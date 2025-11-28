"""
Invitation Service
Created: November 2, 2025
Purpose: Business logic for invitation management
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from bson import ObjectId
import secrets
import string

from models.invitation_models import (
    InvitationCreate,
    InvitationDB,
    InvitationResponse,
    InvitationStatus,
    InvitationStats,
    InvitationChannel
)


class InvitationService:
    """Service for managing invitations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.invitations
        
    def _generate_token(self, length: int = 32) -> str:
        """Generate secure random token for invitation"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    def _calculate_time_lapse(self, created_at: datetime) -> str:
        """Calculate human-readable time since invitation created"""
        now = datetime.utcnow()
        delta = now - created_at
        
        if delta.days > 365:
            years = delta.days // 365
            return f"{years} year{'s' if years > 1 else ''}"
        elif delta.days > 30:
            months = delta.days // 30
            return f"{months} month{'s' if months > 1 else ''}"
        elif delta.days > 0:
            return f"{delta.days} day{'s' if delta.days > 1 else ''}"
        elif delta.seconds > 3600:
            hours = delta.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''}"
        elif delta.seconds > 60:
            minutes = delta.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''}"
        else:
            return "Just now"
    
    async def create_invitation(
        self,
        invitation_data: InvitationCreate,
        invited_by: str
    ) -> InvitationDB:
        """Create new invitation"""
        
        # Check if invitation already exists for this email
        existing = await self.collection.find_one({
            "email": invitation_data.email,
            "archived": False
        })
        
        if existing:
            raise ValueError(f"Active invitation already exists for {invitation_data.email}")
        
        # Generate invitation token
        token = self._generate_token()
        token_expires = datetime.utcnow() + timedelta(days=30)  # 30-day expiry
        
        # Create invitation document
        invitation_doc = {
            "name": invitation_data.name,
            "email": invitation_data.email,
            "phone": invitation_data.phone,
            "channel": invitation_data.channel,
            "customMessage": invitation_data.customMessage,
            "emailSubject": invitation_data.emailSubject or "You're Invited to Join USVedika for US Citizens & GC Holders",
            "invitedBy": invited_by,
            
            # Email tracking
            "emailStatus": InvitationStatus.PENDING,
            "emailSentAt": None,
            "emailDeliveredAt": None,
            "emailFailedReason": None,
            
            # SMS tracking
            "smsStatus": InvitationStatus.PENDING,
            "smsSentAt": None,
            "smsDeliveredAt": None,
            "smsFailedReason": None,
            
            # Registration tracking
            "registeredAt": None,
            "registeredUsername": None,
            
            # Metadata
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "archived": False,
            
            # Invitation link
            "invitationToken": token,
            "tokenExpiresAt": token_expires
        }
        
        result = await self.collection.insert_one(invitation_doc)
        invitation_doc["_id"] = str(result.inserted_id)
        
        return InvitationDB(**invitation_doc)
    
    async def get_invitation(self, invitation_id: str) -> Optional[InvitationDB]:
        """Get invitation by ID"""
        try:
            doc = await self.collection.find_one({"_id": ObjectId(invitation_id)})
            if doc:
                doc["_id"] = str(doc["_id"])
                return InvitationDB(**doc)
            return None
        except Exception:
            return None
    
    async def get_invitation_by_email(self, email: str) -> Optional[InvitationDB]:
        """Get active invitation by email"""
        doc = await self.collection.find_one({
            "email": email,
            "archived": False
        })
        if doc:
            doc["_id"] = str(doc["_id"])
            return InvitationDB(**doc)
        return None
    
    async def get_invitation_by_token(self, token: str) -> Optional[InvitationDB]:
        """Get invitation by token"""
        doc = await self.collection.find_one({
            "invitationToken": token,
            "archived": False
        })
        if doc:
            doc["_id"] = str(doc["_id"])
            return InvitationDB(**doc)
        return None
    
    async def list_invitations(
        self,
        skip: int = 0,
        limit: int = 100,
        include_archived: bool = False,
        status_filter: Optional[InvitationStatus] = None
    ) -> List[InvitationResponse]:
        """List all invitations with filters"""
        
        query: Dict = {}
        if not include_archived:
            query["archived"] = False
        
        if status_filter:
            query["$or"] = [
                {"emailStatus": status_filter},
                {"smsStatus": status_filter}
            ]
        
        cursor = self.collection.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        invitations = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            invitation = InvitationDB(**doc)
            
            # Calculate time lapse
            time_lapse = self._calculate_time_lapse(invitation.createdAt)
            
            # Check if expired
            is_expired = False
            if invitation.tokenExpiresAt:
                is_expired = datetime.utcnow() > invitation.tokenExpiresAt
            
            response = InvitationResponse(
                **invitation.dict(),
                timeLapse=time_lapse,
                isExpired=is_expired
            )
            invitations.append(response)
        
        return invitations
    
    async def update_invitation_status(
        self,
        invitation_id: str,
        channel: InvitationChannel,
        status: InvitationStatus,
        failed_reason: Optional[str] = None
    ) -> bool:
        """Update invitation delivery status"""
        
        update_doc = {
            "$set": {
                "updatedAt": datetime.utcnow()
            }
        }
        
        if channel == InvitationChannel.EMAIL:
            update_doc["$set"]["emailStatus"] = status
            if status == InvitationStatus.SENT:
                update_doc["$set"]["emailSentAt"] = datetime.utcnow()
            elif status == InvitationStatus.DELIVERED:
                update_doc["$set"]["emailDeliveredAt"] = datetime.utcnow()
            elif status == InvitationStatus.FAILED and failed_reason:
                update_doc["$set"]["emailFailedReason"] = failed_reason
                
        elif channel == InvitationChannel.SMS:
            update_doc["$set"]["smsStatus"] = status
            if status == InvitationStatus.SENT:
                update_doc["$set"]["smsSentAt"] = datetime.utcnow()
            elif status == InvitationStatus.DELIVERED:
                update_doc["$set"]["smsDeliveredAt"] = datetime.utcnow()
            elif status == InvitationStatus.FAILED and failed_reason:
                update_doc["$set"]["smsFailedReason"] = failed_reason
        
        result = await self.collection.update_one(
            {"_id": ObjectId(invitation_id)},
            update_doc
        )
        
        return result.modified_count > 0
    
    async def mark_as_registered(
        self,
        invitation_id: str,
        username: str
    ) -> bool:
        """Mark invitation as accepted/registered"""
        
        result = await self.collection.update_one(
            {"_id": ObjectId(invitation_id)},
            {
                "$set": {
                    "emailStatus": InvitationStatus.ACCEPTED,
                    "smsStatus": InvitationStatus.ACCEPTED,
                    "registeredAt": datetime.utcnow(),
                    "registeredUsername": username,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
    
    async def archive_invitation(self, invitation_id: str) -> bool:
        """Archive an invitation"""
        
        result = await self.collection.update_one(
            {"_id": ObjectId(invitation_id)},
            {
                "$set": {
                    "archived": True,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
    
    async def delete_invitation(self, invitation_id: str) -> bool:
        """Permanently delete an invitation"""
        
        result = await self.collection.delete_one({"_id": ObjectId(invitation_id)})
        return result.deleted_count > 0
    
    async def get_statistics(self) -> InvitationStats:
        """Get invitation system statistics"""
        
        total = await self.collection.count_documents({})
        archived = await self.collection.count_documents({"archived": True})
        
        pending = await self.collection.count_documents({
            "archived": False,
            "$or": [
                {"emailStatus": InvitationStatus.PENDING},
                {"smsStatus": InvitationStatus.PENDING}
            ]
        })
        
        accepted = await self.collection.count_documents({
            "registeredAt": {"$ne": None}
        })
        
        # Calculate success rates
        email_sent = await self.collection.count_documents({
            "emailStatus": {"$in": [InvitationStatus.SENT, InvitationStatus.DELIVERED]}
        })
        
        sms_sent = await self.collection.count_documents({
            "smsStatus": {"$in": [InvitationStatus.SENT, InvitationStatus.DELIVERED]}
        })
        
        email_success_rate = (email_sent / total * 100) if total > 0 else 0
        sms_success_rate = (sms_sent / total * 100) if total > 0 else 0
        acceptance_rate = (accepted / total * 100) if total > 0 else 0
        
        # Calculate average time to accept
        pipeline = [
            {"$match": {"registeredAt": {"$ne": None}}},
            {"$project": {
                "timeToAccept": {
                    "$subtract": ["$registeredAt", "$createdAt"]
                }
            }},
            {"$group": {
                "_id": None,
                "avgTime": {"$avg": "$timeToAccept"}
            }}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        avg_time_ms = result[0]["avgTime"] if result else None
        
        avg_time_str = None
        if avg_time_ms:
            days = int(avg_time_ms / (1000 * 60 * 60 * 24))
            if days > 0:
                avg_time_str = f"{days} day{'s' if days > 1 else ''}"
            else:
                hours = int(avg_time_ms / (1000 * 60 * 60))
                avg_time_str = f"{hours} hour{'s' if hours > 1 else ''}"
        
        return InvitationStats(
            totalInvitations=total,
            pendingInvitations=pending,
            sentInvitations=email_sent + sms_sent,
            acceptedInvitations=accepted,
            expiredInvitations=0,  # TODO: Calculate based on tokenExpiresAt
            archivedInvitations=archived,
            emailSuccessRate=round(email_success_rate, 2),
            smsSuccessRate=round(sms_success_rate, 2),
            acceptanceRate=round(acceptance_rate, 2),
            averageTimeToAccept=avg_time_str
        )
    
    async def get_invitation_by_token(self, token: str) -> Optional[InvitationDB]:
        """
        Get invitation by invitation token
        Used for validating invitation links
        """
        data = await self.collection.find_one({"invitationToken": token})
        if data:
            return InvitationDB(**data)
        return None
    
    async def mark_as_accepted(self, invitation_id: str, registered_username: str):
        """
        Mark invitation as accepted and link to registered user
        """
        await self.collection.update_one(
            {"_id": ObjectId(invitation_id)},
            {
                "$set": {
                    "emailStatus": InvitationStatus.ACCEPTED,
                    "smsStatus": InvitationStatus.ACCEPTED,
                    "registeredUsername": registered_username,
                    "registeredAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
            }
        )
