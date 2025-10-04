#!/bin/bash

# Comprehensive Testing Script for Profile Data Application
# Usage: ./test_all.sh [watch|demand]
#   watch: Monitor for file changes and run tests automatically
#   demand: Run tests once (default)

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"
TEST_USERNAME="testuser"
TEST_PASSWORD="testpass123"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

print_header() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

print_section() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# Function to check if service is running
check_service() {
    local url=$1
    local service_name=$2

    if curl -s --head --fail "$url" > /dev/null 2>&1; then
        print_success "$service_name is running"
        return 0
    else
        print_error "$service_name is not accessible"
        return 1
    fi
}

# Function to run API test
run_api_test() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=${4:-200}
    local description=$5

    ((TOTAL_TESTS++))

    print_header "Testing $description"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/test_response "$BACKEND_URL$endpoint" 2>/dev/null)
    elif [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/test_response -X POST \
            -H "Content-Type: application/json" \
            -d "$data" "$BACKEND_URL$endpoint" 2>/dev/null)
    else
        print_error "Unsupported test method or missing data"
        return 1
    fi

    http_code=$(echo "$response" | tail -n1)
    response_body=$(cat /tmp/test_response 2>/dev/null || echo "")

    if [ "$http_code" = "$expected_status" ]; then
        print_success "$description - HTTP $http_code"
        echo "  Response: $response_body" | head -c 100
        [ ${#response_body} -gt 100 ] && echo "..."
        return 0
    else
        print_error "$description - Expected HTTP $expected_status, got HTTP $http_code"
        echo "  Response: $response_body"
        return 1
    fi
}

# Function to test user registration
test_user_registration() {
    print_section "USER REGISTRATION TESTS"

    # Test valid registration
    local user_data='{
        "username": "'$TEST_USERNAME'",
        "password": "'$TEST_PASSWORD'",
        "firstName": "Test",
        "lastName": "User",
        "contactEmail": "test@example.com",
        "contactNumber": "1234567890",
        "dob": "1990-01-01",
        "sex": "Male",
        "location": "Test City",
        "education": "B.Tech",
        "occupation": "Software Engineer"
    }'

    run_api_test "POST" "/register" "$user_data" "201" "User registration"
}

# Function to test user login
test_user_login() {
    print_section "USER LOGIN TESTS"

    # Test valid login
    local login_data='{
        "username": "'$TEST_USERNAME'",
        "password": "'$TEST_PASSWORD'"
    }'

    run_api_test "POST" "/login" "$login_data" "200" "User login"
}

# Function to test admin login
test_admin_login() {
    print_section "ADMIN LOGIN TESTS"

    # Test admin login
    local admin_data='{
        "username": "'$ADMIN_USERNAME'",
        "password": "'$ADMIN_PASSWORD'"
    }'

    run_api_test "POST" "/login" "$admin_data" "200" "Admin login"
}

# Function to test admin endpoints
test_admin_endpoints() {
    print_section "ADMIN ENDPOINTS TESTS"

    # Test getting all users (requires admin auth)
    run_api_test "GET" "/admin/users" "" "200" "Admin get all users"
}

# Function to test search functionality
test_search_functionality() {
    print_section "SEARCH FUNCTIONALITY TESTS"

    # Test basic search
    run_api_test "GET" "/search?keyword=test" "" "200" "Basic search"

    # Test search with filters
    run_api_test "GET" "/search?gender=Male&ageMin=25&ageMax=35" "" "200" "Search with filters"

    # Test advanced search
    run_api_test "GET" "/search?religion=Hindu&education=B.Tech&newlyAdded=false" "" "200" "Advanced search filters"
}

# Function to test profile endpoints
test_profile_endpoints() {
    print_section "PROFILE ENDPOINTS TESTS"

    # Test getting user profile
    run_api_test "GET" "/profile/$TEST_USERNAME" "" "200" "Get user profile"

    # Test getting admin profile
    run_api_test "GET" "/profile/$ADMIN_USERNAME" "" "200" "Get admin profile"
}

