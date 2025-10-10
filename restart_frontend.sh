#!/bin/bash

echo "🛑 Stopping frontend..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "🧹 Clearing webpack cache..."
rm -rf frontend/node_modules/.cache

echo "🚀 Starting frontend..."
cd frontend && npm start
