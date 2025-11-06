#!/bin/bash

# Force switch frontend to local environment

echo "🔄 Forcing switch to LOCAL environment..."
echo ""

# 1. Kill any running React dev servers
echo "🛑 Stopping any running React dev servers..."
pkill -f "react-scripts start" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
sleep 1

# 2. Clean all caches
echo "🧹 Cleaning all caches..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf build 2>/dev/null || true
rm -rf .cache 2>/dev/null || true

# 3. Ensure .env.local is set correctly
echo "📝 Setting .env.local to LOCAL environment..."
cat > .env.local <<'EOF'
# Local Development Environment
REACT_APP_ENVIRONMENT=local

# Local Backend URLs
REACT_APP_SOCKET_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:8000/api/users
REACT_APP_WS_URL=ws://localhost:8000

# Disable any production overrides
REACT_APP_DEV_BACKEND_URL=
REACT_APP_POD_BACKEND_URL=

# Firebase Configuration (Push Notifications) - ENABLED
REACT_APP_FIREBASE_API_KEY=AIzaSyBIAPoQzqKnp7XovCmock897kMDpWY8QeQ
REACT_APP_FIREBASE_AUTH_DOMAIN=l3v3lmatchmsgs.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=l3v3lmatchmsgs
REACT_APP_FIREBASE_STORAGE_BUCKET=l3v3lmatchmsgs.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=885095197155
REACT_APP_FIREBASE_APP_ID=1:885095197155:web:b24bd160c031e9097b18d6
REACT_APP_FIREBASE_MEASUREMENT_ID=G-GXYTLN1J8G
REACT_APP_FIREBASE_VAPID_KEY=BLgfsc6KSjjYMTbovL1XIjLujBp_vCdkJ6T05ED_yk9xWYVlPAsY77wwSlCfiqRzKdlzSVRfdoWT6p3EU9tX3GU
EOF

# 4. Remove any runtime config files
echo "🗑️  Removing runtime config..."
rm -f public/config.js 2>/dev/null || true

echo ""
echo "✅ Frontend switched to LOCAL environment!"
echo ""
echo "📝 Now start your React dev server:"
echo "   npm start"
echo ""
echo "🌐 Your app will connect to:"
echo "   Backend: http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
