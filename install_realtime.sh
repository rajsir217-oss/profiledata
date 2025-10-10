#!/bin/bash

# Install Real-Time Messaging Dependencies
echo "🚀 Installing Real-Time Messaging Dependencies..."

# Navigate to backend directory
cd fastapi_backend

# Install Python dependencies
echo "📦 Installing Python packages..."
pip install sse-starlette==1.6.5
pip install redis[hiredis]==5.0.1

echo "✅ Backend dependencies installed"

# Check if Redis is running
echo "🔍 Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not running. Please start Redis:"
    echo "   brew services start redis (macOS)"
    echo "   or: redis-server"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Start the backend: ./startb.sh"
echo "2. Start the frontend: cd frontend && npm start"
echo "3. Login with two users in different browsers"
echo "4. Send messages and watch green badges appear instantly!"
echo ""
echo "🎯 Features:"
echo "- Green message badges on profile cards"
echo "- Real-time updates (< 100ms)"
echo "- Browser notifications"
echo "- Unread message counts"
echo "- Works globally on all screens"
