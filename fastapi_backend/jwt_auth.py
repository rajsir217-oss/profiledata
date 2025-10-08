# fastapi_backend/jwt_auth.py
"""
JWT Authentication System with Refresh Tokens
"""

from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from security_config import security_settings
import secrets

# HTTP Bearer token scheme
security_scheme = HTTPBearer()

class JWTManager:
    """JWT token management"""
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=security_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            security_settings.JWT_SECRET_KEY,
            algorithm=security_settings.JWT_ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=security_settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
            "jti": secrets.token_urlsafe(32)  # Unique token ID
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            security_settings.JWT_SECRET_KEY,
            algorithm=security_settings.JWT_ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def decode_token(token: str) -> Dict:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(
                token,
                security_settings.JWT_SECRET_KEY,
                algorithms=[security_settings.JWT_ALGORITHM]
            )
            return payload
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    @staticmethod
    def verify_token_type(payload: Dict, expected_type: str):
        """Verify token type (access or refresh)"""
        token_type = payload.get("type")
        if token_type != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {expected_type}, got {token_type}",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    @staticmethod
    def get_token_expiry(payload: Dict) -> datetime:
        """Get token expiry datetime"""
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            return datetime.fromtimestamp(exp_timestamp)
        return None
    
    @staticmethod
    def is_token_expired(payload: Dict) -> bool:
        """Check if token is expired"""
        expiry = JWTManager.get_token_expiry(payload)
        if expiry:
            return datetime.utcnow() >= expiry
        return True

class AuthenticationService:
    """Authentication service for user verification"""
    
    @staticmethod
    async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
        db = None  # Will be injected via Depends
    ) -> Dict:
        """
        Get current authenticated user from JWT token
        This is a dependency that can be used in route handlers
        """
        token = credentials.credentials
        
        # Decode token
        payload = JWTManager.decode_token(token)
        
        # Verify it's an access token
        JWTManager.verify_token_type(payload, "access")
        
        # Check if token is expired
        if JWTManager.is_token_expired(payload):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Extract user info
        username = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get user from database (if db provided)
        if db:
            user = await db.users.find_one({"username": username})
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Check if user is active
            if user.get("status", {}).get("status") != "active":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is not active"
                )
            
            return user
        
        # Return minimal user info from token
        return {
            "username": username,
            "role": payload.get("role", "free_user"),
            "permissions": payload.get("permissions", [])
        }
    
    @staticmethod
    async def get_current_active_user(
        current_user: Dict = Depends(get_current_user)
    ) -> Dict:
        """Get current active user (additional validation)"""
        # Additional checks can be added here
        return current_user
    
    @staticmethod
    async def verify_refresh_token(refresh_token: str, db) -> Dict:
        """Verify refresh token and return user"""
        # Decode token
        payload = JWTManager.decode_token(refresh_token)
        
        # Verify it's a refresh token
        JWTManager.verify_token_type(payload, "refresh")
        
        # Check if token is expired
        if JWTManager.is_token_expired(payload):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get username
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Verify token exists in database (not revoked)
        session = await db.sessions.find_one({
            "refresh_token": refresh_token,
            "revoked": False
        })
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked"
            )
        
        # Get user
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return user

# Helper function to create token pair
def create_token_pair(user: Dict, remember_me: bool = False) -> Dict:
    """Create access and refresh token pair"""
    token_data = {
        "sub": user["username"],
        "role": user.get("role_name", "free_user"),
        "permissions": user.get("custom_permissions", [])
    }
    
    # Create access token
    access_token = JWTManager.create_access_token(token_data)
    
    # Create refresh token
    refresh_token = JWTManager.create_refresh_token(token_data)
    
    # Calculate expiry
    if remember_me:
        expires_in = security_settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60  # Convert to minutes
    else:
        expires_in = security_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in * 60  # Convert to seconds
    }

# Dependency for getting current user (to be used in routes)
async def get_current_user_dependency(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme)
) -> Dict:
    """Dependency to get current user from token"""
    from database import get_database
    db = await get_database()
    return await AuthenticationService.get_current_user(credentials, db)
