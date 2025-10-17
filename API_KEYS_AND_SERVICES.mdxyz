# 🔑 API Keys & External Services Review
## L3V3L Dating Platform - Security & Integration Assessment

**Last Updated:** October 14, 2025  
**Status:** ⚠️ Requires Configuration for Production

---

## 📋 Current Status

### ✅ **Implemented & Secure**
| Service | Status | Security | Notes |
|---------|--------|----------|-------|
| MongoDB | ✅ Active | ✅ Secure | Local/Atlas connection |
| JWT Auth | ✅ Active | ✅ Secure | SECRET_KEY in .env (gitignored) |
| WebSocket | ✅ Active | ✅ Secure | Socket.IO with auth |
| File Upload | ✅ Active | ✅ Secure | Local storage with validation |

### ⚠️ **Needed for Production**
| Service | Priority | Current Status | Required For |
|---------|----------|----------------|--------------|
| Email Service (SMTP) | 🔴 HIGH | ❌ Not configured | Email verification, password reset |
| Image Moderation API | 🔴 HIGH | ❌ Placeholder only | Content safety compliance |
| SMS Service (Twilio) | 🟡 MEDIUM | ❌ Not configured | Phone verification, 2FA |
| Payment Gateway (Stripe) | 🟡 MEDIUM | ❌ Not configured | Premium subscriptions |
| Cloud Storage (S3/Azure) | 🟢 LOW | ❌ Local only | Scalable image hosting |
| CDN | 🟢 LOW | ❌ Not configured | Fast image delivery |
| Analytics | 🟢 LOW | ❌ Not configured | User insights |

---

## 🔐 Current API Keys & Configuration

### 1. **JWT Authentication**
**File:** `/fastapi_backend/.env` (gitignored ✅)

```env
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Status:** ✅ Properly secured in .env  
**Action Required:** 
- ✅ Generate strong production secret
- ✅ Rotate keys periodically (every 90 days)
- ✅ Never commit to git (already protected)

**Generate Strong Key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

### 2. **MongoDB Connection**
**File:** `/fastapi_backend/.env`

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=matrimonialDB
```

**Status:** ✅ Secure for local dev  
**Production Options:**
- **MongoDB Atlas** (Recommended)
- **AWS DocumentDB**
- **Azure Cosmos DB**

**Production Config:**
```env
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=matrimonialDB_prod
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=10
```

---

### 3. **Image Moderation Service** ⚠️ CRITICAL
**Current Status:** Placeholder implementation only  
**File:** `/fastapi_backend/image_validator.py`

```python
# Lines 112-133 - Currently just placeholder
# Note: For production, integrate with Azure Content Moderator, 
# AWS Rekognition, or Google Vision API
```

#### **Recommended Service: Azure Content Moderator**
**Why Azure:**
- ✅ Best for dating/adult content detection
- ✅ GDPR compliant (European servers)
- ✅ $1/1000 images (affordable)
- ✅ Fast processing (<1 second)

**Setup:**
```env
# Add to .env
AZURE_CONTENT_MODERATOR_KEY=your-azure-key-here
AZURE_CONTENT_MODERATOR_ENDPOINT=https://your-region.api.cognitive.microsoft.com/
AZURE_CONTENT_MODERATOR_REGION=eastus
```

**Implementation:**
```python
# Update image_validator.py
import requests

def check_content_azure(image_path: str) -> Dict:
    """Check image content using Azure Content Moderator"""
    
    endpoint = os.getenv('AZURE_CONTENT_MODERATOR_ENDPOINT')
    key = os.getenv('AZURE_CONTENT_MODERATOR_KEY')
    
    headers = {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/octet-stream'
    }
    
    with open(image_path, 'rb') as image:
        response = requests.post(
            f'{endpoint}/contentmoderator/moderate/v1.0/ProcessImage/Evaluate',
            headers=headers,
            data=image
        )
    
    data = response.json()
    
    # Check for adult content
    is_safe = (
        data.get('IsImageAdultClassified', False) == False and
        data.get('IsImageRacyClassified', False) == False and
        data.get('AdultClassificationScore', 1.0) < 0.5
    )
    
    return {
        'safe': is_safe,
        'issues': [] if is_safe else ['Inappropriate content detected'],
        'score': data.get('AdultClassificationScore', 0),
        'details': data
    }
```

