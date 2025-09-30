# Matrimonial Profile Management System

A full-stack web application for managing matrimonial profiles with image uploads, user authentication, and profile browsing.

## 🏗️ Architecture

- **Frontend**: React 19 with React Router, Bootstrap 5, Axios
- **Backend Options**:
  - **FastAPI** (Python) - Modern async API with auto-docs (Port 8000) ⭐ **RECOMMENDED**
  - **Express** (Node.js) - Traditional REST API (Port 5001)
- **Database**: MongoDB (shared by both backends)
- **File Storage**: Local file system (uploads directory)

## 📋 Features

- ✅ User registration with profile details
- ✅ Secure password hashing with bcrypt
- ✅ Image upload (up to 5 images, max 5MB each)
- ✅ User login and authentication
- ✅ Profile viewing with image carousel
- ✅ Input validation and sanitization
- ✅ Rate limiting for security
- ✅ Structured logging with Winston
- ✅ CORS configuration
- ✅ Environment-based configuration

## 🚀 Getting Started

### Prerequisites

- **For FastAPI Backend** (Recommended):
  - Python 3.8 or higher
  - MongoDB (running locally or remote instance)
  
- **For Express Backend** (Alternative):
  - Node.js (v16 or higher)
  - MongoDB (running locally or remote instance)
  - npm or yarn

---

## Option 1: FastAPI Backend Setup (Recommended)

### 1. Navigate to FastAPI directory:
```bash
cd fastapi_backend
```

### 2. Create and activate virtual environment:
```bash
python -m venv venv

# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 3. Install dependencies:
```bash
pip install -r requirements.txt
```

### 4. Create `.env` file:
```bash
cp .env.example .env
# Edit .env if needed (default values work for local development)
```

### 5. Start MongoDB:
```bash
mongod
```

### 6. Start FastAPI server:
```bash
uvicorn main:app --reload --port 8000
# Or: python main.py
```

The FastAPI backend will run on `http://localhost:8000`
- **API Docs**: http://localhost:8000/docs (Interactive Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc

---

## Option 2: Express Backend Setup (Alternative)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file:
   ```env
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/matrimonialDB
   FRONTEND_URL=http://localhost:3000
   BACKEND_URL=http://localhost:5001
   BCRYPT_ROUNDS=10
   ```

5. Start MongoDB (if running locally):
   ```bash
   mongod
   ```

6. Start the backend server:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

The backend will run on `http://localhost:5001`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file:
   ```env
   # For FastAPI backend (default):
   REACT_APP_API_URL=http://localhost:8000/api/users
   
   # For Express backend (alternative):
   # REACT_APP_API_URL=http://localhost:5001/api/users
   ```

5. Start the React development server:
   ```bash
   npm start
   ```

The frontend will run on `http://localhost:3000`

## 📁 Project Structure

```
profiledata/
├── fastapi_backend/      # ⭐ FastAPI backend (Python)
│   ├── main.py          # Application entry point
│   ├── config.py        # Settings management
│   ├── database.py      # MongoDB connection
│   ├── models.py        # Pydantic models
│   ├── routes.py        # API endpoints
│   ├── auth.py          # JWT authentication
│   ├── utils.py         # Helper functions
│   ├── requirements.txt # Python dependencies
│   ├── .env.example
│   ├── uploads/         # Uploaded images (gitignored)
│   └── README.md
├── backend/             # Express backend (Node.js)
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Validation, rate limiting
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── utils/           # Logger and utilities
│   ├── uploads/         # Uploaded images (gitignored)
│   ├── logs/            # Application logs (gitignored)
│   ├── server.js        # Entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── api.js       # Axios configuration
│   │   ├── App.js       # Main app component
│   │   └── index.js     # Entry point
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🔐 API Endpoints

Both backends expose the same API endpoints:

### Authentication

- **POST** `/api/users/register` - Register a new user
  - Body: `multipart/form-data` with profile fields and images
  - FastAPI: No rate limit (add if needed)
  - Express: 5 requests per 15 minutes per IP
  
- **POST** `/api/users/login` - Login user
  - Body: `{ username, password }`
  - FastAPI: Returns JWT token + user data
  - Express: Returns user data only
  - Rate limit (Express): 5 requests per 15 minutes per IP

### Profiles

- **GET** `/api/users/profile/:username` - Get user profile
  - Returns profile with full image URLs

### Health Check

- **GET** `/health` - Server health status

### FastAPI Exclusive

- **GET** `/docs` - Interactive API documentation (Swagger UI)
- **GET** `/redoc` - Alternative API documentation

## 🛡️ Security Features

- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting on authentication endpoints
- CORS configuration
- Unique constraints on username and email
- File type and size validation for uploads
- SQL injection prevention via Mongoose
- XSS protection via input sanitization

## 📝 User Profile Fields

- Username (unique, required, min 3 chars)
- Password (required, min 6 chars, hashed)
- First Name, Last Name
- Contact Number, Contact Email (unique)
- Date of Birth
- Sex (Male/Female)
- Height
- Caste Preference
- Eating Preference (Vegetarian/Eggetarian/Non-Veg/Others)
- Location
- Education
- Working Status
- Workplace
- Citizenship Status (Citizen/Greencard)
- Family Background
- About You
- Partner Preference
- Images (up to 5, max 5MB each)

## 🧪 Testing

Currently, no automated tests are implemented. To test manually:

1. Start both backend and frontend servers
2. Navigate to `http://localhost:3000`
3. Register a new user with profile details
4. Login with credentials
5. View the profile page

## 🐛 Known Issues

- No email verification implemented
- No password reset functionality
- No image optimization/compression
- No pagination for profile listings
- Bootstrap carousel requires Bootstrap JS bundle

## 🔮 Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Image optimization (Sharp for Node.js, Pillow for Python)
- [ ] Search and filter profiles
- [ ] Pagination for profile listings
- [ ] Admin dashboard
- [ ] Profile matching algorithm
- [ ] Real-time chat functionality
- [ ] Automated tests (Jest/Pytest)
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Rate limiting for FastAPI
- [ ] WebSocket support for real-time features

## 📄 License

ISC

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## ⚠️ Important Notes

- Never commit `.env` files to version control
- Keep your MongoDB credentials secure
- **FastAPI runs on port 8000**, Express runs on port 5001
- Update frontend `.env` to point to the backend you're using
- Run dependency installation after pulling updates:
  - FastAPI: `pip install -r requirements.txt`
  - Express: `npm install`
  - Frontend: `npm install`
- Ensure MongoDB is running before starting any backend
- Both backends can use the same MongoDB database

## 🆚 FastAPI vs Express Backend

| Feature | FastAPI | Express |
|---------|---------|---------|
| **Language** | Python | Node.js |
| **Port** | 8000 | 5001 |
| **Performance** | Async/Await (faster) | Async/Await |
| **Auto Docs** | ✅ Built-in Swagger | ❌ Manual |
| **Type Safety** | ✅ Pydantic | ❌ (can add TypeScript) |
| **JWT Auth** | ✅ Included | ❌ Not implemented |
| **Rate Limiting** | ❌ Not added | ✅ Included |
| **Logging** | ✅ Basic | ✅ Winston |
| **Validation** | ✅ Pydantic | ✅ Custom middleware |
| **Setup** | pip install | npm install |
| **Recommended** | ✅ Yes | For Node.js preference |

## 📞 Support

For issues and questions, please create an issue in the repository.
