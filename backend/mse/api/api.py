from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from backend.mse.api import routers

app = FastAPI(title="Music Stem Extractor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routers.router)


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}

# Serve the production-built React app from the same Cloud Run service.
_frontend_dist = Path(__file__).resolve().parents[3] / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