**Cost Estimate:**
- 100 images/day = $3/month
- 1000 images/day = $30/month

#### **Alternative: AWS Rekognition**
```env
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

**Pros:** Similar features, AWS ecosystem integration  
**Cons:** Slightly more expensive, US-centric

#### **Alternative: Sightengine**
```env
SIGHTENGINE_API_USER=your-api-user
SIGHTENGINE_API_SECRET=your-api-secret
```

**Pros:** Dating-specific models, nudity detection  
**Cons:** More expensive ($2/1000 images)

---

### 4. **Email Service** ⚠️ CRITICAL
**Current Status:** ❌ Not configured  
**Required For:**
- Email verification on signup
- Password reset emails
- Welcome emails
- Match notifications
- Admin alerts

#### **Option A: SendGrid (Recommended)**
**Why SendGrid:**
- ✅ Free tier: 100 emails/day
- ✅ Reliable delivery (98%+ success rate)
- ✅ Easy API
- ✅ Email templates
- ✅ Analytics dashboard

**Setup:**
```env
# Add to .env
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=noreply@l3v3l.com
SENDGRID_FROM_NAME=L3V3L Dating
```

**Implementation:**
```python
# Create email_service.py
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import os

def send_verification_email(to_email: str, token: str):
    """Send email verification"""
    
    verification_link = f"{os.getenv('FRONTEND_URL')}/verify-email?token={token}"
    
    message = Mail(
        from_email=os.getenv('SENDGRID_FROM_EMAIL'),
        to_emails=to_email,
        subject='Verify Your L3V3L Account',
        html_content=f'''
            <h1>Welcome to L3V3L!</h1>
            <p>Click below to verify your email:</p>
            <a href="{verification_link}">Verify Email</a>
            <p>This link expires in 24 hours.</p>
        '''
    )
    
    sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
    response = sg.send(message)
    return response.status_code == 202

def send_password_reset_email(to_email: str, token: str):
    """Send password reset email"""
    # Similar implementation
    pass
```

**Cost:**
- Free: 100 emails/day
- Essentials: $19.95/month (50k emails/month)
- Pro: $89.95/month (1.5M emails/month)

#### **Option B: AWS SES**
```env
AWS_SES_ACCESS_KEY=your-aws-ses-key
AWS_SES_SECRET_KEY=your-aws-ses-secret
AWS_SES_REGION=us-east-1
```

**Pros:** Very cheap ($0.10 per 1000 emails)  
**Cons:** Requires email verification, more complex setup

#### **Option C: Gmail SMTP** (Dev/Testing Only)
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password  # Not regular password!
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

**⚠️ Warning:** Gmail limits to 500/day, not suitable for production

---

### 5. **SMS Service (Twilio)** 🟡 Optional
**Current Status:** ❌ Not configured  
**Use Cases:**
- Phone number verification
- 2FA/MFA authentication
- Match notifications (premium feature)
- Admin alerts

**Setup:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Implementation:**
```python
from twilio.rest import Client

def send_verification_sms(phone_number: str, code: str):
    """Send SMS verification code"""
    
    client = Client(
        os.getenv('TWILIO_ACCOUNT_SID'),
        os.getenv('TWILIO_AUTH_TOKEN')
    )
    
    message = client.messages.create(
        body=f'Your L3V3L verification code is: {code}',
        from_=os.getenv('TWILIO_PHONE_NUMBER'),
        to=phone_number
    )
    
    return message.sid
