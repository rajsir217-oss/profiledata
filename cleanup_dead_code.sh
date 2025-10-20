#!/bin/bash

# ============================================================
# Dead Code Cleanup Script
# ============================================================
# Date: October 19, 2025
# Purpose: Remove confirmed dead code and unused files
# Risk Level: LOW - All deletions verified safe
#
# USAGE:
#   ./cleanup_dead_code.sh           # Normal mode (prompts for confirmation)
#   ./cleanup_dead_code.sh --dry-run # Preview what would be deleted
#   ./cleanup_dead_code.sh --force   # Skip confirmation prompt
#
# FEATURES:
#   ✓ Skips missing files (won't fail if file already deleted)
#   ✓ Continues on errors (ensures maximum cleanup)
#   ✓ Detailed progress reporting with color codes
#   ✓ Dry-run mode for safe preview
#   ✓ Force mode for automated cleanup
#
# SAFETY:
#   - All files verified as unused before deletion
#   - See CLEANUP_DEAD_CODE.md for full audit report
#   - Recommended: Run with --dry-run first
# ============================================================

# Don't exit on error - we want to continue even if files don't exist
# set -e

# Parse command line arguments
DRY_RUN=false
FORCE=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--dry-run] [--force]"
            exit 1
            ;;
    esac
done  

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}║   Dead Code Cleanup - DRY RUN          ║${NC}"
    echo -e "${BLUE}║   Preview Mode (No Files Deleted)     ║${NC}"
else
    echo -e "${BLUE}║   Dead Code Cleanup Script            ║${NC}"
    echo -e "${BLUE}║   Safe Deletion of Unused Files       ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Confirmation prompt
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 DRY RUN MODE: This script will PREVIEW the following:${NC}"
else
    echo -e "${YELLOW}⚠️  This script will DELETE the following:${NC}"
fi
echo ""
echo "Backend (20 files):"
echo "  - 15 fix/utility scripts"
echo "  - 1 duplicate routes file"
echo "  - 4 debris files"
echo ""
echo "Frontend (3 components):"
echo "  - AccessRequestButton.js"
echo "  - ImageCarousel.js"
echo "  - ImagePrivacySettings.js"
echo ""
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}Total: 23 files to be checked${NC}"
    echo ""
    echo -e "${GREEN}▶ Starting dry run preview...${NC}"
else
    echo -e "${YELLOW}Total: 23 files to be deleted${NC}"
    echo ""
    
    # Skip confirmation if --force flag is used
    if [ "$FORCE" != true ]; then
        read -p "Are you sure you want to proceed? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo -e "${RED}❌ Cleanup cancelled.${NC}"
            exit 0
        fi
    else
        echo -e "${YELLOW}⚡ Force mode: Skipping confirmation${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Starting cleanup...${NC}"
fi
echo ""

# Track deletions
deleted_count=0
failed_count=0
skipped_count=0

# Function to safely delete a file
safe_delete() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "  ${BLUE}●${NC} Would delete: $description"
            ((deleted_count++))
        else
            if rm -f "$file" 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} Deleted: $description"
                ((deleted_count++))
            else
                echo -e "  ${RED}✗${NC} Failed to delete: $description"
                ((failed_count++))
            fi
        fi
    else
        echo -e "  ${YELLOW}○${NC} Not found (skipped): $description"
        ((skipped_count++))
    fi
}

# ============================================
# PHASE 1: BACKEND CLEANUP
# ============================================

echo -e "${BLUE}═══ Backend Cleanup ═══${NC}"

