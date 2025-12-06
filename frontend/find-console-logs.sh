#!/bin/bash

# Find Console Logs Script
# Helps identify all console.log, console.warn, console.error usage

echo "🔍 Scanning for console statements in frontend..."
echo ""

# Count total occurrences
TOTAL_LOG=$(grep -r "console\.log" src --include="*.js" --include="*.jsx" | wc -l | xargs)
TOTAL_ERROR=$(grep -r "console\.error" src --include="*.js" --include="*.jsx" | wc -l | xargs)
TOTAL_WARN=$(grep -r "console\.warn" src --include="*.js" --include="*.jsx" | wc -l | xargs)

echo "📊 Summary:"
echo "   console.log:   $TOTAL_LOG occurrences"
echo "   console.error: $TOTAL_ERROR occurrences"
echo "   console.warn:  $TOTAL_WARN occurrences"
echo "   Total:         $((TOTAL_LOG + TOTAL_ERROR + TOTAL_WARN)) console statements"
echo ""

# List files with console statements
echo "📁 Files with console.log:"
grep -r "console\.log" src --include="*.js" --include="*.jsx" -l | sort
echo ""

echo "📁 Files with console.error:"
grep -r "console\.error" src --include="*.js" --include="*.jsx" -l | sort
echo ""

echo "📁 Files with console.warn:"
grep -r "console\.warn" src --include="*.js" --include="*.jsx" -l | sort
echo ""

# Optional: Show detailed lines (uncomment if needed)
# echo "📝 Detailed occurrences:"
# grep -r -n "console\." src --include="*.js" --include="*.jsx" --color=always

echo "✅ Scan complete!"
echo ""
echo "💡 To fix, use the logger utility:"
echo "   import logger from './utils/logger';"
echo "   logger.debug('msg')  - Development only"
echo "   logger.info('msg')   - Dev + Production (if LOG_LEVEL=INFO)"
echo "   logger.error('msg')  - Always shown"
echo ""
echo "📖 See CONSOLE_LOG_MIGRATION_GUIDE.md for details"
