import os
from spleeter.separator import Separator
from backend.mse.interface.extractor import IStemExtractor


class SpleeterStemExtractor(IStemExtractor):
    """
    Implementation of IStemExtractor using Spleeter for audio stem separation.
    This class allows splitting an audio file into multiple stems (vocals, accompaniment, etc.)
    using Spleeter.It supports 2, 3, or 4 stems based on user selection and saves the stems
    in a structured output directory.
    Attributes:
        base_output (str): Base folder where stems are saved.Defaults to './data/stems'.
    """

    def __init__(self, base_output: str = "./data/stems"):
        """
        Initializes the SpleeterStemExtractor.
        Args:
            base_output (str): Base output directory to save extracted stems.
        """
        self.base_output = base_output
        os.makedirs(self.base_output, exist_ok=True)

    def extract(self, audio_path: str, stems: int) -> str:
        """
        Extracts stems from the given audio file.
        Args:
            audio_path (str): Path to the input audio file.
            stems (int): Number of stems to extract (2, 3, or 4).
        Returns:
            str: Path to the folder containing extracted stems.
        Raises:
            FileNotFoundError: If the audio file does not exist.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Prepare output folder
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        out_dir = os.path.join(self.base_output, f"{base_name}_{stems}stems")
        os.makedirs(out_dir, exist_ok=True)

        # Initialize Spleeter separator
        sep = Separator(f"spleeter:{stems}stems")
        sep.separate_to_file(audio_path, out_dir)

        # Return the folder containing stems
        for c in os.listdir(out_dir):
            full_path = os.path.join(out_dir, c)
            if os.path.isdir(full_path):
                return full_path

        # Fallback in case Spleeter output folder is different
        return out_dir
