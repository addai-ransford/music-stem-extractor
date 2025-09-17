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
