# ☸️ Kubernetes Deployment Guide

Deploy L3V3L Matrimonial Platform to Kubernetes for maximum scalability.

---

## Why Kubernetes?

- ✅ **Auto-scaling** - Scale up/down based on traffic
- ✅ **Self-healing** - Restarts failed containers automatically
- ✅ **Load balancing** - Distributes traffic across pods
- ✅ **Zero-downtime** deployments
- ✅ **Multi-cloud** - Works on AWS, GCP, Azure
- ✅ **Industry standard** for container orchestration

---

## Prerequisites

### Install kubectl (Mac)

```bash
# Install kubectl
brew install kubectl

# Verify installation
kubectl version --client
```

### Choose Kubernetes Platform

**Local Testing:**
- **Minikube** - Local Kubernetes cluster
- **Docker Desktop** - Built-in Kubernetes
- **K3s** - Lightweight Kubernetes

**Cloud Platforms:**
- **AWS EKS** (Elastic Kubernetes Service)
- **Google GKE** (Google Kubernetes Engine)
- **Azure AKS** (Azure Kubernetes Service)
- **DigitalOcean Kubernetes**

---

## Part 1: Local Kubernetes Testing

### Setup Minikube (Local)

```bash
# Install Minikube
brew install minikube

# Start Minikube
minikube start --cpus=4 --memory=8192 --driver=docker

# Verify
kubectl get nodes

# Enable Ingress
minikube addons enable ingress

# Get dashboard
minikube dashboard
```

### Or Use Docker Desktop Kubernetes

1. Open Docker Desktop
2. Settings → Kubernetes → Enable Kubernetes
3. Wait for Kubernetes to start
4. Verify: `kubectl get nodes`

---

## Part 2: Kubernetes Configuration Files

### Directory Structure

```
k8s/
├── namespace.yaml
├── mongodb/
│   ├── mongodb-pv.yaml
│   ├── mongodb-pvc.yaml
│   ├── mongodb-deployment.yaml
│   └── mongodb-service.yaml
├── redis/
│   ├── redis-deployment.yaml
│   └── redis-service.yaml
├── backend/
│   ├── backend-secret.yaml
│   ├── backend-configmap.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   └── backend-hpa.yaml
├── frontend/
│   ├── frontend-deployment.yaml
│   └── frontend-service.yaml
└── ingress.yaml
```

---

## Step 1: Create Namespace

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: matrimonial
  labels:
    name: matrimonial
```

Apply:
```bash
kubectl apply -f k8s/namespace.yaml
```

---

## Step 2: MongoDB Setup

### Persistent Volume

Create `k8s/mongodb/mongodb-pv.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongodb-pv
  namespace: matrimonial
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard
  hostPath:
    path: /data/mongodb
```

### Persistent Volume Claim

Create `k8s/mongodb/mongodb-pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: matrimonial
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard
```

### MongoDB Deployment

Create `k8s/mongodb/mongodb-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: matrimonial
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:6.0
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_DATABASE
          value: "matrimonialDB"
        volumeMounts:
        - name: mongodb-storage
          mountPath: /data/db
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: mongodb-storage
        persistentVolumeClaim:
          claimName: mongodb-pvc
```

### MongoDB Service

Create `k8s/mongodb/mongodb-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: matrimonial
spec:
  selector:
    app: mongodb
  ports:
  - protocol: TCP
    port: 27017
    targetPort: 27017
  type: ClusterIP
```

---

## Step 3: Redis Setup

### Redis Deployment

Create `k8s/redis/redis-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: matrimonial
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Redis Service

Create `k8s/redis/redis-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: matrimonial
spec:
  selector:
    app: redis
  ports:
  - protocol: TCP
    port: 6379
    targetPort: 6379
  type: ClusterIP
```

---

## Step 4: Backend Setup

### Secrets

Create `k8s/backend/backend-secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: matrimonial
type: Opaque
stringData:
  SECRET_KEY: "your-generated-secret-key-here"
  SMTP_PASSWORD: "your-smtp-password"
  TWILIO_AUTH_TOKEN: "your-twilio-token"
```

Apply:
```bash
kubectl apply -f k8s/backend/backend-secret.yaml
```

### ConfigMap

Create `k8s/backend/backend-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: matrimonial
data:
  MONGODB_URL: "mongodb://mongodb:27017"
  REDIS_URL: "redis://redis:6379"
  DATABASE_NAME: "matrimonialDB"
  FRONTEND_URL: "https://yourdomain.com"
  BACKEND_URL: "https://api.yourdomain.com"
  ENVIRONMENT: "production"
  DEBUG: "false"
```

### Backend Deployment

Create `k8s/backend/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: matrimonial
spec:
  replicas: 3  # Start with 3 replicas
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/matrimonial-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: SECRET_KEY
        envFrom:
        - configMapRef:
            name: backend-config
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Backend Service

Create `k8s/backend/backend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: matrimonial
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Horizontal Pod Autoscaler

Create `k8s/backend/backend-hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: matrimonial
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Step 5: Frontend Setup

### Frontend Deployment

Create `k8s/frontend/frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: matrimonial
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/matrimonial-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Frontend Service

Create `k8s/frontend/frontend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: matrimonial
spec:
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP
```

---

