# fastapi_backend/routes_pii_access.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

router = APIRouter(prefix="/api/pii-access", tags=["pii-access"])
logger = logging.getLogger(__name__)

@router.get("/{username}/received")
async def get_received_pii_access(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get PII access that has been granted TO this user (received).
    Returns list of access grants where this user is the requester.
    """
    try:
        logger.info(f"📥 Fetching received PII access for {username}")
        
        # Find all PII access grants where this user is the grantedTo
        access_grants = await db.pii_access.find({
            "grantedToUsername": username,
            "isActive": True
        }).to_list(length=None)
        
        logger.info(f"✅ Found {len(access_grants)} ACTIVE received PII access grants for {username}")
        for grant in access_grants:
            logger.info(f"   - From {grant.get('granterUsername')}: {grant.get('accessType')} (isActive: {grant.get('isActive')})")
        
        # Group by granterUsername and aggregate accessTypes
        grouped_access = {}
        for grant in access_grants:
            granter = grant.get("granterUsername")
            access_type = grant.get("accessType")
            
            if granter and access_type:
                if granter not in grouped_access:
                    grouped_access[granter] = {
                        "userProfile": {"username": granter},
                        "accessTypes": []
                    }
                grouped_access[granter]["accessTypes"].append(access_type)
        
        # Convert to list
        formatted_access = list(grouped_access.values())
        
        return {
            "success": True,
            "receivedAccess": formatted_access,
            "access": formatted_access  # Alternative key for compatibility
        }
        
    except Exception as error:
        logger.error(f"❌ Error fetching received PII access: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch PII access: {str(error)}"
        )

@router.get("/{username}/granted")
async def get_granted_pii_access(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get PII access that this user has granted TO others.
    Returns list of access grants where this user is the owner.
    """
    try:
        logger.info(f"📤 Fetching granted PII access by {username}")
        
        # Find all PII access grants where this user is the owner
        access_grants = await db.pii_access.find({
            "granterUsername": username,
            "isActive": True
        }).to_list(length=None)
        
        logger.info(f"✅ Found {len(access_grants)} granted PII access")
        
        return {
            "success": True,
            "grantedAccess": access_grants
        }
        
    except Exception as error:
        logger.error(f"❌ Error fetching granted PII access: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch granted PII access: {str(error)}"
        )
