# 🚀 FoodDiscover Backend

This is the backend server for the FoodDiscover application, built with Node.js, Express, and MongoDB Atlas.

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure MongoDB Atlas

1. **Update Connection String**: 
   - Open `config.env` file
   - Replace `<db_password>` with your actual MongoDB Atlas password
   - The connection string should look like:
   ```
   MONGODB_URI=mongodb+srv://vaibhavsharmaa0706_db_user:your_actual_password@cluster0.bkw7b70.mongodb.net/fooddiscover?retryWrites=true&w=majority&appName=Cluster0
   ```

2. **Database Setup**:
   - The database `fooddiscover` will be created automatically
   - Collections will be created when users register

### 3. Environment Variables

The `config.env` file contains:
- `MONGODB_URI`: Your MongoDB Atlas connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode

### 4. Start the Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## 🌐 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | User login |
| GET | `/me` | Get current user profile |
| POST | `/logout` | User logout |
| POST | `/refresh` | Refresh JWT token |

### User Routes (`/api/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update user profile |
| PUT | `/password` | Change password |
| DELETE | `/profile` | Deactivate account |
| GET | `/search` | Search users |
| GET | `/:username` | Get public profile by username |

## 🔐 Authentication

- JWT tokens are used for authentication
- Tokens expire after 7 days
- Protected routes require `Authorization: Bearer <token>` header

## 📊 Database Schema

### User Model
- **Personal Info**: firstName, lastName, email, username
- **Security**: password (hashed with bcrypt)
- **Preferences**: location, foodInterests, dietaryRestrictions
- **Settings**: newsletter, isActive, lastLogin
- **Timestamps**: createdAt, updatedAt

## 🛡️ Security Features

- Password hashing with bcrypt (salt rounds: 12)
- JWT token authentication
- Input validation and sanitization
- CORS enabled for frontend integration
- Rate limiting ready (can be added)

## 🚀 Getting Started

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Test the connection:**
   - Visit: `http://localhost:5000/api/health`
   - Should show: `{"status":"OK","database":"Connected"}`

3. **Test registration:**
   - Use your frontend registration form
   - Or test with Postman/curl

## 🧪 Testing the API

### Test User Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "password": "password123"
  }'
```

### Test User Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check your connection string in `config.env`
   - Verify your IP is whitelisted in MongoDB Atlas
   - Check username/password

2. **Port Already in Use**
   - Change PORT in `config.env`
   - Or kill the process using port 5000

3. **JWT Token Issues**
   - Check JWT_SECRET in `config.env`
   - Ensure token is sent in Authorization header

### Debug Mode

Enable detailed logging by setting:
```bash
NODE_ENV=development
```

## 📁 Project Structure

```
backend/
├── models/
│   └── User.js          # User data model
├── routes/
│   ├── auth.js          # Authentication routes
│   └── users.js         # User management routes
├── config.env           # Environment variables
├── package.json         # Dependencies
├── server.js            # Main server file
└── README.md            # This file
```

## 🌟 Features

- ✅ User registration with validation
- ✅ Secure login with JWT
- ✅ Password hashing and validation
- ✅ User profile management
- ✅ MongoDB Atlas integration
- ✅ RESTful API design
- ✅ Error handling and validation
- ✅ CORS enabled for frontend
- ✅ Health check endpoint

## 🔮 Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Social login (Google, Facebook)
- [ ] File upload for profile pictures
- [ ] Rate limiting
- [ ] API documentation with Swagger
- [ ] Unit and integration tests
- [ ] Logging and monitoring

## 📞 Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify your MongoDB Atlas connection
3. Ensure all dependencies are installed
4. Check that the server is running on the correct port

---

**Happy coding! 🎉**

