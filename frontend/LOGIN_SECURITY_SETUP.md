# Login Security Features - Setup Guide

## ✅ What Was Implemented

### 1. **Forgot Username/Password Link**
- Added link below password field on login page
- Routes to `/forgot-password`
- Created full `ForgotPassword.js` component with 4-step flow:
  1. Request reset (enter username/email)
  2. Verify code (6-digit code)
  3. Reset password (enter new password)
  4. Success confirmation

### 2. **Google reCAPTCHA Integration**
- Added reCAPTCHA v2 (checkbox) to login form
- Prevents bot/automated login attempts
- Currently using Google's test key (needs replacement)
- Sign In button disabled until CAPTCHA completed

---

## 🔧 Setup Steps Required

### Step 1: Install reCAPTCHA Package

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend
npm install react-google-recaptcha
```

### Step 2: Get Your reCAPTCHA Keys

1. Go to: https://www.google.com/recaptcha/admin
2. Click "Register a new site"
3. Fill in:
   - **Label:** L3V3L Matches
   - **reCAPTCHA type:** ✓ reCAPTCHA v2 → "I'm not a robot" Checkbox
   - **Domains:** 
     - `l3v3lmatches.com`
     - `localhost` (for testing)
4. Accept terms and submit
5. Copy your **Site Key** and **Secret Key**

### Step 3: Update Frontend Site Key

Edit `frontend/src/components/Login.js` (line ~440):

```javascript
// Replace this:
sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"  // Test key

// With your actual key:
sitekey="YOUR_ACTUAL_SITE_KEY_HERE"
```

### Step 4: Backend - Add CAPTCHA Verification

Add to `fastapi_backend/.env`:
```
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

Update `fastapi_backend/config.py`:
```python
class Settings(BaseSettings):
    # ... existing settings ...
    recaptcha_secret_key: str = ""
```

Update `fastapi_backend/routes.py` login endpoint:

```python
import requests
from config import Settings

settings = Settings()

@router.post("/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    captchaToken: str = Form(None),  # NEW
    db = Depends(get_database)
):
    # Verify CAPTCHA
    if captchaToken:
        verify_url = "https://www.google.com/recaptcha/api/siteverify"
        verify_data = {
            "secret": settings.recaptcha_secret_key,
            "response": captchaToken
        }
        verify_response = requests.post(verify_url, data=verify_data)
        result = verify_response.json()
        
        if not result.get("success"):
            logger.warning(f"CAPTCHA verification failed for username: {username}")
            raise HTTPException(
                status_code=400, 
                detail="CAPTCHA verification failed. Please try again."
            )
        
        logger.info(f"✅ CAPTCHA verified for username: {username}")
    else:
        # Optional: Make CAPTCHA required
        raise HTTPException(
            status_code=400,
            detail="CAPTCHA verification required"
        )
    
    # Continue with existing login logic...
    user = await db.users.find_one({"username": username})
    # ... rest of login logic
```

### Step 5: Backend - Forgot Password API Endpoints

Add these new endpoints to `fastapi_backend/routes.py`:

