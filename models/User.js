const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },

  passwordHash: { type: String, required: true },

  // FACE
  faceRegistered: { type: Boolean, default: false },
  faceEmbedding: { type: Array, default: [] },

  // MULTIPLE WALLETS
  wallets: [
    {
      cipher: { type: [Number], required: true },
      iv: { type: [Number], required: true },
      label: { type: String, default: "My Wallet" },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