```

**Cost:**
- $1/month per phone number
- $0.0079 per SMS sent (India)
- $0.0075 per SMS sent (US)

**Estimate:** 100 SMS/day = ~$23/month

---

### 6. **Payment Gateway (Stripe)** 🟡 Optional
**Current Status:** ❌ Not configured  
**Required For:**
- Premium subscriptions
- One-time purchases
- Refunds

**Setup:**
```env
STRIPE_SECRET_KEY=sk_test_your-test-key  # Test mode
STRIPE_PUBLIC_KEY=pk_test_your-public-key  # Test mode
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Production
STRIPE_SECRET_KEY_PROD=sk_live_your-live-key
STRIPE_PUBLIC_KEY_PROD=pk_live_your-public-key
```

**Implementation:**
```python
import stripe

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

def create_subscription(user_id: str, price_id: str):
    """Create premium subscription"""
    
    # Create customer
    customer = stripe.Customer.create(
        metadata={'user_id': user_id}
    )
    
    # Create subscription
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{'price': price_id}],
        payment_behavior='default_incomplete',
        expand=['latest_invoice.payment_intent']
    )
    
    return {
        'subscription_id': subscription.id,
        'client_secret': subscription.latest_invoice.payment_intent.client_secret
    }
```

**Pricing Tiers (Suggested):**
```python
PRICING = {
    'free': {
        'price': 0,
        'favorites_limit': 10,
        'messages_per_day': 5,
        'profile_views': 20
    },
    'premium_monthly': {
        'price': 9.99,  # USD
        'stripe_price_id': 'price_xxxxxxxxxxxxx',
        'favorites_limit': None,  # Unlimited
        'messages_per_day': None,
        'profile_views': None
    },
    'premium_yearly': {
        'price': 99.99,  # USD (2 months free)
        'stripe_price_id': 'price_xxxxxxxxxxxxx',
        'favorites_limit': None,
        'messages_per_day': None,
        'profile_views': None
    }
}
```

**Fees:** 2.9% + $0.30 per transaction

---

### 7. **Cloud Storage** 🟢 Optional
**Current Status:** Local file system  
**Why Upgrade:**
- ✅ Scalability (unlimited storage)
- ✅ CDN integration (faster loading)
- ✅ Backup/redundancy
- ✅ Global distribution

#### **Option A: AWS S3 (Recommended)**
```env
AWS_S3_BUCKET=l3v3l-user-images
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY=your-access-key
AWS_S3_SECRET_KEY=your-secret-key
AWS_CLOUDFRONT_URL=https://d111111abcdef8.cloudfront.net
```

**Cost:**
- Storage: $0.023/GB/month
- Transfer: $0.09/GB (first 10TB)
- 10GB images + 1TB transfer = ~$90/month

#### **Option B: Azure Blob Storage**
```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER=l3v3l-images
AZURE_CDN_ENDPOINT=https://l3v3l.azureedge.net
```

**Cost:** Similar to AWS S3

#### **Option C: Cloudinary** (Easiest)
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Pros:** Image transformation, automatic optimization  
**Cons:** More expensive

---

## 🔒 API Key Security Best Practices

### ✅ **Current Implementation: GOOD**
1. ✅ API keys in `.env` file (gitignored)
2. ✅ No hardcoded secrets in code
3. ✅ Environment-based configuration

### 🎯 **Recommendations for Production**

#### 1. **Use Secret Management Service**
Instead of `.env` files, use:

**AWS Secrets Manager:**
```python
import boto3
import json

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# Usage
secrets = get_secret('l3v3l-prod-secrets')
JWT_SECRET = secrets['JWT_SECRET_KEY']
```

**Azure Key Vault:**
```python
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

def get_secret(secret_name):
    vault_url = "https://l3v3l-vault.vault.azure.net/"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_url, credential=credential)
    return client.get_secret(secret_name).value
```

#### 2. **Rotate Keys Regularly**
```python
# Add to security_config.py
KEY_ROTATION_SCHEDULE = {
    'JWT_SECRET_KEY': 90,  # days
    'API_KEYS': 180,  # days
    'DATABASE_PASSWORD': 90,  # days
}
```

#### 3. **Key Encryption at Rest**
```python
from cryptography.fernet import Fernet

