# ✅ Production Deployment Checklist

Quick checklist for deploying L3V3L Matrimonial Platform to production.

---

## 📚 Before You Start

Read these guides:
- [ ] `PRODUCTION_DEPLOYMENT_GUIDE.md` - Main deployment guide
- [ ] `SECURITY_HARDENING.md` - Security requirements  
- [ ] `DOCKER_DEPLOYMENT.md` - If using Docker

---

## Phase 1: Pre-Deployment (1-2 hours)

### Purchase & Setup
- [ ] Get VPS (Recommended: DigitalOcean $12-24/mo)
  - Min specs: 2 vCPUs, 4GB RAM, 80GB SSD
  - OS: Ubuntu 22.04 LTS
- [ ] Register domain name (if not done)
- [ ] Note server IP address
- [ ] Note domain name

### Local Preparation
- [ ] Merge all code to `main` branch
- [ ] Run all tests locally: `pytest` and `npm test`
- [ ] Verify no errors in console
- [ ] Document all environment variables needed

---

## Phase 2: Server Setup (2-3 hours)

### Initial Server Configuration
- [ ] SSH into server: `ssh root@your-server-ip`
- [ ] Update system: `apt update && apt upgrade -y`
- [ ] Create deploy user:
  ```bash
  adduser deploy
  usermod -aG sudo deploy
  su - deploy
  ```

### Install Dependencies
- [ ] Install Python 3.11
- [ ] Install Node.js 18
- [ ] Install MongoDB 6.0
- [ ] Install Nginx
- [ ] Install Certbot (SSL)
- [ ] Install Redis (optional)

**See:** `PRODUCTION_DEPLOYMENT_GUIDE.md` for exact commands

### Clone Repository
- [ ] Create `/var/www/matrimonial` directory
- [ ] Clone from GitHub
- [ ] Verify all files present

---

## Phase 3: Backend Configuration (30 mins)

### Setup Backend
- [ ] Create Python virtual environment
- [ ] Install requirements: `pip install -r requirements.txt`
- [ ] Create `.env.production` file
- [ ] **Generate new JWT secret:** `openssl rand -hex 32`
- [ ] Configure MongoDB URL
- [ ] Configure frontend/backend URLs
- [ ] Configure email settings (SMTP)
- [ ] Configure SMS settings (Twilio) if needed

### Critical: Change Secrets!
- [ ] **JWT SECRET_KEY** - MUST be different from development
- [ ] **Admin password** - Change default password
- [ ] **MongoDB password** - Enable authentication
- [ ] **Email credentials** - Use production account

### Create Systemd Service
- [ ] Create `/etc/systemd/system/matrimonial-backend.service`
- [ ] Enable service: `sudo systemctl enable matrimonial-backend`
- [ ] Start service: `sudo systemctl start matrimonial-backend`
- [ ] Check status: `sudo systemctl status matrimonial-backend`

---

## Phase 4: Frontend Configuration (30 mins)

### Build Frontend
- [ ] Navigate to `frontend/` directory
- [ ] Run `npm install`
- [ ] Create `.env.production` with API URL
- [ ] Build: `npm run build`
- [ ] Verify `build/` folder created
- [ ] Check build size (should be < 5MB)

---

## Phase 5: Web Server Setup (30 mins)

### Configure Nginx
- [ ] Create `/etc/nginx/sites-available/matrimonial`
- [ ] Configure backend proxy (port 8000)
- [ ] Configure frontend serving
- [ ] Enable site: `ln -s /etc/nginx/sites-available/matrimonial /etc/nginx/sites-enabled/`
- [ ] Test config: `sudo nginx -t`
- [ ] Restart Nginx: `sudo systemctl restart nginx`

### Point Domain to Server
- [ ] Login to domain registrar
- [ ] Add A record: `@` → your-server-ip
- [ ] Add A record: `www` → your-server-ip
- [ ] Add A record: `api` → your-server-ip
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Test: `ping yourdomain.com`

---

## Phase 6: SSL/HTTPS Setup (15 mins)

