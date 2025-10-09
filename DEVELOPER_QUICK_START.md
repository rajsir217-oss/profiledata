# Developer Quick Start Guide
**Matrimonial Profile Application**

---

## 🚀 Quick Setup (5 Minutes)

### Prerequisites
- Python 3.12+
- Node.js 16+
- MongoDB running on localhost:27017
- Redis running on localhost:6379

### Backend Setup
```bash
cd fastapi_backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:socket_app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm start  # Runs on http://localhost:3000
```

### Quick Test
```bash
# Backend tests
cd fastapi_backend
pytest

# Frontend tests
cd frontend
npm test
```

---

## 🔑 Default Credentials

### Admin Account
- **Username:** `admin`
- **Password:** `admin123` (change in production!)

### Test Users
Run the profile generator:
```bash
python generate_test_profiles.py
```

---

## 📁 Project Structure

```
profiledata/
├── fastapi_backend/          # Python FastAPI backend
│   ├── main.py              # App entry point
│   ├── routes.py            # API endpoints (56 routes)
│   ├── models.py            # Pydantic models
│   ├── database.py          # MongoDB connection
│   ├── redis_manager.py     # Redis operations
│   ├── auth/                # Authentication modules
│   └── tests/               # Pytest tests
│
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── App.js           # Main component
│   │   ├── api.js           # Axios config
│   │   ├── components/      # React components
│   │   ├── services/        # Business logic
│   │   └── themes/          # CSS themes
│   └── public/
│
└── docs/                     # Documentation
    ├── PROJECT_STATUS.md
    ├── AUTH_MODULE_COMPLETE.md
    └── ...
```

---

## 🛠️ Common Development Tasks

### Add a New API Endpoint
1. Define route in `fastapi_backend/routes.py`:
```python
@router.get("/api/users/my-endpoint")
async def my_endpoint(username: str, db = Depends(get_database)):
    # Your logic here
    return {"data": "response"}
```

2. Add frontend API call in `frontend/src/api.js` or component:
```javascript
const response = await api.get(`/api/users/my-endpoint?username=${username}`);
```

### Add a New React Component
1. Create component file: `frontend/src/components/MyComponent.js`
2. Create styles: `frontend/src/components/MyComponent.css`
3. Import and use in parent component

### Add a New Database Collection
1. Access via dependency injection:
```python
async def my_route(db = Depends(get_database)):
    result = await db.my_collection.find_one({"field": "value"})
```

### Add Redis Caching
1. Use redis_manager:
```python
from redis_manager import get_redis_manager
redis = get_redis_manager()
redis.redis_client.set("key", "value", ex=3600)  # 1 hour TTL
```

---

## 🐛 Debugging Tips

### Backend Debugging
```python
# Add logging
import logging
logger = logging.getLogger(__name__)
logger.info(f"Debug info: {variable}")
```

### Frontend Debugging
```javascript
// Console logging
console.log('🔍 Debug:', variable);

// React DevTools
// Install browser extension for component inspection
```

### Check Logs
```bash
# Backend logs
tail -f fastapi_backend/server.log

# Frontend logs
# Check browser console (F12)
```

---

## 🧪 Testing

### Run All Tests
```bash
# Backend
cd fastapi_backend
pytest -v --cov=. --cov-report=html

# Frontend
cd frontend
npm test -- --coverage
```

### Run Specific Tests
```bash
# Backend
pytest tests/test_auth.py -v

# Frontend
npm test -- Login.test.js
```

### Test via UI
1. Login as admin
2. Navigate to Test Dashboard
3. Click "Run All Tests"

---

## 🔧 Common Issues & Solutions

