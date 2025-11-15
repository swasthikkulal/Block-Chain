const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const nodemailer = require("nodemailer");

// YOUR SECRET
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY_123";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
// ------------------------------------------------------
// REGISTER (same as your current code)
// ------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      faceRegistered: false,
      otp: null,
      otpExpires: null,
    });

    res.json({ userId: user._id, message: "Registered" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// ------------------------------------------------------
// LOGIN (email + password → go to VERIFY PAGE)
// ------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Invalid password" });

    return res.json({
      message: "Password OK",
      userId: user._id
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ------------------------------------------------------
// SEND OTP
// ------------------------------------------------------
router.post("/send-otp", async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const expires = Date.now() + 2 * 60 * 1000;

    user.otp = otpCode;
    user.otpExpires = expires;
    await user.save();

    // email text
    const mailOptions = {
      from: `"Wallet Login" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Your Login OTP Code",
      html: `
        <h2>Your OTP Code</h2>
        <p style="font-size:20px; font-weight:bold;">${otpCode}</p>
        <p>This OTP is valid for 2 minutes.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      message: "OTP sent to your email"
    });

  } catch (err) {
    console.error("OTP SEND ERROR:", err);
    res.status(500).json({ message: "Error sending OTP email" });
  }
});



// ------------------------------------------------------
// VERIFY OTP → GIVE JWT TOKEN
// ------------------------------------------------------
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    console.log("📩 Incoming OTP verify:", { userId, otp });

    if (!userId || !otp) {
      return res.status(400).json({ message: "Missing OTP or userId" });
    }

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Stored OTP:", user.otp);
    console.log("OTP Expiry:", user.otpExpires, "Current Time:", Date.now());

    // Check if OTP exists and is NOT expired
    if (!user.otp || !user.otpExpires || Number(user.otpExpires) < Date.now()) {
      console.log("❌ OTP expired or missing");
      return res.status(400).json({ message: "OTP expired" });
    }

    // Compare OTP as string
    if (user.otp.toString().trim() !== otp.toString().trim()) {
      console.log("❌ Incorrect OTP");
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    // OTP is correct → Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Clear OTP after success
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    console.log("✅ OTP verified, token generated");

    return res.json({
      success: true,
      token
    });

  } catch (err) {
    console.error("OTP VERIFY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});





// ------------------------------------------------------
// FACE VERIFY (UPGRADED FOR MULTI-ACCOUNT MATCHING)
// ------------------------------------------------------
// router.post("/verify-face", async (req, res) => {
//   try {
//     const { embedding } = req.body;

//     const users = await User.find({ faceEmbedding: { $exists: true, $ne: [] } });

//     let bestUser = null;
//     let bestDist = 1.0;

//     for (const user of users) {
//       let diff = 0;
//       for (let i = 0; i < embedding.length; i++) {
//         diff += (embedding[i] - user.faceEmbedding[i]) ** 2;
//       }
//       diff = Math.sqrt(diff);

//       if (diff < bestDist) {
//         bestDist = diff;
//         bestUser = user;
//       }
//     }

//     if (!bestUser || bestDist > 0.53) {
//       return res.json({ success: false, message: "Face mismatch" });
//     }

//     // SUCCESS → Issue JWT
//     const token = jwt.sign(
//       { id: bestUser._id, email: bestUser.email },
//       JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.json({
//       success: true,
//       token,
//       userId: bestUser._id
//     });

//   } catch (err) {
//     console.error("FACE VERIFY ERROR:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });
router.post("/verify-face", async (req, res) => {
  try {
    const { userId, embedding } = req.body;

    if (!userId || !embedding) {
      return res.status(400).json({ success: false, message: "Missing userId or embedding" });
    }

    // Find ONLY the user who is doing login
    const user = await User.findById(userId);

    if (!user || !user.faceEmbedding || user.faceEmbedding.length === 0) {
      return res.status(404).json({ success: false, message: "Face not registered" });
    }

    // Calculate distance
    let diff = 0;
    for (let i = 0; i < embedding.length; i++) {
      diff += (embedding[i] - user.faceEmbedding[i]) ** 2;
    }
    diff = Math.sqrt(diff);

    const THRESHOLD = 0.53;

    if (diff > THRESHOLD) {
      return res.json({ success: false, message: "Face mismatch" });
    }

    // If matched → issue token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      userId: user._id
    });

  } catch (err) {
    console.error("FACE VERIFY ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ------------------------------------------------------
// SAVE FACE EMBEDDING (Face Registration)
// ------------------------------------------------------
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
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      message: "Face registered successfully"
    });

  } catch (err) {
    console.error("SAVE FACE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
