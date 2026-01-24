# fastapi_backend/websocket_manager.py
import socketio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Create Socket.IO server with proper CORS and Redis session management
import os

# Function to get allowed origins (called at runtime, not module load)
def get_cors_origins():
    env = os.getenv('ENV', 'development')
    logger.debug(f"🔍 Socket.IO CORS - ENV={env}")
    
    if env == 'production':
        # Production: Allow actual domain
        frontend_url = os.getenv('FRONTEND_URL', 'https://l3v3lmatches.com')
        origins = [
            frontend_url,
            'https://l3v3lmatches.com',
            'https://www.l3v3lmatches.com',
            'https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app'
        ]
        logger.info(f"🔒 Production Socket.IO CORS: {origins}")
        return origins
    else:
        # Development: Allow localhost
        origins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001'
        ]
        logger.info(f"🔓 Development Socket.IO CORS: {origins}")
        return origins

# Create Socket.IO server with Redis session management for production
env = os.getenv('ENV', 'development')
redis_url = os.getenv('REDIS_URL')

logger.info(f"🔍 Socket.IO Configuration:")
logger.info(f"   ENV: {env}")
logger.info(f"   Redis URL: {'configured' if redis_url else 'not configured'}")

# Use Redis for session management in production
if env == 'production' and redis_url:
    logger.info(f"🔴 Configuring Redis session manager for production...")
    try:
        # Import Redis manager from python-socketio
        from socketio import AsyncRedisManager
        
        # Create Redis manager for session persistence across instances
        manager = AsyncRedisManager(redis_url)
        
        sio = socketio.AsyncServer(
            async_mode='asgi',
            client_manager=manager,
            cors_allowed_origins='*',
            cors_credentials=True,
            logger=True,
            engineio_logger=True
        )
        logger.info(f"✅ Socket.IO configured with Redis session manager")
        logger.info(f"   Sessions will persist across multiple Cloud Run instances")
        
    except ImportError as e:
        logger.warning(f"⚠️  Failed to import AsyncRedisManager: {e}")
        logger.info(f"   Falling back to in-memory sessions")
        sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins='*',
            cors_credentials=True,
            logger=True,
            engineio_logger=True
        )
    except Exception as e:
        logger.warning(f"⚠️  Redis manager initialization failed: {e}")
        logger.info(f"   Falling back to in-memory sessions")
        sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins='*',
            cors_credentials=True,
            logger=True,
            engineio_logger=True
        )
else:
    # Development or no Redis: Use in-memory sessions
    logger.info(f"📝 Using in-memory Socket.IO sessions (development mode)")
    sio = socketio.AsyncServer(
        async_mode='asgi',
        cors_allowed_origins='*',
        cors_credentials=True,
        logger=True,
        engineio_logger=True
    )

# Store online users: {username: sid}
online_users = {}
# Store user sessions: {sid: username}
user_sessions = {}

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    from redis_manager import get_redis_manager
    
    # Get username from query parameters (Socket.IO connection)
    query_string = environ.get('QUERY_STRING', '')
    username = None
    
    # Parse query string to get username
    if query_string:
        from urllib.parse import parse_qs
        params = parse_qs(query_string)
        username = params.get('username', [None])[0]
    
    if username:
        online_users[username] = sid
        user_sessions[sid] = username
        
        # Mark user as online in Redis
        redis = get_redis_manager()
        success = redis.set_user_online(username)
        
        logger.info(f"🟢 User '{username}' connected (sid: {sid})")
        logger.info(f"   Redis set_user_online result: {success}")
        logger.info(f"   Total online users: {len(online_users)}")
        
        # Broadcast user online status to all other clients
        await sio.emit('user_online', {'username': username}, skip_sid=sid)
        await broadcast_online_count()
        logger.info(f"   Broadcasted online status for '{username}'")
    else:
        logger.warning(f"⚠️ Connection without username (sid: {sid})")
        
    await sio.emit('connection_established', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    from redis_manager import get_redis_manager
    
    logger.info(f"🔌 Client disconnected: {sid}")
    
    # Remove user from online list
    if sid in user_sessions:
        username = user_sessions[sid]
        if username in online_users and online_users[username] == sid:
            del online_users[username]
        del user_sessions[sid]
        
        # Mark user as offline in Redis
        redis = get_redis_manager()
        success = redis.set_user_offline(username)
        
        logger.info(f"⚪ User '{username}' went offline")
        logger.info(f"   Redis set_user_offline result: {success}")
        logger.info(f"   Remaining online users: {len(online_users)}")
        
        await broadcast_online_count()
        await sio.emit('user_offline', {'username': username})
        logger.info(f"   Broadcasted offline status for '{username}'")

@sio.event
async def send_message(sid, data):
    """Send real-time message"""
    from redis_manager import get_redis_manager
    
    from_username = data.get('from')
    to_username = data.get('to')
    message = data.get('message')
    message_id = data.get('id')
    
    logger.info(f"💬 Real-time message: {from_username} → {to_username}")
    
    # Store message in Redis
    redis = get_redis_manager()
    redis.send_message(from_username, to_username, message, message_id)
    
    # Send to recipient if online via WebSocket
    if to_username in online_users:
        target_sid = online_users[to_username]
        await sio.emit('new_message', {
            'id': message_id,
            'from': from_username,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }, room=target_sid)
        logger.info(f"✅ Message delivered to {to_username} via WebSocket")
    else:
        logger.info(f"📭 User {to_username} is offline, message stored in Redis")

@sio.event
async def typing(sid, data):
    """Handle typing indicator"""
    from redis_manager import get_redis_manager
    
    from_username = data.get('from')
    to_username = data.get('to')
    is_typing = data.get('isTyping', True)
    
    redis = get_redis_manager()
    if is_typing:
        redis.set_typing(from_username, to_username)
    else:
        redis.clear_typing(from_username, to_username)
    
    # Send to recipient if online
    if to_username in online_users:
        target_sid = online_users[to_username]
        await sio.emit('user_typing', {
            'from': from_username,
            'isTyping': is_typing
        }, room=target_sid)

@sio.event
async def get_online_users(sid, data):
    """Get list of online users with profile info"""
    from main import db
    
    usernames = list(online_users.keys())
    user_list = []
    
    # Fetch user details from database
    for username in usernames:
        user = await db.users.find_one({"username": username})
        if user:
            user_list.append({
                "username": user.get("username"),
                "firstName": user.get("firstName"),
                "lastName": user.get("lastName"),
                "profileImage": user.get("images", [None])[0] if user.get("images") else None,
                "role": user.get("role", "free_user")
            })
    
    await sio.emit('online_users_list', {
        'users': user_list,
        'count': len(user_list)
    }, room=sid)

async def broadcast_online_count():
    """Broadcast online user count to all clients"""
    await sio.emit('online_count_update', {
        'count': len(online_users),
        'timestamp': datetime.utcnow().isoformat()
    })

async def notify_user(username, event_type, data):
    """Send notification to specific user if online"""
    if username in online_users:
        sid = online_users[username]
        await sio.emit(event_type, data, room=sid)
        return True
    return False

async def broadcast_to_all(event_type, data):
    """Broadcast event to all connected clients"""
    await sio.emit(event_type, data)

def get_online_users_list():
    """Get current online users from Redis"""
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    return redis.get_online_users()

def get_online_count():
    """Get count of online users from Redis"""
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    users = redis.get_online_users()
    return len(users)

def is_user_online(username):
    """Check if specific user is online in Redis"""
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    return redis.is_user_online(username)
