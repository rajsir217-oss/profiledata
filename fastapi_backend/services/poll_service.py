"""
Poll Service
Business logic for the polling system
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.poll_models import (
    PollCreate, PollUpdate, Poll, PollOption,
    PollResponseCreate, PollResponse, PollStatus, PollType,
    PollResultsSummary, PollWithUserResponse
)
from crypto_utils import get_encryptor

logger = logging.getLogger(__name__)


class PollService:
    """Service for managing polls and responses"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.polls_collection = db.polls
        self.responses_collection = db.poll_responses
        self.users_collection = db.users
    
    # ==================== POLL CRUD ====================
    
    async def create_poll(self, poll_data: PollCreate, created_by: str) -> Dict[str, Any]:
        """Create a new poll"""
        try:
            # Build options list
            options = []
            if poll_data.poll_type == PollType.RSVP:
                # Default RSVP options
                options = [
                    PollOption(id=str(ObjectId()), text="Yes, I can join!", order=0),
                    PollOption(id=str(ObjectId()), text="No, I cannot make it", order=1),
                    PollOption(id=str(ObjectId()), text="Maybe, I'll try", order=2),
                ]
            elif poll_data.options:
                # Custom options
                options = [
                    PollOption(id=str(ObjectId()), text=opt, order=i)
                    for i, opt in enumerate(poll_data.options)
                ]
            
            poll_doc = {
                "title": poll_data.title,
                "description": poll_data.description,
                "poll_type": poll_data.poll_type.value,
                "options": [opt.model_dump() for opt in options],
                
                "event_date": poll_data.event_date,
                "event_time": poll_data.event_time,
                "event_location": poll_data.event_location,
                "event_details": poll_data.event_details,
                
                "collect_contact_info": poll_data.collect_contact_info,
                "allow_comments": poll_data.allow_comments,
                "anonymous": poll_data.anonymous,
                
                "start_date": poll_data.start_date or datetime.utcnow(),
                "end_date": poll_data.end_date,
                "status": PollStatus.DRAFT.value,
                
                "target_all_users": poll_data.target_all_users,
                "target_usernames": poll_data.target_usernames or [],
                
                "created_by": created_by,
                "created_at": datetime.utcnow(),
                "updated_at": None,
            }
            
            result = await self.polls_collection.insert_one(poll_doc)
            poll_doc["_id"] = str(result.inserted_id)
            
            logger.info(f"✅ Poll created: {poll_data.title} by {created_by}")
            
            return {
                "success": True,
                "message": "Poll created successfully",
                "poll_id": str(result.inserted_id),
                "poll": poll_doc
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating poll: {e}")
            return {
                "success": False,
                "message": f"Failed to create poll: {str(e)}"
            }
    
    async def get_poll(self, poll_id: str, include_stats: bool = False) -> Optional[Dict[str, Any]]:
        """Get a single poll by ID"""
        try:
            poll = await self.polls_collection.find_one({"_id": ObjectId(poll_id)})
            if not poll:
                return None
            
            poll["_id"] = str(poll["_id"])
            
            if include_stats:
                # Get response count
                response_count = await self.responses_collection.count_documents(
                    {"poll_id": poll_id}
                )
                poll["response_count"] = response_count
            
            return poll
            
        except Exception as e:
            logger.error(f"❌ Error getting poll {poll_id}: {e}")
            return None
    
    async def update_poll(self, poll_id: str, poll_data: PollUpdate) -> Dict[str, Any]:
        """Update an existing poll"""
        try:
            update_doc = {"updated_at": datetime.utcnow()}
            
            # Only update provided fields
            update_fields = poll_data.model_dump(exclude_unset=True)
            
            # Handle options update
            if "options" in update_fields and update_fields["options"]:
                options = [
                    PollOption(id=str(ObjectId()), text=opt, order=i).model_dump()
                    for i, opt in enumerate(update_fields["options"])
                ]
                update_doc["options"] = options
                del update_fields["options"]
            
            # Handle enum fields
            if "poll_type" in update_fields:
                update_fields["poll_type"] = update_fields["poll_type"].value
            if "status" in update_fields:
                update_fields["status"] = update_fields["status"].value
            
            update_doc.update(update_fields)
            
            result = await self.polls_collection.update_one(
                {"_id": ObjectId(poll_id)},
                {"$set": update_doc}
            )
            
            if result.modified_count == 0:
                return {
                    "success": False,
                    "message": "Poll not found or no changes made"
                }
            
            logger.info(f"✅ Poll updated: {poll_id}")
            
            return {
                "success": True,
                "message": "Poll updated successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Error updating poll {poll_id}: {e}")
            return {
                "success": False,
                "message": f"Failed to update poll: {str(e)}"
            }
    
    async def delete_poll(self, poll_id: str) -> Dict[str, Any]:
        """Delete a poll and all its responses"""
        try:
            # Delete responses first
            await self.responses_collection.delete_many({"poll_id": poll_id})
            
            # Delete poll
            result = await self.polls_collection.delete_one({"_id": ObjectId(poll_id)})
            
            if result.deleted_count == 0:
                return {
                    "success": False,
                    "message": "Poll not found"
                }
            
            logger.info(f"✅ Poll deleted: {poll_id}")
            
            return {
                "success": True,
                "message": "Poll and all responses deleted successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Error deleting poll {poll_id}: {e}")
            return {
                "success": False,
                "message": f"Failed to delete poll: {str(e)}"
            }
    
    async def list_polls(
        self,
        status: Optional[PollStatus] = None,
        page: int = 1,
        page_size: int = 20,
        include_stats: bool = False
    ) -> Dict[str, Any]:
        """List polls with optional filtering"""
        try:
            query = {}
            if status:
                query["status"] = status.value
            
            # Get total count
            total = await self.polls_collection.count_documents(query)
            
            # Get paginated results
            skip = (page - 1) * page_size
            cursor = self.polls_collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
            polls = await cursor.to_list(length=page_size)
            
            # Convert ObjectIds and add stats
            for poll in polls:
                poll["_id"] = str(poll["_id"])
                if include_stats:
                    poll["response_count"] = await self.responses_collection.count_documents(
                        {"poll_id": poll["_id"]}
                    )
            
            return {
                "polls": polls,
                "total": total,
                "page": page,
                "page_size": page_size,
                "has_more": skip + len(polls) < total
            }
            
        except Exception as e:
            logger.error(f"❌ Error listing polls: {e}")
            return {
                "polls": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "has_more": False
            }
    
    async def set_poll_status(self, poll_id: str, status: PollStatus) -> Dict[str, Any]:
        """Change poll status (activate, close, archive)"""
        try:
            result = await self.polls_collection.update_one(
                {"_id": ObjectId(poll_id)},
                {
                    "$set": {
                        "status": status.value,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count == 0:
                return {
                    "success": False,
                    "message": "Poll not found"
                }
            
            logger.info(f"✅ Poll {poll_id} status changed to {status.value}")
            
            return {
                "success": True,
                "message": f"Poll status changed to {status.value}"
            }
            
        except Exception as e:
            logger.error(f"❌ Error changing poll status: {e}")
            return {
                "success": False,
                "message": f"Failed to change poll status: {str(e)}"
            }
    
    # ==================== USER RESPONSES ====================
    
    async def get_active_polls_for_user(self, username: str) -> List[Dict[str, Any]]:
        """Get all active polls that a user can respond to"""
        try:
            now = datetime.utcnow()
            
            # Find active polls
            query = {
                "status": PollStatus.ACTIVE.value,
                "$or": [
                    {"start_date": {"$lte": now}},
                    {"start_date": None}
                ],
                "$or": [
                    {"end_date": {"$gte": now}},
                    {"end_date": None}
                ],
                "$or": [
                    {"target_all_users": True},
                    {"target_usernames": username}
                ]
            }
            
            # Simplified query to avoid $or conflicts
            query = {
                "status": PollStatus.ACTIVE.value,
            }
            
            cursor = self.polls_collection.find(query).sort("created_at", -1)
            polls = await cursor.to_list(length=100)
            
            result = []
            for poll in polls:
                poll_id = str(poll["_id"])
                poll["_id"] = poll_id
                
                # Check if user has already responded
                existing_response = await self.responses_collection.find_one({
                    "poll_id": poll_id,
                    "username": username
                })
                
                poll["user_has_responded"] = existing_response is not None
                if existing_response:
                    existing_response["_id"] = str(existing_response["_id"])
                    poll["user_response"] = existing_response
                
                # Filter by targeting
                if poll.get("target_all_users", True) or username in poll.get("target_usernames", []):
                    # Filter by date
                    start_date = poll.get("start_date")
                    end_date = poll.get("end_date")
                    
                    if start_date and start_date > now:
                        continue
                    if end_date and end_date < now:
                        continue
                    
                    result.append(poll)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error getting active polls for user {username}: {e}")
            return []
    
    async def submit_response(
        self,
        response_data: PollResponseCreate,
        username: str
    ) -> Dict[str, Any]:
        """Submit a user's response to a poll"""
        try:
            poll_id = response_data.poll_id
            
            # Get the poll
            poll = await self.get_poll(poll_id)
            if not poll:
                return {
                    "success": False,
                    "message": "Poll not found"
                }
            
            # Check if poll is active
            if poll.get("status") != PollStatus.ACTIVE.value:
                return {
                    "success": False,
                    "message": "This poll is not currently active"
                }
            
            # Check if user already responded
            existing = await self.responses_collection.find_one({
                "poll_id": poll_id,
                "username": username
            })
            
            if existing:
                return {
                    "success": False,
                    "message": "You have already responded to this poll",
                    "response_id": str(existing["_id"])
                }
            
            # Get user info if collecting contact info
            user_full_name = None
            user_email = None
            user_phone = None
            
            if poll.get("collect_contact_info", True):
                user = await self.users_collection.find_one({"username": username})
                if user:
                    # Get and decrypt user info
                    encryptor = get_encryptor()
                    
                    # Full name
                    first_name = user.get("firstName", "")
                    last_name = user.get("lastName", "")
                    if first_name and first_name.startswith("gAAAAA"):
                        try:
                            first_name = encryptor.decrypt(first_name)
                        except:
                            pass
                    if last_name and last_name.startswith("gAAAAA"):
                        try:
                            last_name = encryptor.decrypt(last_name)
                        except:
                            pass
                    user_full_name = f"{first_name} {last_name}".strip()
                    
                    # Email
                    email = user.get("contactEmail") or user.get("email")
                    if email and email.startswith("gAAAAA"):
                        try:
                            email = encryptor.decrypt(email)
                        except:
                            pass
                    user_email = email
                    
                    # Phone
                    phone = user.get("contactNumber")
                    if phone and phone.startswith("gAAAAA"):
                        try:
                            phone = encryptor.decrypt(phone)
                        except:
                            pass
                    user_phone = phone
            
            # Determine RSVP response from selected options
            rsvp_response = response_data.rsvp_response
            if poll.get("poll_type") == PollType.RSVP.value and response_data.selected_options:
                # Map option text to rsvp response
                for opt in poll.get("options", []):
                    if opt["id"] in response_data.selected_options:
                        opt_text = opt["text"].lower()
                        if "yes" in opt_text:
                            rsvp_response = "yes"
                        elif "no" in opt_text:
                            rsvp_response = "no"
                        elif "maybe" in opt_text:
                            rsvp_response = "maybe"
                        break
            
            # Create response document
            response_doc = {
                "poll_id": poll_id,
                "username": username,
                
                "user_full_name": user_full_name,
                "user_email": user_email,
                "user_phone": user_phone,
                
                "selected_options": response_data.selected_options,
                "rsvp_response": rsvp_response,
                "text_response": response_data.text_response,
                "comment": response_data.comment,
                
                "responded_at": datetime.utcnow(),
                "updated_at": None,
            }
            
            result = await self.responses_collection.insert_one(response_doc)
            
            logger.info(f"✅ Poll response submitted: {username} -> {poll_id}")
            
            return {
                "success": True,
                "message": "Response submitted successfully",
                "response_id": str(result.inserted_id)
            }
            
        except Exception as e:
            logger.error(f"❌ Error submitting poll response: {e}")
            return {
                "success": False,
                "message": f"Failed to submit response: {str(e)}"
            }
    
    async def update_response(
        self,
        poll_id: str,
        username: str,
        response_data: PollResponseCreate
    ) -> Dict[str, Any]:
        """Update a user's existing response"""
        try:
            # Get the poll
            poll = await self.get_poll(poll_id)
            if not poll:
                return {
                    "success": False,
                    "message": "Poll not found"
                }
            
            # Check if poll is still active
            if poll.get("status") != PollStatus.ACTIVE.value:
                return {
                    "success": False,
                    "message": "This poll is no longer active"
                }
            
            # Determine RSVP response
            rsvp_response = response_data.rsvp_response
            if poll.get("poll_type") == PollType.RSVP.value and response_data.selected_options:
                for opt in poll.get("options", []):
                    if opt["id"] in response_data.selected_options:
                        opt_text = opt["text"].lower()
                        if "yes" in opt_text:
                            rsvp_response = "yes"
                        elif "no" in opt_text:
                            rsvp_response = "no"
                        elif "maybe" in opt_text:
                            rsvp_response = "maybe"
                        break
            
            update_doc = {
                "selected_options": response_data.selected_options,
                "rsvp_response": rsvp_response,
                "text_response": response_data.text_response,
                "comment": response_data.comment,
                "updated_at": datetime.utcnow(),
            }
            
            result = await self.responses_collection.update_one(
                {"poll_id": poll_id, "username": username},
                {"$set": update_doc}
            )
            
            if result.modified_count == 0:
                return {
                    "success": False,
                    "message": "Response not found"
                }
            
            logger.info(f"✅ Poll response updated: {username} -> {poll_id}")
            
            return {
                "success": True,
                "message": "Response updated successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Error updating poll response: {e}")
            return {
                "success": False,
                "message": f"Failed to update response: {str(e)}"
            }
    
    # ==================== ADMIN RESULTS ====================
    
    async def get_poll_results(self, poll_id: str) -> Dict[str, Any]:
        """Get detailed poll results (admin only)"""
        try:
            poll = await self.get_poll(poll_id, include_stats=True)
            if not poll:
                return {
                    "success": False,
                    "message": "Poll not found"
                }
            
            # Get all responses
            cursor = self.responses_collection.find({"poll_id": poll_id}).sort("responded_at", -1)
            responses = await cursor.to_list(length=1000)
            
            for resp in responses:
                resp["_id"] = str(resp["_id"])
            
            # Calculate option counts
            option_counts = {}
            rsvp_counts = {"yes": 0, "no": 0, "maybe": 0}
            
            for opt in poll.get("options", []):
                option_counts[opt["id"]] = 0
            
            for resp in responses:
                # Count selected options
                for opt_id in resp.get("selected_options", []):
                    if opt_id in option_counts:
                        option_counts[opt_id] += 1
                
                # Count RSVP responses
                rsvp = resp.get("rsvp_response")
                if rsvp in rsvp_counts:
                    rsvp_counts[rsvp] += 1
            
            # Calculate percentages
            total = len(responses)
            option_percentages = {}
            for opt_id, count in option_counts.items():
                option_percentages[opt_id] = round((count / total * 100) if total > 0 else 0, 1)
            
            return {
                "success": True,
                "poll": poll,
                "total_responses": total,
                "option_counts": option_counts,
                "option_percentages": option_percentages,
                "rsvp_counts": rsvp_counts,
                "responses": responses
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting poll results: {e}")
            return {
                "success": False,
                "message": f"Failed to get poll results: {str(e)}"
            }
    
    async def export_responses(self, poll_id: str) -> List[Dict[str, Any]]:
        """Export poll responses for CSV/Excel export"""
        try:
            poll = await self.get_poll(poll_id)
            if not poll:
                return []
            
            cursor = self.responses_collection.find({"poll_id": poll_id}).sort("responded_at", 1)
            responses = await cursor.to_list(length=10000)
            
            # Build option ID to text mapping
            option_map = {opt["id"]: opt["text"] for opt in poll.get("options", [])}
            
            export_data = []
            for resp in responses:
                # Convert selected options to text
                selected_texts = [option_map.get(opt_id, opt_id) for opt_id in resp.get("selected_options", [])]
                
                export_data.append({
                    "Username": resp.get("username"),
                    "Full Name": resp.get("user_full_name", ""),
                    "Email": resp.get("user_email", ""),
                    "Phone": resp.get("user_phone", ""),
                    "Response": resp.get("rsvp_response") or ", ".join(selected_texts),
                    "Comment": resp.get("comment", ""),
                    "Responded At": resp.get("responded_at").isoformat() if resp.get("responded_at") else "",
                })
            
            return export_data
            
        except Exception as e:
            logger.error(f"❌ Error exporting poll responses: {e}")
            return []
