// backend/controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const path = require("path");

exports.registerUser = async (req, res) => {
  try {
    const { username, password, ...rest } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
        images: user.images.map((img) => `http://localhost:5001${img}`)
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find the user
    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Build full image URLs
    const imagesWithUrls = (user.images || []).map(
      (img) => `http://localhost:5001${img}`
    );

    // Send full profile data
    res.json({
      message: "Login successful",
      user: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        location: user.location,
        aboutYou: user.aboutYou,
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
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Build full image URLs for frontend display
    const imagesWithUrls = (user.images || []).map(
      (img) => img.startsWith("http") ? img : `http://localhost:5001${img}`
    );
    // Do not send password hash
    const { password, ...safeUser } = user;
    res.json({
      ...safeUser,
      images: imagesWithUrls
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};
