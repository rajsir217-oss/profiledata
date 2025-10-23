# ☁️ Cloud-Native Container Deployment

Deploy containerized application to managed cloud services (easier than Kubernetes).

---

## Deployment Options Comparison

| Service | Provider | Complexity | Cost | Scaling | Best For |
|---------|----------|------------|------|---------|----------|
| **AWS ECS Fargate** | AWS | Low | $$ | Auto | Serverless containers |
| **Google Cloud Run** | GCP | Very Low | $ | Auto | Simplest serverless |
| **Azure Container Instances** | Azure | Low | $$ | Manual | Quick deployment |
| **DigitalOcean App Platform** | DO | Very Low | $ | Auto | Developers |
| **Fly.io** | Fly.io | Very Low | $ | Auto | Modern apps |
| **Render** | Render | Very Low | $ | Auto | Fastest setup |

---

## Option 1: Google Cloud Run (Recommended)

**Why Cloud Run?**
- ✅ Simplest setup (5 commands)
- ✅ Pay-per-use (can be $0-10/mo for low traffic)
- ✅ Auto-scaling (0 to 1000 instances)
- ✅ Built-in HTTPS
- ✅ No infrastructure management

### Prerequisites

```bash
# Install gcloud CLI (Mac)
brew install google-cloud-sdk

# Login
gcloud auth login

# Create project
gcloud projects create matrimonial-prod --name="L3V3L Matrimonial"

# Set project
gcloud config set project matrimonial-prod

# Enable APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Deploy Backend to Cloud Run

```bash
cd fastapi_backend

# Build and deploy (one command!)
gcloud run deploy matrimonial-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="MONGODB_URL=$MONGODB_URL,DATABASE_NAME=matrimonialDB" \
  --set-secrets="SECRET_KEY=backend-secret:latest"

# Get URL
gcloud run services describe matrimonial-backend --region us-central1 --format 'value(status.url)'
```

### Deploy Frontend to Cloud Run

```bash
cd frontend

# Build production
npm run build

# Create simple server
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
EOF

# Update package.json
npm install express

# Deploy
gcloud run deploy matrimonial-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Setup Cloud SQL (MongoDB Atlas Alternative)

```bash
# Use MongoDB Atlas (easier)
# Visit: https://cloud.mongodb.com/
# Create free cluster
# Get connection string
# Use in Cloud Run environment variables
```

### Cost Estimate

```
Cloud Run Backend:
- First 2 million requests/month: FREE
- After that: $0.40 per million requests

Cloud Run Frontend:
- First 2 million requests/month: FREE

MongoDB Atlas:
- M0 (free): 512MB storage - FREE
- M10 (starter): 10GB storage - $57/mo

Total: $0-60/mo depending on traffic
```

---

## Option 2: AWS ECS Fargate

**Why ECS Fargate?**
- ✅ Serverless containers (no EC2 management)
- ✅ Integrates with AWS services
- ✅ Good for AWS-first organizations

### Prerequisites

```bash
# Install AWS CLI
brew install awscli

# Configure
aws configure
```

### Create ECS Cluster

```bash
# Create cluster
aws ecs create-cluster \
  --cluster-name matrimonial-prod \
  --capacity-providers FARGATE \
  --region us-east-1
```

### Push Images to ECR

```bash
# Create ECR repositories
aws ecr create-repository --repository-name matrimonial-backend
aws ecr create-repository --repository-name matrimonial-frontend

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
cd fastapi_backend
docker build -t matrimonial-backend -f Dockerfile.prod .
docker tag matrimonial-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/matrimonial-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/matrimonial-backend:latest

# Build and push frontend
cd ../frontend
docker build -t matrimonial-frontend -f Dockerfile.prod .
docker tag matrimonial-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/matrimonial-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/matrimonial-frontend:latest
```

### Create Task Definitions

Create `backend-task-definition.json`:

```json
{
  "family": "matrimonial-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/matrimonial-backend:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "MONGODB_URL",
          "value": "mongodb+srv://user:pass@cluster.mongodb.net"
        },
        {
          "name": "DATABASE_NAME",
          "value": "matrimonialDB"
        }
      ],
      "secrets": [
        {
          "name": "SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:account-id:secret:backend-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/matrimonial-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Register task:
```bash
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json
```

### Create ECS Services

```bash
# Create backend service
aws ecs create-service \
  --cluster matrimonial-prod \
  --service-name backend \
  --task-definition matrimonial-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Setup Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name matrimonial-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