## Step 6: Ingress Setup

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: matrimonial-ingress
  namespace: matrimonial
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
    - api.yourdomain.com
    secretName: matrimonial-tls
  rules:
  # Frontend
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: www.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  # Backend API
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
```

---

## Step 7: Deploy Everything

### Build and Push Images

```bash
# Build backend image
cd fastapi_backend
docker build -t your-registry/matrimonial-backend:latest -f Dockerfile.prod .
docker push your-registry/matrimonial-backend:latest

# Build frontend image
cd ../frontend
docker build -t your-registry/matrimonial-frontend:latest -f Dockerfile.prod .
docker push your-registry/matrimonial-frontend:latest
```

### Apply Kubernetes Configs

```bash
# Apply in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml

# Check status
kubectl get all -n matrimonial
kubectl get ingress -n matrimonial
```

---

## Step 8: SSL with Cert-Manager

### Install Cert-Manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify
kubectl get pods -n cert-manager
```

### Create ClusterIssuer

Create `k8s/cert-issuer.yaml`:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

Apply:
```bash
kubectl apply -f k8s/cert-issuer.yaml
```

---

## Step 9: Useful Commands

### Viewing Resources

```bash
# Get all resources
kubectl get all -n matrimonial

# Get pods
kubectl get pods -n matrimonial

# Get services
kubectl get svc -n matrimonial

# Get deployments
kubectl get deployments -n matrimonial

# Get ingress
kubectl get ingress -n matrimonial

# Watch pods
kubectl get pods -n matrimonial -w
```

### Logs

```bash
# View pod logs
kubectl logs <pod-name> -n matrimonial

# Follow logs
kubectl logs -f <pod-name> -n matrimonial

# Logs from previous crashed container
kubectl logs <pod-name> -n matrimonial --previous

# All backend pods logs
kubectl logs -l app=backend -n matrimonial
```

### Debugging

```bash
# Describe pod (shows events)
kubectl describe pod <pod-name> -n matrimonial

# Execute command in pod
kubectl exec -it <pod-name> -n matrimonial -- bash

# Port forward for testing
kubectl port-forward svc/backend 8000:8000 -n matrimonial
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment backend --replicas=5 -n matrimonial

# Check HPA status
kubectl get hpa -n matrimonial

# Describe HPA
kubectl describe hpa backend-hpa -n matrimonial
```

### Updates

```bash
# Update image
kubectl set image deployment/backend backend=your-registry/matrimonial-backend:v2 -n matrimonial

# Rollout status
kubectl rollout status deployment/backend -n matrimonial

# Rollout history
kubectl rollout history deployment/backend -n matrimonial

# Rollback
kubectl rollout undo deployment/backend -n matrimonial
```

---

## Step 10: Production Best Practices

### Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: matrimonial-quota
  namespace: matrimonial
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "30"
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
  namespace: matrimonial
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mongodb
    ports:
    - protocol: TCP
      port: 27017
```

### Pod Disruption Budget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: backend-pdb
  namespace: matrimonial
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: backend
```

---

## Cloud Kubernetes Services

### AWS EKS

```bash
# Install eksctl
brew install eksctl

# Create cluster
eksctl create cluster \
  --name matrimonial \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5

# Get kubeconfig
aws eks update-kubeconfig --name matrimonial --region us-east-1
```

### Google GKE

```bash
# Install gcloud
brew install google-cloud-sdk

# Create cluster
gcloud container clusters create matrimonial \
  --num-nodes=3 \
  --machine-type=e2-medium \
  --zone=us-central1-a

# Get credentials
gcloud container clusters get-credentials matrimonial --zone=us-central1-a
```

### Azure AKS

```bash
# Install az CLI
brew install azure-cli

# Create cluster
az aks create \
  --resource-group matrimonial-rg \
  --name matrimonial \
  --node-count 3 \
  --node-vm-size Standard_D2_v2

# Get credentials
az aks get-credentials --resource-group matrimonial-rg --name matrimonial
```

---

## Monitoring

### Install Prometheus + Grafana

```bash
# Add Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

---

## Cost Optimization

### Node Autoscaling

```yaml
# For cloud platforms
# AWS EKS - Cluster Autoscaler
# GKE - Cluster Autoscaler (built-in)
# AKS - Cluster Autoscaler
```

### Use Spot Instances

- AWS: Spot instances
- GCP: Preemptible VMs
- Azure: Spot VMs

**Save 60-80% on compute costs!**

---

## Backup Strategy

```bash
# Install Velero for backups
velero install \
  --provider aws \
  --bucket matrimonial-k8s-backups \
  --backup-location-config region=us-east-1

# Create backup
velero backup create matrimonial-backup

# Restore
velero restore create --from-backup matrimonial-backup
```

---

## Summary

**Kubernetes gives you:**
- ✅ Auto-scaling (3-10 pods based on load)
- ✅ Self-healing (auto-restart failed pods)
- ✅ Zero-downtime deployments
- ✅ Multi-region support
- ✅ Professional-grade infrastructure

**Estimated Costs:**
- **AWS EKS:** $150-500/mo
- **Google GKE:** $100-400/mo
- **Azure AKS:** $120-450/mo
- **DigitalOcean K8s:** $80-300/mo

---

**Next:** See `CLOUD_DEPLOYMENT.md` for simpler managed container services (AWS ECS, Cloud Run, Azure Container Instances)
