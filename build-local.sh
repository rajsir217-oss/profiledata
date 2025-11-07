#!/bin/bash

# Local Build Script
# Generates build info for both frontend and backend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================="
echo "🏗️  Local Build with Build Info"
echo "============================================="
echo ""

# Generate Backend Build Info
echo "📝 Generating backend build info..."
cd "$SCRIPT_DIR/fastapi_backend"
python3 generate_build_info.py
echo ""

# Generate Frontend Build Info
echo "📝 Generating frontend build info..."
cd "$SCRIPT_DIR/frontend"
node generate-build-info.js
echo ""

echo "============================================="
echo "✅ Build info generated for both services"
echo "============================================="
echo ""
echo "Backend build info:"
cat "$SCRIPT_DIR/fastapi_backend/build_info.py" | grep "BUILD_DATE ="
echo ""
echo "Frontend build info:"
cat "$SCRIPT_DIR/frontend/public/build-info.json" | grep buildDate
echo ""
echo "You can now:"
echo "  1. Start backend: cd fastapi_backend && uvicorn main:app --reload"
echo "  2. Start frontend: cd frontend && npm start"
echo "  3. View build info in System Config tab"
echo ""