# Create target groups
# Create listeners
# Update ECS service to use ALB
```

### Cost Estimate

```
Fargate:
- Backend (2 tasks): ~$35/mo
- Frontend (2 tasks): ~$35/mo

ALB: ~$20/mo
MongoDB Atlas M10: ~$57/mo
Data transfer: ~$10/mo

Total: ~$157/mo
```

---

## Option 3: DigitalOcean App Platform

**Why App Platform?**
- ✅ Super simple (GitHub-based deployment)
- ✅ Affordable ($12-48/mo)
- ✅ Built-in database options
- ✅ Free SSL

### Setup

1. **Push code to GitHub**

2. **Create App on DigitalOcean:**
   - Visit: https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Connect GitHub repository
   - Select branch: `main`

3. **Configure Backend:**
   ```yaml
   name: backend
   services:
   - name: api
     github:
       repo: rajsir217-oss/profiledata
       branch: main
       deploy_on_push: true
     dockerfile_path: fastapi_backend/Dockerfile.prod
     source_dir: fastapi_backend
     http_port: 8000
     instance_count: 2
     instance_size_slug: basic-xs
     routes:
     - path: /api
     envs:
     - key: MONGODB_URL
       value: ${db.CONNECTION_STRING}
     - key: SECRET_KEY
       value: ${SECRET_KEY}
       type: SECRET
   ```

4. **Configure Frontend:**
   ```yaml
   - name: web
     github:
       repo: rajsir217-oss/profiledata
       branch: main
     dockerfile_path: frontend/Dockerfile.prod
     source_dir: frontend
     http_port: 80
     instance_count: 1
     instance_size_slug: basic-xs
     routes:
     - path: /
   ```

5. **Add MongoDB:**
   - Click "Add Database"
   - Select "MongoDB"
   - Choose plan ($15/mo for dev)

### Cost Estimate

```
Backend (2 instances): $12/mo
Frontend (1 instance): $6/mo
MongoDB: $15/mo

Total: $33/mo
```

---

## Option 4: Fly.io (Modern & Fast)

**Why Fly.io?**
- ✅ Deploy containers globally
- ✅ Edge computing
- ✅ Simple CLI
- ✅ Generous free tier

### Prerequisites

```bash
# Install flyctl
brew install flyctl

# Login
flyctl auth login
```

### Deploy Backend

```bash
cd fastapi_backend

# Initialize
flyctl launch

# Answer prompts:
# App name: matrimonial-backend
# Region: Choose closest
# Setup PostgreSQL: No
# Deploy now: Yes

# Set secrets
flyctl secrets set SECRET_KEY="your-secret"
flyctl secrets set MONGODB_URL="mongodb+srv://..."

# Deploy
flyctl deploy
```

### Deploy Frontend

```bash
cd frontend

# Initialize
flyctl launch

# Answer prompts
# Deploy
flyctl deploy
```

### Cost Estimate

```
Free tier includes:
- 3 shared-cpu VMs
- 3GB persistent storage
- 160GB outbound data

Paid tier:
- $1.94/mo per shared-cpu-1x
- $0.02/mo per GB storage

Typical cost: $0-20/mo
```

---

## Option 5: Render (Fastest Setup)

**Why Render?**
- ✅ Fastest deployment (5 minutes)
- ✅ Free tier available
- ✅ GitHub auto-deploy
- ✅ Built-in SSL

### Setup

1. **Visit:** https://render.com
2. **Connect GitHub:** Link your repository
3. **Create Web Service:**
   - Name: matrimonial-backend
   - Environment: Docker
   - Dockerfile path: fastapi_backend/Dockerfile.prod
   - Region: Choose closest
   - Instance type: Starter ($7/mo)

4. **Environment Variables:**
   ```
   MONGODB_URL=mongodb+srv://...
   SECRET_KEY=your-secret-key
   DATABASE_NAME=matrimonialDB
   ```

5. **Create Frontend:**
   - Name: matrimonial-frontend
   - Environment: Docker
   - Dockerfile path: frontend/Dockerfile.prod
   - Instance type: Starter ($7/mo)

6. **Add MongoDB:**
   - Use MongoDB Atlas (free tier)
   - Or Render's managed MongoDB ($7/mo)

### Cost Estimate

```
Backend: $7/mo
Frontend: $7/mo
MongoDB (Atlas free): $0/mo