# Function to test saved searches
test_saved_searches() {
    print_section "SAVED SEARCHES TESTS"

    # Test getting saved searches
    run_api_test "GET" "/$TEST_USERNAME/saved-searches" "" "200" "Get saved searches"

    # Test creating a saved search
    local save_data='{
        "name": "Test Search",
        "criteria": {
            "keyword": "test",
            "gender": "Male"
        }
    }'

    run_api_test "POST" "/$TEST_USERNAME/saved-searches" "$save_data" "200" "Create saved search"
}

# Function to test database connectivity
test_database_connectivity() {
    print_section "DATABASE CONNECTIVITY TESTS"

    # Test if we can connect to MongoDB by checking if users exist
    if curl -s "$BACKEND_URL/api/users/admin/users" | grep -q '"users"'; then
        print_success "Database connectivity verified"
    else
        print_error "Database connectivity failed"
        return 1
    fi
}

# Function to run all tests
run_all_tests() {
    print_section "RUNNING COMPREHENSIVE TEST SUITE"

    echo "🧪 Starting comprehensive tests..."
    echo "📊 Backend URL: $BACKEND_URL"
    echo "🌐 Frontend URL: $FRONTEND_URL"
    echo ""

    # Test basic connectivity first
    check_service "$BACKEND_URL" "Backend API"
    check_service "$FRONTEND_URL" "Frontend App"

    if [ $? -ne 0 ]; then
        print_error "Services not available. Please start the servers first."
        exit 1
    fi

    # Run all test suites
    test_database_connectivity
    test_user_registration
    test_user_login
    test_admin_login
    test_admin_endpoints
    test_search_functionality
    test_profile_endpoints
    test_saved_searches

    # Print summary
    print_section "TEST SUMMARY"
    echo "📈 Tests Run: $TOTAL_TESTS"
    echo "✅ Passed: $PASSED_TESTS"
    echo "❌ Failed: $FAILED_TESTS"

    if [ $FAILED_TESTS -eq 0 ]; then
        print_success "🎉 All tests passed!"
        return 0
    else
        print_error "💥 $FAILED_TESTS test(s) failed!"
        return 1
    fi
}

# Function to watch for file changes (simple polling method)
watch_for_changes() {
    print_status "🔍 Watching for file changes in backend and frontend..."
    print_status "📁 Monitoring: fastapi_backend/, frontend/src/"
    print_status "🛑 Press Ctrl+C to stop watching"
    print_status "💡 Note: Install 'fswatch' for better performance: brew install fswatch"

    local last_backend=$(find fastapi_backend/ -type f -exec stat -f "%m" {} \; | sort -n | tail -1 2>/dev/null || echo "0")
    local last_frontend=$(find frontend/src/ -type f -exec stat -f "%m" {} \; | sort -n | tail -1 2>/dev/null || echo "0")

    while true; do
        sleep 2

        local current_backend=$(find fastapi_backend/ -type f -exec stat -f "%m" {} \; | sort -n | tail -1 2>/dev/null || echo "0")
        local current_frontend=$(find frontend/src/ -type f -exec stat -f "%m" {} \; | sort -n | tail -1 2>/dev/null || echo "0")

        if [ "$current_backend" != "$last_backend" ] || [ "$current_frontend" != "$last_frontend" ]; then
            print_status "🔄 File changes detected, running tests..."
            run_all_tests
            echo ""
            print_status "⏳ Waiting for more changes..."

            last_backend=$current_backend
            last_frontend=$current_frontend
        fi
    done
}

# Main execution
main() {
    local mode=${1:-demand}

    case $mode in
        "watch")
            watch_for_changes
            ;;
        "demand")
            run_all_tests
            ;;
        *)
            echo "Usage: $0 [watch|demand]"
            echo "  watch: Monitor for file changes and run tests automatically"
            echo "  demand: Run tests once (default)"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
