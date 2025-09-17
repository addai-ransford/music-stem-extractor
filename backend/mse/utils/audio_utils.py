import os
import tempfile
import shutil
import subprocess
from fpdf import FPDF
from pydub import AudioSegment


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
    tmp = tempfile.mkdtemp(prefix="vid_")
    out = os.path.join(tmp, "audio.wav")

    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "44100",
        "-ac", "2",
        out
    ], check=True)

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
    base = os.path.splitext(out_zip)[0]
    shutil.make_archive(base, "zip", folder_path)
    return base + ".zip"


def generate_pdf_analysis(chords, output_path: str) -> str:
    """
    Generates a PDF report of chords & melody analysis.
    Args:
        chords (list): List of chords or strings to include in the PDF.
        output_path (str): Path where the PDF will be saved.
    Returns:
        str: Path to the created PDF file.
    """
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="Chord & Melody Analysis", ln=True, align="C")

    for chord in chords:
        pdf.cell(0, 10, txt=str(chord), ln=True)

    pdf.output(output_path)
    return output_path


def mix_audio(inputs: list, output: str):
    """
    Mixes multiple WAV files into a single audio file.
    Args:
        inputs (list): List of input WAV file paths.
        output (str): Path to save the mixed WAV.
    """
    if not inputs:
        raise ValueError("No input files to mix")

    mix = AudioSegment.from_wav(inputs[0])
    for track in inputs[1:]:
        mix = mix.overlay(AudioSegment.from_wav(track))

    mix.export(output, format="wav")


def build_instrumental(stems_folder: str, stems: int) -> str:
    """
    Returns the path to an instrumental track depending on the number of stems.
    If necessary, combine multiple stem files into a new instrumental.wav.
    """
    stems_map = {
        2: ["accompaniment.wav"],
        3: ["drums.wav", "other.wav"],
        4: ["bass.wav", "drums.wav", "other.wav"],
    }

    if stems not in stems_map:
        raise ValueError(f"Unsupported number of stems: {stems}")

    files = [os.path.join(stems_folder, f) for f in stems_map[stems]]

    # If it's just one file (stems=2) → use it directly
    if len(files) == 1:
        return files[0]

    # Otherwise, mix into a new instrumental file
    instrumental_path = os.path.join(stems_folder, "instrumental.wav")
    mix_audio(files, instrumental_path)
    return instrumental_path
