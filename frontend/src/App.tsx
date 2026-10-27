import React, { useState } from "react";
import UploadForm from "./components/UploadForm";
import ResultDisplay from "./components/Results";
import "./workstation.css";
import "./import-studio.css";
import "./unified-workstation.css";

type View = "Arrange" | "Session" | "Chords" | "Mix" | "Practice";
const VIEWS: View[] = ["Arrange", "Session", "Chords", "Mix", "Practice"];
const LANES = [
  { name: "Vocals", icon: "◉", color: "#a86bff", pattern: [16,30,23,40,34,20,36,45,30,22,40,25] },
  { name: "Drums", icon: "▦", color: "#f28c9c", pattern: [30,20,42,28,46,24,36,18,44,28,38,20] },
  { name: "Bass", icon: "♩", color: "#65a8ff", pattern: [25,36,18,40,27,38,20,35,24,40,28,36] },
  { name: "Piano", icon: "▤", color: "#63dca7", pattern: [38,20,32,45,26,36,44,20,35,24,42,30] },
  { name: "Other", icon: "✦", color: "#f5c76b", pattern: [18,32,40,20,34,44,26,39,22,38,28,45] },
];
const CHORDS = ["C", "G", "Am", "F", "C", "G", "F", "G"];
export default function App() {
  const [view, setView] = useState<View>("Arrange");
  const [importOpen, setImportOpen] = useState(false);
  const [songUrl, setSongUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [browserOpen, setBrowserOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [lowerOpen, setLowerOpen] = useState(true);
  const [activeChord, setActiveChord] = useState(0);
  const [selectedLane, setSelectedLane] = useState("Piano");
  return <div className="workstation">
    <header className="ws-header">
      <a className="ws-logo" href="#workstation"><span>♫</span><strong>STEM LAB</strong><small>WORKSTATION</small></a>
      <form className="ws-song-search" onSubmit={(event) => { event.preventDefault(); setImportOpen(true); }}><label htmlFor="ws-song-url" className="ws-sr-only">YouTube song URL</label><input id="ws-song-url" type="url" value={songUrl} onChange={event => setSongUrl(event.target.value)} placeholder="Paste a YouTube song link…" /><button type="submit" aria-label="Import YouTube song">⌕</button></form>
      <nav className="ws-tabs" aria-label="Workstation views">{VIEWS.map(item => <button type="button" key={item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>
      <div className="ws-header-actions"><button type="button" onClick={() => setImportOpen(true)} className="ws-import">↑ Upload song</button></div>
    </header>
    <div className="ws-transport">
      <div className="ws-toolbar-group"><button onClick={() => setBrowserOpen(!browserOpen)} aria-label="Toggle browser" aria-pressed={browserOpen}>☷</button><span className="ws-muted">Untitled session</span></div>
      <div className="ws-toolbar-group ws-transport-center"><span className="ws-time">1 . 1 . 1</span><span className="ws-transport-note">Playback controls activate with processed audio ↓</span><span className="ws-time">120 <small>BPM · reference</small></span></div>
      <div className="ws-toolbar-group"><span className="ws-chip">4/4</span><span className="ws-chip">Key from analysis</span><button onClick={() => setInspectorOpen(!inspectorOpen)} aria-label="Toggle chord inspector" aria-pressed={inspectorOpen}>◫</button></div>
    </div>
    <div className="ws-main" id="workstation">
      {browserOpen && <aside className="ws-browser">
        <div className="ws-pane-title">LIBRARY <span>⌕</span></div>
        <button onClick={() => setImportOpen(true)} className="ws-library-active">♫ &nbsp; My audio</button>
        <button onClick={() => setImportOpen(true)}>▦ &nbsp; Stem separation</button>
        <button onClick={() => setView("Chords")}>♬ &nbsp; Chord intelligence</button>
        <button onClick={() => setView("Practice")}>◎ &nbsp; Practice tools</button>
        <div className="ws-divider"/>
        <p className="ws-overline">SESSION CONTENT</p>
        <p className="ws-help">Import a song to create real stem tracks, analyze its key, and explore detected chords.</p>
        <button onClick={() => setImportOpen(true)} className="ws-browser-cta">+ New analysis</button>
      </aside>}
      <main className="ws-center">
        <div className="ws-section-header"><div><span className="ws-overline">MUSIC PRODUCTION / {view.toUpperCase()}</span><h1>{view === "Arrange" ? "Arrangement" : view === "Session" ? "Session workspace" : view === "Chords" ? "Chord intelligence" : view === "Mix" ? "Mixing console" : "Practice studio"}</h1></div><span className="ws-demo-label">SESSION PREVIEW · NO AUDIO LOADED</span></div>
        {(view === "Arrange" || view === "Session" || view === "Mix") && <div className="ws-arrangement" aria-label="Illustrative arrangement; load a track below for actual audio">
          <div className="ws-ruler"><span>TRACK</span><div>{Array.from({length: 12}, (_,i) => <span key={i}>{i+1}</span>)}</div></div>
          {LANES.map((lane, index) => <div className={"ws-track "+(selectedLane === lane.name ? "ws-track-selected" : "")} key={lane.name}>
            <button className="ws-track-label" onClick={() => setSelectedLane(lane.name)}><span style={{color:lane.color}}>{lane.icon}</span><strong>{lane.name}</strong><small>PREVIEW</small></button>
            <div className="ws-track-content"><div className="ws-clip" style={{background:lane.color+"28",borderColor:lane.color+"77",left:index%2===0?"1%":"12%",width:index===4?"74%":"86%"}}><span style={{color:lane.color}}>{lane.name} · illustrative clip</span><div className="ws-wave">{lane.pattern.concat(lane.pattern,lane.pattern).map((n,i)=><i key={i} style={{height:n+"%",background:lane.color}}/>)}</div></div></div>
          </div>)}
          <div className="ws-arrangement-foot">Visual layout preview only — audio, seeking and synchronized stem mixing are available after processing a song.</div>
        </div>}
        {(view === "Chords" || view === "Practice") && <div className="ws-feature-view"><div className="ws-overline">HARMONY / PRACTICE</div><h2>Follow the music, not just the waveform.</h2><p>Process a track below to load real timestamped chord analysis, key detection, keyboard visualization and synchronized practice controls. The chord sequence shown here is only a layout example.</p><div className="ws-chord-row">{CHORDS.map((chord,i)=><button key={i} className={activeChord===i?"active":""} onClick={()=>setActiveChord(i)}>{chord}</button>)}</div><button className="ws-import" onClick={() => setImportOpen(true)}>Analyze a song ↗</button></div>}
        {lowerOpen && <section className="ws-lower"><div className="ws-lower-head"><span>◫ &nbsp; DETAIL EDITOR</span><button onClick={()=>setLowerOpen(false)}>Hide panel −</button></div><div className="ws-keyboard"><div className="ws-keys">{Array.from({length:15},(_,i)=><div key={i} className={([1,3,6,8,10,13].includes(i))?"black-key":"white-key"} />)}</div><div className="ws-piano-grid">{Array.from({length:12},(_,i)=><div key={i} className="ws-note-row"><span style={{left:(i*13)%80+"%",width:12+(i%3)*8+"%"}} /></div>)}</div></div><p className="ws-help">Piano-roll layout preview. MIDI note editing is planned; this panel does not generate or save MIDI yet.</p></section>}
        {!lowerOpen && <button className="ws-restore" onClick={()=>setLowerOpen(true)}>Show detail editor +</button>}
      </main>
      {inspectorOpen && <aside className="ws-inspector"><div className="ws-pane-title">CHORD INTELLIGENCE <span>✦</span></div><p className="ws-overline">ANALYSIS STATUS</p><div className="ws-empty-state">♫<strong>Awaiting your song</strong><p>Detected chords, key, and musical structure will appear with processed results.</p></div><div className="ws-divider"/><p className="ws-overline">CHORD PROGRESSION · EXAMPLE</p><div className="ws-chord-grid">{CHORDS.map((chord,i)=><button key={i} className={activeChord===i?"active":""} onClick={()=>setActiveChord(i)}>{chord}</button>)}</div><p className="ws-help">These sample chords are not an analysis of your audio.</p><div className="ws-divider"/><p className="ws-overline">LYRICS</p><p className="ws-help">Synchronized lyrics require a transcription source; the current backend does not provide lyrics.</p></aside>}
    </div>
    {importOpen && <div className="ws-import-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportOpen(false); }}><section className="ws-import-dialog" role="dialog" aria-modal="true" aria-label="Import a song"><div className="ws-dialog-header"><div><span className="ws-overline">NEW STUDIO SESSION</span><h2>Import your song</h2></div><button type="button" onClick={() => setImportOpen(false)} aria-label="Close import dialog">×</button></div><div className="ws-import-section" id="import"><UploadForm onError={setError} initialUrl={songUrl} onJobStarted={(id) => { setJobId(id); setImportOpen(false); }} />{error && <div role="alert" className="ws-error">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}</div></section></div>}
    <section className="ws-session-output" aria-label="Processed song session"><div className="ws-output-header"><span className="ws-overline">SESSION AUDIO & ANALYSIS</span><p>Processing and playback results appear here after importing a song.</p></div>{jobId ? <ResultDisplay key={jobId} jobId={jobId} /> : <div className="ws-output-empty">No song loaded yet. Use the song field above or choose Upload song to start.</div>}</section>
    <footer className="ws-footer">STEM LAB · MUSIC INTELLIGENCE WORKSTATION <span>Arrangement and piano-roll panels are previews; processing results use live backend data.</span></footer>
  </div>;
}
