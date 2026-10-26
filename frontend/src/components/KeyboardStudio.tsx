import React, { useCallback, useEffect, useRef, useState } from "react";

type MidiInput = { id: string; name: string; input: MIDIInput };

type RecordedEvent = { time: number; note: number; velocity: number; on: boolean };

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const COMPUTER_KEYS: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67,
  y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ";": 76,
};
const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const BLACK_NOTES = [
  { note: 1, left: 1 / 7 }, { note: 3, left: 2 / 7 }, { note: 6, left: 4 / 7 },
  { note: 8, left: 5 / 7 }, { note: 10, left: 6 / 7 },
  { note: 13, left: 8 / 7 }, { note: 15, left: 9 / 7 }, { note: 18, left: 11 / 7 },
  { note: 20, left: 12 / 7 }, { note: 22, left: 13 / 7 },
];

function noteName(note: number) { return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`; }
function encodeVariableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  while ((value >>= 7) > 0) { buffer <<= 8; buffer |= ((value & 0x7f) | 0x80); }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8; else break;
  }
  return bytes;
}
function makeMidiFile(events: RecordedEvent[]): Blob {
  const sorted = [...events].sort((a, b) => a.time - b.time || Number(a.on) - Number(b.on));
  const ticksPerSecond = 960;
  let previousTick = 0;
  const track: number[] = [];
  for (const event of sorted) {
    const tick = Math.max(previousTick, Math.round(event.time * ticksPerSecond));
    track.push(...encodeVariableLength(tick - previousTick), event.on ? 0x90 : 0x80, event.note, event.on ? event.velocity : 0);
    previousTick = tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);
  const header = [0x4d,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, 0x03,0xc0];
  const length = track.length;
  const chunk = [0x4d,0x54,0x72,0x6b, (length>>>24)&255,(length>>>16)&255,(length>>>8)&255,length&255, ...track];
  return new Blob([new Uint8Array([...header, ...chunk])], { type: "audio/midi" });
}

interface KeyboardStudioProps { currentTime: number; }

export default function KeyboardStudio({ currentTime }: KeyboardStudioProps) {
  const [midiInputs, setMidiInputs] = useState<MidiInput[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState("");
  const [midiStatus, setMidiStatus] = useState("Use the on-screen keys or computer keys; connect a MIDI keyboard for hardware input.");
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<RecordedEvent[]>([]);
  const [pressedNotes, setPressedNotes] = useState<number[]>([]);
  const [playbackNotes, setPlaybackNotes] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<Map<number, { oscillator: OscillatorNode; gain: GainNode }>>(new Map());
  const heldComputerKeys = useRef<Set<string>>(new Set());
  const startedAtRef = useRef(0);
  const eventsRef = useRef<RecordedEvent[]>([]);
  const activeNotesRef = useRef<Map<number, number>>(new Map());
  const selectedInputRef = useRef<MIDIInput | null>(null);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      const Context = window.AudioContext;
      if (Context) audioContextRef.current = new Context();
    }
    if (audioContextRef.current?.state === "suspended") void audioContextRef.current.resume();
    return audioContextRef.current;
  }, []);

  const noteOn = useCallback((note: number, velocity = 100) => {
    const context = getContext();
    if (voicesRef.current.has(note)) return;
    if (context) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
      const now = context.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity / 127 * 0.18), now + 0.015);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
      voicesRef.current.set(note, { oscillator, gain });
    }
    setPressedNotes(previous => previous.includes(note) ? previous : [...previous, note]);
    if (recording) {
      const time = Math.max(0, currentTime + (performance.now() - startedAtRef.current) / 1000);
      const event = { time: recording ? time : currentTime, note, velocity, on: true };
      eventsRef.current = [...eventsRef.current, event]; setEvents(eventsRef.current);
      activeNotesRef.current.set(note, event.time);
    }
  }, [currentTime, getContext, recording]);

  const noteOff = useCallback((note: number) => {
    const voice = voicesRef.current.get(note);
    if (voice && audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.04);
      voice.oscillator.stop(now + 0.2);
      voicesRef.current.delete(note);
    }
    setPressedNotes(previous => previous.filter(item => item !== note));
    if (recording) {
      const time = Math.max(0, currentTime + (performance.now() - startedAtRef.current) / 1000);
      eventsRef.current = [...eventsRef.current, { time, note, velocity: 0, on: false }];
      setEvents(eventsRef.current);
    }
  }, [currentTime, recording]);

  const connectMidi = async () => {
    const nav = navigator as Navigator & { requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess> };
    if (!window.isSecureContext) {
      setMidiStatus("MIDI access requires a secure context (HTTPS or localhost)."); return;
    }
    if (!nav.requestMIDIAccess) {
      setMidiStatus("Web MIDI is not supported in this browser. Try a current desktop Chrome or Edge browser."); return;
    }
    try {
      const access = await nav.requestMIDIAccess();
      const refreshInputs = () => {
        const available = Array.from(access.inputs.values()).map(input => ({ id: input.id, name: input.name || "MIDI keyboard", input }));
        setMidiInputs(available);
        if (!available.length) { setSelectedMidiId(""); setMidiStatus("MIDI permission granted, but no input device was found. Connect your keyboard and retry."); }
        else {
          setSelectedMidiId(previous => available.some(item => item.id === previous) ? previous : available[0].id);
          setMidiStatus(`Found ${available.length} MIDI input device${available.length === 1 ? "" : "s"}.`);
        }
      };
      access.onstatechange = refreshInputs;
      refreshInputs();
      (access as MIDIAccess & { _stemLabAccess?: boolean })._stemLabAccess = true;
      // Retain access so changing the selected input does not prompt again.
      (window as Window & { __stemLabMidiAccess?: MIDIAccess }).__stemLabMidiAccess = access;
    } catch (error) {
      setMidiStatus(error instanceof Error ? error.message : "Could not access MIDI devices. Check browser permissions.");
    }
  };

  useEffect(() => {
    const input = midiInputs.find(item => item.id === selectedMidiId)?.input || null;
    if (selectedInputRef.current) selectedInputRef.current.onmidimessage = null;
    selectedInputRef.current = input;
    if (input) {
      input.onmidimessage = (message) => {
        const data = message.data;
        if (!data || data.length < 2) return;
        const command = data[0] & 0xf0;
        const note = data[1];
        const velocity = data.length > 2 ? data[2] : 0;
        if (command === 0x90 && velocity > 0) noteOn(note, velocity);
        else if (command === 0x80 || (command === 0x90 && velocity === 0)) noteOff(note);
      };
    }
    return () => { if (input) input.onmidimessage = null; };
  }, [midiInputs, selectedMidiId, noteOn, noteOff]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      const note = COMPUTER_KEYS[key];
      if (note === undefined || heldComputerKeys.current.has(key)) return;
      event.preventDefault(); heldComputerKeys.current.add(key); noteOn(note);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = COMPUTER_KEYS[key];
      if (note === undefined) return;
      heldComputerKeys.current.delete(key); noteOff(note);
    };
    const releaseAll = () => {
      heldComputerKeys.current.forEach(key => { const note = COMPUTER_KEYS[key]; if (note !== undefined) noteOff(note); });
      heldComputerKeys.current.clear();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", releaseAll); };
  }, [noteOn, noteOff]);

  useEffect(() => () => {
    voicesRef.current.forEach(voice => { try { voice.oscillator.stop(); } catch { /* already stopped */ } });
    void audioContextRef.current?.close();
    if (selectedInputRef.current) selectedInputRef.current.onmidimessage = null;
  }, []);

  const startRecording = () => {
    eventsRef.current = []; setEvents([]);
    startedAtRef.current = performance.now();
    setRecording(true);
    setMidiStatus("Recording keyboard notes. Stop to export a standard MIDI file.");
  };
  const stopRecording = () => {
    setRecording(false);
    setMidiStatus("Take captured. Export the MIDI file to use your performance in a DAW.");
  };
  const exportMidi = () => {
    if (!events.length) return;
    const blob = makeMidiFile(events);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "stem-lab-keyboard-performance.mid";
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };
  const clearTake = () => { eventsRef.current = []; setEvents([]); activeNotesRef.current.clear(); };

  return (
    <section className="keyboard-studio" aria-labelledby="keyboard-studio-title">
      <div className="keyboard-studio-heading">
        <div><p className="eyebrow">KEYBOARD PERFORMANCE</p><h4 id="keyboard-studio-title">Play & record over your stems</h4>
          <p className="studio-mixer-description">Play notes with your computer keyboard, the on-screen piano, or a connected MIDI controller. Takes export as a standard MIDI file.</p>
        </div>
        <span className={recording ? "keyboard-recording-badge is-recording" : "keyboard-recording-badge"}>{recording ? "● Recording" : "MIDI recorder"}</span>
      </div>
      <div className="keyboard-tools">
        <button type="button" className="studio-toggle" onClick={() => void connectMidi()}>Connect MIDI</button>
        {midiInputs.length > 0 && <label className="studio-speed">Input
          <select value={selectedMidiId} onChange={event => setSelectedMidiId(event.target.value)} aria-label="MIDI input device">
            {midiInputs.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>}
        <span className="keyboard-note-count">{events.filter(event => event.on).length} note-ons captured</span>
      </div>
      <p className="keyboard-midi-status" role="status">{midiStatus}</p>
      <div className="keyboard-computer-hint">Computer keys: <strong>A W S E D F T G Y H U J K O L P ;</strong> (starting at C4)</div>
      <div className="keyboard-piano" aria-label="On-screen piano, two octaves">
        {WHITE_NOTES.map(note => {
          const midiNote = 48 + note;
          return <button key={note} type="button" className={`keyboard-piano-key white-piano-key${pressedNotes.includes(midiNote) ? " is-pressed" : ""}`}
            aria-label={`Play ${noteName(midiNote)}`} onPointerDown={event => { event.preventDefault(); noteOn(midiNote); }}
            onPointerUp={() => noteOff(midiNote)} onPointerLeave={() => noteOff(midiNote)} onPointerCancel={() => noteOff(midiNote)}>{noteName(midiNote)}</button>;
        })}
        {BLACK_NOTES.map(({ note, left }) => {
          const midiNote = 48 + note;
          return <button key={note} type="button" className={`keyboard-piano-key black-piano-key${pressedNotes.includes(midiNote) ? " is-pressed" : ""}`}
            style={{ left: `${(left / 2) * 100}%` }} aria-label={`Play ${noteName(midiNote)}`}
            onPointerDown={event => { event.preventDefault(); noteOn(midiNote); }} onPointerUp={() => noteOff(midiNote)}
            onPointerLeave={() => noteOff(midiNote)} onPointerCancel={() => noteOff(midiNote)}>{NOTE_NAMES[note % 12]}</button>;
        })}
      </div>
      <div className="keyboard-record-controls">
        {!recording ? <button type="button" className="studio-play-button" onClick={startRecording}>● Record take</button>
          : <button type="button" className="studio-play-button keyboard-stop-button" onClick={stopRecording}>■ Stop recording</button>}
        <button type="button" className="studio-toggle" disabled={recording || !events.length} onClick={exportMidi}>Export MIDI (.mid)</button>
        <button type="button" className="studio-toggle" disabled={recording || !events.length} onClick={clearTake}>Clear take</button>
      </div>
      <p className="studio-mixer-footnote">Recording captures note timing relative to the session playhead plus note-on/off and velocity, not a mixed audio file. Start the stems first, then record; use the exported MIDI in a DAW or software instrument to render a full audio take.</p>
    </section>
  );
}
