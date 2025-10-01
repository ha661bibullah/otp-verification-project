const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - সব domain থেকে request accept করতে
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Store OTPs temporarily
const otpStorage = new Map();

// Configure nodemailer transporter
let transporter;

function initializeTransporter() {
  try {
    console.log('Initializing email transporter...');
    console.log('Email User:', process.env.EMAIL_USER ? 'Set' : 'Not set');
    console.log('Email Pass:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Email credentials missing in environment variables');
      return;
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      debug: true, // debug mode enable
      logger: true
    });
    
    console.log('Transporter created successfully');
  } catch (error) {
    console.error('Failed to create transporter:', error.message);
  }
}

// Initialize transporter on startup
initializeTransporter();

// Verify transporter configuration
async function verifyTransporter() {
  if (!transporter) {
    console.log('Transporter not initialized - checking credentials...');
    initializeTransporter();
    return false;
  }
  
  try {
    await transporter.verify();
    console.log('Email service is ready to send emails');
    return true;
  } catch (error) {
    console.log('Email service not ready:', error.message);
    return false;
  }
}

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
app.post('/api/send-otp', async (req, res) => {
  console.log('📧 Send OTP request received:', req.body);
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if transporter is ready
    const isTransporterReady = await verifyTransporter();
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with timestamp (valid for 10 minutes)
    otpStorage.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    console.log(`✅ OTP ${otp} generated for ${email}`);
    console.log(`📊 Current OTP storage size: ${otpStorage.size}`);

    if (!isTransporterReady) {
      console.log('📨 Email service not available, but OTP generated:', otp);
      return res.json({
        success: true,
        message: 'OTP generated successfully (email service temporarily unavailable)',
        debug_otp: otp // Development only - remove in production
      });
    }

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
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log(`✅ OTP sent successfully to ${email}`);
    
    res.json({
      success: true,
      message: 'OTP sent successfully to your email'
    });
    
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
      error: error.message
    });
  }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  console.log('🔍 Verify OTP request received:', req.body);
  
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
      console.log(`❌ OTP not found for email: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.'
      });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(email);
      console.log(`❌ OTP expired for email: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    console.log(`🔍 Comparing: Input OTP: ${otp}, Stored OTP: ${storedData.otp}`);

    if (storedData.otp !== otp) {
      console.log(`❌ Invalid OTP for email: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid - remove it from storage
    otpStorage.delete(email);
    
    console.log(`✅ OTP verified successfully for ${email}`);
    
    res.json({
      success: true,
      message: 'OTP verified successfully!'
    });
    
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
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
    console.log(`🧹 Cleaned up ${cleanedCount} expired OTPs`);
  }
}, 30 * 60 * 1000);

// Health check endpoint with detailed status
app.get('/health', async (req, res) => {
  const emailStatus = await verifyTransporter();
  
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    otpCount: otpStorage.size,
    emailService: emailStatus ? 'Operational' : 'Not Working',
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'OTP Verification Backend is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      sendOTP: 'POST /api/send-otp',
      verifyOTP: 'POST /api/verify-otp',
      health: 'GET /health'
    },
    status: 'active'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedUrl: req.originalUrl
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server starting...');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email user: ${process.env.EMAIL_USER ? 'Set' : 'Not set'}`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);
  console.log('✅ Server is running successfully!');
});