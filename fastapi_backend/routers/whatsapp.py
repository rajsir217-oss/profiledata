# fastapi_backend/routers/whatsapp.py
# WhatsApp Group Messaging Test App using Unipile API
from fastapi import APIRouter, HTTPException, Depends, Request, Form, File, UploadFile
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
import httpx
import logging
from config import settings

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
logger = logging.getLogger(__name__)

# Unipile API Configuration
UNIPILE_API_KEY = settings.unipile_api_key
UNIPILE_DSN = settings.unipile_dsn

if not UNIPILE_API_KEY or not UNIPILE_DSN:
    logger.warning("Unipile API credentials not configured. WhatsApp features will be disabled.")


async def make_unipile_request(
    method: str,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    files: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Helper function to make requests to Unipile API"""
    if not UNIPILE_API_KEY or not UNIPILE_DSN:
        raise HTTPException(
            status_code=503,
            detail="Unipile API credentials not configured"
        )
    
    url = f"{UNIPILE_DSN}{endpoint}"
    headers = {
        "X-API-KEY": UNIPILE_API_KEY,
        "accept": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                if files:
                    # Multipart form data for file uploads
                    headers.pop("accept")  # Let httpx set proper headers
                    response = await client.post(url, headers=headers, data=data, files=files)
                else:
                    response = await client.post(url, headers=headers, json=data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers, params=params)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Unipile API error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Unipile API error: {e.response.text}"
            )
        except httpx.RequestError as e:
            logger.error(f"Unipile API request error: {str(e)}")
            raise HTTPException(status_code=503, detail=f"Failed to connect to Unipile API: {str(e)}")


@router.get("/accounts")
async def list_accounts():
    """List all connected accounts (WhatsApp, LinkedIn, etc.)"""
    try:
        result = await make_unipile_request("GET", "/api/v1/accounts")
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list accounts: {str(e)}")


@router.get("/chats")
async def list_chats(
    account_id: Optional[str] = None,
    account_type: Optional[str] = None,
    limit: int = 50,
    unread_only: bool = False
):
    """List all chats including WhatsApp groups"""
    try:
        params = {"limit": min(limit, 250)}
        if account_id:
            params["account_id"] = account_id
        if account_type:
            params["account_type"] = account_type
        if unread_only:
            params["unread"] = True
        
        result = await make_unipile_request("GET", "/api/v1/chats", params=params)
        
        # Filter for WhatsApp groups if account_type is specified
        if account_type == "WHATSAPP":
            chats = result.get("items", [])
            groups = [chat for chat in chats if chat.get("type") == 2]  # type 2 = group
            return {
                "success": True,
                "data": {
                    "total": len(groups),
                    "items": groups
                }
            }
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing chats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list chats: {str(e)}")


@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    limit: int = 50,
    cursor: Optional[str] = None
):
    """Get messages from a specific chat/group"""
    try:
        params = {"limit": min(limit, 250)}
        if cursor:
            params["cursor"] = cursor
        
        result = await make_unipile_request(
            "GET",
            f"/api/v1/chats/{chat_id}/messages",
            params=params
        )
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat messages: {str(e)}")


@router.post("/chats/{chat_id}/messages")
async def send_message_to_chat(
    chat_id: str,
    text: str = Form(...),
    attachment: Optional[UploadFile] = File(None)
):
    """Send a message to an existing chat/group"""
    try:
        data = {"text": text}
        files = None
        
        if attachment:
            files = {"attachments": (attachment.filename, await attachment.read(), attachment.content_type)}
        
        result = await make_unipile_request(
            "POST",
            f"/api/v1/chats/{chat_id}/messages",
            data=data,
            files=files
        )
        
        return {
            "success": True,
            "data": result,
            "message": "Message sent successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")


@router.post("/chats")
async def create_chat(
    account_id: str = Form(...),
    attendees_ids: List[str] = Form(...),
    text: str = Form(...),
    subject: Optional[str] = Form(None)
):
    """Create a new chat or group chat"""
    try:
        data = {
            "account_id": account_id,
            "text": text,
            "attendees_ids": attendees_ids
        }
        
        if subject:
            data["subject"] = subject
        
        result = await make_unipile_request(
            "POST",
            "/api/v1/chats",
            data=data
        )
        
        return {
            "success": True,
            "data": result,
            "message": "Chat created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat: {str(e)}")


@router.get("/chats/{chat_id}/attendees")
async def get_chat_attendees(chat_id: str):
    """Get list of attendees/participants in a chat"""
    try:
        result = await make_unipile_request(
            "GET",
            f"/api/v1/chats/{chat_id}/attendees"
        )
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat attendees: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat attendees: {str(e)}")


@router.post("/chats/{chat_id}/sync")
async def sync_chat_history(chat_id: str):
    """Sync chat history for a specific chat"""
    try:
        result = await make_unipile_request(
            "POST",
            f"/api/v1/chats/{chat_id}/sync"
        )
        
        return {
            "success": True,
            "data": result,
            "message": "Chat history synced successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync chat history: {str(e)}")


@router.post("/sync")
async def sync_all_chats(account_id: str = Form(...)):
    """Sync all chats for an account using the correct Unipile endpoint"""
    try:
        # Unipile uses POST /api/v1/chats/sync with account_id in body
        result = await make_unipile_request(
            "POST",
            "/api/v1/chats/sync",
            data={"account_id": account_id}
        )
        
        return {
            "success": True,
            "data": result,
            "message": "Account chats synced successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing account chats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync account chats: {str(e)}")


@router.post("/webhook")
async def whatsapp_webhook(request: Request):
    """Webhook endpoint for real-time message updates from Unipile"""
    try:
        webhook_data = await request.json()
        
        logger.info(f"Received WhatsApp webhook: {webhook_data}")
        
        # Process different event types
        event = webhook_data.get("event")
        account_type = webhook_data.get("account_type")
        
        if event == "message_received":
            # Handle new message
            message = webhook_data.get("message")
            sender = webhook_data.get("sender")
            chat_id = webhook_data.get("chat_id")
            
            logger.info(f"New message from {sender.get('attendee_name')} in chat {chat_id}: {message}")
            
            # You can store messages in MongoDB, trigger notifications, etc.
            # For now, just log it
            
        elif event == "message_read":
            logger.info(f"Message read in chat {webhook_data.get('chat_id')}")
        
        elif event == "message_reaction":
            logger.info(f"Reaction received: {webhook_data.get('reaction')}")
        
        return {"success": True, "message": "Webhook received"}
    
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.get("/test")
async def test_whatsapp_integration():
    """Test endpoint to verify Unipile API configuration"""
    return {
        "success": True,
        "configured": bool(UNIPILE_API_KEY and UNIPILE_DSN),
        "dsn": UNIPILE_DSN if UNIPILE_DSN else "Not configured",
        "message": "Unipile API configuration check"
    }
