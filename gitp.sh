#!/bin/bash



#####
##### window.dispatchEvent(new CustomEvent('show-contribution-popup'));
#####

# Quick git workflow script - gitp (git push)
# Usage: 
#   gitp ["Your commit message"]       - Commit and push to current branch
#   gitp -main ["Your commit message"] - Commit to dev, merge to main, checkout back to dev
#   gitp -n ["Your commit message"]    - Dry-run: preview changes without committing
#   gitp -h                            - Show help
# Note: Timestamp is automatically appended to all commit messages

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_merge() {
    echo -e "${CYAN}[MERGE]${NC} $1"
}

print_dry() {
    echo -e "${MAGENTA}[DRY-RUN]${NC} $1"
}

# Show help
show_help() {
    echo -e "${CYAN}gitp${NC} - Quick git workflow script"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  gitp [message]              Commit and push to current branch"
    echo "  gitp -main [message]        Commit, push, merge dev→main, return to dev"
    echo "  gitp -n [message]           Dry-run: preview what would be committed"
    echo "  gitp -u [message]           Add only tracked files (default: includes untracked)"
    echo "  gitp -h, --help             Show this help message"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  -main     Merge mode: push to dev, then merge into main"
    echo "  -n        Dry-run mode: show what would happen without making changes"
    echo "  -u        Add only tracked files (exclude new untracked files)"
    echo "  -h        Show this help"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  gitp                        # Auto-commit with timestamp message"
    echo "  gitp \"Fix login bug\"        # Commit with custom message + timestamp"
    echo "  gitp -n                     # Preview changes without committing"
    echo "  gitp -main \"Release v1.2\"  # Push to dev, merge to main"
    echo "  gitp -u \"Fix bug\"          # Exclude untracked files"
    echo ""
    echo -e "${YELLOW}Notes:${NC}"
    echo "  • Timestamp is automatically appended to all commit messages"
    echo "  • By default, ALL files are staged including new untracked files"
    echo "  • Use -u to exclude untracked files"
    echo "  • Protected branches (main/master/production) will prompt for confirmation"
    exit 0
}

# Generate default commit message with timestamp
generate_default_message() {
    echo "changes made on $(date '+%Y-%m-%d | %H:%M:%S')"
}

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Protected branches that require confirmation
PROTECTED_BRANCHES=("main" "master" "production")

# Parse flags
MERGE_MODE=false
DRY_RUN=false
ADD_ALL=true  # Default to adding all files including untracked

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            show_help
            ;;
        -main)
            MERGE_MODE=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -a|--all)
            ADD_ALL=true
            shift
            ;;
        -u|--tracked-only)
            ADD_ALL=false
            shift
            ;;
        *)
            break  # Stop parsing flags, rest is commit message
            ;;
    esac
done

