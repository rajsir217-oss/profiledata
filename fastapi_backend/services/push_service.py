"""
Push Notification Service
Handles Firebase Cloud Messaging (FCM) integration for push notifications
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin not installed. Push notifications will be disabled.")


class PushNotificationService:
    """Service for sending push notifications via Firebase Cloud Messaging"""
    
    _initialized = False
    
    def __init__(self):
        """Initialize Firebase Admin SDK"""
        if not FIREBASE_AVAILABLE:
            logger.warning("Firebase SDK not available - push notifications disabled")
            return
            
        if not PushNotificationService._initialized:
            try:
                # Check if already initialized
                if not firebase_admin._apps:
                    # Load credentials from environment
                    firebase_config = {
                        "type": "service_account",
                        "project_id": os.getenv("FIREBASE_PROJECT_ID"),
                        "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
                        "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n'),
                        "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
                        "client_id": os.getenv("FIREBASE_CLIENT_ID"),
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                        "client_x509_cert_url": os.getenv("FIREBASE_CERT_URL")
                    }
                    
                    # Validate required fields
                    required_fields = ["project_id", "private_key", "client_email"]
                    missing_fields = [f for f in required_fields if not firebase_config.get(f)]
                    
                    if missing_fields:
                        logger.error(f"Missing Firebase config: {missing_fields}")
                        logger.warning("Push notifications will be disabled")
                        return
                    
                    # Initialize Firebase app
                    cred = credentials.Certificate(firebase_config)
                    firebase_admin.initialize_app(cred)
                    PushNotificationService._initialized = True
                    logger.info("✅ Firebase Admin SDK initialized successfully")
                    
            except Exception as e:
                logger.error(f"Failed to initialize Firebase: {e}")
                logger.warning("Push notifications will be disabled")
    
    async def send_to_token(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a single device token
        
        Args:
            token: FCM device token
            title: Notification title
            body: Notification message body
            data: Additional data payload (optional)
            image_url: Image URL for rich notification (optional)
            
        Returns:
            Dict with success status and message ID or error
        """
        if not FIREBASE_AVAILABLE or not PushNotificationService._initialized:
            logger.warning("Firebase not initialized - skipping push notification")
            return {"success": False, "error": "Firebase not configured"}
        
        try:
            # Build notification
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url if image_url else None
            )
            
            # Build message
            message = messaging.Message(
                token=token,
                notification=notification,
                data=data or {},
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        icon='notification_icon',
                        color='#4285F4',
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                ),
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        icon='/logo192.png',
                        badge='/logo192.png'
                    )
                )
            )
            
            # Send message
            response = messaging.send(message)
            
            logger.info(f"✅ Push notification sent successfully: {response}")
            
            return {
                "success": True,
                "messageId": response
            }
            
        except messaging.UnregisteredError:
            logger.warning(f"Token is invalid or unregistered: {token[:20]}...")
            return {"success": False, "error": "invalid_token"}
            
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_to_multiple_tokens(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to multiple device tokens (multicast)
        
        Args:
            tokens: List of FCM device tokens (max 500)
            title: Notification title
            body: Notification message body
            data: Additional data payload (optional)
            image_url: Image URL for rich notification (optional)
            
        Returns:
            Dict with success/failure counts and failed tokens
        """
        if not FIREBASE_AVAILABLE or not PushNotificationService._initialized:
            logger.warning("Firebase not initialized - skipping push notifications")
            return {
                "success": False,
                "error": "Firebase not configured",
                "successCount": 0,
                "failureCount": len(tokens)
            }
        
        if not tokens:
            return {
                "success": True,
                "successCount": 0,
                "failureCount": 0,
                "failedTokens": []
            }
        
        # FCM limits multicast to 500 tokens
        if len(tokens) > 500:
            logger.warning(f"Too many tokens ({len(tokens)}), splitting into batches")
            tokens = tokens[:500]
        
        try:
            # Build notification
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url if image_url else None
            )
            
            # Build multicast message
            message = messaging.MulticastMessage(
                tokens=tokens,
                notification=notification,
                data=data or {},
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        icon='notification_icon',
                        color='#4285F4',
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                ),
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        icon='/logo192.png',
                        badge='/logo192.png'
                    )
                )
            )
            
            # Send multicast
            response = messaging.send_multicast(message)
            
            # Collect failed tokens
            failed_tokens = []
            if response.failure_count > 0:
                for idx, result in enumerate(response.responses):
                    if not result.success:
                        failed_tokens.append({
                            "token": tokens[idx],
                            "error": str(result.exception) if result.exception else "Unknown error"
                        })
            
            logger.info(
                f"✅ Multicast sent - Success: {response.success_count}, "
                f"Failed: {response.failure_count}"
            )
            
            return {
                "success": response.success_count > 0,
                "successCount": response.success_count,
                "failureCount": response.failure_count,
                "failedTokens": failed_tokens
            }
            
        except Exception as e:
            logger.error(f"Failed to send multicast notification: {e}")
            return {
                "success": False,
                "error": str(e),
                "successCount": 0,
                "failureCount": len(tokens)
            }
    
    async def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a topic (all subscribed devices)
        
        Args:
            topic: FCM topic name
            title: Notification title
            body: Notification message body
            data: Additional data payload (optional)
            
        Returns:
            Dict with success status and message ID or error
        """
        if not FIREBASE_AVAILABLE or not PushNotificationService._initialized:
            logger.warning("Firebase not initialized - skipping topic notification")
            return {"success": False, "error": "Firebase not configured"}
        
        try:
            # Build message for topic
            message = messaging.Message(
                topic=topic,
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {}
            )
            
            # Send to topic
            response = messaging.send(message)
            
            logger.info(f"✅ Topic notification sent: {topic} - {response}")
            
            return {
                "success": True,
                "messageId": response
            }
            
        except Exception as e:
            logger.error(f"Failed to send topic notification: {e}")
            return {"success": False, "error": str(e)}
    
    async def subscribe_to_topic(
        self,
        tokens: List[str],
        topic: str
    ) -> Dict[str, Any]:
        """
        Subscribe device tokens to a topic
        
        Args:
            tokens: List of device tokens
            topic: Topic name
            
        Returns:
            Dict with success count
        """
        if not FIREBASE_AVAILABLE or not PushNotificationService._initialized:
            return {"success": False, "error": "Firebase not configured"}
        
        try:
            response = messaging.subscribe_to_topic(tokens, topic)
            logger.info(f"✅ Subscribed {response.success_count} tokens to topic: {topic}")
            
            return {
                "success": True,
                "successCount": response.success_count,
                "failureCount": response.failure_count
            }
            
        except Exception as e:
            logger.error(f"Failed to subscribe to topic: {e}")
            return {"success": False, "error": str(e)}
