import os
import tempfile
from pathlib import Path

import yt_dlp

from backend.mse.interface.downloader import IAudioDownloader


class YTDLDownloader(IAudioDownloader):
    """Download audio with yt-dlp, optionally using operator-provided cookies.

    YouTube may require an authenticated session for some requests. In production,
    provide a valid Netscape-format cookies file through YOUTUBE_COOKIES_FILE,
    ideally mounted from the deployment platform's secret manager. Never commit
    cookies to the repository or log their contents.
    """

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
            # YouTube increasingly requires JavaScript challenge solving to expose formats.
            "js_runtimes": {"deno": {}},
            "remote_components": ["ejs:npm"],
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                }
            ],
        }

        cookies_file = os.environ.get("YOUTUBE_COOKIES_FILE", "").strip()
        if cookies_file:
            cookie_path = Path(cookies_file).expanduser()
            if not cookie_path.is_file():
                raise RuntimeError(
                    "YouTube cookie authentication is configured, but "
                    "YOUTUBE_COOKIES_FILE does not point to a readable file. "
                    "Mount a valid Netscape-format cookies file from your "
                    "deployment secret manager, or upload an audio file instead."
                )
            opts["cookiefile"] = str(cookie_path)

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if not info:
                    raise RuntimeError("YouTube did not return video information.")

                filename = Path(ydl.prepare_filename(info))
                wav_file = filename.with_suffix(".wav")
                if not wav_file.is_file():
                    # yt-dlp's output template may resolve to a different
                    # extension after post-processing; find the produced WAV.
                    candidates = list(Path(tmp).glob("*.wav"))
                    if not candidates:
                        raise RuntimeError(
                            "yt-dlp finished without producing an audio WAV file."
                        )
                    wav_file = candidates[0]
                return str(wav_file)
        except Exception as exc:
            message = str(exc)
            lower_message = message.lower()
            if (
                "sign in to confirm you're not a bot" in lower_message
                or "use --cookies-from-browser" in lower_message
                or "confirm you're not a bot" in lower_message
            ):
                if cookies_file:
                    guidance = (
                        "YouTube rejected the configured session cookies. "
                        "Refresh the YOUTUBE_COOKIES_FILE secret with a valid, "
                        "recent Netscape-format cookies export, and ensure it "
                        "belongs to an account allowed to access this video."
                    )
                else:
                    guidance = (
                        "This YouTube request requires an authenticated session. "
                        "For production, configure YOUTUBE_COOKIES_FILE with a "
                        "valid Netscape-format cookies file mounted from your "
                        "secret manager. Do not commit cookies to GitHub. "
                        "If you cannot provide authorized cookies, upload the "
                        "audio file directly instead."
                    )
                raise RuntimeError(guidance) from exc
            if "requested format is not available" in lower_message:
                guidance = (
                    "YouTube did not provide a downloadable audio format for this video. "
                    "The video may be restricted or unavailable, or YouTube may have "
                    "changed its streaming response. Try another public video or upload "
                    "an audio file instead."
                )
                raise RuntimeError(guidance) from exc
            raise RuntimeError(f"Could not download audio from YouTube: {message}") from exc
