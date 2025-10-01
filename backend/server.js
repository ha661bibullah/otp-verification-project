const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();


// Temporary debug version - server.js এর শুরুতে যোগ করুন
console.log("=== Server Starting ===");
console.log("Node Version:", process.version);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("EMAIL_USER available:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASS available:", !!process.env.EMAIL_PASS);
console.log("=== Server Started ===");


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// Basic route for testing
app.get("/", (req, res) => {
  res.json({ 
    message: "OTP Server is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    service: "OTP Service",
    port: PORT
  });
});

// Email configuration (with fallback)
const getTransporter = () => {
  try {
    return nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } catch (error) {
    console.log("Transporter creation warning:", error.message);
    return null;
  }
};

// OTP storage
let otpStore = {};

// Send OTP endpoint
app.post("/send-otp", async (req, res) => {
  console.log("Send OTP request received:", req.body);
  
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: "Email is required" 
    });
  }

  // Check if email credentials are available
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email credentials missing - generating demo OTP");
    const demoOtp = Math.floor(100000 + Math.random() * 900000);
    
    otpStore[email] = {
      otp: demoOtp,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    return res.json({ 
      success: true, 
      message: "Demo OTP generated (email service not configured)",
      otp: demoOtp // Remove this in production
    });
  }

  const transporter = getTransporter();
  if (!transporter) {
    return res.status(500).json({ 
      success: false, 
      error: "Email service not available" 
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  
  otpStore[email] = {
    otp: otp,
    expiresAt: Date.now() + 5 * 60 * 1000
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
        </div>
      `,
    });

    console.log(`OTP sent to ${email}`);
    res.json({ 
      success: true, 
      message: "OTP sent successfully" 
    });
    
  } catch (err) {
    console.error("Email sending error:", err);
    
    // Fallback: return OTP directly if email fails
    res.json({ 
      success: true, 
      message: "OTP generated (email failed)",
      otp: otp // Remove this in production
    });
  }
});

// Verify OTP endpoint
app.post("/verify-otp", async (req, res) => {
  console.log("Verify OTP request received:", req.body);
  
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ 
      success: false, 
      error: "Email and OTP are required" 
    });
  }

  const storedData = otpStore[email];
  
  if (!storedData) {
    return res.json({ 
      success: false, 
      error: "OTP not found or expired" 
    });
  }

  if (Date.now() > storedData.expiresAt) {
    delete otpStore[email];
    return res.json({ 
      success: false, 
      error: "OTP has expired" 
    });
  }

  if (storedData.otp == otp) {
    delete otpStore[email];
    res.json({ 
      success: true, 
      message: "OTP verified successfully" 
    });
  } else {
    res.json({ 
      success: false, 
      error: "Invalid OTP" 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ 
    success: false, 
    error: "Internal server error" 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});