### Get SSL Certificate
- [ ] Run Certbot: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com`
- [ ] Agree to terms
- [ ] Provide email for renewal notices
- [ ] Choose redirect HTTP to HTTPS (recommended)
- [ ] Verify SSL working: https://yourdomain.com
- [ ] Test auto-renewal: `sudo certbot renew --dry-run`

### Test SSL Rating
- [ ] Visit: https://www.ssllabs.com/ssltest/
- [ ] Check your domain
- [ ] Target: A or A+ rating
- [ ] If lower, review `SECURITY_HARDENING.md`

---

## Phase 7: Database Setup (30 mins)

### MongoDB Configuration
- [ ] Enable authentication in `/etc/mongod.conf`
- [ ] Create admin user
- [ ] Create application user
- [ ] Create indexes for performance:
  ```javascript
  db.users.createIndex({ username: 1 }, { unique: true })
  db.users.createIndex({ email: 1 })
  db.favorites.createIndex({ userUsername: 1, favoritedUsername: 1 })
  db.activity_logs.createIndex({ timestamp: -1 })
  ```
- [ ] Update connection string in `.env`
- [ ] Restart backend: `sudo systemctl restart matrimonial-backend`
- [ ] Test connection

### Initialize Data
- [ ] Change admin password in database
- [ ] Add any default data needed
- [ ] Test login with new admin password

---

## Phase 8: Security Hardening (1 hour)

**See:** `SECURITY_HARDENING.md` for detailed steps

### Firewall
- [ ] Install UFW: `sudo apt install ufw`
- [ ] Configure rules:
  ```bash
  sudo ufw allow ssh
  sudo ufw allow 'Nginx Full'
  sudo ufw enable
  ```
- [ ] Verify: `sudo ufw status`

### Fail2Ban
- [ ] Install: `sudo apt install fail2ban`
- [ ] Configure `/etc/fail2ban/jail.local`
- [ ] Enable: `sudo systemctl enable fail2ban`
- [ ] Start: `sudo systemctl start fail2ban`

### Security Headers
- [ ] Add security headers to Nginx config
- [ ] Test at: https://securityheaders.com
- [ ] Target: A rating or higher

### CORS Configuration
- [ ] Update `main.py` with production domains ONLY
- [ ] Remove any `["*"]` wildcard origins
- [ ] Test cross-origin requests

### Rate Limiting
- [ ] Install slowapi: `pip install slowapi`
- [ ] Add rate limits to login endpoint (5/min)
- [ ] Add rate limits to register endpoint (3/hour)
- [ ] Test rate limiting works

---

## Phase 9: Monitoring & Backups (1 hour)

### Monitoring
- [ ] Install Netdata: `bash <(curl -Ss https://my-netdata.io/kickstart.sh)`
- [ ] Access at: `http://your-server-ip:19999`
- [ ] Setup uptime monitoring (UptimeRobot, free)
- [ ] Optional: Setup Sentry for error tracking

### Backups
- [ ] Create MongoDB backup script
- [ ] Test backup script manually
- [ ] Add to crontab (daily at 2 AM)
- [ ] Create code backup script
- [ ] Test restore procedure
- [ ] Document backup locations

### Logging
- [ ] Create log directory: `/var/log/matrimonial/`
- [ ] Configure log rotation
- [ ] Set appropriate permissions
- [ ] Verify logs are writing

---

## Phase 10: Testing (1-2 hours)

### Functional Testing
- [ ] Visit https://yourdomain.com
- [ ] Test user registration
- [ ] Test user login
- [ ] Test profile creation/editing
- [ ] Test search functionality
- [ ] Test favorites/shortlist
- [ ] Test messaging
- [ ] Test PII requests
- [ ] Test notifications
- [ ] Test file uploads
- [ ] Test all navigation links

### Performance Testing
- [ ] Run Google Lighthouse
- [ ] Target: Performance > 80
- [ ] Check page load time < 3 seconds
- [ ] Check API response time < 500ms
- [ ] Test with slow 3G connection

### Security Testing
- [ ] SSL Labs test (target: A+)
- [ ] Security Headers test (target: A)
- [ ] Test CORS restrictions
- [ ] Test rate limiting on login
- [ ] Verify error messages don't expose secrets
- [ ] Test file upload restrictions

### Mobile Testing
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Check responsive design
- [ ] Test touch interactions
- [ ] Verify all features work

---

## Phase 11: CI/CD Setup (Optional, 1 hour)

### GitHub Actions
- [ ] Create `.github/workflows/deploy.yml`
- [ ] Add GitHub secrets:
  - `SERVER_HOST`
  - `SERVER_USER`
  - `SSH_PRIVATE_KEY`
- [ ] Test automated deployment
- [ ] Verify rollback procedure

---

## Phase 12: Launch! 🚀

### Pre-Launch
- [ ] Review all checklist items above
- [ ] Test all critical user flows
- [ ] Verify monitoring is working
- [ ] Verify backups are running
- [ ] Document admin procedures
- [ ] Create incident response plan

### Launch Day
- [ ] Final smoke test
- [ ] Monitor logs closely
- [ ] Watch for errors in Sentry
- [ ] Check uptime monitoring
- [ ] Be available for issues

### Post-Launch (First Week)
- [ ] Monitor daily
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Address any issues quickly
- [ ] Document lessons learned

---

## Ongoing Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor uptime status
- [ ] Verify backups completed

### Weekly
- [ ] Review performance metrics
- [ ] Check disk space usage
- [ ] Review access logs for suspicious activity
- [ ] Check for pending security updates

### Monthly
- [ ] Apply security patches
- [ ] Update dependencies
- [ ] Test backup restoration
- [ ] Review and optimize database
- [ ] Check SSL certificate expiry (should auto-renew)

### Quarterly
- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Capacity planning review
- [ ] Update documentation

---

## Troubleshooting Quick Reference

### Site Not Loading
```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx

# Check DNS
ping yourdomain.com
nslookup yourdomain.com
```

### API Not Working (502 Bad Gateway)
```bash
# Check backend service
sudo systemctl status matrimonial-backend
sudo journalctl -u matrimonial-backend -n 100
sudo systemctl restart matrimonial-backend
```

### Database Connection Issues
```bash
# Check MongoDB
sudo systemctl status mongod
sudo systemctl restart mongod

# Test connection
mongosh "mongodb://user:pass@localhost:27017/matrimonialDB"
```

### SSL Certificate Issues
```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check Nginx SSL config
sudo nginx -t
```

---

## Cost Summary

**Minimum Monthly Cost:**
- VPS (4GB): $20
- Domain: $12/year ($1/mo)
- **Total: ~$21/month**

**Recommended Setup:**
- VPS (4GB): $20
- Domain: $12/year
- Backup storage: $5
- Monitoring: Free (Netdata)
- Email: Free (Gmail SMTP up to 500/day)
- **Total: ~$26/month**

---

## Support Resources

- **Main Guide:** `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Docker Guide:** `DOCKER_DEPLOYMENT.md`
- **Security Guide:** `SECURITY_HARDENING.md`
- **GitHub Issues:** https://github.com/rajsir217-oss/profiledata/issues

---

## Sign-off Checklist

Before considering deployment complete:

- [ ] ✅ Application accessible via HTTPS
- [ ] ✅ All security measures implemented
- [ ] ✅ Backups configured and tested
- [ ] ✅ Monitoring active
- [ ] ✅ All tests passing
- [ ] ✅ SSL rating A or higher
- [ ] ✅ Performance acceptable
- [ ] ✅ Documentation updated
- [ ] ✅ Team trained on procedures
- [ ] ✅ Incident response plan in place

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Server IP:** _______________  
**Domain:** _______________  
**Backup Location:** _______________  

---

**🎉 Congratulations! Your L3V3L Matrimonial Platform is now live in production!**

For ongoing support, refer to the documentation guides and monitor your application regularly.

**Remember:** Production deployment is just the beginning. Continuous monitoring, maintenance, and improvement are key to long-term success.

Good luck! 🚀
