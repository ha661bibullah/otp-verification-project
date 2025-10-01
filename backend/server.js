const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

// উন্নত Nodemailer কনফিগারেশন
const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // রেটার্ন কোড যোগ করুন
  tls: {
    rejectUnauthorized: false
  }
});

// OTP স্টোর করার জন্য (প্রোডাকশনে Redis/MongoDB ব্যবহার করুন)
let otpStore = {};

// OTP পাঠানোর API
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  
  // OTP সংরক্ষণ (5 মিনিটের জন্য)
  otpStore[email] = {
    otp: otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  };

  try {
    await transporter.sendMail({
      from: `"OTP Service" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your OTP Code</h2>
          <p style="font-size: 16px;">Use the following OTP to complete your login:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; margin: 20px 0;">
            <h1 style="margin: 0; color: #333; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p style="font-size: 14px; color: #666;">This OTP will expire in 5 minutes.</p>
          <p style="font-size: 12px; color: #999;">If you didn't request this OTP, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`OTP sent to ${email}: ${otp}`);
    res.json({ success: true, message: "OTP sent successfully" });
    
  } catch (err) {
    console.error("Email sending error:", err);
    
    // বিস্তারিত error handling
    let errorMessage = "Failed to send OTP";
    if (err.code === 'EAUTH') {
      errorMessage = "Email authentication failed. Check your credentials.";
    } else if (err.code === 'EENVELOPE') {
      errorMessage = "Invalid email address";
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// OTP verify API
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: "Email and OTP are required" });
  }

  const storedData = otpStore[email];
  
  if (!storedData) {
    return res.json({ success: false, error: "OTP not found or expired" });
  }

  // OTP এক্সপায়ারি চেক
  if (Date.now() > storedData.expiresAt) {
    delete otpStore[email];
    return res.json({ success: false, error: "OTP has expired" });
  }

  if (storedData.otp == otp) {
    delete otpStore[email]; // OTP ব্যবহার হয়ে গেলে ডিলিট করুন
    res.json({ success: true, message: "OTP verified successfully" });
  } else {
    res.json({ success: false, error: "Invalid OTP" });
  }
});

// হেলথ চেক এন্ডপয়েন্ট
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    service: "OTP Service"
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.EMAIL_USER ? "Configured" : "Not configured"}`);
});