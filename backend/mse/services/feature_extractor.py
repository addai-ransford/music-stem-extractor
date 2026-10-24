import librosa
import numpy as np

from backend.mse.interface.feature import IFeatureExtractor


class LibrosaFeatureExtractor(IFeatureExtractor):
    """
    Feature extractor using librosa to analyze audio files.
    Provides key detection, chord extraction, and melody extraction.
    """

    # Mapping from musical notes to solfège notation
    NOTE_TO_SOLFEGE = {
        "C": "Do", "C#": "Di/Re♭", "D": "Re", "D#": "Ri/Mi♭", "E": "Mi",
        "F": "Fa", "F#": "Fi/Sol♭", "G": "Sol", "G#": "Si/La♭", "A": "La",
        "A#": "Li/Ti♭", "B": "Ti"
    }

    def detect_key(self, audio_path: str) -> str:
        """
        Estimate the global musical key from harmonic audio.

        Uses harmonic-percussive separation, frame-wise chroma normalization,
        and Pearson correlation against Krumhansl-Schmuckler major/minor
        profiles. Analysing multiple frames reduces the influence of short
        percussion hits and loud isolated notes.

        Note: audio-only key detection is an estimate, especially for short,
        noisy, modal, or heavily syncopated recordings.
        """
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        if y.size == 0 or not np.isfinite(y).all() or float(np.max(np.abs(y))) < 1e-6:
            raise ValueError("Cannot detect musical key from an empty or silent audio file.")

        # A harmonic signal is more useful for key estimation than the full mix.
        harmonic, _ = librosa.effects.hpss(y)
        if float(np.max(np.abs(harmonic))) < 1e-6:
            harmonic = y

        # CQT chroma works well across different octaves. Keep time frames
        # instead of averaging first so transient/silent frames can be ignored.
        chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=2048)
        frame_energy = librosa.feature.rms(y=harmonic, frame_length=8192, hop_length=2048)[0]

        # Align frame counts defensively, then exclude near-silent frames.
        frame_count = min(chroma.shape[1], frame_energy.shape[0])
        chroma = chroma[:, :frame_count]
        frame_energy = frame_energy[:frame_count]
        if frame_count == 0:
            raise ValueError("Not enough audio to estimate a musical key.")

        active = frame_energy > max(float(frame_energy.max()) * 0.08, 1e-5)
        if not np.any(active):
            raise ValueError("Not enough audible harmonic content to estimate a musical key.")

        active_chroma = chroma[:, active]
        # Normalize each frame so loud sections do not dominate only by volume.
        active_chroma = active_chroma / (np.linalg.norm(active_chroma, axis=0, keepdims=True) + 1e-8)
        # Slightly weight louder active frames while limiting extreme dynamics.
        weights = np.sqrt(frame_energy[active])
        weights = weights / (weights.mean() + 1e-8)
        weights = np.clip(weights, 0.5, 2.0)
        profile = np.average(active_chroma, axis=1, weights=weights)
        profile = (profile - profile.mean()) / (profile.std() + 1e-8)

        # Krumhansl-Kessler key profiles, in C-to-B pitch-class order.
        major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                          2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=float)
        minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                          2.54, 4.75, 3.98, 2.69, 3.34, 3.17], dtype=float)

        note_names = ["C", "C#", "D", "D#", "E", "F",
                      "F#", "G", "G#", "A", "A#", "B"]
        scores = []
        for mode, base_profile in (("major", major), ("minor", minor)):
            normalized_profile = (base_profile - base_profile.mean()) / base_profile.std()
            for tonic in range(12):
                # Rotating right aligns the profile's tonic with this pitch class.
                candidate = np.roll(normalized_profile, tonic)
                score = float(np.corrcoef(profile, candidate)[0, 1])
                if np.isfinite(score):
                    scores.append((score, tonic, mode))

        if not scores:
            raise ValueError("Musical key estimation was inconclusive for this audio.")
        _, tonic, mode = max(scores, key=lambda item: item[0])
        return f"{note_names[tonic]} {mode}"

    def extract_chords(self, audio_path: str):
        """Estimate timestamped major/minor chords from the full audio mix.

        Returns segments with start/end seconds, chord label, and a relative
        template-match confidence. This is a lightweight estimate, not a
        transcription guarantee.
        """
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        if y.size == 0 or not np.isfinite(y).all() or float(np.max(np.abs(y))) < 1e-6:
            return []

        harmonic, _ = librosa.effects.hpss(y)
        if float(np.max(np.abs(harmonic))) < 1e-6:
            harmonic = y

        hop_length = 512
        chroma = librosa.feature.chroma_cqt(
            y=harmonic, sr=sr, hop_length=hop_length, n_chroma=12
        )
        energy = librosa.feature.rms(
            y=harmonic, frame_length=2048, hop_length=hop_length
        )[0]
        frame_count = min(chroma.shape[1], energy.shape[0])
        chroma, energy = chroma[:, :frame_count], energy[:frame_count]
        if frame_count == 0 or float(energy.max()) < 1e-6:
            return []

        # Normalized pitch-class templates for all 24 major/minor triads.
        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        templates = []
        labels = []
        for root, name in enumerate(note_names):
            for mode, intervals in (("", (0, 4, 7)), ("m", (0, 3, 7))):
                template = np.zeros(12, dtype=float)
                template[(root + np.array(intervals)) % 12] = 1.0
                templates.append(template / np.linalg.norm(template))
                labels.append(name + mode)
        templates = np.asarray(templates)

        # Score short overlapping windows so chord changes receive timestamps.
        frames_per_window = max(1, int(round(0.45 * sr / hop_length)))
        frame_labels = []
        frame_confidences = []
        for index in range(frame_count):
            left = max(0, index - frames_per_window // 2)
            right = min(frame_count, index + frames_per_window // 2 + 1)
            vector = chroma[:, left:right].mean(axis=1)
            norm = np.linalg.norm(vector)
            if energy[index] < max(float(energy.max()) * 0.06, 1e-5) or norm < 1e-8:
                frame_labels.append("N")
                frame_confidences.append(0.0)
                continue
            vector = vector / norm
            scores = templates @ vector
            best = int(np.argmax(scores))
            frame_labels.append(labels[best])
            frame_confidences.append(float(scores[best]))

        # Collapse frame labels into readable segments, then merge brief blips.
        runs = []
        for index, label in enumerate(frame_labels):
            if runs and runs[-1]["chord"] == label:
                runs[-1]["end_frame"] = index + 1
                runs[-1]["confidence_sum"] += frame_confidences[index]
                runs[-1]["count"] += 1
            else:
                runs.append({
                    "chord": label, "start_frame": index, "end_frame": index + 1,
                    "confidence_sum": frame_confidences[index], "count": 1,
                })

        min_frames = max(2, int(round(0.18 * sr / hop_length)))
        for i in range(1, len(runs) - 1):
            if runs[i]["end_frame"] - runs[i]["start_frame"] < min_frames:
                if runs[i - 1]["chord"] == runs[i + 1]["chord"]:
                    runs[i - 1]["end_frame"] = runs[i + 1]["end_frame"]
                    runs[i - 1]["confidence_sum"] += runs[i]["confidence_sum"] + runs[i + 1]["confidence_sum"]
                    runs[i - 1]["count"] += runs[i]["count"] + runs[i + 1]["count"]
                    runs[i + 1]["chord"] = None
        runs = [run for run in runs if run["chord"] is not None]

        segments = []
        for run in runs:
            if run["chord"] == "N":
                continue
            start_time = run["start_frame"] * hop_length / sr
            end_time = min(len(y) / sr, run["end_frame"] * hop_length / sr)
            if end_time <= start_time:
                continue
            segments.append({
                "start": round(start_time, 3),
                "end": round(end_time, 3),
                "chord": run["chord"],
                "confidence": round(run["confidence_sum"] / max(1, run["count"]), 3),
            })
        return segments

    def extract_melody(self, audio_path: str):
        """
        Extract a simplified melody line from an audio file using pitch tracking.
        Converts detected notes to solfège notation.

        Args:
            audio_path (str): Path to the audio file.

        Returns:
            list: List of solfège notes representing the melody.
        """
        y, sr = librosa.load(audio_path, sr=44100)
        pitches, mags = librosa.piptrack(y=y, sr=sr)

        melody = []
        for t in range(pitches.shape[1]):
            idx = mags[:, t].argmax()
            p = pitches[idx, t]
            if p > 0:
                note = librosa.midi_to_note(librosa.hz_to_midi(p))
                sol = self.NOTE_TO_SOLFEGE.get(note[:-1], note)  # Convert to solfège
                melody.append(sol)

        return melody[::10]  # Return every 10th note to simplify the melody
