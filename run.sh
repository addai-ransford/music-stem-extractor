#!/bin/bash
# -----------------------------------------------------------------------------
# Script Name: run.sh
# Description: Safely run FastAPI backend and React Vite frontend with:
#              - auto cleanup of backend data directory
#              - stopping any process on backend or frontend ports
#              - building and previewing the frontend
# Author: Ransford Addai
# Date: 2025-09-17
# -----------------------------------------------------------------------------

# ----------------- Configuration -----------------
APP_MODULE="${APP_MODULE:-backend.mse.api.api:app}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DATA_DIR="${DATA_DIR:-data}"
HOST="${HOST:-0.0.0.0}"

echo "Backend APP_MODULE=$APP_MODULE, PORT=$BACKEND_PORT, DATA_DIR=$DATA_DIR"
echo "Frontend DIR=$FRONTEND_DIR, PORT=$FRONTEND_PORT"

# ----------------- Functions -----------------
stop_port() {
    local port=$1
    echo "Stopping any process on port $port..."
    lsof -ti:"$port" | xargs -r kill
    echo "Waiting for port $port to be freed..."
    sleep 2
}

clean_data_dir() {
    if [ -d "$DATA_DIR" ]; then
        echo "Cleaning up $DATA_DIR..."
        rm -rf "${DATA_DIR:?}"/*
    else
        echo "Data directory $DATA_DIR does not exist. Creating..."
        mkdir -p "$DATA_DIR"
    fi
}

build_frontend() {
    if [ -d "$FRONTEND_DIR" ]; then
        echo "Building and previewing frontend..."
        cd "$FRONTEND_DIR" || exit
        npm install
        stop_port "$FRONTEND_PORT"
        npm run build
        npm run preview &
        cd - || exit
    else
        echo "Frontend directory $FRONTEND_DIR does not exist."
    fi
}

start_backend() {
    echo "Starting FastAPI backend..."
    uvicorn "$APP_MODULE" --reload --host "$HOST" --port "$BACKEND_PORT"
}

# ----------------- Main -----------------
main() {
    stop_port "$BACKEND_PORT"
    clean_data_dir
    build_frontend
    start_backend
}

# Execute main
main
