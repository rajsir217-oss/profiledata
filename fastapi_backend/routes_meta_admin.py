"""
Admin Routes for Meta Fields Management
Allows admins to verify, update, and control meta field visibility
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from auth.authorization import require_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ===== REQUEST MODELS =====

class VerificationUpdate(BaseModel):
    """Update verification status for a user"""
    username: str
    verificationType: str  # "id", "email", "phone", "employment", "education"
    verified: bool
    verificationSource: Optional[str] = None


class PremiumUpdate(BaseModel):
    """Update premium status for a user"""
    username: str
    isPremium: bool
    premiumStatus: str  # "free", "premium", "elite", "vip"
    expiresAt: Optional[datetime] = None


class MetaFieldUpdate(BaseModel):
    """Update any meta field for a user"""
    username: str
    field: str
    value: Any


class VisibilityUpdate(BaseModel):
    """Control meta fields visibility"""
    username: str
    metaFieldsVisibleToPublic: bool
    visibilitySettings: Optional[dict] = None  # {"idVerified": true, "isPremium": false}


class BadgeUpdate(BaseModel):
    """Add or remove badges"""
    username: str
    badges: List[str]
    action: str  # "add" or "set"


# ===== VERIFICATION ENDPOINTS =====

@router.post("/admin/meta/verify", dependencies=[Depends(require_admin)])
async def update_verification(
    update: VerificationUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update verification status for a user"""
    try:
        admin_username = current_user.get('username')
        
        # Build update fields based on verification type
        update_fields = {}
        
        if update.verificationType == "id":
            update_fields['idVerified'] = update.verified
            if update.verified:
                update_fields['idVerifiedAt'] = datetime.utcnow()
                update_fields['idVerifiedBy'] = admin_username
        
        elif update.verificationType == "email":
            update_fields['emailVerified'] = update.verified
            if update.verified:
                update_fields['emailVerifiedAt'] = datetime.utcnow()
        
        elif update.verificationType == "phone":
            update_fields['phoneVerified'] = update.verified
            if update.verified:
                update_fields['phoneVerifiedAt'] = datetime.utcnow()
        
        elif update.verificationType == "employment":
            update_fields['employmentVerified'] = update.verified
            if update.verified:
                update_fields['employmentVerifiedAt'] = datetime.utcnow()
                if update.verificationSource:
                    update_fields['employmentVerificationSource'] = update.verificationSource
        
        elif update.verificationType == "education":
            update_fields['educationVerified'] = update.verified
            if update.verified:
                update_fields['educationVerifiedAt'] = datetime.utcnow()
                if update.verificationSource:
                    update_fields['educationVerificationSource'] = update.verificationSource
        
        else:
            raise HTTPException(status_code=400, detail="Invalid verification type")
        
        # Update user
        result = await db.users.update_one(
            {'username': update.username},
            {'$set': update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"Admin {admin_username} updated {update.verificationType} verification for {update.username} to {update.verified}")
        
        return {
            "success": True,
            "message": f"{update.verificationType.capitalize()} verification updated",
            "username": update.username,
            "verified": update.verified
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating verification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/meta/premium", dependencies=[Depends(require_admin)])
async def update_premium_status(
    update: PremiumUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update premium status for a user"""
    try:
        admin_username = current_user.get('username')
        
        update_fields = {
            'isPremium': update.isPremium,
            'premiumStatus': update.premiumStatus
        }
        
        if update.isPremium:
            update_fields['premiumActivatedAt'] = datetime.utcnow()
            if update.expiresAt:
                update_fields['premiumExpiresAt'] = update.expiresAt
        else:
            update_fields['premiumActivatedAt'] = None
            update_fields['premiumExpiresAt'] = None
        
        result = await db.users.update_one(
            {'username': update.username},
            {'$set': update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"Admin {admin_username} updated premium status for {update.username} to {update.premiumStatus}")
        
        return {
            "success": True,
            "message": "Premium status updated",
            "username": update.username,
            "isPremium": update.isPremium,
            "premiumStatus": update.premiumStatus
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating premium status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/meta/visibility", dependencies=[Depends(require_admin)])
async def update_visibility(
    update: VisibilityUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Control meta fields visibility for a user"""
    try:
        update_fields = {
            'metaFieldsVisibleToPublic': update.metaFieldsVisibleToPublic
        }
        
        if update.visibilitySettings:
            update_fields['metaFieldsVisibility'] = update.visibilitySettings
        
        result = await db.users.update_one(
            {'username': update.username},
            {'$set': update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "message": "Visibility settings updated",
            "username": update.username,
            "metaFieldsVisibleToPublic": update.metaFieldsVisibleToPublic
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating visibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/meta/badges", dependencies=[Depends(require_admin)])
async def update_badges(
    update: BadgeUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Add or set badges for a user"""
    try:
        if update.action == "add":
            # Add new badges (append unique)
            result = await db.users.update_one(
                {'username': update.username},
                {'$addToSet': {'badges': {'$each': update.badges}}}
            )
        elif update.action == "set":
            # Replace badges entirely
            result = await db.users.update_one(
                {'username': update.username},
                {'$set': {'badges': update.badges}}
            )
        else:
            raise HTTPException(status_code=400, detail="Action must be 'add' or 'set'")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "message": f"Badges {update.action}ed successfully",
            "username": update.username,
            "badges": update.badges
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating badges: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/meta/field", dependencies=[Depends(require_admin)])
async def update_meta_field(
    update: MetaFieldUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update any meta field for a user (flexible endpoint)"""
    try:
        # Allowed meta fields for update
        allowed_fields = [
            'trustScore', 'profileCompleteness', 'profileQualityScore',
            'moderationStatus', 'backgroundCheckStatus', 'profileRank',
            'isFeatured', 'isStaffPick', 'achievementPoints', 'responseRate',
            'profileViews', 'uniqueViewersCount', 'activeDays'
        ]
        
        if update.field not in allowed_fields:
            raise HTTPException(status_code=400, detail=f"Field '{update.field}' cannot be updated via this endpoint")
        
        result = await db.users.update_one(
            {'username': update.username},
            {'$set': {update.field: update.value}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "message": f"Field '{update.field}' updated",
            "username": update.username,
            "field": update.field,
            "value": update.value
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating meta field: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/meta/{username}", dependencies=[Depends(require_admin)])
async def get_user_meta_fields(
    username: str,
    db = Depends(get_database)
):
    """Get all meta fields for a specific user"""
    try:
        user = await db.users.find_one({'username': username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Extract meta fields
        meta_fields = {
            # Phase 1
            "idVerified": user.get('idVerified', False),
            "idVerifiedAt": user.get('idVerifiedAt'),
            "idVerifiedBy": user.get('idVerifiedBy'),
            "emailVerified": user.get('emailVerified', False),
            "phoneVerified": user.get('phoneVerified', False),
            "isPremium": user.get('isPremium', False),
            "premiumStatus": user.get('premiumStatus', 'free'),
            "profileCompleteness": user.get('profileCompleteness', 0),
            "trustScore": user.get('trustScore', 50),
            "lastActiveAt": user.get('lastActiveAt'),
            
            # Phase 2
            "employmentVerified": user.get('employmentVerified', False),
            "educationVerified": user.get('educationVerified', False),
            "backgroundCheckStatus": user.get('backgroundCheckStatus', 'none'),
            "profileQualityScore": user.get('profileQualityScore', 0),
            "moderationStatus": user.get('moderationStatus', 'approved'),
            
            # Phase 3
            "badges": user.get('badges', []),
            "achievementPoints": user.get('achievementPoints', 0),
            "profileRank": user.get('profileRank'),
            "isFeatured": user.get('isFeatured', False),
            "isStaffPick": user.get('isStaffPick', False),
            "profileViews": user.get('profileViews', 0),
            "responseRate": user.get('responseRate', 0.0),
            
            # Visibility
            "metaFieldsVisibleToPublic": user.get('metaFieldsVisibleToPublic', False),
            "metaFieldsVisibility": user.get('metaFieldsVisibility', {})
        }
        
        return {
            "username": username,
            "metaFields": meta_fields
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting meta fields: {e}")
        raise HTTPException(status_code=500, detail=str(e))
