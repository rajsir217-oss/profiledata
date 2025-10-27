#!/bin/bash

# Code Cleanup Script
# Identifies files that can be safely archived or removed

echo "🧹 Code Cleanup Analysis"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Find .bak files
echo -e "${BLUE}📄 Backup Files (.bak):${NC}"
find . -name "*.bak" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.git/*"
BAK_COUNT=$(find . -name "*.bak" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.git/*" | wc -l)
echo -e "${YELLOW}Found: $BAK_COUNT files${NC}"
echo ""

# Find .toberemoved files
echo -e "${BLUE}🗑️  To Be Removed Files:${NC}"
find . -name "*.toberemoved" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.git/*"
TBR_COUNT=$(find . -name "*.toberemoved" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.git/*" | wc -l)
echo -e "${YELLOW}Found: $TBR_COUNT files${NC}"
echo ""

# Find unused .env files
echo -e "${BLUE}⚙️  Environment Files:${NC}"
find frontend -maxdepth 1 -name ".env*" -type f
echo ""

# Find console.log in frontend (production code)
echo -e "${BLUE}📊 Console.log statements in frontend:${NC}"
CONSOLE_COUNT=$(grep -r "console\.log" frontend/src --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
echo -e "${YELLOW}Found: $CONSOLE_COUNT statements${NC}"
echo ""

# Find TODO and FIXME comments
echo -e "${BLUE}📝 TODO/FIXME Comments:${NC}"
TODO_COUNT=$(grep -r "TODO\|FIXME" fastapi_backend frontend/src --include="*.py" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
echo -e "${YELLOW}Found: $TODO_COUNT comments${NC}"
echo ""

# Check for hardcoded URLs
echo -e "${BLUE}🔗 Hardcoded localhost URLs:${NC}"
LOCALHOST_COUNT=$(grep -r "localhost:8000\|localhost:3000" frontend/src --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "RUNTIME_CONFIG" | grep -v "process.env" | grep -v "//" | wc -l)
echo -e "${YELLOW}Found: $LOCALHOST_COUNT instances${NC}"
echo ""

# ESLint warnings
echo -e "${BLUE}⚠️  ESLint Warnings:${NC}"
if [ -f "frontend/package.json" ]; then
    cd frontend && npm run lint 2>&1 | grep -i "warning" | head -5
    cd ..
fi
echo ""

# Summary
echo "========================================"
echo -e "${GREEN}📋 Cleanup Summary:${NC}"
echo "  .bak files: $BAK_COUNT"
echo "  .toberemoved files: $TBR_COUNT"
echo "  console.log: $CONSOLE_COUNT"
echo "  TODO/FIXME: $TODO_COUNT"
echo "  Hardcoded URLs: $LOCALHOST_COUNT"
echo ""

# Ask for confirmation
echo -e "${YELLOW}Would you like to:${NC}"
echo "1) Archive .bak and .toberemoved files"
echo "2) Just show the list (no changes)"
echo "3) Exit"
read -p "Enter choice (1-3): " CHOICE

case $CHOICE in
    1)
        echo -e "${GREEN}📦 Creating archive directory...${NC}"
        mkdir -p .archive/$(date +%Y%m%d)
        
        # Move .bak files
        find . -name "*.bak" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.git/*" -exec mv {} .archive/$(date +%Y%m%d)/ \;
        
        # Move .toberemoved files
        find . -name "*.toberemoved" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.git/*" -exec mv {} .archive/$(date +%Y%m%d)/ \;
        
        echo -e "${GREEN}✅ Files archived to .archive/$(date +%Y%m%d)/${NC}"
        echo "You can delete this folder later after confirming everything works."
        ;;
    2)
        echo "No changes made."
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Cleanup analysis complete!${NC}"
echo "Next steps:"
echo "  1. Review archived files"
echo "  2. Run: git status"
echo "  3. Test: ./bstart.sh && ./fstart.sh"
echo "  4. If all works, delete .archive folder"
