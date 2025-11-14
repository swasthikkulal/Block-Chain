require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoute = require("./routes/auth");
const walletRoutes = require("./routes/wallet");


const app = express();

app.use(express.json());
app.use(cors());

// API routes
app.use("/api", authRoute);
app.use("/api/wallet", walletRoutes);

// test
app.get("/", (req, res) => {
    res.send("Backend Working ✔️");
});

// connect Mongo
mongoose
    .connect("mongodb://127.0.0.1:27017/blockchain")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error(err));

app.listen(5000, () => console.log("Server running on port 5000"));
