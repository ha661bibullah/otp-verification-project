const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// মিডলওয়্যার
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// OTP স্টোরেজ
const otpStore = new Map();

// Gmail ট্রান্সপোর্টার সেটআপ
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // আপনার জিমেইল
    pass: process.env.GMAIL_APP_PASSWORD // জিমেইল অ্যাপ পাসওয়ার্ড
  }
});

// OTP পাঠানোর রুট
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'ইমেইল প্রয়োজন' 
      });
    }

    // ৬-অঙ্কের OTP জেনারেট করুন
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // OTP স্টোর করুন (৫ মিনিটের জন্য)
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // ইমেইল অপশন
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'আপনার OTP কোড - লগইন সিস্টেম',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4285f4; text-align: center;">OTP ভেরিফিকেশন</h2>
          <p>আপনার OTP কোড নিচে দেওয়া হলো:</p>
          <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; margin: 20px 0; border-radius: 8px; color: #4285f4;">
            ${otp}
          </div>
          <p style="color: #666;">এই OTP কোড ৫ মিনিটের জন্য বৈধ থাকবে।</p>
          <p style="color: #999; font-size: 12px; text-align: center;">যদি আপনি এই রিকোয়েস্ট না করে থাকেন, তাহলে এই ইমেইল উপেক্ষা করুন।</p>
        </div>
      `
    };

    // ইমেইল পাঠান
    await transporter.sendMail(mailOptions);
    
    console.log(`OTP sent to ${email}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP ইমেইলে পাঠানো হয়েছে' 
    });
    
  } catch (error) {
    console.error('ইমেইল পাঠানোর সময় ত্রুটি:', error);
    res.status(500).json({ 
      success: false, 
      message: 'OTP পাঠানো যায়নি' 
    });
  }
});

// OTP ভেরিফাই করার রুট
app.post('/api/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'ইমেইল এবং OTP প্রয়োজন' 
      });
    }

    const storedOtpData = otpStore.get(email);
    
    if (!storedOtpData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP পাওয়া যায়নি বা সময় শেষ' 
      });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP সময় শেষ' 
      });
    }

    if (storedOtpData.otp === otp) {
      otpStore.delete(email);
      res.json({ 
        success: true, 
        message: 'OTP সফলভাবে ভেরিফাই হয়েছে' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'ভুল OTP' 
      });
    }
  } catch (error) {
    console.error('OTP ভেরিফিকেশন ত্রুটি:', error);
    res.status(500).json({ 
      success: false, 
      message: 'সার্ভার ত্রুটি' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`সার্ভার চালু হয়েছে: http://localhost:${PORT}`);
});