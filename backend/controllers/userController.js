// backend/controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const path = require("path");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

exports.registerUser = async (req, res) => {
  try {
    const { username, password, ...rest } = req.body;

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Check if email already exists
    if (rest.contactEmail) {
      const existingEmail = await User.findOne({ contactEmail: rest.contactEmail });
      if (existingEmail) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const images = req.files?.length
      ? req.files.map((file) => `/uploads/${path.basename(file.path)}`)
      : [];

    const user = new User({
      username,
      password: hashedPassword,
      ...rest,
      images,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        ...user.toObject(),
        images: user.images.map((img) => `${BACKEND_URL}${img}`)
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { username, password: inputPassword } = req.body;

    // Find the user
    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(inputPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Build full image URLs
    const imagesWithUrls = (user.images || []).map(
      (img) => `${BACKEND_URL}${img}`
    );

    // Send full profile data
    // Do not send password hash
    const { password, ...safeUser } = user;
    res.json({
      message: "Login successful",
      user: {
      ...safeUser,
      images: imagesWithUrls
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    console.log(user);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Build full image URLs for frontend display
    const imagesWithUrls = (user.images || []).map(
      (img) => img.startsWith("http") ? img : `${BACKEND_URL}${img}`
    );
    // Do not send password hash
    const { password: pwd, ...safeUser } = user;
    res.json({
      ...safeUser,
      images: imagesWithUrls
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};
