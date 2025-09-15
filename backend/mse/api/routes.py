import os

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse

from backend.mse.services.feature_extractor import LibrosaFeatureExtractor
from backend.mse.services.stem_extractor import SpleeterStemExtractor
from backend.mse.services.yt_downloader import YTDLDownloader
from utils.audio_utils import extract_audio_from_video, safe_zip_folder

router = APIRouter()

# Services
stem_service = SpleeterStemExtractor()
yt_service = YTDLDownloader()
feature_service = LibrosaFeatureExtractor()


@router.post("/process")
async def process(
        stems: int = Form(...),
        youtube_url: str = Form(None),
        file: UploadFile = File(None)
):
    # validate stems
    if stems not in (2, 3, 4):
        raise HTTPException(status_code=400, detail="stems must be 2, 3, or 4")

    if youtube_url and file:
        raise HTTPException(status_code=400, detail="Provide either youtube_url or file, not both")

    # Download / save file
    if youtube_url:
        audio_file = yt_service.download(youtube_url)
    elif file:
        saved = f"/tmp/{file.filename}"
        with open(saved, "wb") as f:
            f.write(await file.read())
        if saved.lower().endswith((".mp4", ".mov", ".mkv", ".avi")):
            audio_file = extract_audio_from_video(saved)
        else:
            audio_file = saved
    else:
        raise HTTPException(status_code=400, detail="No input provided")

    stems_folder = stem_service.extract(audio_file, stems)
    instrumental = f"{stems_folder}/accompaniment.wav"
    vocals = f"{stems_folder}/vocals.wav"

    key = feature_service.detect_key(instrumental)
    chords = feature_service.extract_chords(instrumental)
    melody = feature_service.extract_melody(vocals)
    zip_file = safe_zip_folder(stems_folder, stems_folder + ".zip")

    return JSONResponse({
        "stems_path": stems_folder,
        "stems_zip": zip_file,
        "key": key,
        "chords": chords,
        "melody": melody,
        "instrumental": instrumental,
        "vocals": vocals
    })


@router.get("/download/stems")
def download_stems(path: str):
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="application/zip", filename=os.path.basename(path))
