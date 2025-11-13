# Backend Integration Example for Cloudflare Turnstile
# Add this code to your login endpoint in routes.py

import requests
from config import Settings

settings = Settings()

# Add this function near the top of routes.py
async def verify_turnstile(token: str) -> bool:
    """
    Verify Cloudflare Turnstile CAPTCHA token
    
    Args:
        token: The turnstile token from frontend
        
    Returns:
        bool: True if verification passed, False otherwise
    """
    if not token:
        return False
    
    verify_url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    verify_data = {
        "secret": settings.turnstile_secret_key,
        "response": token
    }
    
    try:
        verify_response = requests.post(verify_url, json=verify_data)
        result = verify_response.json()
        return result.get("success", False)
    except Exception as e:
        logger.error(f"Turnstile verification error: {e}")
        return False


# Update your login endpoint like this:
@router.post("/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    captchaToken: str = Form(None),  # Add this parameter
    db = Depends(get_database)
):
    """Login endpoint with Turnstile CAPTCHA verification"""
    
    # Verify Turnstile CAPTCHA
    if captchaToken:
        if not await verify_turnstile(captchaToken):
            logger.warning(f"❌ Turnstile verification failed for username: {username}")
            raise HTTPException(
                status_code=400, 
                detail="CAPTCHA verification failed. Please try again."
            )
        logger.info(f"✅ Turnstile CAPTCHA verified for username: {username}")
    else:
        # Optional: Make CAPTCHA required
        logger.warning(f"⚠️ No CAPTCHA token provided for username: {username}")
        raise HTTPException(
            status_code=400,
            detail="CAPTCHA verification required"
        )
    
    # Continue with existing login logic...
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    if not pwd_context.verify(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate JWT token
    from datetime import datetime, timedelta
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role_name": user.get("role_name", "free_user"),
            "status": user.get("status", {}).get("status", "active")
        }
    }


# Example response from Turnstile API:
"""
{
  "success": true,
  "challenge_ts": "2025-11-12T07:00:00.000Z",
  "hostname": "l3v3lmatches.com",
  "error-codes": [],
  "action": "login",
  "cdata": ""
}
"""

# If verification fails:
"""
{
  "success": false,
  "error-codes": ["invalid-input-response"]
}
"""
