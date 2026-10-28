import React, { useCallback, useEffect, useRef, useState } from "react";

export interface StudioStem {
  name: string;
  url: string;
  downloadUrl?: string;
}

interface StudioMixerProps {
  stems: StudioStem[];
  active?: boolean;
  seekRequest?: { time: number; token: number } | null;
  onTimeChange?: (seconds: number) => void;
}

interface TrackState {
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const labelFor = (name: string) => name.replace(/\.wav$/i, "").replace(/[_-]/g, " ");

export default function StudioMixer({ stems, active = true, seekRequest, onTimeChange }: StudioMixerProps) {
  const audioRefs = useRef<Array<HTMLAudioElement | null>>([]);
  const onTimeChangeRef = useRef(onTimeChange);
  const lastUiUpdateRef = useRef(0);

  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);
  const [tracks, setTracks] = useState<Record<string, TrackState>>({});
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (active) return;
    audioRefs.current.forEach(audio => audio?.pause());
    setPlaying(false);
  }, [active]);
  const stemsKey = stems.map((stem) => `${stem.name}:${stem.url}`).join("|");

  useEffect(() => {
    setTracks((previous) => {
      const next: Record<string, TrackState> = {};
      stems.forEach((stem) => {
        next[stem.name] = previous[stem.name] || { muted: false, solo: false, volume: 1, pan: 0 };
      });
      return next;
    });
  // Depend on the actual stem identities rather than the array instance passed by the parent.
  }, [stemsKey]);

  const updateTrack = (name: string, patch: Partial<TrackState>) => {
    setTracks((previous) => ({
      ...previous,
      [name]: { muted: false, solo: false, volume: 1, ...previous[name], ...patch },
    }));
  };

  useEffect(() => {
    const hasSolo = stems.some((stem) => tracks[stem.name]?.solo);
    stems.forEach((stem, index) => {
      const audio = audioRefs.current[index];
      if (!audio) return;
      const track = tracks[stem.name] || { muted: false, solo: false, volume: 1, pan: 0 };
      audio.volume = track.muted || (hasSolo && !track.solo) ? 0 : track.volume;
      audio.playbackRate = speed;
    });
  }, [stemsKey, tracks, speed]);

  const seekAll = useCallback((time: number) => {
    audioRefs.current.forEach((audio) => {
      if (audio && Number.isFinite(audio.duration)) {
        try { audio.currentTime = Math.min(Math.max(0, time), audio.duration); } catch { /* metadata may not be ready */ }
      }
    });
    setCurrentTime(time);
    onTimeChangeRef.current?.(time);
  }, []);

  useEffect(() => {
    if (!seekRequest) return;
    seekAll(seekRequest.time);
  }, [seekRequest?.token, seekRequest?.time, seekAll]);

  const togglePlayback = async () => {
    const audioTracks = audioRefs.current.filter((audio): audio is HTMLAudioElement => Boolean(audio));
    if (!audioTracks.length) return;
    if (playing) {
      audioTracks.forEach((audio) => audio.pause());
      setPlaying(false);
      return;
    }
    setLoadError("");
    // Play HTMLAudioElements directly. Routing remote media through a Web Audio
    // MediaElementSource can silently output zero audio without CORS headers.
    // Direct media playback works with ordinary cross-origin WAV URLs.
    const anchor = audioTracks[0];
    const targetTime = anchor.currentTime;
    audioTracks.forEach((audio) => {
      if (Math.abs(audio.currentTime - targetTime) > 0.18) {
        try { audio.currentTime = targetTime; } catch { /* wait for metadata */ }
      }
    });
    const results = await Promise.allSettled(audioTracks.map((audio) => audio.play()));
    if (results.every((result) => result.status === "rejected")) {
      const firstFailure = results.find((result) => result.status === "rejected");
      const reason = firstFailure?.status === "rejected" && firstFailure.reason instanceof Error ? firstFailure.reason.message : "Check that the files are available.";
      setLoadError(`The stems could not be played: ${reason}`);
      setPlaying(false);
    } else {
      setPlaying(true);
      if (results.some((result) => result.status === "rejected")) setLoadError("Some stems could not be played. Check their audio URLs.");
      results.forEach((result, index) => {
        if (result.status === "rejected") audioTracks[index].pause();
      });
    }
  };

  const syncTime = (source: HTMLAudioElement) => {
    // Do not seek every playing stem on each timeupdate: seeking WAV files
    // repeatedly causes decoder stalls, audible gaps and mobile UI jank.
    // Synchronize only when the user explicitly seeks or starts playback.
    const now = performance.now();
    if (now - lastUiUpdateRef.current < 180) return;
    lastUiUpdateRef.current = now;
    setCurrentTime(source.currentTime);
    onTimeChangeRef.current?.(source.currentTime);
  };

  const resetMix = () => setTracks(Object.fromEntries(stems.map(stem => [stem.name, { muted: false, solo: false, volume: 1, pan: 0 }])));
  const hasSolo = stems.some(stem => tracks[stem.name]?.solo);
  const toggleSolo = (stem: StudioStem) => {
    const wasSolo = Boolean(tracks[stem.name]?.solo);
    updateTrack(stem.name, { solo: !wasSolo, muted: false });
  };

  return (
    <section className="studio-mixer" aria-labelledby="studio-mixer-title">
      <div className="studio-mixer-heading">
        <div>
          <p className="eyebrow">STUDIO MIXER</p>
          <h4 id="studio-mixer-title">Build your own mix</h4>
          <p className="studio-mixer-description">Play stems together in sync, isolate a part, and shape each track’s level.</p>
        </div>
        <div className="stem-heading-actions"><span className="studio-mixer-count">{stems.length} {stems.length === 1 ? "track" : "tracks"}</span><button type="button" className="stem-reset" onClick={resetMix}>Reset mix</button></div>
      </div>

      <div className="studio-transport">
        <button type="button" className="studio-play-button" onClick={() => void togglePlayback()} aria-label={playing ? "Pause all stems" : "Play all stems"}>
          {playing ? "Ⅱ" : "▶"} <span>{playing ? "Pause" : "Play all"}</span>
        </button>
        <span className="studio-time">{formatTime(currentTime)}</span>
        <input
          className="studio-seek"
          aria-label="Seek all stems"
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seekAll(Number(event.target.value))}
        />
        <span className="studio-time">{formatTime(duration)}</span>
        <button type="button" className={loop ? "studio-toggle is-on" : "studio-toggle"} aria-pressed={loop} onClick={() => setLoop((value) => !value)}>Loop</button>
        <label className="studio-speed">Speed
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Playback speed">
            <option value={0.75}>0.75×</option>
            <option value={0.9}>0.9×</option>
            <option value={1}>1×</option>
            <option value={1.1}>1.1×</option>
            <option value={1.25}>1.25×</option>
          </select>
        </label>
      </div>

      {loadError && <p className="studio-mixer-error" role="alert">{loadError}</p>}

      <div className="studio-track-list">
        {stems.map((stem, index) => {
          const track = tracks[stem.name] || { muted: false, solo: false, volume: 1, pan: 0 };
          const audible = !track.muted && (!hasSolo || track.solo);
          const effectiveLevel = audible ? track.volume : 0;
          return (
            <article className={`studio-track stem-channel ${audible ? "is-audible" : "is-silent"}`} key={stem.name} style={{ ["--stem-accent" as string]: ["#5bcdbd", "#bd9cff", "#ffb86b", "#6caeff", "#e48cc9"][index % 5] }}>
              <audio
                ref={(element) => { audioRefs.current[index] = element; }}
                src={stem.url}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const nextDuration = event.currentTarget.duration;
                  if (Number.isFinite(nextDuration)) setDuration((previous) => Math.max(previous, nextDuration));
                }}
                onTimeUpdate={(event) => {
                  const audio = event.currentTarget;
                  if (index === 0) syncTime(audio);
                  if (index === 0 && loop && Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.08) {
                    audioRefs.current.forEach((item) => {
                      if (!item) return;
                      item.currentTime = 0;
                      if (playing) void item.play().catch(() => undefined);
                    });
                    setCurrentTime(0);
                    onTimeChangeRef.current?.(0);
                  }
                }}
                onEnded={() => {
                  if (index === 0 && !loop) {
                    audioRefs.current.forEach((audio) => audio?.pause());
                    setPlaying(false);
                  }
                }}
                onError={() => setLoadError(`Could not load the ${labelFor(stem.name)} stem. Its individual download may still be available.`)}
              />
              <div className="studio-track-name stem-channel-identity">
                <span className={`studio-track-dot studio-dot-${index % 5}`} aria-hidden="true" />
                <strong>{labelFor(stem.name)}</strong>
                <small>{audible ? (track.solo ? "SOLO" : "READY") : "MUTED"} · WAV</small>
              </div>
              <div className="stem-channel-meter" aria-label={`${labelFor(stem.name)} output level ${Math.round(effectiveLevel * 100)} percent`}><span style={{ width: `${effectiveLevel * 100}%` }} /></div>
              <div className="studio-track-controls">
                <button type="button" className={track.muted ? "studio-track-button is-on" : "studio-track-button"} aria-pressed={track.muted} onClick={() => updateTrack(stem.name, { muted: !track.muted })}>Mute</button>
                <button type="button" className={track.solo ? "studio-track-button is-on" : "studio-track-button"} aria-pressed={track.solo} onClick={() => toggleSolo(stem)}>Solo</button>
                <label className="studio-volume-label">Level
                  <input type="range" min={0} max={1} step={0.01} value={track.volume} aria-label={`${labelFor(stem.name)} volume`} onChange={(event) => updateTrack(stem.name, { volume: Number(event.target.value) })} />
                </label>
                <span className="studio-volume-value">{Math.round(track.volume * 100)}%</span>
                {stem.downloadUrl && (
                  <a className="studio-track-download" href={stem.downloadUrl} download aria-label={`Download ${labelFor(stem.name)} stem`}>
                    ↓ Download
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="studio-mixer-footnote">Changes to mute, solo and level are non-destructive. Download each original WAV stem at any time.</p>
    </section>
  );
}
