#!/bin/bash
clear

echo "🚀 Starting FastAPI Backend..."
echo "================================"

cd "$(dirname "$0")/fastapi_backend"

# Kill any existing processes on port 8000
echo "🔍 Checking for existing processes on port 8000..."
lsof -ti:8000 | xargs -r kill -9 2>/dev/null || echo "✅ No existing processes to kill"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "💡 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "✅ Starting server on http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "🔍 Starting with detailed logging..."
echo ""

# Start the server with verbose logging (use socket_app for WebSocket support)
uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level debug
