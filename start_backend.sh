#!/bin/bash

# Kill any existing backend
pkill -f "uvicorn main:app" 2>/dev/null
sleep 1

cd fastapi_backend

# Install/update dependencies
pip install -q -r requirements.txt

# Start backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
