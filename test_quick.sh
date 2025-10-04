#!/bin/bash

# Quick Test Script - Fast on-demand testing
# Usage: ./test_quick.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Quick tests
echo "🚀 Running quick tests..."

# Test backend
if curl -s --head --fail "http://localhost:8000" > /dev/null 2>&1; then
    print_success "Backend is running"
else
    print_error "Backend is not running"
    echo "💡 Start with: ./start_backend.sh"
fi

# Test frontend
if curl -s --head --fail "http://localhost:3000" > /dev/null 2>&1; then
    print_success "Frontend is running"
else
    print_error "Frontend is not running"
    echo "💡 Start with: ./start_frontend.sh"
fi

# Test API endpoints
if curl -s "http://localhost:8000/api/users/admin/users" | grep -q '"users"'; then
    print_success "Admin API is working"
else
    print_error "Admin API failed"
fi

# Test search API
if curl -s "http://localhost:8000/api/users/search" | grep -q '"users"'; then
    print_success "Search API is working"
else
    print_error "Search API failed"
fi

echo ""
echo "✅ Quick tests completed!"