```python
@router.post("/auth/request-password-reset")
async def request_password_reset(
    identifier: str = Body(..., embed=True),  # username or email
    db = Depends(get_database)
):
    """Send password reset code to user's email/phone"""
    # Find user by username or email
    user = await db.users.find_one({
        "$or": [
            {"username": identifier},
            {"contactEmail": identifier}
        ]
    })
    
    if not user:
        # Don't reveal if user exists (security)
        return {"message": "If account exists, reset code was sent"}
    
    # Generate 6-digit code
    import random
    code = f"{random.randint(100000, 999999)}"
    
    # Store code in database (expires in 15 minutes)
    from datetime import datetime, timedelta
    await db.password_reset_codes.insert_one({
        "username": user["username"],
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
        "used": False
    })
    
    # Send email/SMS with code
    # TODO: Integrate with your email/SMS service
    logger.info(f"Password reset code for {user['username']}: {code}")
    
    return {"message": "Reset code sent successfully"}


@router.post("/auth/verify-reset-code")
async def verify_reset_code(
    identifier: str = Body(...),
    code: str = Body(...),
    db = Depends(get_database)
):
    """Verify the reset code"""
    user = await db.users.find_one({
        "$or": [
            {"username": identifier},
            {"contactEmail": identifier}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find valid code
    from datetime import datetime
    reset_code = await db.password_reset_codes.find_one({
        "username": user["username"],
        "code": code,
        "used": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not reset_code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    return {"message": "Code verified"}


@router.post("/auth/reset-password")
async def reset_password(
    identifier: str = Body(...),
    code: str = Body(...),
    new_password: str = Body(..., min_length=8),
    db = Depends(get_database)
):
    """Reset user's password"""
    user = await db.users.find_one({
        "$or": [
            {"username": identifier},
            {"contactEmail": identifier}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify code again
    from datetime import datetime
    reset_code = await db.password_reset_codes.find_one({
        "username": user["username"],
        "code": code,
        "used": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not reset_code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Hash new password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(new_password)
    
    # Update password
    await db.users.update_one(
        {"username": user["username"]},
        {"$set": {"password": hashed_password}}
    )
    
    # Mark code as used
    await db.password_reset_codes.update_one(
        {"_id": reset_code["_id"]},
        {"$set": {"used": True}}
    )
    
    logger.info(f"✅ Password reset successfully for user: {user['username']}")
    
    return {"message": "Password reset successfully"}
```

---

## 📊 Files Changed

### Frontend:
1. ✅ `src/components/Login.js` - Added CAPTCHA and forgot password link
2. ✅ `src/components/ForgotPassword.js` - NEW component (4-step reset flow)
3. ✅ `src/App.js` - Added forgot-password route
4. ✅ `INSTALL_CAPTCHA.md` - Setup instructions
5. ✅ `LOGIN_SECURITY_SETUP.md` - This file

### Backend (TODO):
1. ⏳ `fastapi_backend/.env` - Add RECAPTCHA_SECRET_KEY
2. ⏳ `fastapi_backend/config.py` - Add recaptcha_secret_key setting
3. ⏳ `fastapi_backend/routes.py` - Add CAPTCHA verification to login
4. ⏳ `fastapi_backend/routes.py` - Add 3 password reset endpoints

---

## 🧪 Testing

### Test CAPTCHA (Development):
- Google provides test keys that always pass
- **Site Key:** `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI` (currently in use)
- **Secret Key:** `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`

⚠️ **Important:** Replace with real keys before production!

### Test Forgot Password Flow:
1. Go to https://l3v3lmatches.com/login
2. Click "Forgot Username or Password?"
3. Enter username or email
4. Enter 6-digit code (check backend logs in dev mode)
5. Enter new password
6. Confirm success message
7. Test login with new password

---

## 🔒 Security Benefits

✅ **CAPTCHA Protection:**
- Prevents automated bot attacks
- Reduces brute force login attempts
- Protects against credential stuffing

✅ **Password Reset:**
- Secure 6-digit code delivery
- Time-limited codes (15 minutes)
- One-time use codes
- No password exposure

✅ **User Experience:**
- Self-service password recovery
- Clear error messages
- Mobile-friendly interface
- Step-by-step guidance

---

## 📝 Next Steps

1. ✅ Install `react-google-recaptcha`: `npm install react-google-recaptcha`
2. ✅ Get your reCAPTCHA keys from Google
3. ✅ Update frontend with your Site Key
4. ✅ Add backend CAPTCHA verification
5. ✅ Implement forgot password backend endpoints
6. ✅ Test the complete flow
7. ✅ Deploy to production

---

**All frontend code is ready! Just need to:**
1. Run `npm install react-google-recaptcha`
2. Get reCAPTCHA keys
3. Implement backend endpoints
4. Deploy! 🚀
