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
            echo "Usage: bgcpstart.sh [OPTIONS]"
            echo ""
            echo "Start backend with PRODUCTION MongoDB database (for local testing)"
            echo ""
            echo "Options:"
            echo "  -e, -q, --quiet              Show only errors (minimal output)"
            echo "  -w, --warnings               Show warnings and errors"
            echo "  -d, --debug                  Show debug output (verbose)"
            echo "  -h, --help                   Show this help message"
            echo ""
            echo "Default: info level logging"
            echo ""
            echo "⚠️  WARNING: This connects to PRODUCTION database!"
            echo "   Any changes you make will affect real user data."
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

echo "🚀 Starting FastAPI Backend with PRODUCTION Database..."
echo "========================================================"
echo ""
echo "⚠️  WARNING: Connected to PRODUCTION MongoDB!"
echo "   Any changes will affect real user data."
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

# Production MongoDB URL
PROD_MONGODB_URL="mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0"

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   Environment: local + PRODUCTION DB"
echo "   MongoDB: mongodb+srv://...mongocluster0.rebdf0h.mongodb.net/matrimonialDB"
echo "   Frontend: http://localhost:3000"
echo "   Log Level: $(echo $LOG_LEVEL | tr '[:lower:]' '[:upper:]')"
echo ""

# Start the server
echo "✅ Starting server on http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop..."
echo "========================================================"
echo ""

# Export environment variables for production database
export MONGODB_URL="$PROD_MONGODB_URL"
export DATABASE_NAME="matrimonialDB"
export FRONTEND_URL="http://localhost:3000"
export BACKEND_URL="http://localhost:8000"
export ENV="development"

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
