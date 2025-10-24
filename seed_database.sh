#!/bin/bash

# Seed Cloud MongoDB Atlas with Users, Templates, and Jobs
# This script will populate your cloud database with all necessary data

set -e

echo "🌱 Seed Cloud MongoDB Atlas"
echo "============================"
echo ""

# Prompt for MongoDB password
echo "📝 Your MongoDB connection string:"
echo "   mongodb+srv://rajl3v3l_db_user:<db_password>@mongocluster0.rebdf0h.mongodb.net/"
echo ""
read -sp "🔑 Enter your MongoDB password (for rajl3v3l_db_user): " MONGODB_PASSWORD
echo ""
echo ""

if [ -z "$MONGODB_PASSWORD" ]; then
    echo "❌ Error: Password is required"
    exit 1
fi

# Build full MongoDB URL
MONGODB_URL="mongodb+srv://rajl3v3l_db_user:${MONGODB_PASSWORD}@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0"

# Check if Python dependencies are installed
echo "🔍 Checking dependencies..."
if ! python3 -c "import pymongo; import passlib" 2>/dev/null; then
    echo "📦 Installing required Python packages..."
    pip3 install pymongo passlib[bcrypt]
fi

# Run seeding script
echo ""
echo "🚀 Starting database seeding..."
echo ""
python3 seed_cloud_mongodb.py "$MONGODB_URL"

echo ""
echo "✅ Done!"
echo ""
echo "💡 Next steps:"
echo "   1. Run: ./deploy_cloudrun.sh"
echo "   2. Use these credentials when prompted:"
echo "      MongoDB URL: mongodb+srv://rajl3v3l_db_user:YOUR_PASSWORD@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority"
echo "      Redis URL:   redis://default:2svzScwOza6YUFifjx32WIWqWHytrq12@redis-11872.c263.us-east-1-2.ec2.redns.redis-cloud.com:11872"
echo ""
