import React, { useState } from "react";
import Footer from "./components/Footer";
import UploadForm from "./components/UploadForm";

const WORKSPACES = [
  {
    number: "01",
    symbol: "◉",
    title: "Stem Studio",
    description: "Separate vocals, drums, bass, and instruments. Solo a layer, shape the balance, and listen inside the mix.",
    tag: "ISOLATE & MIX",
  },
  {
    number: "02",
    symbol: "♫",
    title: "Chord Explorer",
    description: "Follow the chord timeline with the song, explore its harmony, and use the detected key as a starting point.",
    tag: "FOLLOW THE HARMONY",
  },
  {
    number: "03",
    symbol: "⌁",
    title: "Practice Lab",
    description: "Slow down difficult passages, loop a section, and focus on the part you want to learn.",
    tag: "LEARN BY DOING",
  },
  {
    number: "04",
    symbol: "⌘",
    title: "Keyboard & MIDI",
    description: "Explore notes on a playable keyboard and take musical ideas into your own workflow with MIDI export.",
    tag: "EXPLORE & CREATE",
  },
];

export default function App() {
  const [error, setError] = useState("");

  return (
    <div className="app-shell studio-shell">
      <header className="studio-topbar">
        <a className="app-brand" href="#top" aria-label="Stem Lab home">
          <span className="app-brand-mark" aria-hidden="true">♫</span>
          <span className="app-brand-copy"><strong>STEM LAB</strong><small>Music intelligence studio</small></span>
        </a>
        <nav className="studio-nav" aria-label="Main navigation">
          <a className="studio-nav-link is-current" href="#workspace" aria-current="page">Studio</a>
          <a className="studio-nav-link" href="#workspaces">Explore tools</a>
          <a className="studio-nav-link" href="#workflow">How it works</a>
        </nav>
        <a className="appbar-status" href="#workspace"><span aria-hidden="true" /> New session</a>
      </header>

      <main className="page-main studio-main" id="top">
        <div className="app-container studio-container">
          <section className="studio-intro">
            <div>
              <p className="eyebrow"><span className="intro-spark" aria-hidden="true">✳</span> ONE SONG. EVERY LAYER.</p>
              <h1>Get inside<br className="mobile-title-break" /> <span>the music.</span></h1>
              <p className="hero-copy">Stem Lab is your music intelligence workspace. Pull a song apart, follow its harmony, practise the tricky bits, and discover what makes it work.</p>
              <div className="hero-actions">
                <a className="primary-action" href="#workspace">Open a song <span aria-hidden="true">↗</span></a>
                <a className="secondary-action" href="#workspaces">Explore the studio</a>
              </div>
              <div className="hero-proof" aria-label="Studio capabilities">
                <span><i aria-hidden="true">✓</i> Stem separation</span>
                <span><i aria-hidden="true">✓</i> Chord & key tools</span>
                <span><i aria-hidden="true">✓</i> Practice workspace</span>
              </div>
            </div>
            <div className="intro-orbit" aria-hidden="true">
              <span className="orbit-ring ring-one" /><span className="orbit-ring ring-two" />
              <span className="orbit-note">♫</span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" />
              <span className="orbit-label orbit-label-top">ANALYSE</span>
              <span className="orbit-label orbit-label-right">ISOLATE</span>
              <span className="orbit-label orbit-label-bottom">PRACTISE</span>
            </div>
          </section>

          <section className="workspace studio-workspace" id="workspace" aria-labelledby="workspace-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">START A SESSION</p>
                <h2 id="workspace-title">Bring a song into the lab</h2>
                <p className="section-subtitle">Import an audio file or paste a YouTube link to start analysing your track.</p>
              </div>
              <span className="privacy-note"><span aria-hidden="true">●</span> Your session</span>
            </div>
            <UploadForm onError={setError} />
            {error && (
              <div className="app-alert" role="alert">
                <span aria-hidden="true">!</span><p>{error}</p>
                <button className="alert-dismiss" type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
              </div>
            )}
          </section>

          <section className="features studio-features" id="workspaces" aria-labelledby="features-title">
            <div className="features-heading">
              <p className="eyebrow">MORE THAN STEMS</p>
              <h2 id="features-title">One workspace. More ways to hear.</h2>
              <p className="section-subtitle">Move from listening to understanding, then from understanding to playing.</p>
            </div>
            <div className="feature-grid workspace-tool-grid">
              {WORKSPACES.map((workspace) => (
                <article className="feature-card workspace-tool-card" key={workspace.number}>
                  <div className="tool-card-topline">
                    <span className="feature-icon" aria-hidden="true">{workspace.symbol}</span>
                    <span className="tool-card-number">{workspace.number}</span>
                  </div>
                  <p className="tool-card-tag">{workspace.tag}</p>
                  <h3>{workspace.title}</h3>
                  <p>{workspace.description}</p>
                  <a href="#workspace" className="tool-card-link">Start with a song <span aria-hidden="true">↗</span></a>
                </article>
              ))}
            </div>
            <p className="format-note">Analysis quality depends on the source recording. Detected musical information is a starting point, and should be checked by ear.</p>
          </section>

          <section className="workflow-section" id="workflow" aria-labelledby="workflow-title">
            <div className="features-heading">
              <p className="eyebrow">FROM SONG TO INSIGHT</p>
              <h2 id="workflow-title">A better way to work with music.</h2>
            </div>
            <div className="workflow-steps">
              <article className="workflow-step"><span>01</span><div><h3>Bring it in</h3><p>Start with a track you want to understand, learn, or remix.</p></div></article>
              <article className="workflow-step"><span>02</span><div><h3>Break it down</h3><p>Separate the sound into stems and inspect the musical details available.</p></div></article>
              <article className="workflow-step"><span>03</span><div><h3>Make it yours</h3><p>Listen closely, practise a part, and export the files you need.</p></div></article>
            </div>
          </section>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <a className="bottom-nav-item is-current" href="#top" aria-current="page"><span aria-hidden="true">⌂</span><small>Home</small></a>
        <a className="bottom-nav-item" href="#workspace"><span aria-hidden="true">＋</span><small>New song</small></a>
        <a className="bottom-nav-item" href="#workspaces"><span aria-hidden="true">✳</span><small>Explore</small></a>
      </nav>
      <Footer />
    </div>
  );
}
