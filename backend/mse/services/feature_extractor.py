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
        """
        Extract chords from an audio file using beat tracking and chroma features.

        Args:
            audio_path (str): Path to the audio file.

        Returns:
            list: List of dictionaries with chord info for each bar.
                  Example: [{"bar": 1, "chord": "C"}, ...]
        """
        y, sr = librosa.load(audio_path, sr=44100)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

        chords = []
        for i in range(len(beats)-1):
            s, e = beats[i], beats[i+1]
            frame = chroma[:, s:e].mean(axis=1)  # Average chroma in this beat
            note = librosa.midi_to_note(60 + int(frame.argmax()))
            chords.append({"bar": i+1, "chord": note})

        return chords

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
