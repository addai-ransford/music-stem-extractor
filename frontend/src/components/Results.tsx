import React, { useEffect, useRef, useState } from "react";
import ChordTimeline, { type ChordSegment } from "./ChordTimeline";
import StudioMixer from "./StudioMixer";
import KeyboardStudio from "./KeyboardStudio";

export type SessionView = "Chords" | "Stem Studio" | "MIDI & Remix";

interface ResultDisplayProps {
  jobId: string;
  view: SessionView;
  onStatusChange?: (status: string) => void;
}

interface StemFile {
  name: string;
  url: string;
}

interface StatusMessage {
  status?: unknown;
  error?: unknown;
  result?: { key?: unknown } | null;
}

type JobStatus = "queued" | "downloading" | "extracting" | "key" | "zipping" | "done" | "error" | "unknown";
type SocketState = "connecting" | "connected" | "reconnecting";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  window.location.origin
).replace(/\/$/, "");
const WS_BASE_URL = (
  import.meta.env.VITE_WS_BASE_URL ||
  API_BASE_URL.replace(/^http/, "ws")
).replace(/\/$/, "");

const STEPS: Array<{ id: JobStatus; title: string; description: string }> = [
  { id: "downloading", title: "Preparing audio", description: "Getting your source file ready." },
  { id: "extracting", title: "Separating stems", description: "This is the most intensive step and can take a little while." },
  { id: "key", title: "Detecting musical key", description: "Analysing the instrumental track." },
  { id: "zipping", title: "Packaging downloads", description: "Getting your WAV files ready." },
];

function normalizeStatus(value: unknown): JobStatus {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (status.includes("error") || status.includes("fail")) return "error";
  if (status.includes("done") || status.includes("complete")) return "done";
  if (status.includes("zip") || status.includes("packag")) return "zipping";
  if (status.includes("key") || status.includes("detect")) return "key";
  if (status.includes("extract") || status.includes("separat")) return "extracting";
  if (status.includes("download") || status.includes("saving") || status.includes("prepar")) return "downloading";
  if (status.includes("queue")) return "queued";
  // The API also emits "analyzing" while preparing audio features.
  if (status.includes("analyz")) return "key";
  return "unknown";
}

function getStemDownloadUrl(path: string): string | null {
  // Stem URLs are expected to be API-relative paths. Reject protocol-relative,
  // javascript:, and unrelated absolute URLs rather than turning them into links.
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  try {
    const url = new URL(path, API_BASE_URL);
    const apiOrigin = new URL(API_BASE_URL).origin;
    return url.origin === apiOrigin ? url.toString() : null;
  } catch {
    return null;
  }
}

function statusMessage(status: JobStatus): string {
  if (status === "queued") return "Your job is in the queue.";
  if (status === "unknown") return "Your audio is being processed.";
  return STEPS.find((step) => step.id === status)?.description || "Your audio is being processed.";
}

