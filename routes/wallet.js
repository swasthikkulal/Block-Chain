const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

// -----------------------------------------------
// SAVE ENCRYPTED WALLET TO SERVER
// -----------------------------------------------
// SAVE NEW WALLET (PUSH INTO ARRAY)
router.post("/save", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cipher, iv, label } = req.body;

    if (!cipher || !iv) {
      return res.status(400).json({ message: "Missing encrypted data" });
    }

    const walletObject = {
      cipher,
      iv,
      label: label || "My Wallet",
      createdAt: new Date()
    };

    const updated = await User.findByIdAndUpdate(
      userId,
      { $push: { wallets: walletObject } },
      { new: true }
    );

    res.json({
      message: "Wallet saved successfully!",
      wallets: updated.wallets
    });

  } catch (err) {
    console.error("SAVE WALLET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// -----------------------------------------------
// GET ENCRYPTED WALLET (FOR DASHBOARD UNLOCK)
// -----------------------------------------------
router.get("/encrypted", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("encryptedSeed encryptedSeedCreatedAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.encryptedSeed) {
      return res.status(404).json({ message: "No wallet stored" });
    }

    return res.json({
      encryptedSeed: user.encryptedSeed,
      createdAt: user.encryptedSeedCreatedAt
    });

  } catch (err) {
    console.error("GET WALLET ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------------------------
// DELETE WALLET (OPTIONAL)
// -----------------------------------------------
router.delete("/delete", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await User.findByIdAndUpdate(
      userId,
      { $unset: { encryptedSeed: "", encryptedSeedCreatedAt: "" } }
    );

    return res.json({ message: "Wallet removed" });

  } catch (err) {
    console.error("DELETE WALLET ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/all", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("wallets");

    res.json({ wallets: user.wallets });
  } catch (err) {
    console.error("GET WALLETS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:index", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const index = req.params.index;

    const user = await User.findById(userId).select("wallets");

    if (!user.wallets[index]) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json({ wallet: user.wallets[index] });

  } catch (err) {
    console.error("GET WALLET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
