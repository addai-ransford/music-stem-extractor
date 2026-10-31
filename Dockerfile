# Build the React frontend.
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Python 3.10 is required by the pinned Spleeter/TensorFlow stack.
FROM python:3.10-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 build-essential curl ca-certificates unzip && \
    rm -rf /var/lib/apt/lists/* && \
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh && \
    deno --version
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip && \
    pip install -r /app/backend/requirements.txt && \
    pip install tensorflow-cpu==2.12.0 spleeter==2.4.2 && \
    pip install --upgrade 'typing_extensions>=4.15.0,<5' && \
    python -c "from typing_extensions import Sentinel; import fastapi; print('FastAPI dependency check passed')"
COPY backend/ /app/backend/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN mkdir -p /app/data/stems
EXPOSE 8080
CMD ["sh", "-c", "uvicorn backend.mse.api.api:app --host 0.0.0.0 --port ${PORT}"]
