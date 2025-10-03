#!/bin/bash

echo "🚀 Starting Dating App - Full Stack"
echo "===================================="
echo ""
echo "This will start:"
echo "  1. FastAPI Backend (http://localhost:8000)"
echo "  2. React Frontend (http://localhost:3000)"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Get the script directory
SCRIPT_DIR="$(dirname "$0")"

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Trap Ctrl+C
trap cleanup INT TERM

# Start backend in background
echo "📡 Starting Backend..."
cd "$SCRIPT_DIR/fastapi_backend"
source venv/bin/activate 2>/dev/null || true
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend in background
echo "🎨 Starting Frontend..."
cd "$SCRIPT_DIR/frontend"
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ All servers started!"
echo "  Backend: http://localhost:8000 (PID: $BACKEND_PID)"
echo "  Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait
