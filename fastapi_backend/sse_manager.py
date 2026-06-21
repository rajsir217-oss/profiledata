# fastapi_backend/sse_manager.py
"""
Server-Sent Events (SSE) manager for real-time messaging
Uses async Redis pub/sub for message broadcasting.

Connection model:
  - A small COMMAND pool is used for short-lived publish/ping operations.
  - A separate, larger PUBSUB pool is used for SSE subscribers. Each active
    SSE stream holds exactly one pubsub connection for its lifetime, so this
    pool must be sized to the max number of concurrent SSE viewers per
    instance (SSE_MAX_CONNECTIONS), not the number of instances.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import AsyncGenerator, Dict, Set, Optional
import redis.asyncio as redis
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)

class SSEManager:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._cmd_pool: Optional[redis.ConnectionPool] = None
        self._pubsub_pool: Optional[redis.ConnectionPool] = None
        self.active_connections: Dict[str, Set[asyncio.Queue]] = {}
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        # Small pool for publish/commands
        self._cmd_max_connections = int(os.getenv("REDIS_MAX_CONNECTIONS", "10"))
        # Larger pool for long-lived SSE pubsub subscribers
        self._pubsub_max_connections = int(os.getenv("SSE_MAX_CONNECTIONS", "100"))

    async def initialize(self):
        """Initialize async Redis connection pools for commands and pub/sub.

        Uses ConnectionPool.from_url so TLS (rediss://), db index, username and
        password are all honored from REDIS_URL.
        """
        try:
            self._cmd_pool = redis.ConnectionPool.from_url(
                self.redis_url,
                decode_responses=True,
                max_connections=self._cmd_max_connections,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )
            self._pubsub_pool = redis.ConnectionPool.from_url(
                self.redis_url,
                decode_responses=True,
                max_connections=self._pubsub_max_connections,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )
            self.redis_client = redis.Redis(connection_pool=self._cmd_pool)
            await self.redis_client.ping()
            logger.info(
                f"✅ SSE Manager initialized with async Redis "
                f"(cmd_pool={self._cmd_max_connections}, "
                f"pubsub_pool={self._pubsub_max_connections})"
            )
        except Exception as e:
            logger.error(f"❌ Failed to initialize SSE Manager: {e}")
            self.redis_client = None
            self._cmd_pool = None
            self._pubsub_pool = None

    async def close(self):
        """Close Redis connection pools"""
        if self.redis_client:
            try:
                await self.redis_client.aclose()
            except Exception:
                pass
            self.redis_client = None
        for pool_attr in ("_cmd_pool", "_pubsub_pool"):
            pool = getattr(self, pool_attr, None)
            if pool:
                try:
                    await pool.disconnect()
                except Exception:
                    pass
                setattr(self, pool_attr, None)
        logger.info("🔌 SSE Manager Redis pools closed")
            
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
        
        # Ensure pools are ready; attempt one lazy reinitialize
        if self._pubsub_pool is None or self.redis_client is None:
            logger.warning("⚠️ SSE Manager pools not initialized; attempting to reinitialize")
            await self.initialize()

        if self._pubsub_pool is None or self.redis_client is None:
            # Redis unavailable: emit an error event instead of raising mid-stream
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "message": "SSE service unavailable - Redis not connected",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }
            self._discard_queue(username, queue)
            return

        redis_sub = None
        pubsub = None
        listener_task = None
        heartbeat_task = None
        try:
            # Dedicated long-lived subscriber from the pubsub pool
            redis_sub = redis.Redis(connection_pool=self._pubsub_pool)
            pubsub = redis_sub.pubsub()
            await pubsub.subscribe(channel_name)

            logger.info(f"📡 User '{username}' subscribed to SSE channel")

            yield {
                "event": "connected",
                "data": json.dumps({
                    "type": "connected",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }

            listener_task = asyncio.create_task(
                self._listen_to_redis(pubsub, queue, username)
            )
            heartbeat_task = asyncio.create_task(self._send_heartbeat(queue))

            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=60)
                    if message is None:  # Disconnect signal
                        break
                    yield message
                except asyncio.TimeoutError:
                    yield {
                        "event": "heartbeat",
                        "data": json.dumps({
                            "type": "heartbeat",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    }

        except Exception as e:
            logger.error(f"❌ SSE error for user '{username}': {e}")
            raise
        finally:
            # Cancel background tasks first to stop pubsub usage
            for task in (listener_task, heartbeat_task):
                if task and not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                    except Exception:
                        pass
            # Release the pubsub connection back to the pool (None-safe)
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(channel_name)
                except Exception:
                    pass
                try:
                    await pubsub.aclose()
                except Exception:
                    pass
            if redis_sub is not None:
                try:
                    await redis_sub.aclose()
                except Exception:
                    pass
            self._discard_queue(username, queue)
            logger.info(f"🔌 User '{username}' disconnected from SSE")

    def _discard_queue(self, username: str, queue: asyncio.Queue):
        """Remove a queue from active connections, cleaning up empty entries."""
        if username in self.active_connections:
            self.active_connections[username].discard(queue)
            if not self.active_connections[username]:
                del self.active_connections[username]
            
    async def _listen_to_redis(self, pubsub, queue: asyncio.Queue, username: str):
        """
        Listen to async Redis pub/sub and forward messages to the SSE queue.
        Uses the native async iterator so it never blocks the event loop.
        """
        try:
            async for message in pubsub.listen():
                if not message or message.get('type') != 'message':
                    continue
                data = message['data']
                logger.info(f"📬 Received Redis message for '{username}': {data[:100]}...")

                try:
                    msg_data = json.loads(data)
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
                    await queue.put({
                        "event": "message",
                        "data": data
                    })

        except asyncio.CancelledError:
            # Normal shutdown when the SSE stream closes
            raise
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
        Publish a message to a user's channel using the command pool.
        """
        if self.redis_client is None:
            logger.warning("⚠️ Cannot publish - SSE Redis client not initialized")
            return False
        try:
            channel_name = f"messages:{username}"
            message = json.dumps(message_data)
            await self.redis_client.publish(channel_name, message)
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
