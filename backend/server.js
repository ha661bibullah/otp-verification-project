const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

// OTP Storage (ডেমো জন্য, Production এ DB ব্যবহার করবেন)
let otpStore = {};

// Gmail Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
});

// OTP পাঠানোর রুট
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);

  otpStore[email] = otp; // ডেমো জন্য মেমোরিতে সংরক্ষণ

  try {
    await transporter.sendMail({
      from: `"OTP Login" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });

    res.json({ success: true, message: "OTP sent successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

// OTP যাচাই রুট
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (otpStore[email] && otpStore[email] == otp) {
    delete otpStore[email]; // OTP একবার ব্যবহারের পর মুছে দিন
    return res.json({ success: true, message: "OTP Verified! Login Success ✅" });
  }
  res.json({ success: false, message: "❌ Invalid OTP" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
