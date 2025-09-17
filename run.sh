#!/bin/bash
# -----------------------------------------------------------------------------
# Script Name: run.sh
# Description: Safely run the FastAPI server with auto cleanup of data
#              directory and stopping any process on the configured port.
# Author: Ransford Addai
# Date: 2025-09-17
# -----------------------------------------------------------------------------

APP_MODULE="${APP_MODULE:-backend.mse.api.api:app}"
PORT="${PORT:-8000}"
DATA_DIR="${DATA_DIR:-data}"
HOST="${HOST:-0.0.0.0}"

echo "Using APP_MODULE=$APP_MODULE, PORT=$PORT, DATA_DIR=$DATA_DIR"

stop_port() {
    echo "Stopping any process on port $PORT..."
    lsof -ti:"$PORT" | xargs -r kill
    echo "Waiting for the port to be freed..."
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

start_server() {
    echo "Starting FastAPI server..."
    uvicorn "$APP_MODULE" --reload --host "$HOST" --port "$PORT"
}

main() {
    stop_port
    clean_data_dir
    start_server
}

# Execute main
main
