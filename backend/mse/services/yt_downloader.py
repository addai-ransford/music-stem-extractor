import tempfile
import yt_dlp
from backend.mse.interface.downloader import IAudioDownloader

class YTDLDownloader(IAudioDownloader):
    """
    Downloader class to fetch audio from a YouTube video using yt-dlp
    and convert it to WAV format.
    """

    def download(self, url: str) -> str:
        """
        Download the audio from a given YouTube URL as a WAV file.
        Args:
            url (str): The URL of the YouTube video to download.
        Returns:
            str: Path to the downloaded WAV file.
        """

        # Create a temporary directory to store the downloaded audio
        tmp = tempfile.mkdtemp(prefix="ytdl_")
        # Set options for yt-dlp
        opts = {
            "format": "bestaudio/best",  # Download the best available audio
            "outtmpl": f"{tmp}/%(title)s.%(ext)s",  # Save template in temp folder
            "noplaylist": True,  # Ignore playlists, download only the video
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",  # Convert to audio using FFmpeg
                    "preferredcodec": "wav"       # Convert to WAV format
                }
            ]
        }

        # Download the audio using yt-dlp
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

            # Prepare the filename based on info and change extension to .wav
            filename = ydl.prepare_filename(info)
            wav_file = filename.rsplit(".", 1)[0] + ".wav"

            # Return the path to the WAV file
            return wav_file
