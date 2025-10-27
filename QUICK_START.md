# 🚀 Quick Start Guide

## Local Development

### First Time Setup
```bash
# 1. Clone and enter directory
cd profiledata

# 2. Start backend (will auto-install dependencies)
./bstart.sh

# 3. In new terminal, start frontend
./fstart.sh

# 4. Open browser
open http://localhost:3000
```

That's it! The scripts handle everything else.

## Daily Development

```bash
# Terminal 1: Backend
./bstart.sh

# Terminal 2: Frontend  
./fstart.sh
```

## Code Cleanup

```bash
# Analyze codebase
./cleanup.sh

# Follow prompts to archive old files
```

## Before Deploying to GCP

```bash
# 1. Run pre-deployment checks
./pre-deploy-check.sh

# 2. If all checks pass, deploy
./deploy-gcp.sh

# 3. Set up secrets (first time only)
./set-gcp-secrets.sh
```

## Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
lsof -ti:8000

# Kill the process
kill -9 $(lsof -ti:8000)

# Try again
./bstart.sh
```

### Frontend won't start
```bash
# Check if backend is running
curl http://localhost:8000/docs

# If not, start backend first
./bstart.sh

# Then start frontend
./fstart.sh
```

### Environment mismatch
```bash
# Force local environment
./switch-env.sh local

# Check frontend config
cat frontend/public/config.js
# Should show: ENVIRONMENT: 'local'

# Restart both services
```

### Database connection issues
```bash
# Check MongoDB is running
brew services list | grep mongodb

# Start if needed
brew services start mongodb-community

# Check connection
mongosh --eval "db.adminCommand('ping')"
```

### Clean install
```bash
# Backend
cd fastapi_backend
rm -rf venv
cd ..
./bstart.sh

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
./fstart.sh
```

## Useful Commands

### View logs
```bash
# Backend logs (running in terminal)
# Frontend logs (running in terminal)

# MongoDB logs
tail -f /usr/local/var/log/mongodb/mongo.log

# Redis logs (if using)
tail -f /usr/local/var/log/redis.log
```

### Database operations
```bash
# Connect to MongoDB
mongosh matrimonialDB

# List collections
show collections

# View users
db.users.find().pretty()

# Backup database
mongodump --db matrimonialDB --out backup/
```

### Check environment
```bash
# Backend config
cat fastapi_backend/.env | grep -v PASSWORD

# Frontend config
cat frontend/public/config.js

# Current environment
grep ENVIRONMENT fastapi_backend/.env
grep ENVIRONMENT frontend/public/config.js
```

## Scripts Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `./bstart.sh` | Start backend | Every dev session |
| `./fstart.sh` | Start frontend | Every dev session |
| `./switch-env.sh` | Change environment | Switching local↔prod |
| `./cleanup.sh` | Clean old files | Weekly or before commit |
| `./pre-deploy-check.sh` | Validate before deploy | Before GCP deployment |
| `./deploy-gcp.sh` | Deploy to GCP | Production deployment |
| `./set-gcp-secrets.sh` | Set up secrets | First deploy only |

## Configuration Files

### Backend
- `fastapi_backend/.env` - Current config (auto-switched)
- `fastapi_backend/.env.local` - Local development
- `fastapi_backend/.env.production` - GCP production
- `fastapi_backend/config.py` - Settings class

### Frontend
- `frontend/public/config.js` - Runtime config ⚠️ IMPORTANT
- `frontend/.env.development.local` - Development env vars
- `frontend/.env.production` - Production env vars
- `frontend/src/config/apiConfig.js` - Environment detection

## Common Issues

### "Port already in use"
```bash
# Kill the process
./bstart.sh  # Handles this automatically
./fstart.sh  # Handles this automatically
```

### "Backend not responding"
```bash
# Check if running
curl http://localhost:8000/docs

# Check logs in terminal
# Restart if needed
```

### "Images not loading"
```bash
# Check frontend config.js
cat frontend/public/config.js

# Should be 'local' for local dev
# Should be 'pod' for production
```

### "Wrong database"
```bash
# Check MongoDB connection
cat fastapi_backend/.env | grep MONGODB_URL

# Should be:
# Local: mongodb://localhost:27017
# Prod: mongodb+srv://...
```

## Getting Help

1. Check this guide first
2. Check `CLEANUP_SUMMARY.md` for recent changes
3. Check `CODE_CLEANUP_PLAN.md` for roadmap
4. Check `TODO.md` for known issues
5. Check `DEPLOYMENT_GUIDE.md` for deployment help

---
**Last Updated:** October 26, 2025