### Issue: MongoDB Connection Failed
**Solution:**
```bash
# Check if MongoDB is running
mongosh
# If not, start it:
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Issue: Redis Connection Failed
**Solution:**
```bash
# Check if Redis is running
redis-cli ping
# If not, start it:
brew services start redis              # macOS
sudo systemctl start redis             # Linux
```

### Issue: Port Already in Use
**Solution:**
```bash
# Find process using port 8000
lsof -i :8000
# Kill process
kill -9 <PID>
```

### Issue: CORS Errors
**Solution:** Check `fastapi_backend/main.py` CORS settings:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: Real-time Messages Not Appearing
**Solution:** Check property names in message objects:
- Use `msg.content || msg.message`
- Use `msg.fromUsername || msg.from_username`
- See `MEMORY[5cea050b]` for details

---

## 📊 Database Schema Quick Reference

### Users Collection
```javascript
{
  username: String (unique),
  password: String (hashed),
  firstName: String,
  lastName: String,
  email: String,
  contactNumber: String,
  gender: String,
  dateOfBirth: Date,
  age: Number,
  height: Number,
  maritalStatus: String,
  religion: String,
  caste: String,
  education: String,
  occupation: String,
  income: Number,
  location: String,
  city: String,
  state: String,
  country: String,
  images: [String],
  status: {
    status: String,  // active, inactive, suspended, pending
    reason: String,
    updatedAt: Date,
    updatedBy: String
  },
  createdAt: Date
}
```

### Messages Collection
```javascript
{
  fromUsername: String,
  toUsername: String,
  content: String,
  isRead: Boolean,
  isVisible: Boolean,
  createdAt: Date
}
```

### Favorites/Shortlist/Exclusions Collections
```javascript
{
  username: String,
  targetUsername: String,
  createdAt: Date
}
```

---

## 🎨 UI Theme Customization

### Change Theme
User can select from 3 themes in Preferences:
- Cozy Light
- Cozy Night
- Cozy Rose

### Add New Theme
Edit `frontend/src/themes/themes.css`:
```css
[data-theme="my-theme"] {
  --primary-color: #your-color;
  --background-color: #your-bg;
  /* ... other variables */
}
```

---

## 🔐 Security Checklist

- [ ] Change default admin password
- [ ] Set strong SECRET_KEY in .env
- [ ] Enable HTTPS in production
- [ ] Configure CORS for production domain
- [ ] Set up rate limiting
- [ ] Enable MongoDB authentication
- [ ] Secure Redis with password
- [ ] Implement request validation
- [ ] Add input sanitization
- [ ] Set up security headers

---

## 📦 Deployment Checklist

### Pre-deployment
- [ ] Run all tests
- [ ] Update dependencies
- [ ] Review security settings
- [ ] Set production environment variables
- [ ] Build frontend: `npm run build`
- [ ] Test production build locally

### Production Environment Variables
```bash
# Backend (.env)
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DATABASE_NAME=matrimonial_prod
SECRET_KEY=<strong-random-key>
REDIS_HOST=<redis-host>
REDIS_PORT=6379
UPLOAD_DIR=/var/www/uploads

# Frontend (.env.production)
REACT_APP_API_URL=https://api.yourdomain.com
```

### Deployment Steps
1. Set up production servers (backend, frontend, DB, Redis)
2. Configure reverse proxy (Nginx)
3. Set up SSL certificates (Let's Encrypt)
4. Deploy backend with Gunicorn/Uvicorn
5. Deploy frontend to static hosting (Nginx/S3/Vercel)
6. Set up monitoring (PM2, New Relic, etc.)
7. Configure backups (MongoDB, Redis)
8. Set up logging (CloudWatch, Papertrail)

---

## 🚨 Emergency Procedures

### Backend Crash
```bash
# Check logs
tail -100 fastapi_backend/server.log

# Restart backend
cd fastapi_backend
source venv/bin/activate
uvicorn main:socket_app --reload --port 8000
```

### Database Issues
```bash
# Check MongoDB status
mongosh
db.serverStatus()

# Backup database
mongodump --db matrimonial_profiles --out backup/

# Restore database
mongorestore --db matrimonial_profiles backup/matrimonial_profiles/
```

### Redis Issues
```bash
# Check Redis
redis-cli
INFO

# Clear Redis cache (use carefully!)
redis-cli FLUSHDB
```

---

## 📚 Useful Commands

### Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:socket_app --reload --port 8000

# Run tests
pytest -v

# Check coverage
pytest --cov=. --cov-report=html

# Format code
black .

# Lint code
flake8 .
```

### Frontend
```bash
# Install dependencies
npm install

# Run dev server
npm start

# Build for production
npm run build

# Run tests
npm test

# Check bundle size
npm run build -- --stats
```

### Database
```bash
# Connect to MongoDB
mongosh

# Show databases
show dbs

# Use database
use matrimonial_profiles

# Show collections
show collections

# Query users
db.users.find().pretty()

# Count documents
db.users.countDocuments()
```

### Redis
```bash
# Connect to Redis
redis-cli

# Check all keys
KEYS *

# Get value
GET key

# Check online users
SMEMBERS online_users

# Check message queue
LRANGE messages:username 0 -1
```

---

## 🔗 Useful Links

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **React Docs:** https://react.dev/
- **MongoDB Docs:** https://www.mongodb.com/docs/
- **Redis Docs:** https://redis.io/docs/
- **Pytest Docs:** https://docs.pytest.org/
- **Socket.IO Docs:** https://socket.io/docs/

---

## 💡 Pro Tips

1. **Use the Test Dashboard** - Automated testing saves time
2. **Check Console Logs** - Frontend logs are very detailed
3. **Use React DevTools** - Inspect component state easily
4. **Monitor Redis** - Check message queues for debugging
5. **Read the Memories** - Important fixes are documented
6. **Keep Dependencies Updated** - Security and features
7. **Write Tests First** - TDD saves debugging time
8. **Use Git Branches** - Never commit directly to main
9. **Document as You Go** - Future you will thank you
10. **Ask for Help** - Check existing documentation first

---

## 🎯 Next Steps for New Developers

1. ✅ Set up development environment
2. ✅ Run the application locally
3. ✅ Create a test user account
4. ✅ Explore the UI features
5. ✅ Review the codebase structure
6. ✅ Run the test suite
7. ✅ Make a small change and test
8. ✅ Read the documentation
9. ✅ Pick a feature to implement
10. ✅ Submit your first PR

---

**Happy Coding! 🚀**

For questions or issues, check the documentation or create an issue in the repository.