# Check if backend directory exists
if [ -d "fastapi_backend" ]; then
    cd fastapi_backend || {
        echo -e "${RED}❌ Cannot access fastapi_backend directory${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️  fastapi_backend directory not found, skipping backend cleanup${NC}"
fi

# Fix Scripts (15 files)
echo "🔧 Removing fix scripts..."
safe_delete "fix_all_routes.py" "fix_all_routes.py"
safe_delete "fix_all_routes_comprehensive.py" "fix_all_routes_comprehensive.py"
safe_delete "fix_dependency_injection.py" "fix_dependency_injection.py"
safe_delete "fix_routes.py" "fix_routes.py"
safe_delete "fix_syntax.py" "fix_syntax.py"
safe_delete "fix_syntax_errors.py" "fix_syntax_errors.py"
safe_delete "fix_test_e2e.py" "fix_test_e2e.py"
safe_delete "fix_test_integration.py" "fix_test_integration.py"
safe_delete "fix_test_integration2.py" "fix_test_integration2.py"
safe_delete "add_except_blocks.py" "add_except_blocks.py"
safe_delete "apply_di_fix.py" "apply_di_fix.py"
safe_delete "comprehensive_fix.py" "comprehensive_fix.py"
safe_delete "systematic_fix.py" "systematic_fix.py"
safe_delete "cleanup_routes.py" "cleanup_routes.py"
safe_delete "cleanup_scheduler.py" "cleanup_scheduler.py"

# Duplicate Routes
echo ""
echo "📄 Removing duplicate routes..."
safe_delete "routes_fixed.py" "routes_fixed.py (duplicate)"

# Debris Files
echo ""
echo "🗑️  Removing debris files..."
safe_delete "GET" "GET (Redis artifact)"
safe_delete "SMEMBERS" "SMEMBERS (Redis artifact)"
safe_delete "exit" "exit (shell artifact)"
safe_delete "DEL" "DEL (command artifact)"

cd ..

# ============================================
# PHASE 2: FRONTEND CLEANUP
# ============================================

echo ""
echo -e "${BLUE}═══ Frontend Cleanup ═══${NC}"

# Check if frontend directory exists
if [ -d "frontend/src/components" ]; then
    cd frontend/src/components || {
        echo -e "${RED}❌ Cannot access frontend/src/components directory${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️  frontend/src/components directory not found, skipping frontend cleanup${NC}"
fi

# Unused Components
echo "🎨 Removing unused React components..."
safe_delete "AccessRequestButton.js" "AccessRequestButton.js"
safe_delete "AccessRequestButton.css" "AccessRequestButton.css"
safe_delete "ImageCarousel.js" "ImageCarousel.js"
safe_delete "ImageCarousel.css" "ImageCarousel.css"
safe_delete "ImagePrivacySettings.js" "ImagePrivacySettings.js"
safe_delete "ImagePrivacySettings.css" "ImagePrivacySettings.css"

cd ../../..

# ============================================
# SUMMARY
# ============================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}║       Dry Run Complete!                ║${NC}"
else
    echo -e "${BLUE}║       Cleanup Complete!                ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Calculate totals
total_processed=$((deleted_count + skipped_count + failed_count))

if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}● Would delete: $deleted_count files${NC}"
    if [ $skipped_count -gt 0 ]; then
        echo -e "${YELLOW}○ Not found: $skipped_count files${NC}"
    fi
else
    echo -e "${GREEN}✅ Successfully deleted: $deleted_count files${NC}"
    if [ $skipped_count -gt 0 ]; then
        echo -e "${YELLOW}○ Skipped (not found): $skipped_count files${NC}"
    fi
    if [ $failed_count -gt 0 ]; then
        echo -e "${RED}✗ Failed to delete: $failed_count files${NC}"
    fi
fi
echo -e "${BLUE}📊 Total processed: $total_processed files${NC}"
echo ""

# ============================================
# NEXT STEPS
# ============================================

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}📋 TO RUN ACTUAL CLEANUP:${NC}"
    echo ""
    echo "Run without --dry-run flag:"
    echo -e "   ${BLUE}./cleanup_dead_code.sh${NC}"
    echo ""
    echo "Or skip confirmation prompt:"
    echo -e "   ${BLUE}./cleanup_dead_code.sh --force${NC}"
    echo ""
else
    echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
    echo ""
    echo "1. Verify backend still runs:"
    echo -e "   ${BLUE}cd fastapi_backend && python main.py${NC}"
    echo ""
    echo "2. Verify frontend builds:"
    echo -e "   ${BLUE}cd frontend && npm run build${NC}"
    echo ""
    echo "3. Run tests:"
    echo -e "   ${BLUE}cd fastapi_backend && pytest${NC}"
    echo ""
    echo "4. Check git status:"
    echo -e "   ${BLUE}git status${NC}"
    echo ""
    echo "5. Commit changes:"
    echo -e "   ${BLUE}git add -A${NC}"
    echo -e "   ${BLUE}git commit -m \"chore: remove dead code - $deleted_count files\"${NC}"
    echo ""
    echo -e "${GREEN}🎉 All done! Your codebase is now cleaner.${NC}"
fi
echo ""

# Show detailed summary
echo -e "${BLUE}═══ Final Summary ═══${NC}"
echo ""
if [ "$DRY_RUN" = true ]; then
    if [ $deleted_count -gt 0 ]; then
        echo -e "${BLUE}● Would delete:${NC} $deleted_count files"
    fi
    if [ $skipped_count -gt 0 ]; then
        echo -e "${YELLOW}○ Would skip:${NC} $skipped_count files (not found)"
    fi
    echo ""
    echo -e "${BLUE}💡 This was a preview. No files were actually deleted.${NC}"
    echo -e "${BLUE}   Run without --dry-run to execute the cleanup.${NC}"
else
    if [ $deleted_count -gt 0 ]; then
        echo -e "${GREEN}✓ Deleted successfully:${NC} $deleted_count files"
    fi
    if [ $skipped_count -gt 0 ]; then
        echo -e "${YELLOW}○ Skipped (not found):${NC} $skipped_count files"
    fi
    if [ $failed_count -gt 0 ]; then
        echo -e "${RED}✗ Failed to delete:${NC} $failed_count files"
    fi
    echo ""
    echo -e "${BLUE}✨ The script continued despite missing files to ensure maximum cleanup.${NC}"
fi
echo ""
