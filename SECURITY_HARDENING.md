# 🔒 Security Hardening Guide

Comprehensive security guide for production deployment.

---

## Critical Security Checklist

### ✅ Before Launch
- [ ] Change default JWT secret key
- [ ] Change default admin password
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Configure firewalls
- [ ] Setup security headers
- [ ] Enable MongoDB authentication
- [ ] Review API permissions
- [ ] Setup error tracking (without exposing sensitive data)

---

## 1. JWT Security

### Generate Strong Secret Key

```bash
# Generate 256-bit secret
openssl rand -hex 32

# Add to .env
SECRET_KEY=your_generated_key_here_64_characters
```

### Configure JWT Settings

In `.env`:

```bash
SECRET_KEY=<your-256-bit-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30  # Shorter = more secure
```

### Best Practices

- ✅ **Never commit** secret key to git
- ✅ **Rotate keys** every 6-12 months
- ✅ **Use environment variables** only
- ✅ **Different keys** for dev/staging/prod
- ❌ **Never log** JWT tokens
- ❌ **Never send** JWT in URL parameters

---

## 2. Password Security

### Hash Admin Password

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("your-strong-password")
print(hashed)
```

### Update Admin Password in MongoDB

```bash
mongosh matrimonialDB

db.users.updateOne(
  { username: "admin" },
  { $set: { password: "$2b$12$HASHED_PASSWORD_HERE" } }
)
```

### Password Requirements

Enforce in backend:

```python
def validate_password(password: str):
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters")
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain uppercase letter")
    if not re.search(r'[a-z]', password):
        raise ValueError("Password must contain lowercase letter")
    if not re.search(r'[0-9]', password):
        raise ValueError("Password must contain number")
    if not re.search(r'[!@#$%^&*]', password):
        raise ValueError("Password must contain special character")
```

---

## 3. CORS Configuration

### Production CORS Settings

In `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",
        "https://www.yourdomain.com",
        # ❌ NEVER use ["*"] in production!
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### Test CORS

```bash
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://api.yourdomain.com/api/users/login
```

---

## 4. Rate Limiting

### Install slowapi

```bash
pip install slowapi
```

### Configure Rate Limiting

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints
@app.post("/login")
@limiter.limit("5/minute")  # 5 login attempts per minute
async def login(request: Request, ...):
    ...

@app.post("/register")
@limiter.limit("3/hour")  # 3 registrations per hour
async def register(request: Request, ...):
    ...

@app.get("/api/users/search")
@limiter.limit("100/minute")  # 100 searches per minute
async def search(request: Request, ...):
    ...