# Check if commit message is provided, otherwise use default
if [ $# -eq 0 ]; then
    COMMIT_MESSAGE=$(generate_default_message)
    print_status "No commit message provided, using: \"$COMMIT_MESSAGE\""
else
    # Append timestamp to provided message
    COMMIT_MESSAGE="$1 [$TIMESTAMP]"
    print_status "Appending timestamp to your message"
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository!"
    exit 1
fi

# Get current branch early for protection check
CURRENT_BRANCH=$(git branch --show-current)

# Check if pushing to protected branch (skip in merge mode)
if [ "$MERGE_MODE" = false ] && [ "$DRY_RUN" = false ]; then
    for protected in "${PROTECTED_BRANCHES[@]}"; do
        if [ "$CURRENT_BRANCH" == "$protected" ]; then
            print_warning "⚠️  You're about to push directly to protected branch: $CURRENT_BRANCH"
            echo -n "Continue? (y/N): "
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                print_status "Aborted. Consider using a feature branch instead."
                exit 0
            fi
            break
        fi
    done
fi

if [ "$DRY_RUN" = true ]; then
    print_dry "=========================================="
    print_dry "DRY-RUN MODE - No changes will be made"
    print_dry "=========================================="
fi

print_status "Starting git workflow..."

# Check git status
print_status "Checking git status..."
GIT_STATUS=$(git status --porcelain)

if [ -z "$GIT_STATUS" ]; then
    print_warning "No changes to commit."
    echo "Current git status:"
    git status
    exit 0
fi

# Show what will be committed
print_status "Files to be committed:"
echo "$GIT_STATUS" | sed 's/^/  /'

# Dry-run: show what would happen and exit
if [ "$DRY_RUN" = true ]; then
    echo ""
    print_dry "Would commit with message: \"$COMMIT_MESSAGE\""
    print_dry "Would push to branch: $CURRENT_BRANCH"
    if [ "$MERGE_MODE" = true ]; then
        print_dry "Would then merge dev → main"
    fi
    if [ "$ADD_ALL" = true ]; then
        print_dry "Would add ALL files (including untracked)"
    else
        print_dry "Would add only tracked files (use -a for all)"
    fi
    echo ""
    print_dry "=========================================="
    print_dry "End of dry-run. No changes were made."
    print_dry "=========================================="
    exit 0
fi

# Add changes (tracked only by default, or all with -a flag)
if [ "$ADD_ALL" = true ]; then
    print_status "Adding ALL files to staging area (including untracked)..."
    if git add --all; then
        print_success "All files added successfully"
    else
        print_error "Failed to add files"
        exit 1
    fi
else
    print_status "Adding tracked files to staging area..."
    if git add -u; then
        print_success "Tracked files added successfully"
    else
        print_error "Failed to add files"
        exit 1
    fi
    
    # Check for untracked files and warn
    UNTRACKED=$(git status --porcelain | grep "^??" || true)
    if [ -n "$UNTRACKED" ]; then
        print_warning "Untracked files not staged (use -a to include):"
        echo "$UNTRACKED" | sed 's/^??/  /'
    fi
fi

# Commit with provided message
print_status "Committing with message: \"$COMMIT_MESSAGE\""
if git commit -m "$COMMIT_MESSAGE"; then
    print_success "Changes committed successfully"
else
    print_error "Failed to commit changes"
    exit 1
fi

# Check if remote exists
REMOTE_EXISTS=$(git remote)

if [ -z "$REMOTE_EXISTS" ]; then
    print_warning "No remote repository configured."
    print_status "To add a remote, run:"
    echo "  git remote add origin <your-repo-url>"
    exit 0
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

print_status "Pushing to remote repository (branch: $CURRENT_BRANCH)..."

# Push changes
if git push origin "$CURRENT_BRANCH"; then
    print_success "Changes pushed successfully!"
    print_status "Repository URL: $(git remote get-url origin)"
    print_status "Branch: $CURRENT_BRANCH"
else
    print_error "Failed to push changes"
    print_status "You might need to set up authentication or the remote repository"
    exit 1
fi

# Handle merge mode (-main flag)
if [ "$MERGE_MODE" = true ]; then
    echo ""
    print_merge "=========================================="
    print_merge "Starting merge workflow: dev -> main"
    print_merge "=========================================="
    
    # Check if we're on dev branch
    if [ "$CURRENT_BRANCH" != "dev" ]; then
        print_error "Merge mode requires you to be on 'dev' branch!"
        print_error "Current branch: $CURRENT_BRANCH"
        print_status "Please checkout to dev branch first: git checkout dev"
        exit 1
    fi
    
    # Check for uncommitted changes and auto-stash if needed
    STASH_NEEDED=false
    if [ -n "$(git status --porcelain)" ]; then
        print_merge "Uncommitted changes detected, stashing..."
        if git stash push -m "gitp auto-stash before merge [$TIMESTAMP]"; then
            STASH_NEEDED=true
            print_success "Changes stashed successfully"
        else
            print_error "Failed to stash changes"
            exit 1
        fi
    fi
    
    # Checkout to main
    print_merge "Checking out to main branch..."
    if git checkout main; then
        print_success "Switched to main branch"
    else
        print_error "Failed to checkout main branch"
        # Restore stash if we stashed
        if [ "$STASH_NEEDED" = true ]; then
            git stash pop
        fi
        git checkout dev  # Try to go back to dev
        exit 1
    fi
    
    # Pull latest main (in case there are remote changes)
    print_merge "Pulling latest changes from main..."
    if git pull origin main; then
        print_success "Main branch is up to date"
    else
        print_warning "Could not pull main (might be up to date or no remote)"
    fi
    
    # Merge dev into main
    print_merge "Merging dev into main..."
    if git merge dev -m "Merge dev into main [$TIMESTAMP]"; then
        print_success "Merged dev into main successfully"
    else
        print_error "Merge conflict detected!"
        print_error "Please resolve conflicts manually, then:"
        print_status "  1. git add ."
        print_status "  2. git commit"
        print_status "  3. git push origin main"
        print_status "  4. git checkout dev"
        exit 1
    fi
    
    # Push main to remote
    print_merge "Pushing main to remote..."
    if git push origin main; then
        print_success "Main branch pushed successfully!"
    else
        print_error "Failed to push main branch"
        exit 1
    fi
    
    # Checkout back to dev
    print_merge "Checking out back to dev branch..."
    if git checkout dev; then
        print_success "Switched back to dev branch"
    else
        print_error "Failed to checkout dev branch"
        exit 1
    fi
    
    # Restore stash if we stashed earlier
    if [ "$STASH_NEEDED" = true ]; then
        print_merge "Restoring stashed changes..."
        if git stash pop; then
            print_success "Stashed changes restored"
        else
            print_warning "Could not restore stash automatically"
            print_status "Your changes are in: git stash list"
        fi
    fi
    
    echo ""
    print_merge "=========================================="
    print_success "Merge workflow completed! 🚀"
    print_merge "=========================================="
    print_status "dev -> main merge successful"
    print_status "You are now on: dev branch"
fi

print_success "Git workflow completed successfully! 🎉"
