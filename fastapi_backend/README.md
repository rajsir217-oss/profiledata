# FastAPI Backend for Matrimonial Profile Management

A modern, async Python backend using FastAPI and MongoDB.

## Features

- ✅ Async/await with FastAPI
- ✅ MongoDB with Motor (async driver)
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ File upload handling
- ✅ Input validation with Pydantic
- ✅ CORS configuration
- ✅ Automatic API documentation (Swagger/OpenAPI)

## Setup

### 1. Create Virtual Environment

```bash
cd fastapi_backend
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Start MongoDB

Make sure MongoDB is running:
```bash
mongod
```

### 5. Run the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload --port 8000

# Or using Python directly
python main.py
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Authentication

- **POST** `/api/users/register` - Register new user
  - Content-Type: `multipart/form-data`
  - Fields: username, password, profile fields, images (optional)
  
- **POST** `/api/users/login` - Login user
  - Content-Type: `application/json`
  - Body: `{"username": "...", "password": "..."}`
  - Returns: user data + JWT token

### Profiles

- **GET** `/api/users/profile/{username}` - Get user profile

### Utility

- **GET** `/health` - Health check
- **GET** `/` - API info

## Project Structure

```
fastapi_backend/
├── main.py           # Application entry point
├── config.py         # Configuration settings
├── database.py       # MongoDB connection
├── models.py         # Pydantic models
├── routes.py         # API endpoints
├── auth.py           # Authentication utilities
├── utils.py          # Helper functions
├── requirements.txt  # Python dependencies
├── .env             # Environment variables (gitignored)
├── .env.example     # Environment template
└── uploads/         # Uploaded files (gitignored)
```

## Testing

You can test the API using:

1. **Interactive Docs**: http://localhost:8000/docs
2. **cURL**:
   ```bash
   curl -X POST http://localhost:8000/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test123"}'
   ```
3. **Frontend**: Update frontend to use http://localhost:8000

## Differences from Express Backend

- **Port**: 8000 (instead of 5001)
- **Async**: All operations are async/await
- **Auto Docs**: Built-in Swagger UI at /docs
- **Type Safety**: Pydantic models for validation
- **JWT Tokens**: Returns access_token on login

## Production Deployment

1. Set strong SECRET_KEY in .env
2. Use production MongoDB instance
3. Set DEBUG=False
4. Use proper ASGI server (uvicorn with workers)
5. Set up HTTPS/SSL
6. Configure rate limiting
7. Set up monitoring/logging

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `mongod`
- Check MONGODB_URL in .env

### Import Errors
- Activate virtual environment
- Install dependencies: `pip install -r requirements.txt`

### Port Already in Use
- Change port in main.py or use: `uvicorn main:app --port 8001`
