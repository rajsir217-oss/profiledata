# fastapi_backend/auth/audit_logger.py
"""
Audit Logging System for Security Events
"""

from datetime import datetime
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

class AuditLogger:
    """Centralized audit logging"""
    
    @staticmethod
    async def log_event(
        db,
        username: Optional[str] = None,
        user_id: Optional[str] = None,
        action: str = "",
        resource: Optional[str] = None,
        resource_id: Optional[str] = None,
        status: str = "success",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict] = None,
        error_message: Optional[str] = None,
        severity: str = "info"
    ):
        """Log a security event to audit log"""
        try:
            log_entry = {
                "user_id": user_id,
                "username": username,
                "action": action,
                "resource": resource,
                "resource_id": resource_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "status": status,
                "details": details or {},
                "error_message": error_message,
                "timestamp": datetime.utcnow(),
                "severity": severity
            }
            
            await db.audit_logs.insert_one(log_entry)
            
            # Also log to application logger
            log_message = f"AUDIT: {action} by {username or 'anonymous'} - {status}"
            if severity == "critical":
                logger.critical(log_message)
            elif severity == "error":
                logger.error(log_message)
            elif severity == "warning":
                logger.warning(log_message)
            else:
                logger.info(log_message)
        
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
    
    @staticmethod
    async def get_user_audit_logs(
        db,
        username: str,
        limit: int = 50,
        skip: int = 0
    ):
        """Get audit logs for a specific user"""
        try:
            logs = await db.audit_logs.find(
                {"username": username}
            ).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
            
            for log in logs:
                log["_id"] = str(log["_id"])
            
            return logs
        except Exception as e:
            logger.error(f"Failed to retrieve audit logs: {e}")
            return []
    
    @staticmethod
    async def get_all_audit_logs(
        db,
        action: Optional[str] = None,
        severity: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        skip: int = 0
    ):
        """Get all audit logs with filters"""
        try:
            query = {}
            
            if action:
                query["action"] = action
            
            if severity:
                query["severity"] = severity
            
            if start_date or end_date:
                query["timestamp"] = {}
                if start_date:
                    query["timestamp"]["$gte"] = start_date
                if end_date:
                    query["timestamp"]["$lte"] = end_date
            
            logs = await db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
            
            for log in logs:
                log["_id"] = str(log["_id"])
            
            return logs
        except Exception as e:
            logger.error(f"Failed to retrieve audit logs: {e}")
            return []
