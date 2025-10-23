# 🐳 Local Docker Development Setup

Test your containerized application locally before cloud deployment.

---

## Prerequisites (Mac)

### Install Docker Desktop

```bash
# Download Docker Desktop for Mac
# Visit: https://www.docker.com/products/docker-desktop/

# Or install via Homebrew
brew install --cask docker

# Start Docker Desktop (from Applications)
# Verify installation
docker --version
docker compose version
```

### Allocate Resources

Open Docker Desktop → Settings → Resources:
- **CPUs:** 4 minimum (6-8 recommended)
- **Memory:** 8 GB minimum (16 GB recommended)
- **Disk:** 60 GB minimum

---

## Project Structure

```
matrimonial/
├── docker-compose.local.yml      # Local development
├── docker-compose.prod.yml       # Production config
├── .env.local                    # Local environment
├── fastapi_backend/
│   ├── Dockerfile.dev           # Development image
│   ├── Dockerfile.prod          # Production image
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   └── .dockerignore
└── nginx/
    └── nginx.local.conf
```

---

## Step 1: Create Dockerfiles

### Backend Development Dockerfile

Create `fastapi_backend/Dockerfile.dev`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install development tools
RUN pip install watchdog

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Development server with auto-reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Frontend Development Dockerfile

Create `frontend/Dockerfile.dev`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "start"]
```

### Backend .dockerignore

Create `fastapi_backend/.dockerignore`:

```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv/
.env
.env.local
*.log
.git
.gitignore
README.md
tests/
.pytest_cache
```

### Frontend .dockerignore

Create `frontend/.dockerignore`:

```
node_modules
npm-debug.log
build
.git
.gitignore
README.md
.env.local
.DS_Store
```

---

## Step 2: Local Docker Compose

Create `docker-compose.local.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: matrimonial-dev-db
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: matrimonialDB
    volumes:
      - mongodb_dev_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - matrimonial-dev

  redis:
    image: redis:7-alpine
    container_name: matrimonial-dev-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - matrimonial-dev

  backend:
    build:
      context: ./fastapi_backend
      dockerfile: Dockerfile.dev
    container_name: matrimonial-dev-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URL=mongodb://mongodb:27017
      - REDIS_URL=redis://redis:6379
      - DATABASE_NAME=matrimonialDB
      - ENVIRONMENT=development
      - DEBUG=true
    env_file:
      - .env.local
    volumes:
      # Mount code for hot-reload
      - ./fastapi_backend:/app
      # Exclude venv from mounting
      - /app/venv
    depends_on:
      - mongodb
      - redis
    networks:
      - matrimonial-dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: matrimonial-dev-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000/api/users
      - REACT_APP_SOCKET_URL=http://localhost:8000
      - CHOKIDAR_USEPOLLING=true  # For hot-reload on Mac
    volumes:
      # Mount code for hot-reload
      - ./frontend:/app
      # Exclude node_modules from mounting
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - matrimonial-dev

volumes:
  mongodb_dev_data:

networks:
  matrimonial-dev:
    driver: bridge
```

---

## Step 3: Environment Configuration

Create `.env.local`:

```bash
# MongoDB
MONGODB_URL=mongodb://mongodb:27017
DATABASE_NAME=matrimonialDB

# JWT (development keys - NOT for production!)
SECRET_KEY=development-secret-key-change-in-production-12345678
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Email (local testing - use Mailtrap or similar)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASSWORD=your-mailtrap-password
FROM_EMAIL=dev@localhost
FROM_NAME=L3V3L Dev

# SMS (optional for local testing)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=test_sid
TWILIO_AUTH_TOKEN=test_token
TWILIO_FROM_PHONE=+1234567890

# Development
ENVIRONMENT=development
DEBUG=true
```

---

## Step 4: Start Local Development

### First Time Setup

```bash
# Build images (first time only)
docker compose -f docker-compose.local.yml build

# Start all services
docker compose -f docker-compose.local.yml up -d

# View logs
docker compose -f docker-compose.local.yml logs -f