class SecureConfig:
    def __init__(self, master_key: str):
        self.cipher = Fernet(master_key.encode())
    
    def encrypt_key(self, key: str) -> str:
        return self.cipher.encrypt(key.encode()).decode()
    
    def decrypt_key(self, encrypted_key: str) -> str:
        return self.cipher.decrypt(encrypted_key.encode()).decode()
```

#### 4. **Environment-Specific Keys**
```python
# Different keys per environment
ENVIRONMENTS = {
    'development': {
        'jwt_secret': 'dev-secret',
        'stripe_key': 'sk_test_...',
    },
    'staging': {
        'jwt_secret': 'staging-secret',
        'stripe_key': 'sk_test_...',
    },
    'production': {
        'jwt_secret': 'prod-secret-very-strong',
        'stripe_key': 'sk_live_...',
    }
}
```

#### 5. **API Key Monitoring**
```python
# Log API key usage
def log_api_key_usage(key_name: str, endpoint: str):
    audit_log = {
        'timestamp': datetime.utcnow(),
        'key_name': key_name,
        'endpoint': endpoint,
        'environment': os.getenv('ENV', 'development')
    }
    # Send to monitoring service
```

---

## 📊 Role System Review

### ✅ **Current Status: EXCELLENT**

Your role system is already well-implemented! From the screenshot and code review:

```python
ROLES = {
    'admin': {
        'permissions': ['users.*', 'roles.*', 'profiles.*', ...],
        'features': ['user_management', 'test_dashboard', 'audit_logs']
    },
    'moderator': {
        'permissions': ['users.read', 'profiles.update', 'messages.delete'],
        'features': ['content_moderation', 'user_support']
    },
    'premium_user': {
        'permissions': ['favorites.*', 'shortlist.*', 'pii.grant'],
        'features': ['unlimited_favorites', 'advanced_search', 'pii_access']
    },
    'free_user': {
        'permissions': ['profiles.read', 'messages.create'],
        'features': ['basic_search', 'limited_favorites']
    }
}
```

### 🎯 **No Changes Needed - System is Production Ready!**

#### **Why Current System is Good:**
1. ✅ **4 clear roles** with distinct purposes
2. ✅ **Permission-based** not just role-based
3. ✅ **Scalable** - can add custom permissions
4. ✅ **UI Integration** - dropdown in admin panel
5. ✅ **Backend enforcement** - FastAPI dependencies

#### **Optional Enhancements (Low Priority):**

**1. Role Inheritance (Future Enhancement)**
```python
ROLE_INHERITANCE = {
    'admin': ['moderator', 'premium_user', 'free_user'],
    'moderator': ['premium_user', 'free_user'],
    'premium_user': ['free_user']
}

def get_inherited_permissions(role: str) -> List[str]:
    """Get all permissions including inherited"""
    permissions = DEFAULT_PERMISSIONS.get(role, [])
    
    # Add inherited permissions
    for inherited_role in ROLE_INHERITANCE.get(role, []):
        permissions.extend(DEFAULT_PERMISSIONS.get(inherited_role, []))
    
    return list(set(permissions))  # Remove duplicates
```

**2. Custom Roles (Future Enhancement)**
```python
# Allow creating custom roles
def create_custom_role(name: str, permissions: List[str]):
    """Create a custom role"""
    db.roles.insert_one({
        'name': name,
        'permissions': permissions,
        'is_system_role': False,
        'created_at': datetime.utcnow()
    })
