import shutil
import tempfile
import traceback
from pathlib import Path

import yt_dlp

from backend.mse.interface.downloader import IAudioDownloader


class YTDLDownloader(IAudioDownloader):
    """Download audio with yt-dlp into a temporary directory.

    The downloaded audio is kept only until its processing job completes.
    """

    @staticmethod
    def cleanup(audio_path: str) -> None:
        temporary_dir = Path(audio_path).parent
        if (
            not temporary_dir.name.startswith("ytdl_")
            or temporary_dir.parent.resolve() != Path(tempfile.gettempdir()).resolve()
        ):
            raise ValueError("YouTube audio path is outside its temporary directory.")
        shutil.rmtree(temporary_dir)

    def download(self, url: str) -> str:
        """Download the best available audio and convert it to WAV."""
        tmp = tempfile.mkdtemp(prefix="ytdl_")
        output_template = str(Path(tmp) / "source.%(ext)s")

        opts = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "noplaylist": True,
            "restrictfilenames": True,
            "quiet": True,
            "no_warnings": True,
            "cachedir": False,
            # YouTube now often hides playable formats behind JS challenge pages.
            # Provide the Deno runtime so yt-dlp can solve EJS challenges.
            "js_runtimes": {"deno": {}},
            "remote_components": ["ejs:npm"],
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                }
            ],
        }

        keep_temporary_audio = False
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)

                if not info:
                    raise RuntimeError(
                        "YouTube did not return video information."
                    )

                filename = Path(ydl.prepare_filename(info))
                wav_file = filename.with_suffix(".wav")

                if not wav_file.is_file():
                    # yt-dlp may use a different extension after post-processing.
                    candidates = list(Path(tmp).glob("*.wav"))

                    if not candidates:
                        raise RuntimeError(
                            "yt-dlp finished without producing an audio WAV file."
                        )

                    wav_file = candidates[0]

                if wav_file.stat().st_size <= 0:
                    raise RuntimeError("yt-dlp produced an empty audio WAV file.")

                keep_temporary_audio = True
                return str(wav_file)

        except Exception as exc:
            print(
                "YOUTUBE DOWNLOAD FAILURE:",
                repr(exc),
                flush=True,
            )
            traceback.print_exc()
            raise RuntimeError(
                f"Could not download audio from YouTube: {exc}"
            ) from exc
        finally:
            if not keep_temporary_audio:
                shutil.rmtree(tmp, ignore_errors=True)
