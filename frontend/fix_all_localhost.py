#!/usr/bin/env python3
"""
Fix all hardcoded localhost:8000 URLs in frontend components
Replaces with proper runtime config that works in production
"""

import os
import re
from pathlib import Path

# Files to process  
FILES_TO_FIX = [
    "src/components/DynamicScheduler.js",
    "src/components/EventQueueManager.js",
    "src/components/ActivityLogs.js",
    "src/components/MetaFieldsModal.js",
    "src/components/JobExecutionHistory.js",
    "src/components/ScheduleListModal.js",
    "src/App.js",
    "src/components/AdminContactManagement.js",
    "src/components/AdminPage.js",
    "src/components/ContactUs.js",
    "src/components/NotificationTester.js",
    "src/components/ScheduleNotificationModal.js",
    "src/components/SearchPage.js",
    "src/components/SearchResultCard.js",
    "src/components/Sidebar.js",
    "src/components/TopBar.js",
    "src/components/UserManagement.js",
    "src/test-dashboard/testApi.js",
]

# Replacement patterns
PATTERNS = [
    # Pattern 1: baseURL: 'http://localhost:8000'
    (
        r"baseURL:\s*['\"]http://localhost:8000['\"]",
        "baseURL: window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'"
    ),
    # Pattern 2: 'http://localhost:8000/api/...' in template literals
    (
        r"`http://localhost:8000(/[^`]*)`",
        r"`${window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'}\1`"
    ),
    # Pattern 3: 'http://localhost:8000/api/...' in regular strings
    (
        r"['\"]http://localhost:8000(/[^'\"]*)['\"]",
        r"`${window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'}\1`"
    ),
]

def fix_file(filepath):
    """Fix hardcoded URLs in a single file"""
    if not os.path.exists(filepath):
        print(f"  ⚠️  File not found: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes_made = 0
    
    # Apply all patterns
    for pattern, replacement in PATTERNS:
        new_content, count = re.subn(pattern, replacement, content)
        if count > 0:
            content = new_content
            changes_made += count
    
    if changes_made > 0:
        # Write back to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Fixed {filepath} ({changes_made} replacements)")
        return True
    else:
        print(f"  - No changes needed in {filepath}")
        return False

def main():
    print("🔧 Fixing hardcoded localhost:8000 URLs in frontend...")
    print("=" * 60)
    
    total_fixed = 0
    
    for filepath in FILES_TO_FIX:
        if fix_file(filepath):
            total_fixed += 1
    
    print("\n" + "=" * 60)
    print(f"✅ Done! Fixed {total_fixed} files")
    print("\nNext steps:")
    print("1. Review changes: git diff src/")
    print("2. Test locally: npm start")
    print("3. Build for production: npm run build")
    print("4. Deploy and test in production!")

if __name__ == "__main__":
    main()