```

---

## 📝 Implementation Roadmap

### **Phase 1: Critical (Before Production)** 🔴
**Priority: Must Have**

- [ ] **Email Service** (SendGrid or AWS SES)
  - Setup account
  - Configure API keys
  - Implement email verification
  - Implement password reset
  - Test delivery

- [ ] **Image Moderation** (Azure Content Moderator)
  - Create Azure account
  - Get API keys
  - Integrate with image_validator.py
  - Test with sample images
  - Set up automated scanning

- [ ] **Strong JWT Secret**
  - Generate production secret (64+ bytes)
  - Store in secure vault
  - Update production .env
  - Test authentication

- [ ] **MongoDB Production**
  - Set up MongoDB Atlas
  - Configure connection string
  - Enable authentication
  - Set up backups

### **Phase 2: Important (Within 1 Month)** 🟡
**Priority: Should Have**

- [ ] **Payment Gateway** (Stripe)
  - Set up Stripe account
  - Create pricing plans
  - Implement subscription flow
  - Add payment UI
  - Test transactions

- [ ] **SMS Verification** (Twilio)
  - Create Twilio account
  - Buy phone number
  - Implement verification
  - Add to registration flow

- [ ] **Secret Management**
  - Set up AWS Secrets Manager or Azure Key Vault
  - Migrate keys from .env
  - Update deployment scripts

### **Phase 3: Nice to Have (Within 3 Months)** 🟢
**Priority: Could Have**

- [ ] **Cloud Storage** (AWS S3)
  - Set up S3 bucket
  - Configure CloudFront CDN
  - Migrate existing images
  - Update upload logic

- [ ] **Analytics** (Google Analytics, Mixpanel)
  - Track user behavior
  - Monitor conversions
  - A/B testing

---

## 💰 Cost Estimate (Monthly)

### **Minimum Production Setup**
| Service | Tier | Cost |
|---------|------|------|
| MongoDB Atlas | M10 Cluster | $57 |
| SendGrid Email | Free (100/day) | $0 |
| Azure Content Moderator | 1000 images/day | $30 |
| Heroku/Railway Hosting | Basic | $7 |
| Domain Name | .com | $1 |
| **TOTAL** | | **$95/month** |

### **Recommended Production Setup**
| Service | Tier | Cost |
|---------|------|------|
| MongoDB Atlas | M20 Cluster | $150 |
| SendGrid Email | Essentials | $20 |
| Azure Content Moderator | 5000 images/day | $150 |
| Twilio SMS | 100 SMS/day | $23 |
| AWS S3 + CloudFront | 100GB + 1TB transfer | $90 |
| Heroku/Railway | Pro | $25 |
| Stripe | Transaction fees only | 2.9% |
| Domain + SSL | | $1 |
| **TOTAL** | | **$459/month** |

### **Enterprise Setup (10k+ users)**
| Service | Tier | Cost |
|---------|------|------|
| MongoDB Atlas | M40 Cluster | $580 |
| SendGrid Email | Pro | $90 |
| Azure Content Moderator | Unlimited | $500 |
| Twilio SMS | 1000/day | $230 |
| AWS S3 + CloudFront | 1TB + 10TB transfer | $900 |
| AWS ECS/EKS | Kubernetes | $300 |
| AWS Secrets Manager | | $5 |
| Stripe | Transaction fees | 2.9% |
| **TOTAL** | | **$2,605/month** |

---

## 🔗 Quick Setup Links

### **Recommended Services**
1. **Email:** https://sendgrid.com/pricing/
2. **Image Moderation:** https://azure.microsoft.com/en-us/services/cognitive-services/content-moderator/
3. **SMS:** https://www.twilio.com/verify
4. **Payments:** https://stripe.com/pricing
5. **Database:** https://www.mongodb.com/pricing
6. **Cloud Storage:** https://aws.amazon.com/s3/pricing/
7. **Secrets:** https://aws.amazon.com/secrets-manager/

---

## 📞 Next Steps

1. **Review this document** with your team
2. **Prioritize services** based on launch timeline
3. **Create accounts** for Phase 1 services
4. **Store API keys** in secure vault
5. **Test integrations** in development
6. **Update deployment** documentation

**Need help with setup? Let me know which service to implement first!** 🚀

---

**Document Version:** 1.0  
**Last Review:** October 14, 2025  
**Next Review:** Before Production Launch
