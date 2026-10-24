import React, { useState, useEffect } from "react";
import { BlinkBlur } from "react-loading-indicators";

interface ResultDisplayProps {
  jobId: string;
  onStatusChange?: (status: string) => void;
}

const ResultDisplay = ({ jobId, onStatusChange }: ResultDisplayProps) => {
  const [status, setStatus] = useState("queued");
  const [stemFiles, setStemFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [error, setError] = useState("");
  const [detectedKey, setDetectedKey] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/status/${jobId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status) {
        setStatus(data.status);
        onStatusChange?.(data.status);
        if (data.status === "error") setError(data.error || "Audio processing failed.");
        if (data.status === "done" && data.result?.key) setDetectedKey(data.result.key);
      }
    };

    return () => ws.close();
  }, [jobId, onStatusChange]);

  useEffect(() => {
    if (status !== "done") return;
    let cancelled = false;
    fetch(`http://localhost:8000/stems/${jobId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load generated stem files.");
        return response.json();
      })
      .then((data) => { if (!cancelled) setStemFiles(data.stems || []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load stem files."); });
    return () => { cancelled = true; };
  }, [jobId, status]);

  const downloadZip = () => {
    const link = document.createElement("a");
    link.href = `http://localhost:8000/download/stems/${jobId}`;
    link.download = "stems.zip";
    link.click();
  };

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {status === "error" ? (
        <p style={{ color: "#b91c1c" }}>Processing failed. Please try another audio file.</p>
      ) : status !== "done" ? (
        <div>
          <BlinkBlur
            color={["#32cd32", "#327fcd", "#cd32cd", "#cd8032"]}
            size="medium"
          />
          <h4 style={{ marginTop: 10, color: "#555" }}>{status}</h4>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Your audio stems are ready</h3>
          {detectedKey && (
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 13, color: "#166534" }}>Detected song key</div>
              <strong style={{ display: "block", marginTop: 4, fontSize: 24, color: "#14532d" }}>{detectedKey}</strong>
            </div>
          )}
          <p style={{ margin: 0, color: "#555" }}>Download individual WAV files or get every stem in one ZIP archive.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {stemFiles.map((stem) => (
              <a
                key={stem.name}
                href={`http://localhost:8000${stem.url}`}
                download={stem.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  color: "#333",
                  textDecoration: "none",
                  textAlign: "left",
                }}
              >
                <span>{stem.name.replace(/\.wav$/i, "").replace(/_/g, " ")}</span>
                <span style={{ color: "#2563eb", whiteSpace: "nowrap" }}>Download WAV ↓</span>
              </a>
            ))}
            {stemFiles.length === 0 && <p style={{ color: "#666" }}>Loading available stem files…</p>}
          </div>
          <button
          onClick={downloadZip}
          style={{
            marginTop: 10,
            padding: "10px 16px",
            backgroundColor: "#484857",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
          >
            Download all stems (ZIP)
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
