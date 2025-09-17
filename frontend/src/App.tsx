import React, {useState} from "react";
import Footer from "./components/Footer";
import UploadForm from "./components/UploadForm";

export default function App() {
    const [error, setError] = useState("");

    return (
        <div
            style={{
                fontFamily: "Inter, Arial, sans-serif",
                background: "linear-gradient(135deg, #192236 0%, #8e44ad 100%)",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    padding: "clamp(12px, 4vw, 24px)",
                }}
            >
                <div
                    style={{
                        maxWidth: "960px",
                        width: "100%",
                        background: "#fff",
                        padding: "clamp(16px, 5vw, 32px)",
                        borderRadius: 12,
                        boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                        boxSizing: "border-box",
                    }}
                >
                    <h1
                        style={{
                            margin: 0,
                            fontSize: "clamp(22px, 6vw, 32px)",
                            textAlign: "center",
                        }}
                    >
                        🎶 Music Stem Extractor
                    </h1>

                    <div style={{marginTop: 24}}>
                        <UploadForm onError={(msg) => setError(msg)}/>
                        {error && <p style={{color: "red", marginTop: 12}}>{error}</p>}
                    </div>

                    <div
                        style={{
                            marginTop: 40,
                            paddingTop: 20,
                            borderTop: "4px solid red",
                        }}
                    >
                        <h2
                            style={{
                                textAlign: "center",
                                fontSize: "clamp(18px, 5vw, 24px)",
                            }}
                        >
                            ✨ Features
                        </h2>
                        <ul
                            style={{
                                lineHeight: "1.8",
                                color: "#333",
                                fontSize: "clamp(14px, 3.5vw, 16px)",
                                paddingLeft: "1.2rem",
                            }}
                        >
                            <li>🎤 <strong>Extract stems</strong> (vocals, accompaniment, bass, drums — choose 2/3/4
                                stems)
                            </li>
                            <li>🎼 <strong>Detect chords</strong> and build chord progressions</li>
                            <li>🎵 <strong>Identify the key</strong> of a song</li>
                            <li>🎶 <strong>Transcribe melody</strong> into solfège notation</li>
                            <li>📺 Upload audio/video files <strong>or</strong> paste YouTube links</li>
                        </ul>
                    </div>
                </div>
            </div>

            <Footer/>
        </div>
    );
}
