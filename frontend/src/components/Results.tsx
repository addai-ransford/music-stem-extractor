import React, { useEffect, useState } from "react";

interface ResultDisplayProps {
  jobId: string;
  onStatusChange?: (status: string) => void;
}

interface StemFile {
  name: string;
  url: string;
}

type JobStatus = "queued" | "downloading" | "extracting" | "key" | "zipping" | "done" | "error" | "connecting" | "unknown";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/, "ws")).replace(/\/$/, "");

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
  return "unknown";
}

function statusMessage(status: JobStatus): string {
  if (status === "queued") return "Your job is in the queue.";
  if (status === "connecting") return "Connecting to the processing server…";
  if (status === "unknown") return "Your audio is being processed.";
  return STEPS.find((step) => step.id === status)?.description || "Your audio is being processed.";
}

export default function ResultDisplay({ jobId, onStatusChange }: ResultDisplayProps) {
  const [status, setStatus] = useState<JobStatus>("queued");
  const [stemFiles, setStemFiles] = useState<StemFile[]>([]);
  const [error, setError] = useState("");
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;

    const connect = () => {
      if (disposed) return;
      setSocketState(retryDelay > 1000 ? "reconnecting" : "connecting");

      try {
        socket = new WebSocket(`${WS_BASE_URL}/ws/status/${encodeURIComponent(jobId)}`);
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        if (disposed) return;
        retryDelay = 1000;
        setSocketState("connected");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            status?: unknown;
            error?: unknown;
            result?: { key?: unknown };
          };
          const nextStatus = normalizeStatus(data.status);
          if (nextStatus !== "unknown") {
            setStatus(nextStatus);
            onStatusChange?.(nextStatus);
          }
          if (typeof data.error === "string" && data.error.trim()) setError(data.error);
          if (nextStatus === "error") {
            setError(typeof data.error === "string" && data.error.trim() ? data.error : "Audio processing failed. Please try another file or link.");
          }
          if (data.result && typeof data.result.key === "string") setDetectedKey(data.result.key);
        } catch {
          setError("Received an unreadable update from the processing server. Reconnecting…");
        }
      };

      socket.onerror = () => {
        if (!disposed) setSocketState("reconnecting");
      };

      socket.onclose = () => {
        if (!disposed && status !== "done" && status !== "error") scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (disposed || retryTimer) return;
      setSocketState("reconnecting");
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        retryDelay = Math.min(retryDelay * 2, 10000);
        connect();
      }, retryDelay);
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
    // The socket is tied to a job. Status updates should not recreate the connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (status !== "done") return;
    let cancelled = false;
    setFilesLoading(true);
    fetch(`${API_BASE_URL}/stems/${encodeURIComponent(jobId)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const detail = payload && typeof payload === "object" && typeof payload.detail === "string" ? payload.detail : "Could not load generated stem files.";
          throw new Error(detail);
        }
        return payload as { stems?: StemFile[] };
      })
      .then((payload) => {
        if (!cancelled) setStemFiles(Array.isArray(payload.stems) ? payload.stems : []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load stem files.");
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId, status]);

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
          <p className="results-copy">Download the stems you need, or grab the full collection as a ZIP archive.</p>
          <div className="stem-list">
            {filesLoading && <p className="muted-message">Loading your WAV files…</p>}
            {!filesLoading && stemFiles.length === 0 && (
              <p className="muted-message">{error || "No individual stem files were returned. Try downloading the full ZIP archive."}</p>
            )}
            {stemFiles.map((stem) => (
              <a className="stem-download" key={stem.name} href={`${API_BASE_URL}${stem.url}`} download={stem.name}>
                <span className="stem-file-icon" aria-hidden="true">♫</span>
                <span className="stem-file-info">
                  <strong>{stem.name.replace(/\.wav$/i, "").replace(/[_-]/g, " ")}</strong>
                  <small>WAV audio file</small>
                </span>
                <span className="stem-download-action">Download <span aria-hidden="true">↓</span></span>
              </a>
            ))}
          </div>
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
              const complete = finished || (activeStepIndex >= 0 && index < activeStepIndex);
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
          <p className="connection-note">
            <span className={socketState === "connected" ? "connection-dot is-connected" : "connection-dot"} aria-hidden="true" />
            {socketState === "connected" ? "Live status connected" : socketState === "reconnecting" ? "Restoring live updates…" : "Connecting to live updates…"}
          </p>
        </div>
      )}
    </section>
  );
}
