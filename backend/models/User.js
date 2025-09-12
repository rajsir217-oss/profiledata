// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  firstName: String,
  lastName: String,
  contactNumber: String,
  contactEmail: String,
  dob: Date,
  sex: String,
  height: String,
  castePreference: String,
  eatingPreference: String,
  location: String,
  education: String,
  workingStatus: String,
  workplace: String,
  citizenshipStatus: String,
  familyBackground: String,
  aboutYou: String,
  partnerPreference: String,
  images: [String], // file paths
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

