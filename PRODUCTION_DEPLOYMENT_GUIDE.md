# 🚀 Production Deployment Guide

Complete guide for deploying the L3V3L Matrimonial Platform to production.

---

## Quick Start

### Recommended Approach (VPS)

**Platform:** DigitalOcean Droplet ($12-24/mo)  
**Server:** Ubuntu 22.04 LTS, 2 vCPUs, 4GB RAM  
**Time:** 2-3 hours for complete setup

---

## Pre-Deployment Checklist

### ✅ Code Readiness
- [ ] All tests passing
- [ ] Merged to `main` branch
- [ ] Environment variables documented
- [ ] Database backup plan

### ✅ Security
- [ ] Change JWT secret key
- [ ] Change admin password
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall

---

## VPS Deployment (Step-by-Step)

### 1. Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update & create user
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### 2. Install Dependencies

```bash
# Python 3.11
sudo apt install python3.11 python3.11-venv python3-pip -y

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install mongodb-org -y
sudo systemctl enable mongod
sudo systemctl start mongod

# Nginx & SSL
sudo apt install nginx certbot python3-certbot-nginx -y
sudo systemctl enable nginx
```

### 3. Clone & Setup Backend

```bash
cd /var/www
sudo mkdir matrimonial && sudo chown deploy:deploy matrimonial
cd matrimonial
git clone https://github.com/rajsir217-oss/profiledata.git .

cd fastapi_backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=matrimonialDB
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
EOF
```

### 4. Build Frontend

```bash
cd ../frontend
npm install
echo "REACT_APP_API_URL=https://api.yourdomain.com/api/users" > .env.production
npm run build
```

### 5. Create Backend Service

```bash
sudo tee /etc/systemd/system/matrimonial-backend.service << 'EOF'
[Unit]
Description=L3V3L Matrimonial Backend
After=network.target mongodb.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/matrimonial/fastapi_backend
Environment="PATH=/var/www/matrimonial/fastapi_backend/venv/bin"
ExecStart=/var/www/matrimonial/fastapi_backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable matrimonial-backend
sudo systemctl start matrimonial-backend
```

### 6. Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/matrimonial << 'EOF'
# API Backend
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/matrimonial/frontend/build;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/matrimonial /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup SSL

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

### 8. Configure Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Environment Variables

### Backend `.env`

```bash
# Core
SECRET_KEY=<generate with: openssl rand -hex 32>
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=matrimonialDB
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourdomain.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_FROM_PHONE=+1234567890
```

### Frontend `.env.production`

```bash
REACT_APP_API_URL=https://api.yourdomain.com/api/users
REACT_APP_SOCKET_URL=https://api.yourdomain.com
GENERATE_SOURCEMAP=false
```

---

## Database Setup

```bash
mongosh matrimonialDB

# Create indexes
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ email: 1 })
db.favorites.createIndex({ userUsername: 1, favoritedUsername: 1 })
db.activity_logs.createIndex({ timestamp: -1 })
```

---

## Backups

### Automated MongoDB Backup

```bash
sudo tee /usr/local/bin/backup-mongodb.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --out "$BACKUP_DIR/$DATE" --gzip
cd "$BACKUP_DIR"
tar -czf "$DATE.tar.gz" "$DATE" && rm -rf "$DATE"
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
EOF

sudo chmod +x /usr/local/bin/backup-mongodb.sh

# Run daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-mongodb.sh") | crontab -
```

---

## Monitoring

### Install Netdata

```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
# Access at: http://your-server-ip:19999
```

### Error Tracking (Sentry)

```bash
# Backend
pip install sentry-sdk

# Frontend
npm install @sentry/react
```

---

## CI/CD (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/matrimonial
            git pull origin main
            cd fastapi_backend
            source venv/bin/activate
            pip install -r requirements.txt
            sudo systemctl restart matrimonial-backend
            cd ../frontend
            npm install && npm run build
            sudo systemctl reload nginx
```

---

## Common Issues

### 502 Bad Gateway

```bash
sudo systemctl status matrimonial-backend
sudo journalctl -u matrimonial-backend -n 100
sudo systemctl restart matrimonial-backend
```

### CORS Errors

Check `main.py` - ensure CORS allows your domain.

---

## Cost Estimate

**Small Scale (< 1000 users):**
- VPS (4GB): $20/mo
- Domain: $12/yr
- **Total: ~$26/mo**

**Medium Scale (1000-10,000 users):**
- VPS (8GB): $40/mo
- Managed DB: $30/mo
- Email/SMS: $30/mo
- **Total: ~$100/mo**

---

## Next Steps

1. ✅ Get VPS (DigitalOcean recommended)
2. ✅ Point domain to server IP
3. ✅ Follow setup steps above
4. ✅ Setup SSL with Certbot
5. ✅ Configure backups
6. ✅ Setup monitoring
7. ✅ Test everything
8. ✅ Launch! 🚀

---

For detailed guides:
- **Docker Deployment:** See `DOCKER_DEPLOYMENT.md`
- **AWS Deployment:** See `AWS_DEPLOYMENT.md`
- **Security Guide:** See `SECURITY_HARDENING.md`
