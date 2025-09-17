import React, { useState, useEffect } from "react";
import { BlinkBlur } from "react-loading-indicators";

interface ResultDisplayProps {
  jobId: string;
  onStatusChange?: (status: string) => void;
}

const ResultDisplay = ({ jobId, onStatusChange }: ResultDisplayProps) => {
  const [status, setStatus] = useState("queued");

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/status/${jobId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status) {
        setStatus(data.status);
        onStatusChange?.(data.status);
      }
    };

    return () => ws.close();
  }, [jobId, onStatusChange]);

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
      {status !== "done" ? (
        <div>
          <BlinkBlur
            color={["#32cd32", "#327fcd", "#cd32cd", "#cd8032"]}
            size="medium"
          />
          <h4 style={{ marginTop: 10, color: "#555" }}>{status}</h4>
        </div>
      ) : (
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
          Download Stems ZIP
        </button>
      )}
    </div>
  );
};

export default ResultDisplay;
