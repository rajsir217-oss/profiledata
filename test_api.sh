#!/bin/bash

# Test script for FastAPI backend
echo "🧪 Testing FastAPI Backend..."
echo ""

# Test 1: Health Check
echo "1️⃣ Testing Health Check..."
HEALTH=$(curl -s http://localhost:8000/health)
if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ Health check passed"
    echo "   Response: $HEALTH"
else
    echo "❌ Health check failed"
    exit 1
fi
echo ""

# Test 2: Root Endpoint
echo "2️⃣ Testing Root Endpoint..."
ROOT=$(curl -s http://localhost:8000/)
if [[ $ROOT == *"Matrimonial"* ]]; then
    echo "✅ Root endpoint passed"
    echo "   Response: $ROOT"
else
    echo "❌ Root endpoint failed"
    exit 1
fi
echo ""

# Test 3: API Documentation
echo "3️⃣ Testing API Documentation..."
DOCS=$(curl -s http://localhost:8000/docs)
if [[ $DOCS == *"swagger"* ]]; then
    echo "✅ API docs available at http://localhost:8000/docs"
else
    echo "❌ API docs not accessible"
    exit 1
fi
echo ""

# Test 4: OpenAPI Schema
echo "4️⃣ Testing OpenAPI Schema..."
OPENAPI=$(curl -s http://localhost:8000/openapi.json)
if [[ $OPENAPI == *"openapi"* ]]; then
    echo "✅ OpenAPI schema available"
else
    echo "❌ OpenAPI schema not accessible"
    exit 1
fi
echo ""

echo "🎉 All tests passed!"
echo ""
echo "📝 Available endpoints:"
echo "   - Health: http://localhost:8000/health"
echo "   - Docs: http://localhost:8000/docs"
echo "   - Register: POST http://localhost:8000/api/users/register"
echo "   - Login: POST http://localhost:8000/api/users/login"
echo "   - Profile: GET http://localhost:8000/api/users/profile/{username}"
echo ""
echo "🚀 Frontend should connect to: http://localhost:8000/api/users"
