#!/bin/bash
set -e  # Exit on error

clear

echo "🚀 Starting React Frontend..."
echo "=============================="

# Switch to local environment
echo "🔄 Switching to local environment..."
"$(dirname "$0")/deploy_gcp/switch-env.sh" local
echo ""

# Check if backend is running
echo "🔍 Checking backend..."
if ! curl -s http://localhost:8000/docs >/dev/null 2>&1; then
    echo "⚠️  Backend not detected on http://localhost:8000"
    echo "   Start backend first: ./bstart.sh"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Backend is running"
fi
echo ""

# Change to frontend directory
FRONTEND_DIR="$(dirname "$0")/frontend"
cd "$FRONTEND_DIR"

# Kill any existing processes on port 3000
echo "🔍 Checking for existing processes on port 3000..."
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "⚠️  Killing existing process on port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
echo "✅ Port 3000 is available"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not found!"
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Check if config.js has correct environment
if grep -q "ENVIRONMENT: 'pod'" public/config.js; then
    echo "⚠️  WARNING: public/config.js is set to 'pod' (production)"
    echo "   Should be 'local' for local development"
    echo "   Fix: Edit frontend/public/config.js"
    echo ""
fi

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   Environment: local"
echo "   Backend URL: http://localhost:8000"
echo "   Frontend URL: http://localhost:3000"
echo ""

echo "✅ Starting frontend on http://localhost:3000"
echo "🌐 Network: http://$(ipconfig getifaddr en0 2>/dev/null || echo 'N/A'):3000"
echo ""
echo "Press Ctrl+C to stop..."
echo "=============================="
echo ""

npm start
