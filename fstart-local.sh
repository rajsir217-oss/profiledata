#!/bin/bash
clear

echo "🚀 Starting React Frontend (LOCAL MODE)..."
echo "==========================================="
echo "🧹 Clearing all caches..."

cd "$(dirname "$0")/frontend"

# Kill any existing process
kill -9 $(lsof -ti:3000) 2>/dev/null

# Clear ALL caches
rm -rf node_modules/.cache
rm -rf .cache
rm -rf build

# Verify .env files
echo "📋 Checking .env files..."
if [ -f ".env.development.local" ]; then
    echo "✅ .env.development.local found"
    cat .env.development.local
else
    echo "❌ .env.development.local not found!"
    exit 1
fi

echo ""
echo "🌍 Starting with FORCED LOCAL environment..."
echo "✅ Backend: http://localhost:8000"
echo "✅ Frontend: http://localhost:3000"
echo ""

# Force environment variable
export REACT_APP_ENVIRONMENT=local
export REACT_APP_SOCKET_URL=http://localhost:8000
export REACT_APP_API_URL=http://localhost:8000/api/users

npm start
