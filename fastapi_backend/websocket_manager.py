# fastapi_backend/websocket_manager.py
import socketio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Configure properly in production
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
    logger.info(f"🔌 Client connected: {sid}")
    await sio.emit('connection_established', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    logger.info(f"🔌 Client disconnected: {sid}")
    
    # Remove user from online list
    if sid in user_sessions:
        username = user_sessions[sid]
        if username in online_users and online_users[username] == sid:
            del online_users[username]
        del user_sessions[sid]
        
        # Broadcast user went offline
        await broadcast_online_count()
        await sio.emit('user_offline', {'username': username})
        logger.info(f"👋 User {username} went offline")

@sio.event
async def user_online(sid, data):
    """User comes online"""
    username = data.get('username')
    if not username:
        return
    
    # Store user session
    user_sessions[sid] = username
    online_users[username] = sid
    
    logger.info(f"✅ User {username} is now online")
    
    # Broadcast to all clients
    await broadcast_online_count()
    await sio.emit('user_online', {'username': username})

@sio.event
async def user_typing(sid, data):
    """User is typing a message"""
    username = data.get('username')
    to_username = data.get('to')
    
    if to_username in online_users:
        target_sid = online_users[to_username]
        await sio.emit('user_typing', {
            'from': username,
            'isTyping': data.get('isTyping', True)
        }, room=target_sid)

@sio.event
async def send_message(sid, data):
    """Send real-time message"""
    from_username = data.get('from')
    to_username = data.get('to')
    message = data.get('message')
    
    logger.info(f"💬 Real-time message: {from_username} → {to_username}")
    
    # Send to recipient if online
    if to_username in online_users:
        target_sid = online_users[to_username]
        await sio.emit('new_message', {
            'from': from_username,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }, room=target_sid)
        logger.info(f"✅ Message delivered to {to_username}")
    else:
        logger.info(f"📭 User {to_username} is offline, message stored in DB")

@sio.event
async def get_online_users(sid, data):
    """Get list of online users"""
    await sio.emit('online_users_list', {
        'users': list(online_users.keys()),
        'count': len(online_users)
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
    """Get current online users"""
    return list(online_users.keys())

def get_online_count():
    """Get count of online users"""
    return len(online_users)

def is_user_online(username):
    """Check if specific user is online"""
    return username in online_users
