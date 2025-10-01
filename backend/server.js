const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - FIXED CORS
app.use(cors({
  origin: ['https://cerulean-basbousa-feb431.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Store OTPs temporarily
const otpStorage = new Map();

// Configure nodemailer transporter - IMPROVED VERSION
let transporter;

// Initialize transporter
const initializeTransporter = () => {
  try {
    transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Additional settings for better reliability
      pool: true,
      maxConnections: 1,
      maxMessages: 5
    });

    console.log('Transporter created successfully');
    
  } catch (error) {
    console.error('Failed to create transporter:', error);
  }
};

// Initialize on startup
initializeTransporter();

// Verify transporter on first use
const verifyTransporter = async () => {
  if (!transporter) {
    console.log('Transporter not initialized');
    return false;
  }
  
  try {
    await transporter.verify();
    console.log('Server is ready to send emails');
    return true;
  } catch (error) {
    console.log('Transporter verification failed:', error);
    return false;
  }
};

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email - IMPROVED VERSION
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Verify transporter before sending
    const isVerified = await verifyTransporter();
    if (!isVerified) {
      return res.status(500).json({
        success: false,
        message: 'Email service temporarily unavailable'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with timestamp (valid for 10 minutes)
    otpStorage.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    console.log(`OTP ${otp} generated for ${email}`);

    // Email options
    const mailOptions = {
      from: {
        name: 'OTP Verification System',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">OTP Verification</h2>
          <p>Your One-Time Password (OTP) for verification is:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `
    };

    // Send email with timeout
    const sendEmailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout')), 15000);
    });

    await Promise.race([sendEmailPromise, timeoutPromise]);
    
    console.log(`OTP sent successfully to ${email}`);
    
    res.json({
      success: true,
      message: 'OTP sent successfully to your email'
    });
    
  } catch (error) {
    console.error('Error sending OTP:', error);
    
    let errorMessage = 'Failed to send OTP. Please try again.';
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Email service timeout. Please try again.';
    } else if (error.message.includes('Invalid login')) {
      errorMessage = 'Email configuration error. Please contact support.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Verify OTP - UNCHANGED
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
    
    console.log(`OTP verified successfully for ${email}`);
    
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

// Clean up expired OTPs periodically (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [email, data] of otpStorage.entries()) {
    if (now > data.expiresAt) {
      otpStorage.delete(email);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired OTPs`);
  }
}, 30 * 60 * 1000);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    otpCount: otpStorage.size,
    emailConfigured: !!process.env.EMAIL_USER
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'OTP Verification Backend is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      sendOTP: 'POST /api/send-otp',
      verifyOTP: 'POST /api/verify-otp',
      health: 'GET /health'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email user: ${process.env.EMAIL_USER ? 'Set' : 'Not set'}`);
  
  // Verify transporter on startup
  setTimeout(() => {
    verifyTransporter();
  }, 2000);
});