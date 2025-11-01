# MFA Login Flow - Industry Standard Implementation

## ✅ Correct Flow (Now Implemented)

### Step 1: Initial Login Attempt
```
POST /login
{
  "username": "user123",
  "password": "password"
}
```

**Backend Response (if MFA enabled):**
```
Status: 403 Forbidden
{
  "detail": "MFA_REQUIRED",
  "mfa_channel": "email",  // or "sms"
  "contact_masked": "r***l@gmail.com"
}
```

**⚠️ CRITICAL: No JWT token is issued yet!**

---

### Step 2: Frontend Sends MFA Code
```
POST /api/auth/mfa/send-code
{
  "username": "user123"
}
```

**Backend:**
- Generates 6-digit OTP
- Sends to user's email/SMS
- Stores OTP in database with expiry (10 minutes)

**Response:**
```
{
  "success": true,
  "message": "Verification code sent via EMAIL",
  "contact_masked": "r***l@gmail.com"
}
```

---

### Step 3: User Enters MFA Code
User receives code (e.g., `123456`) and enters it in the login form.

---

### Step 4: Verify MFA and Complete Login
```
POST /login
{
  "username": "user123",
  "password": "password",
  "mfa_code": "123456"
}
```

**Backend:**
- Verifies password again
- Verifies MFA code from database
- If valid: Creates JWT token + session
- Returns full login response

**Response:**
```
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": { ... }
}
```

**✅ User is now logged in!**

---

## Security Benefits

1. **No Premature Access:** User cannot access the system without MFA verification
2. **Token Only After MFA:** JWT token is issued only after full authentication
3. **Single Login Endpoint:** Same `/login` endpoint for both steps (cleaner API)
4. **OTP Stored in DB:** Server-side validation, no client-side trust
5. **Time-Limited OTP:** Codes expire after 10 minutes
6. **One-Time Use:** Each OTP can only be used once
7. **Backup Codes:** Users can use backup codes if they lose access to email/SMS

---

## Backup Code Flow

If user doesn't have access to email/SMS:

```
POST /login
{
  "username": "user123",
  "password": "password",
  "mfa_code": "ABCD-1234"  // Backup code format
}
```

**Backend:**
- Recognizes backup code format (has dash, 9 chars)
- Verifies against hashed backup codes
- Removes used backup code
- Issues JWT token

---

## Frontend Implementation

### State Management
```javascript
const [mfaRequired, setMfaRequired] = useState(false);
const [mfaCode, setMfaCode] = useState("");
const [mfaChannel, setMfaChannel] = useState("");
const [contactMasked, setContactMasked] = useState("");
```

### Login Handler
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const res = await api.post("/login", {
      username: form.username,
      password: form.password,
      mfa_code: mfaCode || undefined  // Include if MFA step
    });
    
    // Success - save token and navigate
    localStorage.setItem('token', res.data.access_token);
    navigate('/dashboard');
    
  } catch (err) {
    if (err.response?.status === 403 && 
        err.response?.data?.detail === "MFA_REQUIRED") {
      // MFA required - show MFA input
      setMfaRequired(true);
      setMfaChannel(err.response.data.mfa_channel);
      setContactMasked(err.response.data.contact_masked);
      
      // Auto-send MFA code
      await sendMfaCode();
    } else {
      setError(err.response?.data?.detail || "Login failed");
    }
  }
};
```

---

## Backend Implementation

### Auth Routes (`/auth/auth_routes.py`)

```python
@router.post("/login")
async def login(request: LoginRequest, db = Depends(get_database)):
    # 1. Validate username/password
    user = await db.users.find_one({"username": request.username})
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 2. Check if MFA enabled
    mfa = user.get("mfa", {})
    if mfa.get("mfa_enabled"):
        if not request.mfa_code:
            # MFA required but no code provided - block login
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "MFA_REQUIRED",
                    "mfa_channel": mfa.get("mfa_type", "email"),
                    "contact_masked": mask_contact(user)
                }
            )
        
        # 3. Verify MFA code
        otp_manager = OTPManager(db)
        result = await otp_manager.verify_otp(
            identifier=request.username,
            code=request.mfa_code,
            purpose="mfa",
            mark_as_used=True
        )
        
        if not result["success"]:
            # Try backup code
            if not verify_backup_code(request.mfa_code, mfa["backup_codes"]):
                raise HTTPException(status_code=401, detail="Invalid MFA code")
    
    # 4. Create JWT token (only after MFA verification)
    token = create_access_token(user)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }
```

---

## Files Modified

1. **`/auth/auth_routes.py`** - Login endpoint
   - Returns `MFA_REQUIRED` with channel and masked contact
   - Verifies MFA code on second attempt
   - Supports both email and SMS MFA

2. **`/frontend/src/components/Login.js`** - Already implemented
   - Handles MFA_REQUIRED response
   - Shows MFA code input
   - Sends code via `/api/auth/mfa/send-code`

3. **`/auth/mfa_routes.py`** - MFA endpoints
   - `/api/auth/mfa/send-code` - Sends OTP
   - `/api/auth/mfa/status` - Check MFA status
   - `/api/auth/mfa/enable` - Enable MFA
   - `/api/auth/mfa/disable` - Disable MFA

---

## Testing Checklist

- [ ] Login with MFA-enabled account shows MFA prompt
- [ ] Login without MFA-enabled account works normally
- [ ] MFA code is sent to correct email/SMS
- [ ] Valid MFA code completes login
- [ ] Invalid MFA code shows error
- [ ] Expired MFA code shows error
- [ ] Backup code works
- [ ] User cannot access system without MFA verification
- [ ] Token is not issued until MFA verification
- [ ] Resend code works
- [ ] Cancel MFA returns to login form

---

## Security Notes

1. **Rate Limiting:** Add rate limiting to `/login` and `/api/auth/mfa/send-code`
2. **OTP Expiry:** OTPs expire after 10 minutes
3. **Max Attempts:** Limit OTP verification attempts to 5
4. **Backup Codes:** Generate 10 backup codes, each usable once
5. **Audit Logging:** Log all MFA events (enabled, disabled, login attempts)
6. **Session Management:** Create session only after successful MFA verification

---

**Last Updated:** October 31, 2025  
**Status:** ✅ Implemented & Ready for Testing
