#!/bin/bash

# Setup Google Cloud Project for L3V3L Matrimonial
# This script creates a new GCP project and enables required services

set -e

echo "🚀 Setting Up Google Cloud Project"
echo "===================================="
echo ""

PROJECT_ID="matrimonial-staging"
PROJECT_NAME="L3V3L Matrimonial Staging"

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "🔐 Please login to Google Cloud..."
    gcloud auth login
fi

ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n1)
echo "✅ Logged in as: $ACCOUNT"
echo ""

# Check if project exists
if gcloud projects describe $PROJECT_ID &>/dev/null; then
    echo "✅ Project '$PROJECT_ID' already exists"
else
    echo "📦 Creating new project: $PROJECT_ID"
    
    # Try to create project
    if gcloud projects create $PROJECT_ID --name="$PROJECT_NAME" 2>/dev/null; then
        echo "✅ Project created successfully!"
    else
        echo ""
        echo "❌ Failed to create project. This usually means:"
        echo ""
        echo "Option 1: You don't have permission to create projects"
        echo "   Solution: Use an existing project instead"
        echo ""
        echo "Option 2: Project ID is already taken globally"
        echo "   Solution: Use a different project ID"
        echo ""
        echo "Let's use an existing project or create one with a unique ID:"
        echo ""
        
        # List existing projects
        echo "📋 Your existing projects:"
        gcloud projects list --format="table(projectId,name)" 2>/dev/null || echo "   (No projects found)"
        echo ""
        
        read -p "Enter project ID to use (or press Enter to create with unique ID): " USER_PROJECT_ID
        
        if [ -z "$USER_PROJECT_ID" ]; then
            # Generate unique project ID with timestamp
            UNIQUE_ID="matrimonial-$(date +%s)"
            echo ""
            echo "📦 Creating project with unique ID: $UNIQUE_ID"
            
            if gcloud projects create $UNIQUE_ID --name="$PROJECT_NAME"; then
                PROJECT_ID=$UNIQUE_ID
                echo "✅ Project created: $PROJECT_ID"
            else
                echo "❌ Still failed. Please create project manually at:"
                echo "   https://console.cloud.google.com/projectcreate"
                exit 1
            fi
        else
            PROJECT_ID=$USER_PROJECT_ID
            echo "✅ Using existing project: $PROJECT_ID"
        fi
    fi
fi

echo ""
echo "🔧 Setting active project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

echo ""
echo "🔌 Enabling required APIs..."
echo "   (This may take 2-3 minutes...)"

# Enable APIs one by one with better error handling
apis=(
    "run.googleapis.com"
    "cloudbuild.googleapis.com"
    "containerregistry.googleapis.com"
)

for api in "${apis[@]}"; do
    echo -n "   Enabling $api... "
    if gcloud services enable $api 2>/dev/null; then
        echo "✅"
    else
        echo "⚠️  (may require billing to be enabled)"
    fi
done

echo ""
echo "💳 Checking billing status..."

# Check if billing is enabled
BILLING_ENABLED=$(gcloud beta billing projects describe $PROJECT_ID --format="value(billingEnabled)" 2>/dev/null || echo "false")

if [ "$BILLING_ENABLED" = "True" ] || [ "$BILLING_ENABLED" = "true" ]; then
    echo "✅ Billing is enabled"
else
    echo "⚠️  Billing is NOT enabled"
    echo ""
    echo "📌 Important: Cloud Run requires billing to be enabled"
    echo "   (But there's a generous FREE tier - likely $0/month for your usage)"
    echo ""
    echo "To enable billing:"
    echo "   1. Visit: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    echo "   2. Select or create a billing account"
    echo "   3. Link it to this project"
    echo ""
    read -p "Press Enter after enabling billing to continue..."
fi

echo ""
echo "=============================================="
echo "✅ GCP Project Setup Complete!"
echo "=============================================="
echo ""
echo "📊 Summary:"
echo "   Project ID: $PROJECT_ID"
echo "   Project Name: $PROJECT_NAME"
echo "   Account: $ACCOUNT"
echo ""
echo "🎯 Next Steps:"
echo "   1. Make sure billing is enabled (free tier available)"
echo "   2. Run: ./deploy_cloudrun.sh"
echo ""
echo "💡 Useful Links:"
echo "   Console: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo "   Billing: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
echo ""

# Save project ID for deploy script
echo "$PROJECT_ID" > .gcp_project_id
echo "💾 Saved project ID to .gcp_project_id"
echo ""
