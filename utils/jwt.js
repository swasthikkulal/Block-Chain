const jwt = require("jsonwebtoken");

const JWT_SECRET = "SUPER_SECRET_KEY_CHANGE_THIS"; // put in .env later
const EXPIRES_IN = "7d"; // token valid for 7 days

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
