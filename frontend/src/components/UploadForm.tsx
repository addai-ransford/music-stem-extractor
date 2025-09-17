import React, {useState} from "react";
import ResultDisplay from "./Results";

interface UploadFormProps {
    onError: (msg: string) => void;
}

export default function UploadForm({onError}: UploadFormProps) {
    const [mode, setMode] = useState<"upload" | "link">("link");
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState("");
    const [stems, setStems] = useState(4);
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onError("");
        setLoading(true);

        try {
            const form = new FormData();
            form.append("stems", stems.toString());

            if (mode === "link") {
                if (!url) throw new Error("Provide a YouTube URL");
                form.append("youtube_url", url);
            } else {
                if (!file) throw new Error("Choose a file");
                form.append("file", file);
            }

            const res = await fetch("http://localhost:8000/process", {
                method: "POST",
                body: form,
            });

            if (!res.ok) {
                const text = await res.text();
                onError(text || "Processing failed");
                setLoading(false);
                return;
            }

            const data: { job_id: string } = await res.json();
            setJobId(data.job_id);
            setStatus("queued");
        } catch (err: any) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const inputStyle = {
        padding: 8,
        borderRadius: 6,
        border: "1px solid #ddd",
        height: 40,
        boxSizing: "border-box" as const,
    };

    const formDisabled = loading || (status !== null && status !== "done");

    return (
        <div>
            <form onSubmit={handleSubmit} style={{display: "grid", gap: 12}}>
                <fieldset
                    disabled={formDisabled}
                    style={{display: "contents"}}
                >
                    <div style={{display: "flex", gap: 8}}>
                        <button
                            type="button"
                            onClick={() => setMode("upload")}
                            style={{
                                padding: "8px 12px",
                                background: mode === "upload" ? "#af41ec" : "#eee",
                                color: mode === "upload" ? "#fff" : "#222",
                                border: "none",
                                minWidth: 120,
                                borderRadius: 6,
                                cursor: "pointer",
                            }}
                        >
                            Upload
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("link")}
                            style={{
                                padding: "8px 12px",
                                background: mode === "link" ? "#af41ec" : "#eee",
                                color: mode === "link" ? "#fff" : "#222",
                                border: "none",
                                minWidth: 120,
                                borderRadius: 6,
                                cursor: "pointer",
                            }}
                        >
                            YouTube
                        </button>
                    </div>

                    {mode === "upload" ? (
                        <input
                            type="file"
                            accept="audio/*,video/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            style={inputStyle}
                        />
                    ) : (
                        <input
                            type="url"
                            placeholder="https://youtube.com/..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            style={inputStyle}
                        />
                    )}

                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                        <label>Stems</label>
                        <select
                            value={stems}
                            onChange={(e) => setStems(parseInt(e.target.value))}
                            style={{padding: 6}}
                        >
                            <option value={2}>2 (Vocals + Accompaniment)</option>
                            <option value={3}>3 (Vocals + Drums + Other)</option>
                            <option value={4}>4 (Vocals + Bass + Drums + Other)</option>
                        </select>
                    </div>
                </fieldset>

                {!formDisabled && (
                    <button
                        type="submit"
                        disabled={loading || (mode === "upload" ? !file : !url.trim())}
                        style={{
                            marginLeft: "auto",
                            background:
                                loading || (mode === "upload" ? !file : !url.trim())
                                    ? "#ccc"
                                    : "#10b981",
                            color: "#fff",
                            padding: "8px 12px",
                            border: "none",
                            borderRadius: 6,
                            cursor:
                                loading || (mode === "upload" ? !file : !url.trim())
                                    ? "not-allowed"
                                    : "pointer",
                        }}
                    >
                        {loading ? "Processing..." : "Process"}
                    </button>
                )}
            </form>

            {jobId && (
                <ResultDisplay
                    jobId={jobId}
                    onStatusChange={(s) => setStatus(s)}
                />
            )}

        </div>
    );
}
