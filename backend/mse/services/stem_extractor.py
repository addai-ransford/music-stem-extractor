import os
import shutil
import uuid
from pathlib import Path

from spleeter.model.provider import ModelProvider
from spleeter.separator import Separator
from spleeter.utils.configuration import load_configuration
from backend.mse.interface.extractor import IStemExtractor


class SpleeterStemExtractor(IStemExtractor):
    """
    Separate audio with Spleeter and save each job into a clean, isolated
    output directory. Isolating runs prevents stale stems from a previous
    upload with the same filename from being returned as current results.
    """

    EXPECTED_STEMS = {
        2: {"vocals.wav", "accompaniment.wav"},
        4: {"vocals.wav", "bass.wav", "drums.wav", "other.wav"},
        5: {"vocals.wav", "bass.wav", "drums.wav", "piano.wav", "other.wav"},
    }

    @staticmethod
    def _ensure_model_checkpoint(stems: int) -> None:
        configuration = load_configuration(f"spleeter:{stems}stems")
        model_name = configuration["model_dir"]
        model_dir = Path(model_name)
        if not model_dir.is_absolute():
            model_dir = Path(ModelProvider.DEFAULT_MODEL_PATH) / model_dir

        def has_checkpoint() -> bool:
            return (
                (model_dir / "checkpoint").is_file()
                and (model_dir / "model.index").is_file()
                and any(model_dir.glob("model.data-*"))
            )

        if has_checkpoint():
            return

        if model_dir.exists():
            try:
                # Spleeter's provider skips downloads when an empty cache
                # directory already exists.
                model_dir.rmdir()
            except OSError as exc:
                raise RuntimeError(
                    f"The Spleeter {stems}-stem model cache is incomplete at "
                    f"{model_dir}. Remove or restore that cache, then retry."
                ) from exc

        ModelProvider.default().get(model_name)
        if not has_checkpoint():
            raise RuntimeError(
                f"The Spleeter {stems}-stem model checkpoint is missing from "
                f"{model_dir} after download."
            )

    def __init__(self, base_output: str | None = None):
        data_dir = os.environ.get("DATA_DIR", "./data")
        self.base_output = (
            base_output if base_output is not None else os.path.join(data_dir, "stems")
        )
        os.makedirs(self.base_output, exist_ok=True)

    def extract(self, audio_path: str, stems: int) -> str:
        if not os.path.isfile(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        if stems not in self.EXPECTED_STEMS:
            raise ValueError("Stem count must be 2, 4, or 5.")

        # A unique run directory prevents old files from a previous run being
        # mixed into the results when uploads share a filename.
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        run_id = uuid.uuid4().hex
        out_dir = os.path.join(self.base_output, f"{base_name}_{stems}stems_{run_id}")
        os.makedirs(out_dir, exist_ok=False)

        try:
            self._ensure_model_checkpoint(stems)
            separator = Separator(f"spleeter:{stems}stems")
            separator.separate_to_file(audio_path, out_dir, codec="wav")

            # Spleeter writes to a nested directory named after the input file.
            nested_dir = os.path.join(out_dir, base_name)
            result_dir = nested_dir if os.path.isdir(nested_dir) else out_dir

            actual_wavs = {
                name.lower()
                for name in os.listdir(result_dir)
                if name.lower().endswith(".wav")
                and os.path.isfile(os.path.join(result_dir, name))
            }
            expected = self.EXPECTED_STEMS[stems]
            missing = expected - actual_wavs
            if missing:
                raise RuntimeError(
                    f"Spleeter did not produce the expected {stems}-stem separation. "
                    f"Missing: {', '.join(sorted(missing))}. "
                    "Please check that the correct Spleeter model is installed and try again."
                )

            return result_dir
        except Exception:
            # Do not leave a partial result that could later be mistaken for a
            # successful separation.
            shutil.rmtree(out_dir, ignore_errors=True)
            raise
