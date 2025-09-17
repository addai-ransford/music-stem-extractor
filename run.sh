#!/bin/bash

uvicorn backend.mse.api.api:app --reload --host 0.0.0.0 --port 8000