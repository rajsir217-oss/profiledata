# fastapi_backend/sse_manager.py
"""
Server-Sent Events (SSE) manager for real-time messaging
Uses Redis pub/sub for message broadcasting
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import AsyncGenerator, Dict, Set
import redis
from fastapi import HTTPException
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)

class SSEManager:
    def __init__(self):
        self.redis_client = None
        self.pubsub = None
        self.active_connections: Dict[str, Set[asyncio.Queue]] = {}
        # Use environment variable for Redis URL (supports Docker container names)
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        
    async def initialize(self):
        """Initialize Redis connection for pub/sub"""
        try:
            # Parse Redis URL from environment variable
            # Format: redis://host:port or redis://localhost:6379
            redis_url = self.redis_url.replace('redis://', '')
            if ':' in redis_url:
                host, port = redis_url.split(':')
                port = int(port)
            else:
                host = redis_url
                port = 6379
            
            # Use standard Redis client for simplicity
            self.redis_client = redis.Redis(
                host=host,
                port=port,
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("✅ SSE Manager initialized with Redis")
        except Exception as e:
            logger.error(f"❌ Failed to initialize SSE Manager: {e}")
            
    async def close(self):
        """Close Redis connections"""
        if self.redis_client:
            self.redis_client.close()
            
    async def subscribe_to_user_channel(self, username: str) -> AsyncGenerator:
        """
        Subscribe to a user's message channel for SSE streaming
        """
        queue = asyncio.Queue()
        
        # Add queue to active connections
        if username not in self.active_connections:
            self.active_connections[username] = set()
        self.active_connections[username].add(queue)
        
        # Subscribe to Redis channel for this user
        channel_name = f"messages:{username}"
        
        try:
            # Create a new Redis client for this connection
            redis_sub = redis.Redis(host='localhost', port=6379, decode_responses=True)
            pubsub = redis_sub.pubsub()
            pubsub.subscribe(channel_name)
            
            logger.info(f"📡 User '{username}' subscribed to SSE channel")
            
            # Send initial connection event
            yield {
                "event": "connected",
                "data": json.dumps({
                    "type": "connected",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }
            
            # Start listening for messages
            asyncio.create_task(self._listen_to_redis(pubsub, queue, username))
            
            # Send heartbeat every 30 seconds
            heartbeat_task = asyncio.create_task(self._send_heartbeat(queue))
            
            # Stream events from queue
            try:
                while True:
                    # Wait for messages with timeout
                    try:
                        message = await asyncio.wait_for(queue.get(), timeout=60)
                        if message is None:  # Disconnect signal
                            break
                        yield message
                    except asyncio.TimeoutError:
                        # Send heartbeat on timeout
                        yield {
                            "event": "heartbeat",
                            "data": json.dumps({
                                "type": "heartbeat",
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        }
            finally:
                # Cleanup
                heartbeat_task.cancel()
                pubsub.unsubscribe(channel_name)
                pubsub.close()
                redis_sub.close()
                
        except Exception as e:
            logger.error(f"❌ SSE error for user '{username}': {e}")
            raise
        finally:
            # Remove queue from active connections
            if username in self.active_connections:
                self.active_connections[username].discard(queue)
                if not self.active_connections[username]:
                    del self.active_connections[username]
            logger.info(f"🔌 User '{username}' disconnected from SSE")
            
    async def _listen_to_redis(self, pubsub, queue: asyncio.Queue, username: str):
        """
        Listen to Redis pub/sub and forward messages to SSE queue
        """
        try:
            # Use get_message with timeout for non-blocking
            while True:
                message = pubsub.get_message(timeout=0.1)
                if message and message['type'] == 'message':
                    data = message['data']
                    logger.info(f"📬 Received Redis message for '{username}': {data[:100]}...")
                    
                    try:
                        # Parse the message
                        msg_data = json.loads(data)
                        
                        # Create SSE event based on message type
                        if msg_data.get('type') == 'new_message':
                            event = {
                                "event": "new_message",
                                "data": json.dumps(msg_data)
                            }
                        elif msg_data.get('type') == 'unread_update':
                            event = {
                                "event": "unread_update",
                            }
                        else:
                            event = {
                                "event": "message",
                                "data": data
                            }
                        await queue.put(event)
                    except json.JSONDecodeError:
                        # Send raw message if not JSON
                        event = {
                            "event": "message",
                            "data": data
                        }
                        await queue.put(event)
                # Add small sleep to prevent blocking
                await asyncio.sleep(0.1)
                        
        except Exception as e:
            logger.error(f"❌ Error in Redis listener for '{username}': {e}")
            await queue.put(None)  # Signal disconnect
            
    async def _send_heartbeat(self, queue: asyncio.Queue):
        """
        Send periodic heartbeat to keep connection alive
        """
        try:
            while True:
                await asyncio.sleep(30)
                heartbeat = {
                    "event": "heartbeat",
                    "data": json.dumps({
                        "type": "heartbeat",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                }
                await queue.put(heartbeat)
        except asyncio.CancelledError:
            pass
            
    async def publish_message(self, username: str, message_data: dict):
        """
        Publish a message to a user's channel
        """
        try:
            channel_name = f"messages:{username}"
            message = json.dumps(message_data)
            
            # Use a separate Redis client for publishing
            redis_pub = redis.Redis(host='localhost', port=6379, decode_responses=True)
            redis_pub.publish(channel_name, message)
            redis_pub.close()
            
            logger.info(f"📤 Published message to channel '{channel_name}'")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to publish message: {e}")
            return False
            
    async def broadcast_new_message(self, sender: str, recipient: str, message: str, message_id: str):
        """
        Broadcast a new message notification to the recipient
        """
        message_data = {
            "type": "new_message",
            "from": sender,
            "message": message,
            "message_id": message_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        return await self.publish_message(recipient, message_data)
        
    async def broadcast_unread_update(self, username: str, sender: str, count: int):
        """
        Broadcast unread count update to a user
        """
        update_data = {
            "type": "unread_update",
            "username": sender,
            "count": count,
            "timestamp": datetime.utcnow().isoformat()
        }
        return await self.publish_message(username, update_data)

# Create singleton instance
sse_manager = SSEManager()

def get_sse_manager():
    return sse_manager
