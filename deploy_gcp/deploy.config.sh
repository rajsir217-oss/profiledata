#!/bin/bash

# Centralized Deployment Configuration
# Source this file in all deployment scripts: . ./deploy.config.sh

# =============================================================================
# Google Cloud Configuration
# =============================================================================
PROJECT_ID="${PROJECT_ID:-matrimonial-staging}"
REGION="${REGION:-us-central1}"

# =============================================================================
# Service Names
# =============================================================================
BACKEND_SERVICE="${BACKEND_SERVICE:-matrimonial-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-matrimonial-frontend}"
MESSENGER_SERVICE="${MESSENGER_SERVICE:-matrimonial-messenger}"

# =============================================================================
# Domain Configuration
# =============================================================================
DOMAIN="${DOMAIN:-l3v3lmatches.com}"
MESSENGER_DOMAIN="${MESSENGER_DOMAIN:-messenger.l3v3lmatches.com}"

# =============================================================================
# Cloud Run Resource Configuration
# =============================================================================
# Backend Settings
BACKEND_CPU="${BACKEND_CPU:-1}"
BACKEND_MEMORY="${BACKEND_MEMORY:-1Gi}"
BACKEND_MIN_INSTANCES="${BACKEND_MIN_INSTANCES:-1}"
BACKEND_MAX_INSTANCES="${BACKEND_MAX_INSTANCES:-3}"
BACKEND_TIMEOUT="${BACKEND_TIMEOUT:-300}"
BACKEND_CONCURRENCY="${BACKEND_CONCURRENCY:-80}"
BACKEND_PORT="${BACKEND_PORT:-8080}"

# Frontend Settings
FRONTEND_CPU="${FRONTEND_CPU:-1}"
FRONTEND_MEMORY="${FRONTEND_MEMORY:-512Mi}"
FRONTEND_MIN_INSTANCES="${FRONTEND_MIN_INSTANCES:-1}"
FRONTEND_MAX_INSTANCES="${FRONTEND_MAX_INSTANCES:-2}"
FRONTEND_TIMEOUT="${FRONTEND_TIMEOUT:-60}"
FRONTEND_CONCURRENCY="${FRONTEND_CONCURRENCY:-100}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"

# =============================================================================
# GCS Configuration
# =============================================================================
GCS_BUCKET="${GCS_BUCKET:-matrimonial-uploads-matrimonial-staging}"
GCS_PROJECT_ID="${GCS_PROJECT_ID:-matrimonial-staging}"

# APK GCS Configuration
ANDROID_APK_MAIN_GCS_BUCKET_NAME="${ANDROID_APK_MAIN_GCS_BUCKET_NAME:-matrimonial-uploads-matrimonial-staging}"
ANDROID_APK_MAIN_GCS_OBJECT="${ANDROID_APK_MAIN_GCS_OBJECT:-mobile/android/l3v3lmatches-latest.apk}"
ANDROID_APK_MSGR_GCS_BUCKET_NAME="${ANDROID_APK_MSGR_GCS_BUCKET_NAME:-matrimonial-uploads-matrimonial-staging}"
ANDROID_APK_MSGR_GCS_OBJECT="${ANDROID_APK_MSGR_GCS_OBJECT:-mobile/android/l3v3lmatches-msgr-latest.apk}"

# =============================================================================
# Android Configuration
# =============================================================================
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

# Android Package Names
MAIN_APP_PACKAGE="${MAIN_APP_PACKAGE:-com.l3v3l.matrimony}"
MSGR_APP_PACKAGE="${MSGR_APP_PACKAGE:-com.l3v3lmessenger}"

# =============================================================================
# Messenger Web Configuration
# =============================================================================
MSG_DIR="${MSG_DIR:-$REPO_ROOT/messenger}"
MSG_WEB_DIR="${MSG_WEB_DIR:-$REPO_ROOT/messenger-web}"
WEBPACK_PORT="${WEBPACK_PORT:-3030}"

# =============================================================================
# Deployment Behavior
# =============================================================================
# Set to 'true' to skip all interactive prompts (for CI/CD)
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"

# Set to 'true' to enable verbose logging
VERBOSE="${VERBOSE:-false}"

# =============================================================================
# Validation Functions
# =============================================================================

# Validate URL format
validate_url() {
    local url="$1"
    local url_name="${2:-URL}"
    
    if [[ -z "$url" ]]; then
        echo "❌ $url_name is empty"
        return 1
    fi
    
    if ! [[ "$url" =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$ ]]; then
        echo "❌ Invalid $url_name format: $url"
        echo "   Must start with http:// or https:// and contain valid characters"
        return 1
    fi
    
    return 0
}

# Validate required command exists
validate_command() {
    local cmd="$1"
    local cmd_name="${2:-$cmd}"
    
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ Required command not found: $cmd_name"
        return 1
    fi
    
    return 0
}

