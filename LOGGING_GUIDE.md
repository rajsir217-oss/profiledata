# Backend Logging Guide

## Overview
The FastAPI backend has been enhanced with comprehensive logging to make troubleshooting easier. All logs include emojis for quick visual identification and detailed context information.

## Log Levels

- **INFO**: General operational messages (successful operations, connections)
- **DEBUG**: Detailed diagnostic information (useful for development)
- **WARNING**: Warning messages (validation failures, skipped operations)
- **ERROR**: Error messages with full stack traces

## Log Format

```
%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

Example:
```
2025-09-30 11:15:00 - routes - INFO - 📝 Registration attempt for username: john_doe
```

## Logging Coverage

### 1. **Application Lifecycle** (`main.py`)
- 🚀 Application startup
- 📁 Static files mounting
- 👋 Application shutdown
- 📨 All incoming HTTP requests
- ✅/❌ Response status and duration

### 2. **Database Operations** (`database.py`)
- 🔌 MongoDB connection attempts
- ✅ Successful connections with database name
- ❌ Connection failures with error details
- 🔌 Connection closures

### 3. **User Registration** (`routes.py` - `/register`)
- 📝 Registration attempts with username
- ⚠️ Validation failures (username/password too short)
- ⚠️ Duplicate username/email attempts
- 📸 Image upload processing
- ✅ Successful image saves with count
- ❌ Image save errors
- 💾 Database insert operations
- ✅ Successful registrations with user ID

### 4. **User Login** (`routes.py` - `/login`)
- 🔑 Login attempts with username
- ⚠️ Failed logins (user not found, invalid password)
- ✅ Successful logins

### 5. **Profile Retrieval** (`routes.py` - `/profile/{username}`)
- 👤 Profile requests
- ⚠️ Profile not found
- ✅ Successful profile retrievals

### 6. **File Operations** (`utils.py`)
- 📁 File upload processing
- 💾 Individual file saves with size
- ⚠️ File validation warnings (wrong type, too large)
- ✅ Successful file saves
- ❌ File save errors

## Log Emoji Guide

| Emoji | Meaning |
|-------|---------|
| 🚀 | Application startup |
| 📨 | Incoming request |
| ✅ | Success |
| ❌ | Error/Failure |
| ⚠️ | Warning |
| 📝 | Registration |
| 🔑 | Login |
| 👤 | Profile |
| 📸 | Image processing |
| 💾 | Database/File save |
| 🔌 | Connection |
| 📁 | File/Directory |
| 👋 | Shutdown |

## Viewing Logs

### During Development
Logs are automatically printed to the console when running the server:

```bash
cd fastapi_backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Example Log Output

```
2025-09-30 11:15:00 - main - INFO - 🚀 Starting FastAPI application...
2025-09-30 11:15:00 - main - INFO - ✅ Upload directory ready: uploads
2025-09-30 11:15:00 - database - INFO - 🔌 Attempting to connect to MongoDB at mongodb://localhost:27017
2025-09-30 11:15:00 - database - INFO - ✅ Successfully connected to MongoDB database: matrimonial_db
2025-09-30 11:15:05 - main - INFO - 📨 Incoming POST request to /api/users/register
2025-09-30 11:15:05 - routes - INFO - 📝 Registration attempt for username: john_doe
2025-09-30 11:15:05 - routes - DEBUG - Registration data - Email: john@example.com, Name: John Doe
2025-09-30 11:15:05 - routes - DEBUG - Checking if username 'john_doe' exists...
2025-09-30 11:15:05 - routes - DEBUG - Checking if email 'john@example.com' exists...
2025-09-30 11:15:05 - routes - INFO - 📸 Processing 2 image(s) for user 'john_doe'
2025-09-30 11:15:05 - utils - INFO - 📁 Processing 2 file(s) for upload...
2025-09-30 11:15:05 - utils - DEBUG - 💾 Saving file 'profile.jpg' as '123e4567-e89b-12d3-a456-426614174000.jpg'
2025-09-30 11:15:05 - utils - INFO - ✅ File saved successfully: 123e4567-e89b-12d3-a456-426614174000.jpg (1.23MB)
2025-09-30 11:15:05 - utils - INFO - ✅ Successfully saved 2/2 file(s)
2025-09-30 11:15:05 - routes - INFO - ✅ Successfully saved 2 image(s) for user 'john_doe'
2025-09-30 11:15:05 - routes - DEBUG - Hashing password for user 'john_doe'
2025-09-30 11:15:05 - routes - INFO - 💾 Inserting user 'john_doe' into database...
2025-09-30 11:15:05 - routes - INFO - ✅ User 'john_doe' successfully registered with ID: 507f1f77bcf86cd799439011
2025-09-30 11:15:05 - main - INFO - ✅ POST /api/users/register - Status: 201 - Duration: 0.523s
```

## Troubleshooting Common Issues

### 1. Database Connection Errors
Look for:
```
❌ Failed to connect to MongoDB: ...
```
**Solution**: Ensure MongoDB is running (`mongod`)

### 2. Registration Failures
Look for:
```
⚠️ Registration failed: Username 'xxx' already exists
⚠️ Registration failed: Email 'xxx' already registered
```
**Solution**: Use a different username/email

### 3. Image Upload Issues
Look for:
```
⚠️ Skipping file xxx: too large (6.5MB > 5MB)
❌ Error saving images for user 'xxx': ...
```
**Solution**: Check file size and format

### 4. Login Failures
Look for:
```
⚠️ Login failed: Username 'xxx' not found
⚠️ Login failed: Invalid password for user 'xxx'
```
**Solution**: Verify credentials

## Changing Log Level

To see more detailed logs (DEBUG level), modify `main.py`:

```python
logging.basicConfig(
    level=logging.DEBUG,  # Change from INFO to DEBUG
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

To reduce log verbosity (WARNING level only):

```python
logging.basicConfig(
    level=logging.WARNING,  # Only warnings and errors
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## Production Logging

For production, consider:

1. **File-based logging**:
```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

2. **Log rotation** (to prevent large log files):
```python
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler(
    'app.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
```

3. **Structured logging** for log aggregation tools (ELK, Splunk, etc.)

## Benefits

✅ **Easy debugging**: Quickly identify where errors occur
✅ **Performance monitoring**: Track request durations
✅ **Security auditing**: Track login attempts and failures
✅ **User behavior**: Understand registration patterns
✅ **File tracking**: Monitor image uploads and storage
✅ **Database monitoring**: Track all database operations

## Next Steps

- Set up log aggregation for production
- Add custom metrics/monitoring
- Implement log-based alerting
- Create dashboards from log data
