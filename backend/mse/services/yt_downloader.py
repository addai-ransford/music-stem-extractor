import hashlib
import os
import shutil
import tempfile
import threading
import time
import traceback
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import yt_dlp

from backend.mse.interface.downloader import IAudioDownloader


class YTDLDownloader(IAudioDownloader):
    """Download audio with yt-dlp, optionally using operator-provided cookies.

    YouTube may require an authenticated session for some requests. In production,
    provide a valid Netscape-format cookies file through YOUTUBE_COOKIES_FILE,
    ideally mounted from the deployment platform's secret manager. Never commit
    cookies to the repository or log their contents. Downloaded audio is cached
    locally for a limited time; Cloud Run cache files disappear when an instance
    is recycled.
    """

    CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
    CACHE_MAX_BYTES = 1024 * 1024 * 1024
    _cache_lock = threading.Lock()

    @staticmethod
    def _cache_directory() -> Path:
        configured_dir = os.environ.get("YOUTUBE_AUDIO_CACHE_DIR", "").strip()
        if configured_dir:
            return Path(configured_dir).expanduser()
        data_dir = os.environ.get("DATA_DIR", "./data")
        return Path(data_dir) / "youtube-cache"

    @staticmethod
    def _cache_key(url: str, cookie_fingerprint: str = "") -> str:
        parsed = urlsplit(url.strip())
        host = (parsed.hostname or "").lower()
        path_parts = [part for part in parsed.path.split("/") if part]
        query = parse_qs(parsed.query)
        youtube_hosts = {
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "music.youtube.com",
            "youtu.be",
            "www.youtu.be",
        }
        video_id = None
        if host in youtube_hosts:
            video_id = query.get("v", [None])[0]
            if host in {"youtu.be", "www.youtu.be"} and path_parts:
                video_id = path_parts[0]
            elif path_parts and path_parts[0] in {"shorts", "embed", "live"}:
                if len(path_parts) > 1:
                    video_id = path_parts[1]

        cache_identity = (
            f"youtube:{video_id}"
            if video_id
            else f"{parsed.scheme.lower()}://{host}{parsed.path}?{parsed.query}"
        )
        cache_identity = f"{cache_identity}:{cookie_fingerprint}"
        return hashlib.sha256(cache_identity.encode("utf-8")).hexdigest()

    def _prune_cache(self, cache_dir: Path) -> None:
        now = time.time()
        cached_files = [
            path
            for path in cache_dir.glob("*.wav")
            if path.is_file()
        ]
        for path in cached_files:
            try:
                if now - path.stat().st_mtime > self.CACHE_TTL_SECONDS:
                    path.unlink()
            except FileNotFoundError:
                continue

        cached_files = sorted(
            (path for path in cache_dir.glob("*.wav") if path.is_file()),
            key=lambda path: path.stat().st_mtime,
        )
        total_bytes = sum(path.stat().st_size for path in cached_files)
        while total_bytes > self.CACHE_MAX_BYTES and cached_files:
            oldest = cached_files.pop(0)
            try:
                size = oldest.stat().st_size
                oldest.unlink()
                total_bytes -= size
            except FileNotFoundError:
                continue

    def download(self, url: str) -> str:
        """Download the best available audio and convert it to WAV."""
        cookies_file = os.environ.get("YOUTUBE_COOKIES_FILE", "").strip()
        cookie_contents = b""
        cookie_fingerprint = ""
        if cookies_file:
            cookie_path = Path(cookies_file).expanduser()
            if not cookie_path.is_file():
                raise RuntimeError("YouTube cookie file is missing or unreadable.")
            try:
                cookie_contents = cookie_path.read_bytes()
            except OSError as exc:
                raise RuntimeError(
                    "YouTube cookie file is missing or unreadable."
                ) from exc
            cookie_fingerprint = hashlib.sha256(cookie_contents).hexdigest()

        cache_dir = self._cache_directory()
        cache_key = self._cache_key(url, cookie_fingerprint)
        cached_wav = cache_dir / f"{cache_key}.wav"
        cache_dir.mkdir(parents=True, exist_ok=True)

        with self._cache_lock:
            self._prune_cache(cache_dir)
            if cached_wav.is_file() and cached_wav.stat().st_size > 0:
                os.utime(cached_wav, None)
                return str(cached_wav)

            tmp = tempfile.mkdtemp(prefix="ytdl_", dir=cache_dir)
            output_template = str(Path(tmp) / "source.%(ext)s")

            opts = {
                "format": "bestaudio/best",
                "outtmpl": output_template,
                "noplaylist": True,
                "restrictfilenames": True,
                "quiet": True,
                "no_warnings": True,
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

            if cookies_file:
                # Secret Manager mounts are read-only.
                # Copy the cookie file into writable /tmp so yt-dlp can save updates.
                writable_cookie_file = Path(tmp) / "youtube-cookies.txt"
                writable_cookie_file.write_bytes(cookie_contents)

                opts["cookiefile"] = str(writable_cookie_file)

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

                    if wav_file.stat().st_size > self.CACHE_MAX_BYTES:
                        keep_temporary_audio = True
                        return str(wav_file)

                    os.replace(wav_file, cached_wav)
                    os.utime(cached_wav, None)
                    self._prune_cache(cache_dir)
                    return str(cached_wav)

            except Exception as exc:
                message = str(exc)
                lower_message = message.lower()

                # Temporary diagnostics. These do not print cookie contents.
                print(
                    "YOUTUBE DOWNLOAD FAILURE:",
                    repr(exc),
                    flush=True,
                )
                traceback.print_exc()

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
                        "The video may be restricted, unavailable, or blocked by a regional "
                        "or age restriction. Try another public video or upload an audio file "
                        "instead."
                    )
                    raise RuntimeError(guidance) from exc

                raise RuntimeError(
                    f"Could not download audio from YouTube: {message}"
                ) from exc
            finally:
                if not keep_temporary_audio:
                    shutil.rmtree(tmp, ignore_errors=True)
