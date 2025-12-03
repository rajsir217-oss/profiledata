"""
Email Tracking Router
Tracks email opens, clicks, and engagement metrics
"""

from fastapi import APIRouter, Request, Response, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import Optional
import io
import logging

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(prefix="/api/email-tracking", tags=["email-tracking"])
logger = logging.getLogger(__name__)

# 1x1 transparent PNG pixel
TRACKING_PIXEL = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
])


@router.get("/pixel/{tracking_id}")
async def track_email_open(
    tracking_id: str,
    request: Request,
    db = Depends(get_database)
):
    """
    Track email open via tracking pixel
    
    When an email is opened, the email client loads this 1x1 transparent image.
    We log the open event and return the pixel.
    
    Args:
        tracking_id: Unique identifier for this email (notification queue _id)
        request: FastAPI request object (for IP, user agent)
        db: Database connection (injected)
    
    Returns:
        1x1 transparent PNG image
    """
    try:
        
        # Extract request metadata
        user_agent = request.headers.get("user-agent", "Unknown")
        ip_address = request.client.host if request.client else "Unknown"
        referer = request.headers.get("referer", "")
        
        # Log email open
        email_analytics = db.email_analytics
        
        # Check if already tracked (prevent multiple opens from being counted)
        existing = await email_analytics.find_one({
            "tracking_id": tracking_id,
            "event_type": "open",
            "ip_address": ip_address,
            "user_agent": user_agent
        })
        
        if not existing:
            # First time this email was opened from this device/IP
            await email_analytics.insert_one({
                "tracking_id": tracking_id,
                "event_type": "open",
                "timestamp": datetime.utcnow(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "referer": referer
            })
            
            # Update notification queue status
            notification_queue = db.notification_queue
            await notification_queue.update_one(
                {"_id": tracking_id},
                {
                    "$set": {
                        "emailOpened": True,
                        "emailOpenedAt": datetime.utcnow()
                    },
                    "$inc": {"emailOpenCount": 1}
                }
            )
            
            logger.info(f"📬 Email opened: {tracking_id}")
        
    except Exception as e:
        logger.error(f"Error tracking email open: {e}")
        # Don't fail - still return pixel
    
    # Return tracking pixel
    return StreamingResponse(
        io.BytesIO(TRACKING_PIXEL),
        media_type="image/png",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/click/{tracking_id}")
async def track_email_click(
    tracking_id: str,
    request: Request,
    url: str = Query(..., description="Destination URL"),
    link_type: str = Query("generic", description="Type of link clicked"),
    db = Depends(get_database)
):
    """
    Track email link click and redirect to destination
    
    Args:
        tracking_id: Unique identifier for this email
        url: Destination URL to redirect to
        link_type: Type of link (e.g., 'profile', 'chat', 'button', 'unsubscribe')
        request: FastAPI request object (injected)
        db: Database connection (injected)
    
    Returns:
        Redirect to destination URL
    """
    try:
        
        # Extract request metadata
        user_agent = request.headers.get("user-agent", "Unknown") if request else "Unknown"
        ip_address = request.client.host if request and request.client else "Unknown"
        
        # Log email click
        email_analytics = db.email_analytics
        await email_analytics.insert_one({
            "tracking_id": tracking_id,
            "event_type": "click",
            "link_type": link_type,
            "destination_url": url,
            "timestamp": datetime.utcnow(),
            "ip_address": ip_address,
            "user_agent": user_agent
        })
        
        # Update notification queue
        notification_queue = db.notification_queue
        await notification_queue.update_one(
            {"_id": tracking_id},
            {
                "$inc": {"emailClickCount": 1},
                "$push": {
                    "emailClicks": {
                        "link_type": link_type,
                        "url": url,
                        "timestamp": datetime.utcnow()
                    }
                }
            }
        )
        
        logger.info(f"🖱️ Email link clicked: {tracking_id} -> {link_type}")
        
    except Exception as e:
        logger.error(f"Error tracking email click: {e}")
        # Don't fail - still redirect
    
    # Redirect to destination
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url, status_code=302)


@router.get("/analytics/{tracking_id}")
async def get_email_analytics(
    tracking_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get analytics for a specific email (Admin only)
    
    Args:
        tracking_id: Unique identifier for this email
        current_user: Current authenticated user (must be admin)
    
    Returns:
        Dict with analytics data (opens, clicks, engagement)
    """
    # Check if user is admin
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        
        # Get all analytics events for this email
        email_analytics = db.email_analytics
        events = await email_analytics.find({"tracking_id": tracking_id}).to_list(100)
        
        # Count event types
        open_count = sum(1 for e in events if e["event_type"] == "open")
        click_count = sum(1 for e in events if e["event_type"] == "click")
        
        # Get unique opens (by IP)
        unique_opens = len(set(
            e["ip_address"] for e in events if e["event_type"] == "open"
        ))
        
        # Get click details
        clicks = [
            {
                "link_type": e["link_type"],
                "url": e["destination_url"],
                "timestamp": e["timestamp"]
            }
            for e in events if e["event_type"] == "click"
        ]
        
        # Get first open time
        open_events = [e for e in events if e["event_type"] == "open"]
        first_opened = min(e["timestamp"] for e in open_events) if open_events else None
        
        return {
            "tracking_id": tracking_id,
            "opened": open_count > 0,
            "open_count": open_count,
            "unique_opens": unique_opens,
            "first_opened": first_opened,
            "click_count": click_count,
            "clicks": clicks,
            "engagement_rate": (click_count / max(open_count, 1)) * 100 if open_count > 0 else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting email analytics: {e}")
        return {
            "error": str(e),
            "tracking_id": tracking_id
        }


@router.get("/stats/summary")
async def get_analytics_summary(
    days: int = Query(30, description="Number of days to analyze"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get overall email analytics summary (Admin only)
    
    Args:
        days: Number of days to analyze (default: 30)
        current_user: Current authenticated user (must be admin)
    
    Returns:
        Dict with summary statistics
    """
    # Check if user is admin
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        email_analytics = db.email_analytics
        
        # Get all events in date range
        events = await email_analytics.find({
            "timestamp": {"$gte": cutoff_date}
        }).to_list(10000)
        
        # Calculate metrics
        total_opens = sum(1 for e in events if e["event_type"] == "open")
        total_clicks = sum(1 for e in events if e["event_type"] == "click")
        unique_emails = len(set(e["tracking_id"] for e in events))
        
        # Get notification queue stats
        notification_queue = db.notification_queue
        total_sent = await notification_queue.count_documents({
            "status": "sent",
            "channels": "email",
            "updatedAt": {"$gte": cutoff_date}
        })
        
        # Calculate rates
        open_rate = (total_opens / max(total_sent, 1)) * 100
        click_rate = (total_clicks / max(total_opens, 1)) * 100
        
        return {
            "period_days": days,
            "total_emails_sent": total_sent,
            "total_opens": total_opens,
            "total_clicks": total_clicks,
            "unique_emails_opened": unique_emails,
            "open_rate": round(open_rate, 2),
            "click_through_rate": round(click_rate, 2),
            "engagement_rate": round((total_clicks / max(total_sent, 1)) * 100, 2)
        }
        
    except Exception as e:
        logger.error(f"Error getting analytics summary: {e}")
        return {"error": str(e)}
