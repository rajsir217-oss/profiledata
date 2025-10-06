#!/bin/bash
clear

echo "🚀 Starting React Frontend..."
echo "=============================="

cd "$(dirname "$0")/frontend"

 kill -9 $(lsof -ti:3000)

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not found!"
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Starting frontend on http://localhost:3000"
echo ""
npm start