# Check all containers are running
docker compose -f docker-compose.local.yml ps
```

### Access Your Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **MongoDB:** localhost:27017 (use MongoDB Compass)

### Development Workflow

```bash
# Edit code in your IDE
# Changes auto-reload in both frontend and backend!

# View logs of specific service
docker compose -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.local.yml logs -f frontend

# Restart specific service
docker compose -f docker-compose.local.yml restart backend

# Stop all services
docker compose -f docker-compose.local.yml down

# Stop and remove volumes (fresh start)
docker compose -f docker-compose.local.yml down -v
```

---

## Step 5: Database Management

### Initialize Database

Create `mongo-init.js`:

```javascript
db = db.getSiblingDB('matrimonialDB');

// Create collections
db.createCollection('users');
db.createCollection('favorites');
db.createCollection('shortlists');
db.createCollection('activity_logs');

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 });
db.favorites.createIndex({ userUsername: 1, favoritedUsername: 1 });
db.activity_logs.createIndex({ timestamp: -1 });

// Create test admin user (password: admin123)
db.users.insertOne({
  username: "admin",
  password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeN.B3NdKU4EuWx8u",
  email: "admin@localhost",
  role_name: "admin",
  status: { status: "active" },
  createdAt: new Date()
});

print('✅ Database initialized successfully');
```

### Access MongoDB Shell

```bash
# Connect to MongoDB
docker compose -f docker-compose.local.yml exec mongodb mongosh matrimonialDB

# View collections
show collections

# Query data
db.users.find()

# Exit
exit
```

### Use MongoDB Compass (GUI)

Connection string: `mongodb://localhost:27017/matrimonialDB`

---

## Step 6: Useful Commands

### Container Management

```bash
# View all containers
docker ps

# View logs
docker logs matrimonial-dev-backend
docker logs matrimonial-dev-frontend

# Execute command in container
docker exec -it matrimonial-dev-backend bash
docker exec -it matrimonial-dev-frontend sh

# Stop specific container
docker stop matrimonial-dev-backend

# Remove specific container
docker rm matrimonial-dev-backend
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect matrimonial_mongodb_dev_data

# Remove volume (WARNING: deletes data!)
docker volume rm matrimonial_mongodb_dev_data
```

### Network Management

```bash
# List networks
docker network ls

# Inspect network
docker network inspect matrimonial_matrimonial-dev
```

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi matrimonial-backend-dev

# Remove unused images
docker image prune

# Remove everything (WARNING: nuclear option!)
docker system prune -a --volumes
```

---

## Step 7: Testing in Containers

### Run Backend Tests

```bash
# Execute pytest in backend container
docker compose -f docker-compose.local.yml exec backend pytest

# With coverage
docker compose -f docker-compose.local.yml exec backend pytest --cov
```

### Run Frontend Tests

```bash
# Execute tests in frontend container
docker compose -f docker-compose.local.yml exec frontend npm test
```

---

## Step 8: Debugging

### Check Container Health

```bash
# View container details
docker inspect matrimonial-dev-backend

# Check resource usage
docker stats

# View container processes
docker top matrimonial-dev-backend
```

### Debug Backend Issues

```bash
# View recent logs
docker logs --tail 100 matrimonial-dev-backend

# Follow logs in real-time
docker logs -f matrimonial-dev-backend

# Access backend shell
docker exec -it matrimonial-dev-backend bash

# Check Python packages
docker exec matrimonial-dev-backend pip list

# Test API endpoint
curl http://localhost:8000/health
```

### Debug Frontend Issues

```bash
# View frontend logs
docker logs -f matrimonial-dev-frontend

# Access frontend shell
docker exec -it matrimonial-dev-frontend sh

# Check npm packages
docker exec matrimonial-dev-frontend npm list

