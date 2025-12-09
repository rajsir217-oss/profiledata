#!/bin/bash

# Quick git workflow script - gitp (git push)
# Usage: 
#   gitp ["Your commit message"]       - Commit and push to current branch
#   gitp -main ["Your commit message"] - Commit to dev, merge to main, checkout back to dev
# Note: Timestamp is automatically appended to all commit messages

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

# Generate default commit message with timestamp
generate_default_message() {
    echo "changes made on $(date '+%Y-%m-%d | %H:%M:%S')"
}

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check for -M or --merge flag (merge mode)
MERGE_MODE=false
if [ "$1" == "-M" ] || [ "$1" == "--merge" ]; then
    MERGE_MODE=true
    shift  # Remove flag from arguments
fi

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

# Add all changes
print_status "Adding files to staging area..."
if git add --all; then
    print_success "Files added successfully"
else
    print_error "Failed to add files"
    exit 1
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

# Handle merge mode (-m flag)
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
    
    # Checkout to main
    print_merge "Checking out to main branch..."
    if git checkout main; then
        print_success "Switched to main branch"
    else
        print_error "Failed to checkout main branch"
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
    
    echo ""
    print_merge "=========================================="
    print_success "Merge workflow completed! 🚀"
    print_merge "=========================================="
    print_status "dev -> main merge successful"
    print_status "You are now on: dev branch"
fi

print_success "Git workflow completed successfully! 🎉"
