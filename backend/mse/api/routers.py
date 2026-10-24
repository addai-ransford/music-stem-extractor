import os
import tempfile
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse

from backend.mse.services.feature_extractor import LibrosaFeatureExtractor
from backend.mse.services.stem_extractor import SpleeterStemExtractor
from backend.mse.services.yt_downloader import YTDLDownloader
from backend.mse.utils.audio_utils import extract_audio_from_video, safe_zip_folder, generate_pdf_analysis, \
    build_instrumental

router = APIRouter()

MAX_UPLOAD_BYTES = 500 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".mp4", ".mov", ".mkv", ".avi", ".webm"}
UPLOAD_CHUNK_BYTES = 1024 * 1024

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
            "stems_zip": zip_file,
            "key": key,
            "stems_folder": stems_folder,
            "instrumental": instrumental
        }
        jobs[job_id]["pdf_path"] = None
        notify(job_id, {"status": "done", "result": jobs[job_id]["result"]})

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        notify(job_id, {"status": "error", "error": str(e)})
    finally:
        # Uploaded source files are temporary; never leave user uploads behind.
        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass


# ---------------- Analyze PDF ----------------
def analyze_pdf(job_id: str):
    try:
        job = jobs.get(job_id)
        if not job or not job.get("result"):
            raise ValueError("Stems not available yet")

        stems_folder = job["result"]["stems_folder"]
        instrumental = job["result"].get("instrumental", f"{stems_folder}/accompaniment.wav")
        vocals = f"{stems_folder}/vocals.wav"

        jobs[job_id]["status"] = "analyzing"
        notify(job_id, {"status": "Generating PDF..."})

        # Extract chords & solfège
        chords = feature_service.extract_chords(instrumental)
        melody = feature_service.extract_melody(vocals)

        pdf_path = os.path.join(stems_folder, "analysis.pdf")
        generate_pdf_analysis(pdf_path, chords, melody)

        jobs[job_id]["pdf_path"] = pdf_path
        jobs[job_id]["status"] = "pdf_done"

        notify(job_id, {"status": "pdf_ready"})

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        notify(job_id, {"status": "error", "error": str(e)})


# ---------------- Endpoints ----------------
@router.post("/process")
async def process(background_tasks: BackgroundTasks, stems: int = Form(...), youtube_url: str = Form(None),
                  file: UploadFile = File(None)):
    if stems not in (2, 4, 5):
        raise HTTPException(status_code=400, detail="stems must be 2, 4, or 5")
    if youtube_url and file:
        raise HTTPException(status_code=400, detail="Provide either youtube_url or file, not both")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "result": None, "error": None, "pdf_path": None}

    file_path = None
    if file:
        # Never use a client-supplied filename as a filesystem path.
        extension = os.path.splitext(os.path.basename(file.filename or ""))[1].lower()
        if extension not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported file type.")

        temp_file = tempfile.NamedTemporaryFile(
            prefix=f"mse-{job_id}-",
            suffix=extension,
            dir="/tmp",
            delete=False,
        )
        file_path = temp_file.name
        total_bytes = 0
        try:
            with temp_file:
                while True:
                    chunk = await file.read(UPLOAD_CHUNK_BYTES)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="File exceeds the 500 MB upload limit.")
                    temp_file.write(chunk)
        except Exception:
            if file_path and os.path.isfile(file_path):
                os.remove(file_path)
            raise
        finally:
            await file.close()

    background_tasks.add_task(process_stems, job_id, stems, youtube_url, file_path)
    return JSONResponse({"job_id": job_id})


@router.websocket("/ws/status/{job_id}")
async def websocket_status(ws: WebSocket, job_id: str):
    await ws.accept()
    if job_id not in connections:
        connections[job_id] = []
    connections[job_id].append(ws)

    if job_id in jobs:
        await ws.send_json({
            "status": jobs[job_id]["status"],
            "result": jobs[job_id]["result"],
            "pdf_path": jobs[job_id]["pdf_path"],
            "error": jobs[job_id]["error"]
        })

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if job_id in connections and ws in connections[job_id]:
            connections[job_id].remove(ws)


@router.get("/stems/{job_id}")
def list_stems(job_id: str):
    """List generated audio stems available for individual download."""
    job = jobs.get(job_id)
    if not job or not job.get("result"):
        raise HTTPException(status_code=404, detail="Stems not found")
    stems_folder = job["result"].get("stems_folder")
    if not stems_folder or not os.path.isdir(stems_folder):
        raise HTTPException(status_code=404, detail="Stem files not found")
    files = sorted(
        name for name in os.listdir(stems_folder)
        if name.lower().endswith(".wav")
        and os.path.isfile(os.path.join(stems_folder, name))
        and name != "instrumental.wav"
    )
    return {"stems": [{"name": name, "url": f"/download/stems/{job_id}/{name}"} for name in files]}


@router.get("/download/stems/{job_id}/{stem_name}")
def download_single_stem(job_id: str, stem_name: str):
    """Serve only WAV files located in this job's output folder."""
    job = jobs.get(job_id)
    if not job or not job.get("result"):
        raise HTTPException(status_code=404, detail="Stems not found")
    if os.path.basename(stem_name) != stem_name or not stem_name.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="Invalid stem filename")
    stems_folder = job["result"].get("stems_folder")
    stem_path = os.path.join(stems_folder or "", stem_name)
    if not stems_folder or not os.path.isdir(stems_folder) or not os.path.isfile(stem_path):
        raise HTTPException(status_code=404, detail="Stem file not found")
    return FileResponse(stem_path, media_type="audio/wav", filename=stem_name)


@router.get("/download/stems/{job_id}")
def download_stems(job_id: str):
    job = jobs.get(job_id)
    if not job or not job.get("result"):
        raise HTTPException(status_code=404, detail="Stems not found")
    zip_path = job["result"]["stems_zip"]
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(zip_path, media_type="application/zip", filename=os.path.basename(zip_path))



@router.post("/analyze/{job_id}")
async def generate_pdf(job_id: str, background_tasks: BackgroundTasks):
    job = jobs.get(job_id)
    if not job or not job.get("result"):
        raise HTTPException(status_code=404, detail="Stems not available yet")

    background_tasks.add_task(analyze_pdf, job_id)
    return JSONResponse({"job_id": job_id, "status": "pdf_processing"})


@router.get("/download/pdf/{job_id}")
def download_pdf(job_id: str):
    job = jobs.get(job_id)
    if not job or not job.get("pdf_path"):
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    pdf_path = job["pdf_path"]
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(pdf_path, media_type="application/pdf", filename="analysis.pdf")
