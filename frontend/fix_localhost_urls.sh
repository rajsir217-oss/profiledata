#!/bin/bash

# Script to replace all hardcoded localhost:8000 URLs with proper config import
# This fixes the production deployment issue where frontend still points to localhost

echo "🔧 Fixing hardcoded localhost:8000 URLs across frontend..."
echo "=============================================="

# Define files that need fixing (excluding api.js which is already fixed)
FILES=(
  "src/components/DynamicScheduler.js"
  "src/components/EventQueueManager.js"
  "src/components/ActivityLogs.js"
  "src/components/MetaFieldsModal.js"
  "src/components/JobExecutionHistory.js"
  "src/components/ScheduleListModal.js"
  "src/App.js"
  "src/components/AdminContactManagement.js"
  "src/components/AdminPage.js"
  "src/components/ContactUs.js"
  "src/components/NotificationTester.js"
  "src/components/ScheduleNotificationModal.js"
  "src/components/SearchPage.js"
  "src/components/SearchResultCard.js"
  "src/components/Sidebar.js"
  "src/components/TopBar.js"
  "src/components/UserManagement.js"
  "src/services/onlineStatusService.js"
  "src/services/realtimeMessagingService.js"
  "src/services/socketService.js"
  "src/test-dashboard/testApi.js"
)

# Backup directory
BACKUP_DIR="src_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backups in $BACKUP_DIR..."

# Process each file
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ Processing: $file"
    
    # Backup original
    cp "$file" "$BACKUP_DIR/"
    
    # Replace all variations of localhost:8000 with config import
    # This uses sed to replace the hardcoded URLs
    
    # For axios.create or fetch calls with baseURL
    sed -i.bak "s|baseURL: ['\"]http://localhost:8000['\"]|baseURL: window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'|g" "$file"
    
    # For direct URL strings in axios/fetch calls
    sed -i.bak "s|['\"]http://localhost:8000/api/|window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'} + '/api/|g" "$file"
    
    # For template literals
    sed -i.bak "s|\`http://localhost:8000|\`\${window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'}|g" "$file"
    
    # Clean up .bak files
    rm -f "$file.bak"
    
  else
    echo "  ⚠️  File not found: $file"
  fi
done

echo ""
echo "✅ Done! Fixed all hardcoded localhost URLs"
echo "📂 Backups saved to: $BACKUP_DIR"
echo ""
echo "🔍 Remaining localhost:8000 references:"
grep -r "localhost:8000" src/ --include="*.js" --include="*.jsx" | wc -l
echo ""
echo "Next steps:"
echo "1. Review changes: git diff src/"
echo "2. Test locally: npm start"
echo "3. Build for production: npm run build"
echo "4. Deploy!"
