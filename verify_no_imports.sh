#!/bin/bash

# Verification Script: Confirm files are not imported
# Run BEFORE cleanup to double-check

echo "🔍 Verifying files are truly unused..."
echo ""

# Files to verify
FILES=(
    "fastapi_backend/fix_all_routes.py"
    "fastapi_backend/routes_fixed.py"
    "frontend/src/components/AccessRequestButton.js"
    "frontend/src/components/ImageCarousel.js"
    "frontend/src/components/ImagePrivacySettings.js"
)

all_safe=true

for file in "${FILES[@]}"; do
    filename=$(basename "$file" .py .js)
    
    # Search for imports
    echo -n "Checking $file... "
    
    # Search in Python files
    imports=$(grep -r "from.*$filename import\|import.*$filename" . \
        --include="*.py" \
        --exclude-dir=__pycache__ \
        --exclude-dir=.pytest_cache \
        --exclude="$file" 2>/dev/null | wc -l)
    
    # Search in JS files
    js_imports=$(grep -r "import.*$filename\|from.*$filename" . \
        --include="*.js" \
        --include="*.jsx" \
        --exclude-dir=node_modules \
        --exclude="$file" 2>/dev/null | wc -l)
    
    total=$((imports + js_imports))
    
    if [ $total -eq 0 ]; then
        echo "✅ SAFE TO DELETE (0 imports)"
    else
        echo "⚠️  WARNING: Found $total imports!"
        all_safe=false
    fi
done

echo ""
if [ "$all_safe" = true ]; then
    echo "✅ All files verified safe to delete!"
    echo "Run ./cleanup_dead_code.sh to proceed."
else
    echo "⚠️  Some files may still be in use. Review before cleanup."
fi
