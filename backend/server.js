const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// In-memory storage (Production-এ ডাটাবেস ব্যবহার করুন)
const otpStore = new Map();
const users = new Map();

// Nodemailer configuration - FIXED: createTransport instead of createTransporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
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
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Store OTP with expiration
    otpStore.set(email, {
      otp: await bcrypt.hash(otp, 10),
      expiresAt: expirationTime
    });

    // Email options
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your OTP for Login',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Login OTP</h2>
          <p>Your One-Time Password (OTP) for login is:</p>
          <div style="background: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully' 
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP' 
    });
  }
});

// Verify OTP and login
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    // Check if OTP exists and is not expired
    const storedData = otpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not found or expired' 
      });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, storedData.otp);
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    // OTP is valid - clear it and create session/token
    otpStore.delete(email);
    
    // In a real application, you would create a JWT token here
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store user session (in production, use Redis or database)
    users.set(sessionToken, { email, loggedInAt: new Date() });

    res.json({ 
      success: true, 
      message: 'Login successful',
      token: sessionToken,
      user: { email }
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify OTP' 
    });
  }
});

// Check authentication
app.get('/api/check-auth', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !users.has(token)) {
    return res.status(401).json({ 
      authenticated: false 
    });
  }
  
  const user = users.get(token);
  res.json({ 
    authenticated: true, 
    user 
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    users.delete(token);
  }
  
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

// Serve static files (frontend)
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Make sure your .env file has correct Gmail credentials`);
});