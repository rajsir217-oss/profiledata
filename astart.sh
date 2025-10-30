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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill process on specific port
kill_port() {
    local port=$1
    local service_name=$2

    echo -e "${YELLOW}🔍 Checking for existing processes on port $port...${NC}"

    # Find processes using the port
    local pids=$(lsof -ti:$port 2>/dev/null || echo "")

    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}🛑 Killing existing $service_name processes (PIDs: $pids)...${NC}"
        kill -9 $pids 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}✅ Killed existing $service_name processes${NC}"
    else
        echo -e "${GREEN}✅ No existing processes on port $port${NC}"
    fi
}

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping all servers...${NC}"

    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}Stopping backend (PID: $BACKEND_PID)...${NC}"
        kill -TERM $BACKEND_PID 2>/dev/null || true
    fi

    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
        kill -TERM $FRONTEND_PID 2>/dev/null || true
    fi

    # Also kill any remaining processes on our ports
    kill_port 8000 "backend"
    kill_port 3000 "frontend"

    echo -e "${GREEN}✅ All servers stopped${NC}"
    exit 0
}

# Trap Ctrl+C and other termination signals
trap cleanup INT TERM EXIT

# Kill existing processes first
echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
kill_port 8000 "backend"
kill_port 3000 "frontend"

# Start backend in background
echo -e "${BLUE}📡 Starting FastAPI Backend...${NC}"

# Check if we're in the right directory
if [ ! -d "$SCRIPT_DIR/fastapi_backend" ]; then
    echo -e "${RED}❌ fastapi_backend directory not found at $SCRIPT_DIR/fastapi_backend${NC}"
    exit 1
fi

cd "$SCRIPT_DIR/fastapi_backend"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️ Virtual environment not found, creating one...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Check if dependencies are installed
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi

# Install/update dependencies
echo -e "${YELLOW}📦 Ensuring dependencies are installed...${NC}"
pip install -r requirements.txt > /dev/null 2>&1

# Start the backend server
echo -e "${YELLOW}🚀 Starting backend server in DEBUG mode...${NC}"
uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level debug &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ FastAPI Backend started in DEBUG mode (PID: $BACKEND_PID)${NC}"
echo -e "${GREEN}📚 API Docs: http://localhost:8000/docs${NC}"

# Start frontend in background
echo ""
echo -e "${BLUE}🎨 Starting React Frontend...${NC}"

# Check if frontend directory exists
if [ ! -d "$SCRIPT_DIR/frontend" ]; then
    echo -e "${RED}❌ frontend directory not found at $SCRIPT_DIR/frontend${NC}"
    exit 1
fi

cd "$SCRIPT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️ Dependencies not installed, installing...${NC}"
    npm install > /dev/null 2>&1
fi

# Start the frontend server
echo -e "${YELLOW}🚀 Starting frontend server...${NC}"
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
sleep 5

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ React Frontend started (PID: $FRONTEND_PID)${NC}"

# Final status
echo ""
echo -e "${GREEN}🎉 All servers started successfully!${NC}"
echo -e "${GREEN}  Backend: http://localhost:8000 (PID: $BACKEND_PID) - DEBUG MODE${NC}"
echo -e "${GREEN}  Frontend: http://localhost:3000 (PID: $FRONTEND_PID)${NC}"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo -e "${BLUE}  - Backend API docs: http://localhost:8000/docs${NC}"
echo -e "${BLUE}  - Press Ctrl+C to stop all servers${NC}"
echo -e "${BLUE}  - Check console output for any errors${NC}"
echo ""

# Wait for both processes (this will run until Ctrl+C)
wait $BACKEND_PID $FRONTEND_PID