# Rebuild frontend
docker compose -f docker-compose.local.yml build frontend
docker compose -f docker-compose.local.yml up -d frontend
```

---

## Step 9: Hot Reload Verification

### Backend Hot Reload

1. Edit any Python file in `fastapi_backend/`
2. Save the file
3. Watch the backend container logs:
   ```bash
   docker logs -f matrimonial-dev-backend
   ```
4. Should see: "Reloading..." and "Application startup complete"

### Frontend Hot Reload

1. Edit any file in `frontend/src/`
2. Save the file
3. Browser should automatically refresh
4. If not working, ensure `CHOKIDAR_USEPOLLING=true` is set

---

## Step 10: Environment Switching

### Switch to Production-like Setup

```bash
# Stop development containers
docker compose -f docker-compose.local.yml down

# Start production containers
docker compose -f docker-compose.prod.yml up -d
```

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: matrimonial-prod-db
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: matrimonialDB
    volumes:
      - mongodb_prod_data:/data/db
    networks:
      - matrimonial-prod

  backend:
    build:
      context: ./fastapi_backend
      dockerfile: Dockerfile.prod
    container_name: matrimonial-prod-backend
    restart: always
    environment:
      - MONGODB_URL=mongodb://admin:${MONGO_ROOT_PASSWORD}@mongodb:27017
      - DATABASE_NAME=matrimonialDB
      - ENVIRONMENT=production
    env_file:
      - .env.production
    depends_on:
      - mongodb
    networks:
      - matrimonial-prod

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: matrimonial-prod-frontend
    restart: always
    networks:
      - matrimonial-prod

  nginx:
    image: nginx:alpine
    container_name: matrimonial-prod-nginx
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.local.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - matrimonial-prod

volumes:
  mongodb_prod_data:

networks:
  matrimonial-prod:
    driver: bridge
```

---

## Common Issues & Solutions

### Issue: Port Already in Use

```bash
# Error: port 8000 is already allocated

# Solution: Stop conflicting service
lsof -ti:8000 | xargs kill -9

# Or change port in docker-compose.local.yml
ports:
  - "8001:8000"  # Map to different host port
```

### Issue: Containers Not Starting

```bash
# Check logs
docker compose -f docker-compose.local.yml logs

# Rebuild from scratch
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml build --no-cache
docker compose -f docker-compose.local.yml up -d
```

### Issue: MongoDB Connection Failed

```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check connection from backend
docker exec matrimonial-dev-backend ping mongodb

# Check MongoDB logs
docker logs matrimonial-dev-db
```

### Issue: Hot Reload Not Working

```bash
# For backend: Ensure volume is mounted correctly
volumes:
  - ./fastapi_backend:/app

# For frontend: Ensure CHOKIDAR_USEPOLLING=true
# On Mac, this is required for file watching
```

---

## Performance Tips

### Optimize Build Speed

1. **Use .dockerignore** - Exclude unnecessary files
2. **Layer caching** - COPY requirements first, then code
3. **BuildKit** - Enable for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   ```

### Reduce Container Size

```dockerfile
# Use slim or alpine images
FROM python:3.11-slim  # Instead of python:3.11

# Multi-stage builds for frontend
FROM node:18-alpine as build
# ... build steps ...
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
```

### Resource Limits

```yaml
backend:
  # ... other config ...
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 512M
```

---

## Next Steps

Once you've tested locally:

1. ✅ **Local works?** → Build production images
2. ✅ **Production images work locally?** → Push to registry
3. ✅ **Images in registry?** → Deploy to cloud

**See next:**
- `KUBERNETES_DEPLOYMENT.md` - Kubernetes setup
- `CLOUD_DEPLOYMENT.md` - AWS ECS, Google Cloud Run, Azure
- `CI_CD_CONTAINERS.md` - Automated build/deploy

---

## Quick Reference

### Start Development
```bash
docker compose -f docker-compose.local.yml up -d
```

### Stop Development
```bash
docker compose -f docker-compose.local.yml down
```

### View Logs
```bash
docker compose -f docker-compose.local.yml logs -f
```

### Rebuild After Changes
```bash
docker compose -f docker-compose.local.yml build
docker compose -f docker-compose.local.yml up -d
```

### Fresh Start
```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d --build
```

---

**🎉 Your local Docker development environment is ready!**

Test everything locally before deploying to the cloud. Changes to code will automatically reload in both frontend and backend containers.
