#!/bin/bash
# Install the Python dependencies for this project on macOS.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if ! command -v python3.10 >/dev/null 2>&1; then
    echo "Python 3.10 is required for the pinned Spleeter/TensorFlow stack." >&2
    echo "Install it from https://www.python.org/downloads/release/python-310/" >&2
    echo "If you use Homebrew, try: brew install python@3.10" >&2
    exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is required to install FFmpeg. Install it from https://brew.sh/" >&2
    exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    brew install ffmpeg
fi

if ! command -v lsof >/dev/null 2>&1; then
    echo "lsof is required by run.sh and should be available on macOS." >&2
    exit 1
fi

VENV_DIR="$ROOT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
    python3.10 -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
python -m pip install --upgrade "pip<25"

python -m pip install -r backend/requirements.txt

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
    # Apple Silicon: Apple's TensorFlow build is the supported option for TF 2.12.
    python -m pip install tensorflow-macos==2.12.0 tensorflow-metal==0.8.0
elif [ "$ARCH" = "x86_64" ]; then
    # Intel Macs use the standard CPU TensorFlow wheel.
    python -m pip install tensorflow==2.12.1
else
    echo "Unsupported Mac architecture: $ARCH" >&2
    exit 1
fi

# Install Spleeter without allowing its dependency metadata to replace the
# architecture-specific TensorFlow installation above.
python -m pip install --no-deps spleeter==2.4.2

python - <<'PY'
import fastapi, librosa, numpy, tensorflow, spleeter
from fastapi import File, Form
print("Python audio stack imports OK")
print("TensorFlow:", tensorflow.__version__)
print("NumPy:", numpy.__version__)
print("FastAPI:", fastapi.__version__)
PY

echo
echo "Dependencies installed. Activate the environment with:"
echo "  source .venv/bin/activate"
echo "Then start the app from the repository root with:"
echo "  ./run.sh"
