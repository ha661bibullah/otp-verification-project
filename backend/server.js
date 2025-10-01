const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Store OTPs temporarily (in production, use Redis or database)
const otpStorage = new Map();

// Configure nodemailer transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with timestamp (valid for 10 minutes)
    otpStorage.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">OTP Verification</h2>
          <p>Your One-Time Password (OTP) for verification is:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      message: 'OTP sent successfully to your email'
    });
    
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Check if OTP exists and is not expired
    const storedData = otpStorage.get(email);
    
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.'
      });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid - remove it from storage
    otpStorage.delete(email);
    
    res.json({
      success: true,
      message: 'OTP verified successfully!'
    });
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.'
    });
  }
});

// Clean up expired OTPs periodically (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStorage.entries()) {
    if (now > data.expiresAt) {
      otpStorage.delete(email);
    }
  }
}, 60 * 60 * 1000);

app.get('/', (req, res) => {
  res.json({ 
    message: 'OTP Verification Backend is running!',
    endpoints: {
      sendOTP: 'POST /api/send-otp',
      verifyOTP: 'POST /api/verify-otp'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});