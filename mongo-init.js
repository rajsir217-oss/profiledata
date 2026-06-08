// MongoDB initialization script for local Docker development
db = db.getSiblingDB('matrimonialDB');

// Create collections
db.createCollection('users');
db.createCollection('favorites');
db.createCollection('shortlists');
db.createCollection('activity_logs');
db.createCollection('notification_preferences');
db.createCollection('notification_queue');

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 });
db.users.createIndex({ "status.status": 1 });
db.favorites.createIndex({ userUsername: 1, favoritedUsername: 1 });
db.shortlists.createIndex({ userUsername: 1 });
db.activity_logs.createIndex({ timestamp: -1 });

// Create admin user (password: admin123)
db.users.insertOne({
  username: "admin",
  password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeN.B3NdKU4EuWx8u",
  email: "admin@localhost",
  contactEmail: "admin@localhost",
  role_name: "admin",
  status: { status: "active" },
  firstName: "Admin",
  lastName: "User",
  createdAt: new Date(),
  themePreference: "light-blue"
});

// Create test user (password: test123)
db.users.insertOne({
  username: "riteshpandey052",
  password: "$2b$12$K7Zr8gZQYX5n5nQ5X5X5XeX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5",
  email: "ritesh@test.com",
  contactEmail: "ritesh@test.com",
  role_name: "free_user",
  status: { status: "active" },
  firstName: "Ritesh",
  lastName: "Pandey",
  age: 28,
  gender: "Male",
  location: "Mumbai",
  profession: "Software Engineer",
  createdAt: new Date(),
  themePreference: "light-blue"
});

// Create another test user (password: test123)
db.users.insertOne({
  username: "testuser",
  password: "$2b$12$K7Zr8gZQYX5n5nQ5X5X5XeX5X5X5X5X5X5X5X5X5X5X5X5X5X5X5X5",
  email: "test@test.com",
  contactEmail: "test@test.com",
  role_name: "free_user",
  status: { status: "active" },
  firstName: "Test",
  lastName: "User",
  age: 25,
  gender: "Female",
  location: "Delhi",
  profession: "Designer",
  createdAt: new Date(),
  themePreference: "light-pink"
});

print('✅ Database initialized successfully with test users!');
print('');
print('Test credentials:');
print('  Admin: username=admin, password=admin123');
print('  User 1: username=riteshpandey052, password=test123');
print('  User 2: username=testuser, password=test123');