export default function ResultDisplay({ jobId, view, onStatusChange }: ResultDisplayProps) {
  const [status, setStatus] = useState<JobStatus>("queued");
  const [stemFiles, setStemFiles] = useState<StemFile[]>([]);
  const [error, setError] = useState("");
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<SocketState>("connecting");
  const [filesLoading, setFilesLoading] = useState(false);
  const [chords, setChords] = useState<ChordSegment[]>([]);
  const [chordWarning, setChordWarning] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [mixerSeekRequest, setMixerSeekRequest] = useState<{ time: number; token: number } | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [backingPlaying, setBackingPlaying] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const terminalStatusRef = useRef(false);
  const statusCallbackRef = useRef(onStatusChange);

  useEffect(() => {
    statusCallbackRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    let reconnectAttempts = 0;
    terminalStatusRef.current = false;

    const connect = () => {
      if (disposed || terminalStatusRef.current) return;
      setSocketState(reconnectAttempts > 0 ? "reconnecting" : "connecting");

      try {
        socket = new WebSocket(`${WS_BASE_URL}/ws/status/${encodeURIComponent(jobId)}`);
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        if (disposed) return;
        setSocketState("connected");
        // Do not reset the backoff here: a socket that opens and immediately
        // closes must not create a tight reconnect loop.
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        let data: StatusMessage;
        try {
          data = JSON.parse(event.data) as StatusMessage;
        } catch {
          setError("The processing server sent an unreadable update. Reconnecting…");
          return;
        }

        const nextStatus = normalizeStatus(data.status);
        if (nextStatus !== "unknown") {
          if (nextStatus === "done" || nextStatus === "error") terminalStatusRef.current = true;
          setStatus(nextStatus);
          statusCallbackRef.current?.(nextStatus);
          if (nextStatus !== "error") setError("");
        }

        if (typeof data.error === "string" && data.error.trim()) {
          setError(data.error.trim());
          if (nextStatus === "error") terminalStatusRef.current = true;
        } else if (nextStatus === "error") {
          setError("Audio processing failed. Please try another file or link.");
        }

        if (data.result && typeof data.result.key === "string" && data.result.key.trim()) {
          setDetectedKey(data.result.key.trim());
        }
      };

      socket.onerror = () => {
        if (!disposed) setSocketState("reconnecting");
      };

      socket.onclose = () => {
        if (!disposed && !terminalStatusRef.current) scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (disposed || terminalStatusRef.current || retryTimer) return;
      setSocketState("reconnecting");
      reconnectAttempts += 1;
      const delay = retryDelay + Math.floor(Math.random() * 250);
      retryDelay = Math.min(retryDelay * 2, 15000);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, delay);
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [jobId]);

  useEffect(() => {
    if (status !== "done") return;
    const controller = new AbortController();
    setFilesLoading(true);
    setError("");

    fetch(`${API_BASE_URL}/stems/${encodeURIComponent(jobId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const detail = payload && typeof payload === "object" && typeof (payload as { detail?: unknown }).detail === "string"
            ? (payload as { detail: string }).detail
            : "Could not load generated stem files.";
          throw new Error(detail);
        }
        if (!payload || typeof payload !== "object" || !Array.isArray((payload as { stems?: unknown }).stems)) {
          throw new Error("The server response did not contain a valid stem list.");
        }
        return (payload as { stems: unknown[] }).stems.flatMap((item): StemFile[] => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as { name?: unknown; url?: unknown };
          if (typeof candidate.name !== "string" || !candidate.name.trim() || typeof candidate.url !== "string") return [];
          return [{ name: candidate.name, url: candidate.url }];
        });
      })
      .then((files) => {
        if (!controller.signal.aborted) {
          setStemFiles(files);
          if (files.length === 0) setError("Processing finished, but the server did not return any downloadable WAV stems.");
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setStemFiles([]);
          setError(loadError instanceof Error ? loadError.message : "Could not load stem files.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilesLoading(false);
      });

    return () => controller.abort();
  }, [jobId, status]);

  useEffect(() => {
    if (status !== "done") return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/chords/${encodeURIComponent(jobId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Chord analysis is not available yet.");
        if (!payload || typeof payload !== "object" || !Array.isArray((payload as { chords?: unknown }).chords)) {
          throw new Error("The server returned an invalid chord timeline.");
        }
        const value = payload as { chords: unknown[]; warning?: unknown };
        const parsed = value.chords.flatMap((item): ChordSegment[] => {
          if (!item || typeof item !== "object") return [];
          const chord = item as Partial<ChordSegment>;
          if (typeof chord.start !== "number" || typeof chord.end !== "number" ||
              typeof chord.chord !== "string" || chord.end <= chord.start) return [];
          return [{ start: chord.start, end: chord.end, chord: chord.chord,
            ...(typeof chord.confidence === "number" ? { confidence: chord.confidence } : {}) }];
        });
        if (!controller.signal.aborted) {
          setChords(parsed);
          setChordWarning(typeof value.warning === "string" ? value.warning : "");
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setChords([]);
          setChordWarning(loadError instanceof Error ? loadError.message : "Could not load chord analysis.");
        }
      });
    return () => controller.abort();
  }, [jobId, status]);

  useEffect(() => {
    if (view !== "Chords" && view !== "MIDI & Remix") originalAudioRef.current?.pause();
  }, [view]);

  const toggleBackingTrack = async () => {
    const audio = originalAudioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); }
    catch { setError("Could not play the original audio. Please check the backend audio file."); }
  };

  const seekToChord = (seconds: number) => {
    setCurrentTime(seconds);
    setMixerSeekRequest((previous) => ({ time: seconds, token: (previous?.token ?? 0) + 1 }));
    if (originalAudioRef.current) {
      originalAudioRef.current.currentTime = seconds;
      void originalAudioRef.current.play().catch(() => undefined);
    }
  };

  const downloadZip = () => {
    window.location.assign(`${API_BASE_URL}/download/stems/${encodeURIComponent(jobId)}`);
  };

  const activeStepIndex = STEPS.findIndex((step) => step.id === status);
  const progressPercent = status === "queued" ? 0 : status === "downloading" ? 12 : status === "extracting" ? 45 : status === "key" ? 72 : status === "zipping" ? 90 : 0;
  const activeStepNumber = activeStepIndex >= 0 ? activeStepIndex + 1 : 1;
  const finished = status === "done";
  const failed = status === "error";

  return (
    <section className="job-panel" aria-labelledby="job-panel-title" aria-live="polite">
      {failed ? (
        <div className="job-error">
          <div className="result-icon error-icon" aria-hidden="true">!</div>
          <p className="eyebrow">PROCESSING STOPPED</p>
          <h3 id="job-panel-title">We couldn’t finish this track</h3>
          <p>{error || "The audio could not be processed. Check the file or link and try again."}</p>
          <p className="job-error-help">If you’re using a YouTube link, the video may be unavailable or blocked from downloading. Uploading an audio file is a good alternative.</p>
        </div>
      ) : finished ? (
        <div className="job-success">
          <div className="session-view-heading"><div><p className="eyebrow">{view === "Chords" ? "LEARN & PRACTICE" : view === "Stem Studio" ? "MULTITRACK AUDIO" : "CREATE YOUR OWN PARTS"}</p><h3 id="job-panel-title">{view === "Chords" ? "Follow the chords" : view === "Stem Studio" ? "Separate & mix your tracks" : "Record a MIDI performance"}</h3><p>{view === "Chords" ? "Listen, follow the progression, jump to a chord, and transpose the harmony." : view === "Stem Studio" ? "Play the separated instruments together, mute or solo any part, and download WAV stems." : "Use your computer keyboard, on-screen piano, or a MIDI controller to record a new part."}</p></div></div>
          <div className="session-view-panel" hidden={view !== "Chords"}>
          <section className="daw-session" aria-label="Song session workspace">
            <div className="daw-session-toolbar">
              <div className="daw-session-title">
                <span className="daw-live-dot" aria-hidden="true" />
                <div><p className="eyebrow">SESSION VIEW</p><h4>Arrangement & analysis</h4></div>
              </div>
              <div className="daw-session-meta"><span>STEMS <strong>{stemFiles.length}</strong></span><span>KEY <strong>{detectedKey || "—"}</strong></span><div className="daw-transpose-control" aria-label="Transpose chords"><button type="button" onClick={() => setTranspose(value => Math.max(-11, value - 1))} disabled={transpose <= -11} aria-label="Transpose down one semitone">−</button><span>TRANSPOSE <strong>{transpose === 0 ? "0" : `${transpose > 0 ? "+" : ""}${transpose}`}</strong></span><button type="button" onClick={() => setTranspose(value => Math.min(11, value + 1))} disabled={transpose >= 11} aria-label="Transpose up one semitone">+</button>{transpose !== 0 && <button type="button" className="daw-transpose-reset" onClick={() => setTranspose(0)}>Reset</button>}</div></div>
            </div>
            <audio
              ref={originalAudioRef}
              className="original-audio-player"
              controls
              preload="metadata"
              src={`${API_BASE_URL}/audio/${encodeURIComponent(jobId)}`}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => setBackingPlaying(true)}
              onPause={() => setBackingPlaying(false)}
              onEnded={() => setBackingPlaying(false)}
            >
              Your browser does not support audio playback.
            </audio>
            {chordWarning && <p className="chord-disclaimer" role="status">{chordWarning}</p>}
            <ChordTimeline chords={chords} currentTime={currentTime} onSeek={seekToChord} originalKey={detectedKey} transpose={transpose} />
          </section>
          </div>
          <div className="session-view-panel" hidden={view !== "Stem Studio"}>
          {filesLoading && <p className="muted-message" role="status">Loading your WAV stems…</p>}
          {!filesLoading && !stemFiles.some((stem) => getStemDownloadUrl(stem.url)) && <p className="muted-message" role="status">{error || "No individual stem files were returned. You can still try the full ZIP archive."}</p>}
          {!filesLoading && stemFiles.some((stem) => getStemDownloadUrl(stem.url)) && (
            <>
              <StudioMixer active={view === "Stem Studio"} stems={stemFiles.flatMap((stem) => {
                const url = getStemDownloadUrl(stem.url);
                return url ? [{ name: stem.name, url, downloadUrl: url }] : [];
              })} seekRequest={mixerSeekRequest} onTimeChange={setCurrentTime} />

            </>
          )}
          <button className="secondary-button download-all-button" type="button" onClick={downloadZip}>
            <span aria-hidden="true">⇩</span> Download all stems (.ZIP)
          </button>
          </div>
          <div className="session-view-panel" hidden={view !== "MIDI & Remix"}>
            <div className="remix-guide"><div><strong>Record a performance with your song</strong><p>Start the original backing track, then record your keyboard performance against its timeline.</p></div><button className="studio-play-button" type="button" onClick={() => void toggleBackingTrack()}>{backingPlaying ? "Ⅱ Pause backing" : "▶ Play backing"}</button></div>{error && <p role="alert" className="music-error">{error}</p>}
            <KeyboardStudio currentTime={currentTime} active={view === "MIDI & Remix"} />
            <div className="remix-export-note"><strong>Audio mixdown is not available yet.</strong><p>The existing MIDI recorder exports MIDI note data, not audio. Exporting a finished WAV/MP3 with the stems and your new instrument requires an audio-rendering and mixdown feature.</p></div>
          </div>
        </div>
      ) : (
        <div className="job-progress">
          <div className="progress-heading">
            <div>
              <p className="eyebrow">IN PROGRESS</p>
              <h3 id="job-panel-title">{status === "queued" ? "Preparing your track" : STEPS.find((step) => step.id === status)?.title || "Working on your track"}</h3>
              <p className="progress-description">{status === "queued" ? "Waiting to begin processing…" : `Step ${activeStepNumber} of ${STEPS.length} · ${STEPS.find((step) => step.id === status)?.description || "Processing your audio"}`}</p>
            </div>
            <strong className="progress-percentage">{status === "extracting" ? "Working…" : `${progressPercent}%`}</strong>
          </div>
          <div
            className={`progress-track${status === "extracting" ? " is-indeterminate" : ""}`}
            role="progressbar"
            aria-label="Audio processing progress"
            aria-valuemin={0}
            aria-valuemax={100}
            {...(status === "extracting" ? {} : { "aria-valuenow": progressPercent })}
          >
            <div className="progress-track-fill" style={status === "extracting" ? undefined : { width: `${progressPercent}%` }} />
          </div>
          {status === "extracting" && (
            <style>{`
              .progress-track.is-indeterminate { overflow: hidden; }
              .progress-track.is-indeterminate .progress-track-fill {
                width: 38%;
                height: 100%;
                animation: stemlab-progress-sweep 1.6s ease-in-out infinite;
              }
              @keyframes stemlab-progress-sweep {
                0% { transform: translateX(-110%); }
                100% { transform: translateX(280%); }
              }
              @media (prefers-reduced-motion: reduce) {
                .progress-track.is-indeterminate .progress-track-fill { animation: none; transform: translateX(80%); }
              }
            `}</style>
          )}
          <p className="progress-live-note" role="status">
            <span className="progress-pulse" aria-hidden="true"><span /></span>
            {socketState === "reconnecting" ? "Reconnecting to live updates…" : status === "extracting" ? "Separating your audio layers…" : "Working on your track…"}
          </p>
        </div>
      )}
    </section>
  );
}
