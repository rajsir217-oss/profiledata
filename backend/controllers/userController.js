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
  // login logic here
};

exports.getUserProfile = async (req, res) => {
  // profile logic here
  console.log("Looking for user:", req.params.username);

};
