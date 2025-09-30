// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    trim: true,
    minlength: 3
  },
  password: { 
    type: String, 
    required: true 
  },
  firstName: { 
    type: String, 
    trim: true 
  },
  lastName: { 
    type: String, 
    trim: true 
  },
  contactNumber: { 
    type: String, 
    trim: true 
  },
  contactEmail: { 
    type: String, 
    unique: true, 
    sparse: true,
    trim: true,
    lowercase: true
  },
  dob: Date,
  sex: { 
    type: String, 
    enum: ['Male', 'Female', ''] 
  },
  height: String,
  castePreference: String,
  eatingPreference: { 
    type: String, 
    enum: ['Vegetarian', 'Eggetarian', 'Non-Veg', 'Others', ''] 
  },
  location: String,
  education: String,
  workingStatus: String,
  workplace: String,
  citizenshipStatus: { 
    type: String, 
    enum: ['Citizen', 'Greencard', ''],
    default: 'Citizen'
  },
  familyBackground: String,
  aboutYou: String,
  partnerPreference: String,
  images: [String], // file paths
}, { timestamps: true });

// Indexes for frequently queried fields
userSchema.index({ contactEmail: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);