```

---

## 5. Security Headers

### Nginx Configuration

Add to `/etc/nginx/sites-available/matrimonial`:

```nginx
server {
    # ... existing config ...

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https: wss:;" always;

    # HSTS (force HTTPS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

### Test Security Headers

https://securityheaders.com/?q=yourdomain.com

---

## 6. MongoDB Security

### Enable Authentication

Edit `/etc/mongod.conf`:

```yaml
security:
  authorization: enabled
```

### Create Admin User

```bash
mongosh

use admin

db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD",
  roles: ["userAdminAnyDatabase", "readWriteAnyDatabase"]
})
```

### Create Application User

```bash
use matrimonialDB

db.createUser({
  user: "matrimonial_app",
  pwd: "APP_PASSWORD",
  roles: [
    { role: "readWrite", db: "matrimonialDB" }
  ]
})
```

### Update Connection String

In `.env`:

```bash
MONGODB_URL=mongodb://matrimonial_app:APP_PASSWORD@localhost:27017/matrimonialDB?authSource=matrimonialDB
```

### Network Binding

In `/etc/mongod.conf`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1  # Only localhost (not 0.0.0.0)
```

---

## 7. Firewall Configuration

### UFW (Ubuntu Firewall)

```bash
# Default deny incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT!)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable
sudo ufw enable

# Check status
sudo ufw status verbose
```

### Fail2Ban (Brute Force Protection)

```bash
# Install
sudo apt install fail2ban -y

# Configure
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

# Start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check bans
sudo fail2ban-client status
```

---

## 8. SSL/TLS Configuration

### A+ SSL Rating

Nginx SSL config:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # Certificate paths
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

    # SSL session cache
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
}
```

### Test SSL

https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

---

## 9. API Security

### Input Validation

```python
from pydantic import BaseModel, validator, EmailStr

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    
    @validator('username')
    def username_alphanumeric(cls, v):
        assert v.isalnum(), 'must be alphanumeric'
        assert 3 <= len(v) <= 20, 'must be 3-20 characters'
        return v
    
    @validator('password')
    def password_strong(cls, v):
        if len(v) < 12:
            raise ValueError('Password too short')
        # Add more checks...
        return v
```

### SQL Injection Prevention

Already protected by using MongoDB (NoSQL) and Pydantic validation.

### XSS Prevention

Frontend - sanitize user input:

```bash
npm install dompurify
```

```javascript
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(dirtyInput);
```

### File Upload Security

```python
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_image(file: UploadFile):
    # Check extension
    ext = file.filename.split('.')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Invalid file type")
    
    # Check size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")
    
    # Check magic bytes (actual file type)
    header = file.file.read(8)
    file.file.seek(0)
    # Validate header matches extension...
```

---

## 10. Secrets Management

### Never Commit Secrets

Add to `.gitignore`:

```gitignore
.env
.env.production
.env.local
*.key
*.pem
secrets/
```

### Use Environment Variables

```bash
# Production server
export SECRET_KEY="your-secret"
export DATABASE_PASSWORD="db-password"
```

### Or use secrets management service:

- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Azure Key Vault**
- **Google Secret Manager**

---

## 11. Logging & Monitoring

### Secure Logging

```python
import logging

# DON'T log sensitive data
logger.info(f"User logged in: {username}")  # ✅ OK
logger.info(f"Password: {password}")  # ❌ NEVER!
logger.info(f"JWT: {token}")  # ❌ NEVER!

# Mask sensitive data if needed
def mask_email(email: str):
    user, domain = email.split('@')
    return f"{user[0]}***@{domain}"

logger.info(f"Reset email sent to {mask_email(email)}")
```

### Monitor Failed Login Attempts

```python
from collections import defaultdict
from datetime import datetime, timedelta

failed_attempts = defaultdict(list)

async def check_login_attempts(username: str):
    now = datetime.utcnow()
    attempts = failed_attempts[username]
    
    # Remove old attempts (> 15 min)
    attempts = [t for t in attempts if now - t < timedelta(minutes=15)]
    
    if len(attempts) >= 5:
        raise HTTPException(429, "Too many failed attempts. Try again later.")
    
    failed_attempts[username] = attempts

async def record_failed_login(username: str):
    failed_attempts[username].append(datetime.utcnow())
```

---

## 12. Regular Security Tasks

### Daily
- [ ] Check error logs for suspicious activity
- [ ] Monitor failed login attempts
- [ ] Check SSL certificate expiry

### Weekly
- [ ] Review access logs
- [ ] Check for security updates
- [ ] Verify backups are working

### Monthly
- [ ] Update dependencies (`pip list --outdated`, `npm outdated`)
- [ ] Review user permissions
- [ ] Security scan (`npm audit`, `safety check`)
- [ ] Test backup restoration

### Quarterly
- [ ] Penetration testing
- [ ] Security audit
- [ ] Rotate secrets/keys
- [ ] Review and update security policies

---

## Security Testing Tools

### Backend

```bash
# Check for known vulnerabilities
pip install safety
safety check

# Bandit (Python security linter)
pip install bandit
bandit -r fastapi_backend/
```

### Frontend

```bash
# NPM security audit
npm audit
npm audit fix

# Dependency check
npm install -g snyk
snyk test
```

### Server

```bash
# Port scan
nmap -sV your-server-ip

# SSL test
testssl.sh yourdomain.com
```

---

## Incident Response Plan

### If Compromised:

1. **Immediate Actions:**
   - Take site offline
   - Reset all passwords/keys
   - Review logs for breach extent
   - Notify users if data exposed

2. **Investigation:**
   - Identify vulnerability
   - Check database for unauthorized access
   - Review all recent changes

3. **Recovery:**
   - Patch vulnerability
   - Restore from clean backup
   - Update all secrets
   - Re-deploy with fixes

4. **Post-Incident:**
   - Document what happened
   - Update security measures
   - Implement additional monitoring
   - Consider security audit

---

## Security Checklist Summary

### ✅ Configuration
- [ ] Strong JWT secret key (256-bit)
- [ ] Strong admin password (hashed)
- [ ] CORS whitelist only
- [ ] Rate limiting enabled
- [ ] MongoDB authentication enabled
- [ ] Redis password set (if using)

### ✅ Network
- [ ] Firewall configured (UFW)
- [ ] Fail2Ban enabled
- [ ] SSL/TLS A+ rating
- [ ] Security headers configured
- [ ] MongoDB bind to localhost only

### ✅ Application
- [ ] Input validation (Pydantic)
- [ ] Password requirements enforced
- [ ] File upload validation
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Error messages don't expose sensitive info

### ✅ Monitoring
- [ ] Failed login tracking
- [ ] Error logging (without secrets)
- [ ] Uptime monitoring
- [ ] Security scanning
- [ ] Backup verification

---

## Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **SSL Labs:** https://www.ssllabs.com/ssltest/
- **Security Headers:** https://securityheaders.com/
- **Mozilla Observatory:** https://observatory.mozilla.org/

---

**Remember:** Security is an ongoing process, not a one-time task. Stay updated and vigilant! 🔒
