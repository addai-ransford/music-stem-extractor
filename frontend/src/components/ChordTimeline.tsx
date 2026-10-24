import React from "react";

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
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function ChordTimeline({ chords, currentTime, onSeek }: ChordTimelineProps) {
  if (!chords.length) {
    return <p className="muted-message">No confident chord segments were detected for this track.</p>;
  }

  const activeIndex = chords.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end);
  return (
    <section className="chord-panel" aria-label="Chord timeline">
      <div className="chord-panel-heading">
        <div><p className="eyebrow">PLAY ALONG</p><h4>Chord timeline</h4></div>
        <span className="chord-live-label">{activeIndex >= 0 ? chords[activeIndex].chord : "—"}</span>
      </div>
      <div className="chord-timeline" role="list" aria-label="Detected chords. Select a chord to seek to its start time.">
        {chords.map((segment, index) => {
          const active = index === activeIndex;
          return (
            <button
              className={active ? "chord-segment is-active" : "chord-segment"}
              key={`${segment.start}-${segment.chord}-${index}`}
              type="button"
              role="listitem"
              onClick={() => onSeek(segment.start)}
              aria-label={`${segment.chord}, ${formatTime(segment.start)} to ${formatTime(segment.end)}`}
              aria-pressed={active}
              title={`${formatTime(segment.start)} – ${formatTime(segment.end)}`}
            >
              <strong>{segment.chord}</strong>
              <small>{formatTime(segment.start)}</small>
            </button>
          );
        })}
      </div>
      <p className="chord-disclaimer">Automatic chord estimates can be imperfect, especially in dense mixes.</p>
    </section>
  );
}
