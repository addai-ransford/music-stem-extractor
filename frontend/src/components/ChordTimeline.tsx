import React, { useEffect, useRef } from "react";

export interface ChordSegment {
  start: number;
  end: number;
  chord: string;
  confidence?: number;
}

interface ChordTimelineProps {
  chords: ChordSegment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  originalKey?: string | null;
  transpose: number;
}

const CHROMATIC_NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const NOTE_INDEX: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9,
  "A#": 10, Bb: 10, B: 11, Cb: 11,
};

function transposeChord(chord: string, semitones: number): string {
  if (!semitones || !chord || chord === "N" || chord === "N.C.") return chord;
  return chord.split("/").map((part) => {
    const match = part.match(/^([A-G](?:#|b)?)(.*)$/);
    if (!match || NOTE_INDEX[match[1]] === undefined) return part;
    const index = ((NOTE_INDEX[match[1]] + semitones) % 12 + 12) % 12;
    return `${CHROMATIC_NOTES[index]}${match[2]}`;
  }).join("/");
}

function transposeKey(key: string | null | undefined, semitones: number): string {
  if (!key || !semitones) return key || "—";
  const match = key.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match || NOTE_INDEX[match[1]] === undefined) return key;
  const index = ((NOTE_INDEX[match[1]] + semitones) % 12 + 12) % 12;
  return CHROMATIC_NOTES[index] + match[2];
}


function chordKeyboardInfo(chord: string, transpose: number) {
  if (!chord || chord === "N" || chord === "N.C." || chord === "—") {
    return { notes: [] as string[], inversion: "No chord detected", bass: "" };
  }
  const parts = chord.split("/");
  const match = parts[0].match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match || NOTE_INDEX[match[1]] === undefined) {
    return { notes: [] as string[], inversion: "Inversion unavailable", bass: "" };
  }
  const root = NOTE_INDEX[match[1]];
  const quality = match[2].toLowerCase();
  let intervals = [0, 4, 7];
  if (quality.startsWith("m") && !quality.startsWith("maj")) intervals = [0, 3, 7];
  if (quality.includes("dim")) intervals = [0, 3, 6];
  else if (quality.includes("aug") || quality.includes("+")) intervals = [0, 4, 8];
  else if (quality.includes("sus2")) intervals = [0, 2, 7];
  else if (quality.includes("sus4") || quality === "sus") intervals = [0, 5, 7];
  else if (quality.includes("7")) intervals = quality.includes("maj7") ? [0, 4, 7, 11] : quality.includes("dim7") ? [0, 3, 6, 9] : [0, 4, 7, 10];
  const notes = [...new Set(intervals.map((interval) => CHROMATIC_NOTES[((root + interval + transpose) % 12 + 12) % 12]))];
  const bassMatch = parts.length > 1 ? parts[1].match(/^([A-G](?:#|b)?)/) : null;
  const bassIndex = bassMatch && NOTE_INDEX[bassMatch[1]] !== undefined
    ? (NOTE_INDEX[bassMatch[1]] + transpose + 12) % 12
    : null;
  const rootTransposed = (root + transpose + 12) % 12;
  let inversion = "Inversion not detected";
  if (bassIndex !== null) {
    const chordToneIndex = intervals.findIndex((interval) => (root + interval) % 12 === NOTE_INDEX[bassMatch![1]]);
    inversion = chordToneIndex === 0 ? "Root position (slash bass)" :
      chordToneIndex === 1 ? "1st inversion (slash bass)" :
      chordToneIndex === 2 ? "2nd inversion (slash bass)" :
      "Slash bass detected; inversion uncertain";
  } else if (bassIndex === null && parts.length > 1) {
    inversion = "Slash bass detected; inversion uncertain";
  }
  return { notes, inversion, bass: bassIndex === null ? "" : CHROMATIC_NOTES[bassIndex], root: CHROMATIC_NOTES[rootTransposed] };
}

function PianoKeyboard({ chord, transpose }: { chord: string; transpose: number }) {
  const info = chordKeyboardInfo(chord, transpose);
  const whiteNotes = ["C", "D", "E", "F", "G", "A", "B"];
  const blackNotes = [
    { note: "C♯", left: 1 / 7 }, { note: "D♯", left: 2 / 7 },
    { note: "F♯", left: 4 / 7 }, { note: "G♯", left: 5 / 7 }, { note: "A♯", left: 6 / 7 },
  ];
  const keyLabel = (note: string) => {
    const normalized = note.replace("♯", "#");
    return info.notes.some((item) => item.replace("♯", "#") === normalized);
  };
  return (
    <div className="current-chord-keyboard" aria-label={`Piano keyboard for current chord ${chord}`}>
      <div className="keyboard-heading">
        <span>NOTES IN THIS CHORD</span>
        <strong>{info.notes.length ? info.notes.join(" · ") : "Notes unavailable"}</strong>
      </div>
      <div className="piano-keys" role="img" aria-label={info.notes.length ? `Highlighted notes: ${info.notes.join(", ")}` : "No notes highlighted"}>
        {whiteNotes.map((note) => {
          const highlighted = keyLabel(note);
          return <div className={highlighted ? "piano-key white-key is-highlighted" : "piano-key white-key"} key={note}><span>{note}</span></div>;
        })}
        {blackNotes.map(({ note, left }) => {
          const highlighted = keyLabel(note);
          return <div key={note} className={highlighted ? "piano-key black-key is-highlighted" : "piano-key black-key"} style={{ left: `calc(${left * 100}% - 4.5%)` }}><span>{note}</span></div>;
        })}
      </div>
      <p className="keyboard-inversion">{info.inversion}{info.bass ? ` · Bass: ${info.bass}` : ""}</p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function ChordTimeline({ chords, currentTime, onSeek, originalKey, transpose }: ChordTimelineProps) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = chords.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end);
  const activeChord = activeIndex >= 0 ? chords[activeIndex] : null;

  useEffect(() => {
    if (activeIndex < 0) return;
    const timeline = timelineRef.current;
    const activeElement = segmentRefs.current[activeIndex];
    if (!timeline || !activeElement) return;
    const timelineRect = timeline.getBoundingClientRect();
    const chordRect = activeElement.getBoundingClientRect();
    if (chordRect.left < timelineRect.left || chordRect.right > timelineRect.right) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeIndex]);

  if (!chords.length) {
    return <p className="muted-message">No confident chord segments were detected for this track.</p>;
  }

  return (
    <section className="chord-panel" aria-label="Chord timeline">
      <div className="chord-panel-heading">
        <div><p className="eyebrow">PLAY ALONG</p><h4>Chords & timeline</h4></div>
        <span className="chord-live-label" aria-live="polite" aria-atomic="true">
          {activeChord ? transposeChord(activeChord.chord, transpose) : "—"}
        </span>
      </div>

      <div className="current-chord-card" aria-live="polite" aria-atomic="true">
        <span className="current-chord-caption">{activeChord ? "NOW PLAYING" : "CURRENT CHORD"}</span>
        <strong key={`${activeChord?.chord ?? "no-chord"}-${transpose}`} className="current-chord-name">
          {activeChord ? transposeChord(activeChord.chord, transpose) : "—"}
        </strong>
        <span className="current-chord-time">
          {activeChord ? `${formatTime(activeChord.start)} – ${formatTime(activeChord.end)}` : "Play the song to follow along"}
        </span>
      </div>

      <PianoKeyboard chord={activeChord?.chord ?? "—"} transpose={transpose} />

      <div ref={timelineRef} className="chord-timeline" role="list" aria-label="Detected chords. Select a chord to seek to its start time.">
        {chords.map((segment, index) => {
          const active = index === activeIndex;
          const displayedChord = transposeChord(segment.chord, transpose);
          return (
            <button
              ref={(element) => { segmentRefs.current[index] = element; }}
              className={active ? "chord-segment is-active" : "chord-segment"}
              key={`${segment.start}-${segment.chord}-${index}`}
              type="button"
              role="listitem"
              onClick={() => onSeek(segment.start)}
              aria-label={`${displayedChord}, ${formatTime(segment.start)} to ${formatTime(segment.end)}`}
              aria-pressed={active}
              title={`${formatTime(segment.start)} – ${formatTime(segment.end)}`}
            >
              <strong>{displayedChord}</strong>
              <small>{formatTime(segment.start)}</small>
            </button>
          );
        })}
      </div>
      <p className="chord-disclaimer">The timeline follows playback automatically. Chord estimates can be imperfect, especially in dense mixes.</p>
    </section>
  );
}
