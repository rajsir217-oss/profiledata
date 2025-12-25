#!/bin/bash
set -e  # Exit on error

# Parse command line arguments
LOG_LEVEL="info"
QUIET_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|-q|--quiet|--errors-only)
            LOG_LEVEL="error"
            QUIET_MODE=true
            shift
            ;;
        -w|--warnings)
            LOG_LEVEL="warning"
            shift
            ;;
        -d|--debug)
            LOG_LEVEL="debug"
            shift
            ;;
        -h|--help)
            echo "Usage: bstart.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -e, -q, --quiet              Show only errors (minimal output)"
            echo "  -w, --warnings               Show warnings and errors"
            echo "  -d, --debug                  Show debug output (verbose)"
            echo "  -h, --help                   Show this help message"
            echo ""
            echo "Default: info level logging"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

clear

echo "🚀 Starting FastAPI Backend..."
echo "================================"

# Switch to local environment
echo "🔄 Switching to local environment..."
"$(dirname "$0")/deploy_gcp/switch-env.sh" local
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
echo "   Log Level: $(echo $LOG_LEVEL | tr '[:lower:]' '[:upper:]')"
echo ""

# Start the server
echo "✅ Starting server on http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop..."
echo "================================"
echo ""

# Start with specified log level
# Export LOG_LEVEL (uppercase) so Python app also respects it
export LOG_LEVEL=$(echo $LOG_LEVEL | tr '[:lower:]' '[:upper:]')

# uvicorn needs lowercase log level
UVICORN_LOG_LEVEL=$(echo $LOG_LEVEL | tr '[:upper:]' '[:lower:]')

if [ "$QUIET_MODE" = true ]; then
    # In quiet mode, also suppress uvicorn access logs
    uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level $UVICORN_LOG_LEVEL --no-access-log
else
    uvicorn main:socket_app --reload --port 8000 --host 0.0.0.0 --log-level $UVICORN_LOG_LEVEL
fi