Total: $14/mo
```

---

## Container Registry Options

### Docker Hub (Free)

```bash
# Login
docker login

# Tag and push
docker tag matrimonial-backend:latest yourusername/matrimonial-backend:latest
docker push yourusername/matrimonial-backend:latest
```

### GitHub Container Registry (Free)

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u yourusername --password-stdin

# Tag and push
docker tag matrimonial-backend:latest ghcr.io/yourusername/matrimonial-backend:latest
docker push ghcr.io/yourusername/matrimonial-backend:latest
```

---

## CI/CD Pipeline

### GitHub Actions for Container Deploy

Create `.github/workflows/deploy-containers.yml`:

```yaml
name: Build and Deploy Containers

on:
  push:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - uses: actions/checkout@v3

    - name: Log in to Container registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push backend
      uses: docker/build-push-action@v4
      with:
        context: ./fastapi_backend
        file: ./fastapi_backend/Dockerfile.prod
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:latest

    - name: Build and push frontend
      uses: docker/build-push-action@v4
      with:
        context: ./frontend
        file: ./frontend/Dockerfile.prod
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:latest

  deploy-to-cloud-run:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to Cloud Run
      uses: google-github-actions/deploy-cloudrun@v1
      with:
        service: matrimonial-backend
        image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:latest
        region: us-central1
```

---

## Database Options for Containers

### MongoDB Atlas (Recommended)

```
Free Tier (M0):
- 512MB storage
- Shared cluster
- FREE forever

Starter Tier (M10):
- 10GB storage
- Dedicated cluster
- $57/month

Connect: mongodb+srv://user:pass@cluster.mongodb.net/matrimonialDB
```

### AWS DocumentDB

```
Smallest instance: $53/month
Compatible with MongoDB drivers
Managed backups
```

### DigitalOcean Managed MongoDB

```
Dev plan: $15/month
1GB RAM, 10GB storage
Automated backups
```

---

## Monitoring for Containers

### Google Cloud Monitoring (Free with Cloud Run)

Automatic monitoring included.

### Datadog

```bash
# Add Datadog agent to Dockerfile
ENV DD_API_KEY=your-key
ENV DD_SITE=datadoghq.com
```

### Sentry (Error Tracking)

```bash
# Add to requirements.txt
sentry-sdk[fastapi]

# In main.py
import sentry_sdk
sentry_sdk.init(dsn="your-dsn")
```

---

## Quick Decision Guide

**Choose Google Cloud Run if:**
- ✅ Want simplest setup
- ✅ Pay-per-use pricing
- ✅ Auto-scaling to zero

**Choose AWS ECS if:**
- ✅ Already using AWS
- ✅ Need AWS integrations
- ✅ Enterprise requirements

**Choose DigitalOcean App Platform if:**
- ✅ Want simplicity + affordability
- ✅ GitHub-based deployment
- ✅ Small to medium scale

**Choose Fly.io if:**
- ✅ Want global edge deployment
- ✅ Modern infrastructure
- ✅ Start free

**Choose Render if:**
- ✅ Want fastest setup
- ✅ Free tier testing
- ✅ Simple billing

---

## Summary: Container Deployment Path

### Local Development (Your Mac)
```bash
docker compose -f docker-compose.local.yml up -d
# Test everything locally
```

### Build Production Images
```bash
docker build -t matrimonial-backend:latest -f fastapi_backend/Dockerfile.prod fastapi_backend/
docker build -t matrimonial-frontend:latest -f frontend/Dockerfile.prod frontend/
```

### Push to Registry
```bash
docker tag matrimonial-backend ghcr.io/yourusername/matrimonial-backend:latest
docker push ghcr.io/yourusername/matrimonial-backend:latest
```

### Deploy to Cloud
```bash
# Option 1: Cloud Run
gcloud run deploy --image ghcr.io/yourusername/matrimonial-backend:latest

# Option 2: ECS
aws ecs update-service --cluster matrimonial --service backend --force-new-deployment

# Option 3: Others
# Use their CLI or web interface
```

---

**Recommended for beginners:** Google Cloud Run or Render
**Recommended for AWS users:** AWS ECS Fargate  
**Recommended for budget:** DigitalOcean App Platform or Fly.io

All options support auto-scaling and provide managed infrastructure! 🚀
