import React, { useEffect, useRef, useState } from "react";
import ChordTimeline, { type ChordSegment } from "./ChordTimeline";
import StudioMixer from "./StudioMixer";
import KeyboardStudio from "./KeyboardStudio";

interface ResultDisplayProps {
  jobId: string;
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

export default function ResultDisplay({ jobId, onStatusChange }: ResultDisplayProps) {
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
          <div className="result-icon success-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">READY TO DOWNLOAD</p>
          <h3 id="job-panel-title">Your stems are ready</h3>
          {detectedKey && (
            <div className="key-result">
              <span>Detected musical key</span>
              <strong>{detectedKey}</strong>
            </div>
          )}
          <div className="track-session-heading">
            <div><p className="eyebrow">YOUR SESSION</p><p className="results-copy">Your track has been separated. Preview each layer below, then download the stems you want.</p></div>
            <span className="session-ready"><span aria-hidden="true">●</span> Ready</span>
          </div>
          <section className="original-player-panel" aria-label="Original full song player">
            <div className="chord-panel-heading">
              <div><p className="eyebrow">ORIGINAL MIX</p><h4>Listen & follow chords</h4></div>
              <span className="chord-live-label">{chords.find((item) => currentTime >= item.start && currentTime < item.end)?.chord || "—"}</span>
            </div>
            <audio
              ref={originalAudioRef}
              className="original-audio-player"
              controls
              preload="metadata"
              src={`${API_BASE_URL}/audio/${encodeURIComponent(jobId)}`}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
            >
              Your browser does not support audio playback.
            </audio>
            {chordWarning && <p className="chord-disclaimer" role="status">{chordWarning}</p>}
            <ChordTimeline chords={chords} currentTime={currentTime} onSeek={seekToChord} originalKey={detectedKey} />
          </section>
          {filesLoading && <p className="muted-message" role="status">Loading your WAV stems…</p>}\n          {!filesLoading && !stemFiles.some((stem) => getStemDownloadUrl(stem.url)) && <p className="muted-message" role="status">{error || "No individual stem files were returned. You can still try the full ZIP archive."}</p>}\n          {!filesLoading && stemFiles.some((stem) => getStemDownloadUrl(stem.url)) && (
            <>
              <StudioMixer stems={stemFiles.flatMap((stem) => {
                const url = getStemDownloadUrl(stem.url);
                return url ? [{ name: stem.name, url, downloadUrl: url }] : [];
              })} seekRequest={mixerSeekRequest} onTimeChange={setCurrentTime} />
              <KeyboardStudio currentTime={currentTime} />
            </>
          )}
          <button className="secondary-button download-all-button" type="button" onClick={downloadZip}>
            <span aria-hidden="true">⇩</span> Download all stems (.ZIP)
          </button>
        </div>
      ) : (
        <div className="job-progress">
          <div className="progress-heading">
            <div>
              <p className="eyebrow">IN PROGRESS</p>
              <h3 id="job-panel-title">{status === "queued" ? "Your track is in the queue" : STEPS.find((step) => step.id === status)?.title || "Working on your track"}</h3>
            </div>
            <span className="progress-pulse" aria-hidden="true"><span /></span>
          </div>
          <p className="progress-description">{socketState === "reconnecting" ? "Reconnecting to live updates. Processing may continue in the background." : statusMessage(status)}</p>
          <ol className="progress-steps">
            {STEPS.map((step, index) => {
              const complete = activeStepIndex >= 0 && index < activeStepIndex;
              const active = step.id === status;
              return (
                <li className={complete ? "progress-step is-complete" : active ? "progress-step is-active" : "progress-step"} key={step.id}>
                  <span className="step-marker" aria-hidden="true">{complete ? "✓" : index + 1}</span>
                  <span className="step-content">
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  {active && <span className="step-state">Current</span>}
                </li>
              );
            })}
          </ol>
          <p className="connection-note" role="status">
            <span className={socketState === "connected" ? "connection-dot is-connected" : "connection-dot"} aria-hidden="true" />
            {socketState === "connected" ? "Live status connected" : socketState === "reconnecting" ? "Restoring live updates…" : "Connecting to live updates…"}
          </p>
        </div>
      )}
    </section>
  );
}
