// backend/middleware/validation.js
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\d{10,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

const validateDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

exports.validateRegistration = (req, res, next) => {
  const { username, password, contactEmail, contactNumber, dob } = req.body;
  const errors = [];

  // Username validation
  if (!username || username.length < 3) {
    errors.push("Username must be at least 3 characters long");
  }
  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push("Username can only contain letters, numbers, and underscores");
  }

  // Password validation
  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters long");
  }

  // Email validation
  if (contactEmail && !validateEmail(contactEmail)) {
    errors.push("Invalid email format");
  }

  // Phone validation
  if (contactNumber && !validatePhone(contactNumber)) {
    errors.push("Invalid phone number format (10-15 digits)");
  }

  // Date validation
  if (dob && !validateDate(dob)) {
    errors.push("Invalid date of birth");
  }

  // Sanitize string inputs
  const stringFields = ['firstName', 'lastName', 'location', 'education', 'workplace', 
                        'castePreference', 'familyBackground', 'aboutYou', 'partnerPreference'];
  stringFields.forEach(field => {
    if (req.body[field]) {
      req.body[field] = sanitizeString(req.body[field]);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  next();
};

exports.validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || !password) {
    errors.push("Username and password are required");
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  next();
};
