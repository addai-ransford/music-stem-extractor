# 🎶 Music Stem Extractor

This software is built to help musicians, producers, and learners **split, analyze, and visualize music** in seconds.  

---

## 🚀 Overview

This service allows you to:  
- 🎤 **Extract stems** (vocals vs. accompaniment (2 stems), or separate vocals, bass, drums, piano and other instruments (4- or 5-stem models))  
- 🎼 **Detect chords** and build chord progressions  
- 🎵 **Identify the key** of a song  
- 🎶 **Transcribe melody** into solfège notation  
- 📺 Upload audio/video files **or** paste YouTube links  
- 🖥️ Use a clean **React + Tailwind UI** backed by **FastAPI**  

---

## ✨ Features

- ✅ Multi-stem separation powered by [Spleeter](https://github.com/deezer/spleeter)  
- ✅ Chord detection & melody extraction with [Librosa](https://librosa.org/)  
- ✅ Key detection using chroma profiles  
- ✅ YouTube download support via [yt-dlp](https://github.com/yt-dlp/yt-dlp)  
- ✅ Frontend: **React + TailwindCSS** with a modern, responsive UI  
- ✅ Backend: **FastAPI** for scalable, production-ready APIs  
- ✅ File upload or YouTube URL input  
- ✅ Choice of 2, 4, or 5 stems (5-stem mode includes piano)  
- ✅ Real-time job status updates via WebSockets  
- ✅ Download results as ZIP and PDF reports  

---

## 🛠️ Tech Stack

- **Frontend:** React, TailwindCSS, shadcn/ui  
- **Backend:** FastAPI, Python  
- **Audio Processing:** Spleeter, Librosa, NumPy  
- **Video/Audio Utils:** FFmpeg, yt-dlp  
- **Deployment:** Docker  

---

## ⚡ Quick Start

### macOS setup (Apple Silicon and Intel)

Use Python 3.10 for the pinned Spleeter/TensorFlow stack. On macOS, the installer selects the TensorFlow package for your CPU architecture and installs FFmpeg if needed.

```bash
# From the repository root
chmod +x install-macos.sh run.sh
./install-macos.sh
source .venv/bin/activate
./run.sh
```

The installer supports Apple Silicon (arm64) and Intel (x86_64) Macs. Apple Silicon uses `tensorflow-macos` and the optional Metal plugin; Intel Macs use standard CPU TensorFlow. GPU acceleration is not required for separation.

If installation fails, check that Python is exactly 3.10 (`python --version`) and that Xcode Command Line Tools are installed (`xcode-select --install`). TensorFlow/Spleeter compatibility is version-sensitive, so use the provided installer rather than installing the TensorFlow packages independently.

### Manual backend setup

From the repository root, create and activate a Python 3.10 virtual environment, then install the dependencies using `./install-macos.sh`. Do not run `pip install -r backend/requirements.txt` alone on macOS: TensorFlow must be selected for the Mac's CPU architecture first.

### Usage

- Choose Upload to send a local audio/video file, or YouTube to process a link.
- Select a separation mode: 2 stems for vocals + instrumental, 4 stems for vocals/bass/drums/other, or 5 stems to add a piano stem.
- Click Process.
- Wait for the job status to show done.
- Download individual WAV stems or all stems as a ZIP.

Frontend: http://localhost:3000
Backend: http://localhost:8000