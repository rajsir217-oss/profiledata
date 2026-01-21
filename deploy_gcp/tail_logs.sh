#!/bin/bash

# GCP Cloud Run Logs Tail Script
# Tails production logs in real-time

# Configuration
PROJECT_ID="matrimonial-staging"
BACKEND_SERVICE="matrimonial-backend"
FRONTEND_SERVICE="matrimonial-frontend"
REGION="us-central1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     GCP Cloud Run Log Viewer               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Function to show usage
show_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./tail_logs.sh [option]"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  backend    - Tail backend (FastAPI) logs"
    echo "  frontend   - Tail frontend (React) logs"
    echo "  all        - Tail all Cloud Run logs"
    echo "  errors     - Show only error logs"
    echo "  recent     - Show last 100 log entries"
    echo "  help       - Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./tail_logs.sh backend"
    echo "  ./tail_logs.sh errors"
    echo ""
}

# Function to tail backend logs
tail_backend() {
    echo -e "${GREEN}📡 Tailing Backend Logs (${BACKEND_SERVICE})...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${BACKEND_SERVICE}" \
        --project="${PROJECT_ID}" \
        --format="table(timestamp,severity,textPayload)" \
        --freshness=5m \
        --limit=50
    
    echo ""
    echo -e "${GREEN}Starting live tail...${NC}"
    gcloud alpha logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=${BACKEND_SERVICE}" \
        --project="${PROJECT_ID}" \
        --format="table(timestamp,severity,textPayload)"
}

# Function to tail frontend logs
tail_frontend() {
    echo -e "${GREEN}📡 Tailing Frontend Logs (${FRONTEND_SERVICE})...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${FRONTEND_SERVICE}" \
        --project="${PROJECT_ID}" \
        --format="table(timestamp,severity,textPayload)" \
        --freshness=5m \
        --limit=50
    
    echo ""
    echo -e "${GREEN}Starting live tail...${NC}"
    gcloud alpha logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=${FRONTEND_SERVICE}" \
        --project="${PROJECT_ID}" \
        --format="table(timestamp,severity,textPayload)"
}

# Function to tail all logs
tail_all() {
    echo -e "${GREEN}📡 Tailing All Cloud Run Logs...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    gcloud alpha logging tail "resource.type=cloud_run_revision" \
        --project="${PROJECT_ID}" \
        --format="table(resource.labels.service_name,timestamp,severity,textPayload)"
}

# Function to show only errors
tail_errors() {
    echo -e "${RED}🚨 Showing Error Logs...${NC}"
    echo ""
    gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
        --project="${PROJECT_ID}" \
        --format="table(resource.labels.service_name,timestamp,severity,textPayload)" \
        --freshness=1d \
        --limit=100
}

# Function to show recent logs
show_recent() {
    echo -e "${GREEN}📋 Recent Logs (last 100 entries)...${NC}"
    echo ""
    gcloud logging read "resource.type=cloud_run_revision" \
        --project="${PROJECT_ID}" \
        --format="table(resource.labels.service_name,timestamp,severity,textPayload)" \
        --freshness=1h \
        --limit=100
}

# Main logic
case "${1:-help}" in
    backend|b)
        tail_backend
        ;;
    frontend|f)
        tail_frontend
        ;;
    all|a)
        tail_all
        ;;
    errors|e)
        tail_errors
        ;;
    recent|r)
        show_recent
        ;;
    help|h|*)
        show_usage
        ;;
esac