# Validate required environment variable
validate_env_var() {
    local var_name="$1"
    local var_value="${!var_name}"
    local var_description="${2:-$var_name}"
    
    if [[ -z "$var_value" ]]; then
        echo "❌ Required environment variable not set: $var_name ($var_description)"
        return 1
    fi
    
    return 0
}

# Validate gcloud authentication
validate_gcloud_auth() {
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null 2>&1; then
        echo "❌ No active gcloud account found"
        return 1
    fi
    return 0
}

# Validate gcloud project access
validate_project_access() {
    local project="${1:-$PROJECT_ID}"
    
    if ! gcloud projects describe "$project" &>/dev/null; then
        echo "❌ No access to project: $project"
        return 1
    fi
    
    return 0
}

# Comprehensive pre-deployment validation
pre_deployment_check() {
    local check_type="${1:-standard}"
    local errors=0
    
    echo "============================================="
    echo "🔍 Pre-Deployment Validation"
    echo "============================================="
    echo ""
    
    # Check gcloud
    echo "Checking gcloud installation..."
    if ! validate_command gcloud "gcloud CLI"; then
        errors=$((errors + 1))
    fi
    
    # Check authentication
    echo "Checking gcloud authentication..."
    if ! validate_gcloud_auth; then
        errors=$((errors + 1))
    fi
    
    # Check project access
    echo "Checking project access to $PROJECT_ID..."
    if ! validate_project_access; then
        errors=$((errors + 1))
    fi
    
    # Standard checks
    if [[ "$check_type" == "standard" ]] || [[ "$check_type" == "full" ]]; then
        # Check required commands based on deployment type
        echo "Checking required commands..."
        
        # Always need these
        if ! validate_command curl "curl"; then
            errors=$((errors + 1))
        fi
        
        # Python needed for frontend deployment
        if [[ "$check_type" == "frontend" ]] || [[ "$check_type" == "full" ]]; then
            if ! validate_command python3 "Python 3"; then
                errors=$((errors + 1))
            fi
            if ! validate_command node "Node.js"; then
                errors=$((errors + 1))
            fi
            if ! validate_command npm "npm"; then
                errors=$((errors + 1))
            fi
        fi
        
        # gsutil needed for APK deployment
        if [[ "$check_type" == "mobile" ]] || [[ "$check_type" == "full" ]]; then
            if ! validate_command gsutil "gsutil"; then
                echo "⚠️  gsutil not found - GCS upload will be skipped"
            fi
        fi
    fi
    
    echo ""
    if [[ $errors -eq 0 ]]; then
        echo "✅ All validation checks passed"
        return 0
    else
        echo "❌ Validation failed: $errors error(s) found"
        return 1
    fi
}

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo "ℹ️  $*"
}

log_success() {
    echo "✅ $*"
}

log_warning() {
    echo "⚠️  $*"
}

log_error() {
    echo "❌ $*"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "🔍 $*"
    fi
}

# =============================================================================
# Utility Functions
# =============================================================================

# Prompt for user input (skips if NON_INTERACTIVE=true)
prompt_user() {
    local prompt="$1"
    local default="${2:-}"
    
    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        if [[ -n "$default" ]]; then
            echo "$default"
        else
            return 1
        fi
    fi
    
    read -p "$prompt" -r response
    echo "${response:-$default}"
}

# Confirm action (auto-accepts if NON_INTERACTIVE=true)
confirm_action() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        return 0
    fi
    
    read -p "$prompt (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# =============================================================================
# Export configuration
# =============================================================================

export PROJECT_ID REGION
export BACKEND_SERVICE FRONTEND_SERVICE MESSENGER_SERVICE
export DOMAIN MESSENGER_DOMAIN
export BACKEND_CPU BACKEND_MEMORY BACKEND_MIN_INSTANCES BACKEND_MAX_INSTANCES
export BACKEND_TIMEOUT BACKEND_CONCURRENCY BACKEND_PORT
export FRONTEND_CPU FRONTEND_MEMORY FRONTEND_MIN_INSTANCES FRONTEND_MAX_INSTANCES
export FRONTEND_TIMEOUT FRONTEND_CONCURRENCY FRONTEND_PORT
export GCS_BUCKET GCS_PROJECT_ID
export ANDROID_APK_MAIN_GCS_BUCKET_NAME ANDROID_APK_MAIN_GCS_OBJECT
export ANDROID_APK_MSGR_GCS_BUCKET_NAME ANDROID_APK_MSGR_GCS_OBJECT
export ANDROID_HOME ANDROID_SDK_ROOT
export MAIN_APP_PACKAGE MSGR_APP_PACKAGE
export MSG_DIR MSG_WEB_DIR WEBPACK_PORT
export NON_INTERACTIVE VERBOSE
