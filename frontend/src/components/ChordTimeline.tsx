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
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function ChordTimeline({ chords, currentTime, onSeek }: ChordTimelineProps) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = chords.findIndex((segment) => currentTime >= segment.start && currentTime < segment.end);
  const activeChord = activeIndex >= 0 ? chords[activeIndex] : null;

  // Keep the playing chord visible as the song progresses, including on mobile.
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
          {activeChord?.chord || "—"}
        </span>
      </div>

      <div className="current-chord-card" aria-live="polite" aria-atomic="true">
        <span className="current-chord-caption">{activeChord ? "NOW PLAYING" : "CURRENT CHORD"}</span>
        <strong key={activeChord?.chord ?? "no-chord"} className="current-chord-name">
          {activeChord?.chord || "—"}
        </strong>
        <span className="current-chord-time">
          {activeChord ? `${formatTime(activeChord.start)} – ${formatTime(activeChord.end)}` : "Play the song to follow along"}
        </span>
      </div>

      <div ref={timelineRef} className="chord-timeline" role="list" aria-label="Detected chords. Select a chord to seek to its start time.">
        {chords.map((segment, index) => {
          const active = index === activeIndex;
          return (
            <button
              ref={(element) => { segmentRefs.current[index] = element; }}
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
      <p className="chord-disclaimer">The timeline follows playback automatically. Chord estimates can be imperfect, especially in dense mixes.</p>
    </section>
  );
}
