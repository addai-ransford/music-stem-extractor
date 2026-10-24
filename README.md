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

### Backend

```bash

cd backend
pip install -r requirements.txt
chmod +x run.sh && ./run.sh

```

📄 Usage

- Choose Upload to send a local audio/video file, or YouTube to process a link.
- Select a separation mode: 2 stems for vocals + instrumental, 4 stems for vocals/bass/drums/other, or 5 stems to add a piano stem.
- Click Process.
- Wait for the job status to show done.
- Download stems ZIP or analysis PDF.


Runs on http://localhost:3000