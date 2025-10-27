#!/bin/bash
set -e  # Exit on error

clear

echo "🚀 Starting FastAPI Backend..."
echo "================================"

# Switch to local environment
echo "🔄 Switching to local environment..."
"$(dirname "$0")/switch-env.sh" local
echo ""

# Change to backend directory
BACKEND_DIR="$(dirname "$0")/fastapi_backend"
cd "$BACKEND_DIR"

# Kill any existing processes on port 8000
echo "🔍 Checking for existing processes on port 8000..."
if lsof -ti:8000 >/dev/null 2>&1; then
    echo "⚠️  Killing existing process on port 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
echo "✅ Port 8000 is available"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "💡 Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if dependencies need to be installed
if [ ! -f "venv/.deps_installed" ] || [ requirements.txt -nt venv/.deps_installed ]; then
    echo "📦 Installing/updating dependencies..."
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    touch venv/.deps_installed
    echo "✅ Dependencies up to date"
fi

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   Environment: local"
echo "   MongoDB: $(grep MONGODB_URL .env | cut -d'=' -f2)"
echo "   Storage: Local (uploads/)"
echo ""

# Start the server
echo "✅ Starting server on http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo "🔍 Log Level: INFO"
echo ""
echo "Press Ctrl+C to stop..."
echo "================================"
echo ""

<<<<<<< HEAD
<<<<<<< HEAD:startb.sh
# Start the server with verbose logging (use socket_app for WebSocket support)
=======
# Start the server with verbose logging (using socket_app for WebSocket support)
# uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level trace

>>>>>>> dev:bstart.sh
uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level debug
=======
# Start with appropriate log level for development
uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level info
>>>>>>> dev
