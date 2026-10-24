import React, { useState } from "react";
import Footer from "./components/Footer";
import UploadForm from "./components/UploadForm";

export default function App() {
  const [error, setError] = useState("");

  return (
    <div className="app-shell">
      <header className="mobile-appbar">
        <a className="app-brand" href="#" aria-label="Stem Lab home">
          <span className="app-brand-mark" aria-hidden="true">♫</span>
          <span className="app-brand-copy"><strong>STEM LAB</strong><small>Music tools</small></span>
        </a>
        <span className="appbar-status"><span aria-hidden="true" /> Ready to create</span>
      </header>

      <main className="page-main">
        <div className="app-container">
          <header className="hero">
            <div className="brand-mark" aria-hidden="true">♫</div>
            <p className="eyebrow">YOUR MUSIC, EVERY LAYER</p>
            <h1>Make room for<br className="mobile-title-break" /> every sound.</h1>
            <p className="hero-copy">
              Turn one track into separate stems. Find the key, isolate the details, and make the song yours.
            </p>
            <a className="hero-cta" href="#workspace-title">Start separating <span aria-hidden="true">↓</span></a>
          </header>

          <section className="workspace" id="workspace" aria-labelledby="workspace-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">NEW PROJECT</p>
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

          <section className="features" id="features" aria-labelledby="features-title">
            <div className="features-heading">
              <p className="eyebrow">YOUR CREATIVE TOOLKIT</p>
              <h2 id="features-title">One track. More possibilities.</h2>
            </div>
            <div className="feature-grid">
              <article className="feature-card">
                <span className="feature-icon" aria-hidden="true">◉</span>
                <h3>Isolate the layers</h3>
                <p>Separate vocals, drums, bass, and other parts for your workflow.</p>
              </article>
              <article className="feature-card">
                <span className="feature-icon" aria-hidden="true">♬</span>
                <h3>Find the key</h3>
                <p>Get a detected musical key to help guide your next creative decision.</p>
              </article>
              <article className="feature-card">
                <span className="feature-icon" aria-hidden="true">⇩</span>
                <h3>Keep your stems</h3>
                <p>Download individual WAV files or collect everything in one ZIP.</p>
              </article>
            </div>
            <p className="format-note">Upload an audio or video file, or use a supported YouTube link. Processing time depends on track length and system load.</p>
          </section>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <a className="bottom-nav-item is-current" href="#" aria-current="page">
          <span aria-hidden="true">⌂</span><small>Studio</small>
        </a>
        <a className="bottom-nav-item" href="#workspace">
          <span aria-hidden="true">＋</span><small>New project</small>
        </a>
        <a className="bottom-nav-item" href="#features">
          <span aria-hidden="true">✳</span><small>Explore</small>
        </a>
      </nav>
      <Footer />
    </div>
  );
}
