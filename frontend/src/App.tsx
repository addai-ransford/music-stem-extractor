import React, { useState } from "react";
import Footer from "./components/Footer";
import UploadForm from "./components/UploadForm";

export default function App() {
  const [error, setError] = useState("");

  return (
    <div className="app-shell studio-shell">
      <header className="studio-topbar">
        <a className="app-brand" href="#" aria-label="Stem Lab home">
          <span className="app-brand-mark" aria-hidden="true">♫</span>
          <span className="app-brand-copy"><strong>STEM LAB</strong><small>Music workspace</small></span>
        </a>
        <nav className="studio-nav" aria-label="Main navigation">
          <a className="studio-nav-link is-current" href="#workspace" aria-current="page">Studio</a>
          <a className="studio-nav-link" href="#how-it-works">How it works</a>
        </nav>
        <span className="appbar-status"><span aria-hidden="true" /> Studio ready</span>
      </header>

      <main className="page-main studio-main">
        <div className="app-container studio-container">
          <section className="studio-intro">
            <div>
              <p className="eyebrow"><span className="intro-spark" aria-hidden="true">✳</span> YOUR MUSIC, MULTITRACKED</p>
              <h1>Get closer to<br className="mobile-title-break" /> <span>every layer.</span></h1>
              <p className="hero-copy">Separate a song into the parts that make it yours. Listen closer, practice smarter, and take each stem into your next session.</p>
            </div>
            <div className="intro-orbit" aria-hidden="true">
              <span className="orbit-ring ring-one" /><span className="orbit-ring ring-two" />
              <span className="orbit-note">♫</span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" />
            </div>
          </section>

          <section className="workspace studio-workspace" id="workspace" aria-labelledby="workspace-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TRACK WORKSPACE</p>
                <h2 id="workspace-title">Start with a song</h2>
                <p className="section-subtitle">Upload audio or paste a YouTube link to build your stem mix.</p>
              </div>
              <span className="privacy-note"><span aria-hidden="true">●</span> Private by design</span>
            </div>
            <UploadForm onError={setError} />
            {error && (
              <div className="app-alert" role="alert">
                <span aria-hidden="true">!</span><p>{error}</p>
                <button className="alert-dismiss" type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
              </div>
            )}
          </section>

          <section className="features studio-features" id="how-it-works" aria-labelledby="features-title">
            <div className="features-heading">
              <p className="eyebrow">MADE FOR YOUR NEXT SESSION</p>
              <h2 id="features-title">Listen beyond the mix.</h2>
            </div>
            <div className="feature-grid">
              <article className="feature-card"><span className="feature-icon" aria-hidden="true">◉</span><h3>Solo each layer</h3><p>Focus on vocals, drums, bass, and other parts independently.</p></article>
              <article className="feature-card"><span className="feature-icon" aria-hidden="true">♫</span><h3>Find your key</h3><p>Use the detected musical key as a starting point for your next idea.</p></article>
              <article className="feature-card"><span className="feature-icon" aria-hidden="true">⇩</span><h3>Take it with you</h3><p>Download individual WAV stems or collect the session in a ZIP.</p></article>
            </div>
            <p className="format-note">Supports common audio and video formats, plus public YouTube links you’re allowed to process. Processing time varies by track length and system load.</p>
          </section>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <a className="bottom-nav-item is-current" href="#workspace" aria-current="page"><span aria-hidden="true">⌂</span><small>Studio</small></a>
        <a className="bottom-nav-item" href="#workspace"><span aria-hidden="true">＋</span><small>New track</small></a>
        <a className="bottom-nav-item" href="#how-it-works"><span aria-hidden="true">✳</span><small>Explore</small></a>
      </nav>
      <Footer />
    </div>
  );
}
