// backend/fixImagePaths.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

async function fixImagePaths() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("MongoDB connected");

    const users = await User.find({ images: { $exists: true, $ne: [] } });

    for (let user of users) {
      let updated = false;

      user.images = user.images.map((img) => {
        // Only update if not already a full URL
        if (!img.startsWith("http")) {
          updated = true;
          return `http://localhost:5001/${img.replace(/^\/?/, "")}`;
        }
        return img;
      });

      if (updated) {
        await user.save();
        console.log(`✅ Updated user ${user.username}`);
      }
    }

    console.log("All users checked and updated");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

fixImagePaths();
