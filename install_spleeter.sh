#!/bin/bash

echo "Installing Spleeter and its dependencies..."

# Install Spleeter without its dependencies
pip install spleeter==2.4.2 --no-deps

# Manually install required dependencies
pip install tensorflow-io-gcs-filesystem==0.32.0
pip install "httpx[http2]>=0.19.0,<0.20.0"
pip install "norbert>=0.2.1,<0.3.0"
pip install "typer>=0.3.2,<0.4.0"

echo "✅ Spleeter setup complete."
