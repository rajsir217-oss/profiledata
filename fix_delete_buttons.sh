#!/bin/bash
# Fix: Execution History Delete Buttons Not Showing

echo "🔧 Fixing Execution History Delete Buttons..."
echo ""

cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend

echo "1️⃣ Clearing React cache..."
rm -rf node_modules/.cache

echo "2️⃣ Rebuilding frontend..."
npm run build

echo ""
echo "✅ Frontend rebuilt!"
echo ""
echo "Next steps:"
echo "1. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "2. Or clear browser cache and reload"
echo "3. Check Execution History page again"
echo ""
echo "If still not working, restart frontend dev server:"
echo "  npm start"
