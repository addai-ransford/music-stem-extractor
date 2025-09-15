import librosa
import numpy as np

from backend.mse.interface.feature import IFeatureExtractor


class LibrosaFeatureExtractor(IFeatureExtractor):
    NOTE_TO_SOLFEGE = {"C":"Do","C#":"Di/Re♭","D":"Re","D#":"Ri/Mi♭","E":"Mi","F":"Fa","F#":"Fi/Sol♭","G":"Sol","G#":"Si/La♭","A":"La","A#":"Li/Ti♭","B":"Ti"}

    def detect_key(self, audio_path: str) -> str:
        y, sr = librosa.load(audio_path, sr=44100)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
        major = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
        minor = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
        scores = []
        for i in range(12):
            scores.append((i,"major", float(np.correlate(np.roll(major,i), chroma))))
            scores.append((i,"minor", float(np.correlate(np.roll(minor,i), chroma))))
        best = max(scores, key=lambda x: x[2])
        return librosa.midi_to_note(60+best[0])[:-1] + f" {best[1]}"

    def extract_chords(self, audio_path: str):
        y, sr = librosa.load(audio_path, sr=44100)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chords = []
        for i in range(len(beats)-1):
            s,e = beats[i], beats[i+1]
            frame = chroma[:,s:e].mean(axis=1)
            note = librosa.midi_to_note(60 + int(frame.argmax()))
            chords.append({"bar":i+1,"chord":note})
        return chords

    def extract_melody(self, audio_path: str):
        y, sr = librosa.load(audio_path, sr=44100)
        pitches, mags = librosa.piptrack(y=y, sr=sr)
        melody = []
        for t in range(pitches.shape[1]):
            idx = mags[:,t].argmax()
            p = pitches[idx,t]
            if p>0:
                note = librosa.midi_to_note(librosa.hz_to_midi(p))
                sol = self.NOTE_TO_SOLFEGE.get(note[:-1], note)
                melody.append(sol)
        return melody[::10]
