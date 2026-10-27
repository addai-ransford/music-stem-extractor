import React, { useCallback, useEffect, useState } from "react";
import ResultDisplay from "./Results";

interface UploadFormProps {
  onError: (msg: string) => void;
}

type InputMode = "upload" | "link";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|ogg|opus|mp4|mov|mkv|avi|webm)$/i;

function getApiError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const value = payload as { detail?: unknown; message?: unknown };
    if (typeof value.detail === "string") return value.detail;
    if (typeof value.message === "string") return value.message;
  }
  return fallback;
}

function isSupportedYouTubeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (parsed.username || parsed.password) return false;
    if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) return false;
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean).length === 1;
    return parsed.pathname === "/watch" ? Boolean(parsed.searchParams.get("v"))
      : /^\/(shorts|live|embed)\/[^/]+/.test(parsed.pathname) || parsed.pathname === "/playlist" && Boolean(parsed.searchParams.get("list"));
  } catch {
    return false;
  }
}

export default function UploadForm({ onError }: UploadFormProps) {
  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [stems, setStems] = useState(4);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || mode !== "upload") {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, mode]);

  const handleStatusChange = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
  }, []);

  const processing = Boolean(jobId && status !== "done" && status !== "error");
  const formDisabled = loading || processing;
  const fileInvalid = Boolean(file && (!ACCEPTED_EXTENSIONS.test(file.name) || file.size > MAX_FILE_SIZE));
  const inputInvalid = mode === "upload" ? !file || fileInvalid : !url.trim() || !isSupportedYouTubeUrl(url.trim());
  const canSubmit = !formDisabled && !inputInvalid;

  function changeMode(nextMode: InputMode) {
    setMode(nextMode);
    onError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");

    if (mode === "link" && !isSupportedYouTubeUrl(url.trim())) {
      onError("Enter a valid YouTube URL, such as https://www.youtube.com/watch?v=…");
      return;
    }
    if (mode === "upload" && !file) {
      onError("Choose an audio or video file to continue.");
      return;
    }
    if (mode === "upload" && file && !ACCEPTED_EXTENSIONS.test(file.name)) {
      onError("This file type is not supported. Try MP3, WAV, FLAC, M4A, AAC, OGG, MP4, MOV, MKV, or WEBM.");
      return;
    }
    if (mode === "upload" && file && file.size > MAX_FILE_SIZE) {
      onError("This file is larger than the 500 MB upload limit.");
      return;
    }

    setLoading(true);
    setJobId(null);
    setStatus(null);

    try {
      const form = new FormData();
      form.append("stems", String(stems));
      if (mode === "link") form.append("youtube_url", url.trim());
      else if (file) form.append("file", file);

      const response = await fetch(`${API_BASE_URL}/process`, { method: "POST", body: form });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiError(payload, "We couldn't start processing. Please try again."));
      }

      if (!payload || typeof payload !== "object" || typeof (payload as { job_id?: unknown }).job_id !== "string") {
        throw new Error("The server returned an unexpected response. Please try again.");
      }

      setJobId((payload as { job_id: string }).job_id);
      setStatus("queued");
    } catch (error) {
      const message = error instanceof Error && error.message === "Failed to fetch"
        ? "Can't reach the processing server. Check that the backend is running, then try again."
        : error instanceof Error ? error.message : "Something went wrong. Please try again.";
      onError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="upload-flow" aria-busy={loading || processing}>
      <div className="ws-import-topline"><div><span className="ws-overline">01 / SOURCE</span><h3>Choose your audio source</h3><p>Bring a track into your studio to separate instruments and analyze harmony.</p></div><span className="ws-source-tag">LOCAL PROCESSING WORKFLOW</span></div>
      <div className="mode-switch" role="tablist" aria-label="Choose audio source">
        <button
          type="button"
          role="tab"
          id="upload-tab"
          aria-selected={mode === "upload"}
          aria-controls="source-panel"
          className={mode === "upload" ? "mode-tab is-active" : "mode-tab"}
          disabled={formDisabled}
          onClick={() => changeMode("upload")}
        >
          <span aria-hidden="true">↑</span> Upload audio
        </button>
        <button
          type="button"
          role="tab"
          id="link-tab"
          aria-selected={mode === "link"}
          aria-controls="source-panel"
          className={mode === "link" ? "mode-tab is-active" : "mode-tab"}
          disabled={formDisabled}
          onClick={() => changeMode("link")}
        >
          <span aria-hidden="true">↗</span> YouTube URL
        </button>
      </div>

      <form onSubmit={handleSubmit} className="upload-form" noValidate>
        <div id="source-panel" role="tabpanel" aria-labelledby={mode === "upload" ? "upload-tab" : "link-tab"}>
          {mode === "upload" ? (
            <label className={file ? "file-dropzone has-file" : "file-dropzone"} htmlFor="audio-file">
              <span className="dropzone-icon" aria-hidden="true">⇧</span>
              <span className="dropzone-title">{file ? file.name : "Choose an audio or video file"}</span>
              <span className="dropzone-copy">
                {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · Click to change file` : "MP3, WAV, FLAC, M4A, AAC, OGG, MP4, MOV, MKV or WEBM"}
              </span>
              <input
                id="audio-file"
                type="file"
                accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.mp4,.mov,.mkv,.avi,.webm,audio/*,video/*"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  onError("");
                }}
                disabled={formDisabled}
                aria-describedby="file-help"
              />
            </label>
          ) : (
            <div className="field-group">
              <label htmlFor="youtube-url">Video link</label>
              <input
                id="youtube-url"
                className="text-input"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  onError("");
                }}
                disabled={formDisabled}
                aria-invalid={Boolean(url.trim()) && !isSupportedYouTubeUrl(url.trim())}
              />
              <p className="field-help">Use a public video link that you’re allowed to download and process.</p>
            </div>
          )}
          {mode === "upload" && previewUrl && (
            <div className="source-preview">
              <p className="eyebrow">SOURCE PREVIEW</p>
              <audio className="original-audio-player" controls preload="metadata" src={previewUrl}>
                Your browser does not support audio playback.
              </audio>
              <p className="field-help">Preview the original file before processing. Chords will be shown on the results screen.</p>
            </div>
          )}
          <p id="file-help" className="field-help">
            {mode === "upload" ? "Maximum file size: 500 MB. Longer tracks may take more time." : " "}
          </p>
          {mode === "upload" && fileInvalid && (
            <p className="inline-validation" role="alert">
              {file.size > MAX_FILE_SIZE ? "File exceeds the 500 MB limit." : "That file extension may not be supported."}
            </p>
          )}
        </div>

        <div className="form-bottom-row">
          <div className="field-group stem-select-group">
            <label htmlFor="stem-count">Stem configuration</label>
            <select
              id="stem-count"
              className="text-input stem-select"
              value={stems}
              onChange={(event) => setStems(Number(event.target.value))}
              disabled={formDisabled}
            >
              <option value={2}>2 tracks · Vocals / Instrumental</option>
              <option value={4}>4 tracks · Vocals / Bass / Drums / Other</option>
              <option value={5}>5 tracks · Vocals / Bass / Drums / Piano / Other</option>
            </select>
            <p className="field-help">Select the number of instrument layers. More stems may take longer to process.</p>
          </div>
          <button className="primary-button" type="submit" disabled={!canSubmit}>
            {loading ? <><span className="button-spinner" aria-hidden="true" /> Starting…</> : processing ? "Processing…" : "Create studio session"}
            {!loading && !processing && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </form>

      {jobId && <ResultDisplay jobId={jobId} onStatusChange={handleStatusChange} />}
    </div>
  );
}
