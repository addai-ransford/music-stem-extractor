import os
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse

from backend.mse.services.feature_extractor import LibrosaFeatureExtractor
from backend.mse.services.stem_extractor import SpleeterStemExtractor
from backend.mse.services.yt_downloader import YTDLDownloader
from backend.mse.utils.audio_utils import extract_audio_from_video, safe_zip_folder, generate_pdf_analysis, \
    build_instrumental

router = APIRouter()

# Services
stem_service = SpleeterStemExtractor()
yt_service = YTDLDownloader()
feature_service = LibrosaFeatureExtractor()

# Job tracking
jobs = {}  # job_id -> {"status": str, "result": dict or None, "error": str or None, "pdf_path": str or None}
connections = {}  # job_id -> list of WebSocket connections


# ---------------- Helper functions ----------------
async def send_safe(ws: WebSocket, message: dict):
    try:
        await ws.send_json(message)
    except Exception:
        pass


def notify(job_id: str, message: dict):
    if job_id in connections:
        alive_connections = []
        for ws in connections[job_id]:
            try:
                import asyncio
                asyncio.run(send_safe(ws, message))
                alive_connections.append(ws)
            except Exception:
                pass
        connections[job_id] = alive_connections


# ---------------- Process stems ----------------
def process_stems(job_id: str, stems: int, youtube_url: str = None, file_path: str = None):
    try:
        jobs[job_id]["status"] = "downloading"
        notify(job_id, {"status": "Downloading / saving file..."})

        # Step 1: Download or prepare a file
        if youtube_url:
            audio_file = yt_service.download(youtube_url)
        elif file_path:
            if file_path.lower().endswith((".mp4", ".mov", ".mkv", ".avi")):
                audio_file = extract_audio_from_video(file_path)
            else:
                audio_file = file_path
        else:
            raise ValueError("No input provided")

        # Step 2: Extract stems
        jobs[job_id]["status"] = "extracting"
        notify(job_id, {"status": "Extracting stems..."})
        stems_folder = stem_service.extract(audio_file, stems)

        # Step 3: Detect key (always fast)
        jobs[job_id]["status"] = "key"
        notify(job_id, {"status": "Detecting key..."})
        instrumental = build_instrumental(stems_folder, stems)
        key = feature_service.detect_key(instrumental)

        # Zip stems
        jobs[job_id]["status"] = "zipping"
        notify(job_id, {"status": "Zipping stems..."})
        zip_file = safe_zip_folder(stems_folder, stems_folder + ".zip")

        stems_url = f"/download/stems/{job_id}"

        jobs[job_id]["status"] = "done"
        jobs[job_id]["result"] = {
            "stems_zip": stems_url,
            "key": key,
            "stems_folder": stems_folder
        }
        jobs[job_id]["pdf_path"] = None
        notify(job_id, {"status": "done", "result": jobs[job_id]["result"]})

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        notify(job_id, {"status": "error", "error": str(e)})
