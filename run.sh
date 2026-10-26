#!/bin/bash
# Run FastAPI backend and React Vite frontend.
set -e

APP_MODULE="${APP_MODULE:-backend.mse.api.api:app}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DATA_DIR="${DATA_DIR:-data}"
HOST="${HOST:-0.0.0.0}"

echo "Backend APP_MODULE=$APP_MODULE, PORT=$BACKEND_PORT, DATA_DIR=$DATA_DIR"
echo "Frontend DIR=$FRONTEND_DIR, PORT=$FRONTEND_PORT"

stop_port() {
    local port="$1"
    echo "Stopping any process on port $port..."
    # macOS/BSD xargs does not support GNU xargs -r; avoid invoking kill with no PID.
    local pids
    pids="$(lsof -ti:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
        echo "$pids" | while IFS= read -r pid; do
            [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
        done
    fi
    sleep 1
}

clean_data_dir() {
    mkdir -p "$DATA_DIR"
    # Preserve the directory itself; remove its contents safely.
    find "$DATA_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
}

build_frontend() {
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo "Frontend directory '$FRONTEND_DIR' does not exist." >&2
        return 1
    fi
    echo "Installing and building frontend..."
    cd "$FRONTEND_DIR"
    npm install
    stop_port "$FRONTEND_PORT"
    npm run build
    npm run preview -- --host 0.0.0.0 &
    cd - >/dev/null
}

start_backend() {
    echo "Starting FastAPI backend..."
    uvicorn "$APP_MODULE" --reload --host "$HOST" --port "$BACKEND_PORT"
}

main() {
    stop_port "$BACKEND_PORT"
    clean_data_dir
    build_frontend
    start_backend
}

main "$@"
