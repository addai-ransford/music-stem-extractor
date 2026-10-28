import { useEffect, useRef, useState } from "react";
import UploadForm from "./components/UploadForm";
import ResultDisplay, { type SessionView } from "./components/Results";
import "./studio-shell.css";
import "./session-views.css";
import "./native-mobile.css";
import "./new-song-form.css";

const tabs: SessionView[] = ["Chords", "Stem Studio", "MIDI & Remix"];
const mobileTabMeta: Record<SessionView, { icon: string; label: string }> = {
  Chords: { icon: "♫", label: "Chords" },
  "Stem Studio": { icon: "☷", label: "Stems" },
  "MIDI & Remix": { icon: "♬", label: "Remix" },
};

export default function App() {
  const [workspace, setWorkspace] = useState<SessionView>("Chords");
  const [songUrl, setSongUrl] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sourceKey, setSourceKey] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!importOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImportOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [importOpen]);

  const openImport = (clearUrl = false) => {
    if (clearUrl) setSongUrl("");
    setSourceKey(value => value + 1);
    setError("");
    setImportOpen(true);
  };

  return <div className="music-app">
    <header className="music-topbar">
      <a className="music-brand" href="#studio" aria-label="Stem Lab home"><span className="music-brand-icon">♫</span><span>stem<span className="music-brand-accent">lab</span><small> MUSIC WORKSTATION</small></span></a>
      <form className="music-search" onSubmit={event => { event.preventDefault(); openImport(); }}>
        <label htmlFor="music-song-link" className="music-sr-only">YouTube song link</label>
        <input id="music-song-link" type="url" placeholder="Paste a YouTube song link to start…" value={songUrl} onChange={event => setSongUrl(event.target.value)} />
        <button type="submit" aria-label="Analyze song link"><span aria-hidden="true">⌕</span></button>
      </form>
      <button className="music-upload" type="button" onClick={() => openImport(true)}><span aria-hidden="true">↑</span> Upload song</button>
    </header>

    <div className="music-workspace" id="studio">
      <div className="music-workspace-toolbar">
        <div className="music-heading"><span className="music-eyebrow">YOUR MUSIC STUDIO</span><h1>{jobId ? "Music workstation" : "Create something great."}</h1><p>{jobId ? "One song. Three connected workspaces." : "Separate instruments, discover chords, and practice with your favorite songs."}</p></div>
        <nav className="music-view-tabs" aria-label="Studio workspaces">{tabs.map(tab => <button key={tab} type="button" className={workspace === tab ? "active" : ""} aria-current={workspace === tab ? "page" : undefined} onClick={() => setWorkspace(tab)}>{tab}</button>)}</nav>
      </div>
      {jobId ? <div className="music-results" key={jobId}><div className="music-results-toolbar"><div><span className="music-eyebrow">ACTIVE SESSION</span><strong>Stem separation & chord intelligence</strong></div><button type="button" className="music-new-session" onClick={() => openImport(true)}>+ New song</button></div><ResultDisplay jobId={jobId} view={workspace}/></div> :
      <div className="music-empty">
        <div className="music-empty-art" aria-hidden="true"><span>♫</span><div className="music-art-bars">{[26,42,66,37,83,56,94,45,72,32,61,41,84,55,30].map((height,i)=><i key={i} style={{height:height+"%"}} />)}</div></div>
        <span className="music-eyebrow">EVERY GREAT SESSION STARTS WITH A SONG</span>
        <h2>Your studio is ready.</h2>
        <p>Upload an audio file or paste a YouTube link. We'll separate the stems and detect the song's key and chords, ready for playback and practice.</p>
        <div className="music-empty-actions"><button type="button" className="music-upload" onClick={() => openImport(true)}>↑ Upload your first song</button><button type="button" className="music-secondary" onClick={() => openImport()}>↗ Use a YouTube link</button></div>
        <div className="music-capabilities"><span>◉ Stem separation</span><span>♬ Chord detection</span><span>◫ Multitrack mixer</span><span>♩ MIDI keyboard</span></div>
      </div>}
    </div>

    <nav className="music-mobile-nav" aria-label="Mobile workstation navigation">
      {tabs.map(tab => <button key={tab} type="button" className={workspace === tab ? "is-active" : ""} aria-current={workspace === tab ? "page" : undefined} onClick={() => { setWorkspace(tab); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        <span className="music-mobile-nav-icon" aria-hidden="true">{mobileTabMeta[tab].icon}</span>
        <span>{mobileTabMeta[tab].label}</span>
      </button>)}
      <button type="button" onClick={() => openImport(true)}><span className="music-mobile-nav-icon" aria-hidden="true">＋</span><span>New song</span></button>
    </nav>
    <footer className="music-footer"><span>STEM LAB</span><span>Powered by your existing audio processing service</span></footer>

    {importOpen && <div className="music-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setImportOpen(false); }}>
      <div className="music-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="music-dialog-title">
        <div className="music-dialog-grabber" aria-hidden="true" /><div className="music-dialog-top"><div><span className="music-eyebrow">NEW STUDIO SESSION</span><h2 id="music-dialog-title">Add a song</h2><p>Choose an audio source and how you'd like to separate it.</p></div><button className="music-close" type="button" aria-label="Close dialog" onClick={() => setImportOpen(false)}>×</button></div>
        <div className="ws-import-section"><UploadForm key={sourceKey} initialUrl={songUrl} onError={setError} onJobStarted={id => { setJobId(id); setWorkspace("Chords"); setImportOpen(false); }}/>{error && <div className="music-error" role="alert">{error}</div>}</div>
      </div>
    </div>}
  </div>;
}
