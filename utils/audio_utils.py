import os
import tempfile
import shutil
import subprocess


def extract_audio_from_video(video_path: str) -> str:
    """
    Extracts audio from a video file and saves it as a WAV file.
    Args:
        video_path (str): Path to the input video file.
    Returns:
        str: Path to the extracted audio WAV file.
    Notes:
        - Uses ffmpeg for extraction.
        - Creates a temporary folder to store the output audio.
        - Audio is converted to 16-bit PCM, 44.1 kHz, stereo.
    """
    # Create a temporary directory to store the extracted audio
    tmp = tempfile.mkdtemp(prefix="vid_")
    out = os.path.join(tmp, "audio.wav")

    # Run ffmpeg to extract audio from the video
    subprocess.run([
        "ffmpeg", "-y",  # Overwrite output file if exists
        "-i", video_path,  # Input video file
        "-vn",  # Disable video recording
        "-acodec", "pcm_s16le",  # Audio codec: 16-bit PCM
        "-ar", "44100",  # Sampling rate: 44.1 kHz
        "-ac", "2",  # Channels: stereo
        out
    ], check=True)

    # Return a path to extracted audio
    return out


def safe_zip_folder(folder_path: str, out_zip: str) -> str:
    """
    Safely compresses a folder into a ZIP archive.
    Args:
        folder_path (str): Path to the folder to compress.
        out_zip (str): Desired path for the output ZIP file (can include .zip extension).
    Returns:
        str: Path to the created ZIP file.
    """
    # Remove extension if present to use as base name for archive
    base = os.path.splitext(out_zip)[0]

    # Create ZIP archive from folder
    shutil.make_archive(base, "zip", folder_path)

    # Return  path to the ZIP file
    return base + ".zip"
