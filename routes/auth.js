const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");
const auth = require("../middleware/auth");
const jwt = require("jsonwebtoken");


router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      faceRegistered: false
    });

    res.json({
      message: "User registered successfully",
      userId: user._id
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});



router.post("/save-face", async (req, res) => {
  try {
    const { userId, embedding } = req.body;

    if (!userId || !embedding) {
      return res.status(400).json({ message: "Missing data" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        faceEmbedding: embedding,
        faceRegistered: true
      },
      { new: true, runValidators: true } // <--- IMPORTANT
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Face registered successfully", updatedUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// router.post("/verify-face", async (req, res) => {
//   try {
//     const { userId, embedding } = req.body;

//     if (!userId || !embedding)
//       return res.status(400).json({ message: "Missing data" });

//     const user = await User.findById(userId);
//     if (!user)
//       return res.status(404).json({ message: "User not found" });

//     if (!user.faceRegistered)
//       return res.status(400).json({ message: "Face not registered" });

//     // Calculate face distance
//     const stored = user.faceEmbedding;
//     const incoming = embedding;

//     let dist = 0;
//     for (let i = 0; i < stored.length; i++) {
//       dist += (stored[i] - incoming[i]) ** 2;
//     }
//     dist = Math.sqrt(dist);

//     const THRESHOLD = 0.45;
//     if (dist >= THRESHOLD) {
//       return res.json({ success: false, message: "Face mismatch" });
//     }

//     // Face matched → generate token
//     const token = generateToken(user);

//     res.json({
//       success: true,
//       message: "Face matched",
//       token
//     });

//   } catch (err) {
//     console.error("VERIFY-FACE ERROR:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

router.post("/verify-face", async (req, res) => {
  try {
    const { embedding } = req.body;

    if (!embedding) {
      return res.status(400).json({ success: false, message: "No embedding provided" });
    }

    const users = await User.find({ faceEmbedding: { $exists: true, $ne: [] } });

    let bestUser = null;
    let bestDistance = 1.0;

    for (const user of users) {
      const dbFace = user.faceEmbedding;   // saved array
      const liveFace = embedding;          // from frontend

      const distance = euclideanDistance(dbFace, liveFace);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestUser = user;
      }
    }

    // Recommended threshold: 0.45 – 0.55
    if (!bestUser || bestDistance > 0.53) {
      return res.json({
        success: false,
        message: "Face mismatch",
      });
    }

    const token = jwt.sign(
      { id: bestUser._id, email: bestUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Face match",
      userId: bestUser._id,
      token,
    });

  } catch (err) {
    console.error("Face verify error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

function euclideanDistance(arr1, arr2) {
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}



router.get("/wallet", auth, async (req, res) => {
  res.json({
    message: "Wallet data (protected)",
    user: req.user
  });
});

module.exports = router;
