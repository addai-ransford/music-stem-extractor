import React, { useState } from "react";
import Footer from "./components/Footer";
import UploadForm from "./components/UploadForm";

export default function App() {
  const [error, setError] = useState("");

  return (
    <div className="app-shell">
      <main className="page-main">
        <div className="app-container">
          <header className="hero">
            <div className="brand-mark" aria-hidden="true">♫</div>
            <p className="eyebrow">YOUR MUSIC, EVERY LAYER</p>
            <h1>Music Stem Extractor</h1>
            <p className="hero-copy">
              Separate a track into useful stems, find its key, and bring every layer into your next session.
            </p>
          </header>

          <section className="workspace" aria-labelledby="workspace-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">START A NEW PROJECT</p>
                <h2 id="workspace-title">Separate your audio</h2>
              </div>
              <span className="privacy-note"><span aria-hidden="true">●</span> Simple, focused workflow</span>
            </div>
            <UploadForm onError={setError} />
            {error && (
              <div className="app-alert" role="alert">
                <span aria-hidden="true">!</span>
                <p>{error}</p>
                <button className="alert-dismiss" type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
              </div>
            )}
          </section>

          <section className="features" aria-labelledby="features-title">
            <div className="features-heading">
              <p className="eyebrow">MADE FOR THE NEXT TAKE</p>
              <h2 id="features-title">From one track to a fresh start</h2>
            </div>
            <div className="feature-grid">
              <article className="feature-card">
                <span className="feature-icon" aria-hidden="true">◉</span>
                <h3>Separate stems</h3>
                <p>Split supported audio into vocals, drums, bass, and other parts.</p>
              </article>
              <article className="feature-card">
                <span className="feature-icon" aria-hidden="true">♬</span>
                <h3>Find the key</h3>
                <p>Get a detected musical key to help guide your next creative decision.</p>
              </article>
              <article className="feature-card">
                <span className="feature-icon" aria-hidden="true">⇩</span>
                <h3>Take it with you</h3>
                <p>Download individual WAV stems or collect them in one ZIP archive.</p>
              </article>
            </div>
            <p className="format-note">Upload an audio or video file, or use a supported YouTube link. Processing time depends on track length and system load.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
