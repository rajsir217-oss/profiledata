#!/bin/bash

# Quick git workflow script - gitp (git push)
# Usage: ./gitp.sh ["Your commit message"]

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

# Generate default commit message with timestamp
generate_default_message() {
    echo "changes made on $(date '+%Y-%m-%d | %H:%M:%S')"
}

# Check if commit message is provided, otherwise use default
if [ $# -eq 0 ]; then
    COMMIT_MESSAGE=$(generate_default_message)
    print_status "No commit message provided, using: \"$COMMIT_MESSAGE\""
else
    COMMIT_MESSAGE="$1"
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
if git add .; then
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

print_success "Git workflow completed successfully! 🎉"
