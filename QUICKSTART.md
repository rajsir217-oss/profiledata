# Quick Start Guide - FastAPI Backend

## 🚀 Get Running in 5 Minutes

### Step 1: Start MongoDB
```bash
# In a new terminal
mongod
```

### Step 2: Setup FastAPI Backend
```bash
cd fastapi_backend

# Create virtual environment
python -m venv venv

# Activate it
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --port 8000
```

**Backend is now running at http://localhost:8000**
- View API docs: http://localhost:8000/docs

### Step 3: Setup Frontend
```bash
# In a NEW terminal
cd frontend

# Install dependencies (first time only)
npm install

# Start React app
npm start
```

**Frontend is now running at http://localhost:3000**

### Step 4: Test the Application

1. Open http://localhost:3000
2. Click "Don't have an account? Register"
3. Fill in the registration form
4. Upload images (optional)
5. Click "Create Profile"
6. Login with your credentials
7. View your profile!

---

## 🔧 Troubleshooting

### MongoDB Connection Error
```bash
# Make sure MongoDB is running
mongod

# Or check if it's already running
ps aux | grep mongod
```

### Port Already in Use
```bash
# FastAPI - change port
uvicorn main:app --reload --port 8001

# Update frontend .env
REACT_APP_API_URL=http://localhost:8001/api/users
```

### Python Module Not Found
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # You should see (venv) in your prompt

# Reinstall dependencies
pip install -r requirements.txt
```

### Frontend Can't Connect to Backend
1. Check backend is running: http://localhost:8000/health
2. Check frontend `.env` file has correct URL
3. Restart frontend: `npm start`

---

## 📊 What's Different from Express Backend?

| Aspect | FastAPI (Port 8000) | Express (Port 5001) |
|--------|---------------------|---------------------|
| Setup | `pip install` | `npm install` |
| Start | `uvicorn main:app --reload` | `npm start` |
| Docs | Built-in at /docs | None |
| Auth | JWT tokens | Session-based |

---

## 🎯 Next Steps

- Explore the API docs: http://localhost:8000/docs
- Try the interactive API testing in Swagger UI
- Check out the full README.md for advanced features
- Both backends work with the same MongoDB database
- You can switch between backends by changing the frontend `.env` file

---

## 💡 Pro Tips

1. **Keep MongoDB running** in a separate terminal
2. **Activate virtual environment** before working with FastAPI
3. **Use the /docs endpoint** to test API calls without frontend
4. **Check logs** in the terminal for debugging
5. **Frontend hot-reloads** automatically when you save files

---

## 🆘 Still Having Issues?

1. Check all three terminals are running:
   - Terminal 1: MongoDB (`mongod`)
   - Terminal 2: FastAPI backend (`uvicorn main:app --reload`)
   - Terminal 3: React frontend (`npm start`)

2. Verify ports:
   - MongoDB: 27017
   - FastAPI: 8000
   - Frontend: 3000

3. Check the main README.md for detailed troubleshooting
