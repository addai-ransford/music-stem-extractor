import React, { useEffect, useRef, useState } from "react";

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

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function ChordTimeline({ chords, currentTime, onSeek, originalKey }: ChordTimelineProps) {
  const [transpose, setTranspose] = useState(0);
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
        <div><p className="eyebrow">PLAY ALONG</p><h4>Chord timeline</h4></div>
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

      <div className="chord-key-summary" aria-label="Original and current key">
        <div><span>ORIGINAL KEY</span><strong>{originalKey || "Not detected"}</strong></div>
        <div><span>CURRENT KEY</span><strong>{transposeKey(originalKey, transpose)}</strong></div>
      </div>

      <div className="transpose-controls" aria-label="Transpose chord display">
        <span className="transpose-label">TRANSPOSE CHORDS</span>
        <div className="transpose-stepper">
          <button type="button" onClick={() => setTranspose((value) => Math.max(-11, value - 1))} disabled={transpose <= -11} aria-label="Transpose down one semitone">−</button>
          <strong>{transpose === 0 ? "Original key" : `${transpose > 0 ? "+" : ""}${transpose} semitone${Math.abs(transpose) === 1 ? "" : "s"}`}</strong>
          <button type="button" onClick={() => setTranspose((value) => Math.min(11, value + 1))} disabled={transpose >= 11} aria-label="Transpose up one semitone">+</button>
          <button type="button" className="transpose-reset" onClick={() => setTranspose(0)} disabled={transpose === 0}>Reset</button>
        </div>
        <small>Changes chord names for your preferred key; the audio itself stays unchanged.</small>
      </div>

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
