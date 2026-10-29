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

## Production deployment (Google Cloud Run)

The repository includes a multi-stage `Dockerfile` and `cloudbuild.yaml`. The image builds the Vite frontend and serves it from FastAPI, so production uses one service and one origin.

### One-time setup

1. Create a Google Cloud project and enable billing.
2. Enable **Cloud Run**, **Cloud Build**, and **Artifact Registry** APIs.
3. Create an Artifact Registry Docker repository named `cloud-run-images` in `us-central1` (or change `_REGION` and `_AR_REPOSITORY` in `cloudbuild.yaml`).
4. Grant the Cloud Build service account permission to write to that Artifact Registry repository and deploy Cloud Run services, including permission to act as the runtime service account.
5. Connect this GitHub repository to a Cloud Build trigger that uses `cloudbuild.yaml`, or run the build manually from the repository root:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

The deploy step currently creates a public service named `stem-lab`. Do not use public unauthenticated deployment for private audio or sensitive workloads without adding application authentication and abuse controls first. The service is configured with 2 CPUs, 4 GiB memory, a single instance, and a 60-minute request timeout because stem separation is memory- and CPU-intensive and job state currently lives in process memory.

### Production limitations to address before scaling

- **Job state is in memory.** A restart loses active job status/results; keep the service at one instance until jobs and status are moved to shared storage/queue.
- **Cloud Run disk is ephemeral.** Processed stems and uploads are not durable across restarts. Use a Cloud Storage bucket and lifecycle rules for persistent output before treating this as a durable production service.
- **Resource use:** TensorFlow/Spleeter can exceed 4 GiB for some workloads. If a job runs out of memory, increase Cloud Run memory and review model/runtime usage.
- The `/healthz` endpoint returns JSON for deployment health checks. It confirms the API process is responding, not that an audio model has completed a real inference.

For a local container smoke test:

```bash
docker build -t stem-lab .
docker run --rm -p 8080:8080 stem-lab
# In another terminal:
curl -fsS http://localhost:8080/healthz
```
