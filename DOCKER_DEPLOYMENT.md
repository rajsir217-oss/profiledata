# 🐳 Docker Deployment Guide

Deploy the L3V3L Matrimonial Platform using Docker containers.

---

## Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

---

## Project Structure

```
matrimonial/
├── docker-compose.yml
├── fastapi_backend/
│   ├── Dockerfile
│   ├── .env.production
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.production
└── nginx/
    └── nginx.conf
```

---

## Backend Dockerfile

Create `fastapi_backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

---

## Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## Frontend Nginx Config

Create `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: matrimonial-db
    restart: always
    environment:
      MONGO_INITDB_DATABASE: matrimonialDB
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - matrimonial-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/matrimonialDB --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: matrimonial-redis
    restart: always
    networks:
      - matrimonial-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./fastapi_backend
      dockerfile: Dockerfile
    container_name: matrimonial-backend
    restart: always
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - MONGODB_URL=mongodb://mongodb:27017
      - REDIS_URL=redis://redis:6379
      - DATABASE_NAME=matrimonialDB
    env_file:
      - ./fastapi_backend/.env.production
    networks:
      - matrimonial-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: matrimonial-frontend
    restart: always
    depends_on:
      - backend
    networks:
      - matrimonial-network

  nginx:
    image: nginx:alpine
    container_name: matrimonial-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot-data:/var/www/certbot
    depends_on:
      - frontend
      - backend
    networks:
      - matrimonial-network

  certbot:
    image: certbot/certbot
    container_name: matrimonial-certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - certbot-data:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email admin@yourdomain.com --agree-tos --no-eff-email -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

volumes:
  mongodb_data:
  certbot-data:

networks:
  matrimonial-network:
    driver: bridge
```

---

## Main Nginx Config

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;
    gzip on;

    # Frontend
    upstream frontend {
        server matrimonial-frontend:80;
    }

    # Backend API
    upstream backend {
        server matrimonial-backend:8000;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com api.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # Frontend HTTPS
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/yourdomain.com/privkey.pem;

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    # Backend API HTTPS
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/yourdomain.com/privkey.pem;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

---

## MongoDB Init Script

Create `mongo-init.js`:

```javascript
db = db.getSiblingDB('matrimonialDB');

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 });
db.users.createIndex({ "status.status": 1 });
db.favorites.createIndex({ userUsername: 1, favoritedUsername: 1 });
db.shortlists.createIndex({ userUsername: 1 });
db.activity_logs.createIndex({ timestamp: -1 });

print('Database initialized successfully');
```

---

## Deploy Commands

### First Time Deployment

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# Check logs
docker compose logs -f

# Get SSL certificate (after DNS configured)
docker compose run --rm certbot

# Reload nginx
docker compose restart nginx
```

### Update Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## Useful Commands

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f [service-name]

# Execute command in container
docker compose exec backend bash
docker compose exec mongodb mongosh matrimonialDB

# Restart specific service
docker compose restart backend

# View resource usage
docker stats

# Remove unused images
docker image prune -a
```

---

## Production Tips

### 1. Resource Limits

Add to services in `docker-compose.yml`:

```yaml
backend:
  # ...
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### 2. Health Checks

Already included in the compose file above.

### 3. Logging

Configure logging driver:

```yaml
backend:
  # ...
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

### 4. Backup Volumes

```bash
# Backup MongoDB data
docker run --rm -v matrimonial_mongodb_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mongodb-backup-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v matrimonial_mongodb_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/mongodb-backup.tar.gz -C /
```

---

## Advantages of Docker Deployment

- ✅ Consistent environments (dev = prod)
- ✅ Easy scaling (docker compose scale)
- ✅ Simple rollbacks (docker compose down && docker compose up)
- ✅ Isolated dependencies
- ✅ Easy to move between servers
- ✅ Simplified CI/CD

---

## Next Steps

1. ✅ Setup server with Docker
2. ✅ Clone repository
3. ✅ Configure environment files
4. ✅ Point DNS to server
5. ✅ Run `docker compose up -d`
6. ✅ Get SSL certificate
7. ✅ Test application
8. ✅ Setup monitoring

---

**Deployment complete!** Your application is now running in Docker containers. 🐳
