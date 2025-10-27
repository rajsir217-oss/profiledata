#!/bin/bash

# Pre-Deployment Checklist
# Run this before deploying to GCP

echo "🔍 Pre-Deployment Checks"
echo "========================="
echo ""

ERRORS=0
WARNINGS=0

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check 1: Frontend config.js environment
echo -e "${BLUE}1. Checking frontend/public/config.js...${NC}"
if grep -q "ENVIRONMENT: 'local'" frontend/public/config.js; then
    echo -e "${RED}   ❌ FAIL: config.js is set to 'local'${NC}"
    echo "      Must change to 'pod' for production"
    ((ERRORS++))
elif grep -q "ENVIRONMENT: 'pod'" frontend/public/config.js; then
    echo -e "${GREEN}   ✅ PASS: config.js is set to 'pod'${NC}"
else
    echo -e "${YELLOW}   ⚠️  WARNING: Unknown environment${NC}"
    ((WARNINGS++))
fi

# Check 2: Backend .env file
echo -e "${BLUE}2. Checking backend .env configuration...${NC}"
if [ -f "fastapi_backend/.env" ]; then
    if grep -q "USE_GCS=False" fastapi_backend/.env; then
        echo -e "${YELLOW}   ⚠️  WARNING: USE_GCS=False in .env${NC}"
        echo "      Production should use USE_GCS=True"
        ((WARNINGS++))
    else
        echo -e "${GREEN}   ✅ PASS: Configuration looks good${NC}"
    fi
else
    echo -e "${RED}   ❌ FAIL: .env file not found${NC}"
    ((ERRORS++))
fi

# Check 3: .env.production exists
echo -e "${BLUE}3. Checking .env.production...${NC}"
if [ -f "fastapi_backend/.env.production" ]; then
    echo -e "${GREEN}   ✅ PASS: .env.production exists${NC}"
    
    # Check required fields
    if ! grep -q "MONGODB_URL=mongodb+srv" fastapi_backend/.env.production; then
        echo -e "${YELLOW}   ⚠️  WARNING: MONGODB_URL might not be production ready${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}   ❌ FAIL: .env.production not found${NC}"
    ((ERRORS++))
fi

# Check 4: No console.log in production code
echo -e "${BLUE}4. Checking for console.log...${NC}"
CONSOLE_COUNT=$(grep -r "console\.log" frontend/src --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "NODE_ENV" | wc -l | tr -d ' ')
if [ "$CONSOLE_COUNT" -gt 50 ]; then
    echo -e "${YELLOW}   ⚠️  WARNING: Found $CONSOLE_COUNT console.log statements${NC}"
    echo "      Consider removing or wrapping in development checks"
    ((WARNINGS++))
else
    echo -e "${GREEN}   ✅ PASS: Console.log usage is acceptable${NC}"
fi

# Check 5: No hardcoded localhost URLs
echo -e "${BLUE}5. Checking for hardcoded localhost URLs...${NC}"
LOCALHOST_COUNT=$(grep -r "localhost:8000\|localhost:3000" frontend/src --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "RUNTIME_CONFIG" | grep -v "process.env" | grep -v "//" | wc -l | tr -d ' ')
if [ "$LOCALHOST_COUNT" -gt 0 ]; then
    echo -e "${RED}   ❌ FAIL: Found $LOCALHOST_COUNT hardcoded localhost URLs${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}   ✅ PASS: No hardcoded localhost URLs${NC}"
fi

# Check 6: Dependencies up to date
echo -e "${BLUE}6. Checking Python dependencies...${NC}"
if [ -f "fastapi_backend/requirements.txt" ]; then
    echo -e "${GREEN}   ✅ PASS: requirements.txt exists${NC}"
else
    echo -e "${RED}   ❌ FAIL: requirements.txt not found${NC}"
    ((ERRORS++))
fi

# Check 7: Node dependencies
echo -e "${BLUE}7. Checking Node dependencies...${NC}"
if [ -f "frontend/package.json" ]; then
    echo -e "${GREEN}   ✅ PASS: package.json exists${NC}"
else
    echo -e "${RED}   ❌ FAIL: package.json not found${NC}"
    ((ERRORS++))
fi

# Check 8: Dockerfile exists
echo -e "${BLUE}8. Checking Dockerfile...${NC}"
if [ -f "fastapi_backend/Dockerfile" ]; then
    echo -e "${GREEN}   ✅ PASS: Dockerfile exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  WARNING: Dockerfile not found (will be auto-generated)${NC}"
    ((WARNINGS++))
fi

# Check 9: Git status
echo -e "${BLUE}9. Checking git status...${NC}"
if [ -d ".git" ]; then
    UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
    if [ "$UNCOMMITTED" -gt 0 ]; then
        echo -e "${YELLOW}   ⚠️  WARNING: $UNCOMMITTED uncommitted changes${NC}"
        echo "      Commit before deploying"
        ((WARNINGS++))
    else
        echo -e "${GREEN}   ✅ PASS: No uncommitted changes${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  WARNING: Not a git repository${NC}"
    ((WARNINGS++))
fi

# Check 10: GCP CLI installed
echo -e "${BLUE}10. Checking gcloud CLI...${NC}"
if command -v gcloud &> /dev/null; then
    echo -e "${GREEN}   ✅ PASS: gcloud CLI is installed${NC}"
else
    echo -e "${RED}   ❌ FAIL: gcloud CLI not found${NC}"
    echo "      Install: brew install --cask google-cloud-sdk"
    ((ERRORS++))
fi

# Summary
echo ""
echo "========================================"
echo -e "${BLUE}📋 Pre-Deployment Summary${NC}"
echo "========================================"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Ready for deployment!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review warnings above"
    echo "  2. Run: ./deploy-gcp.sh"
    echo "  3. Select deployment option"
    exit 0
else
    echo -e "${RED}❌ NOT ready for deployment${NC}"
    echo ""
    echo "Fix the errors above before deploying."
    exit 1
fi
