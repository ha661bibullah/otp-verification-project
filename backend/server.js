const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// জিমেইল ট্রান্সপোর্টার সেটআপ
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'ha661bibullah@gmail.com', // আপনার জিমেইল
    pass: 'qaxf foiu zbin blbd' // জিমেইল অ্যাপ পাসওয়ার্ড
  }
});

// OTP স্টোর করার জন্য টেম্পোরারি স্টোরেজ
const otpStore = {};

// OTP জেনারেট করার রুট
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'ইমেইল প্রয়োজন' });
  }

  // ৬-অঙ্কের OTP জেনারেট করুন
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // OTP স্টোর করুন (৫ মিনিটের জন্য)
  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  };

  // ইমেইল অপশন
  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'আপনার OTP কোড',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #4285f4;">OTP ভেরিফিকেশন</h2>
        <p>আপনার OTP কোড নিচে দেওয়া হলো:</p>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
          ${otp}
        </div>
        <p>এই OTP কোড ৫ মিনিটের জন্য বৈধ থাকবে।</p>
        <p style="color: #5f6368; font-size: 14px;">যদি আপনি এই রিকোয়েস্ট না করে থাকেন, তাহলে এই ইমেইল উপেক্ষা করুন।</p>
      </div>
    `
  };

  try {
    // ইমেইল পাঠান
    await transporter.sendMail(mailOptions);
    res.json({ 
      success: true, 
      message: 'OTP ইমেইলে পাঠানো হয়েছে' 
    });
  } catch (error) {
    console.error('ইমেইল পাঠানোর সময় ত্রুটি:', error);
    res.status(500).json({ 
      error: 'OTP পাঠানো যায়নি' 
    });
  }
});

// OTP ভেরিফাই করার রুট
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ error: 'ইমেইল এবং OTP প্রয়োজন' });
  }

  const storedOtpData = otpStore[email];
  
  if (!storedOtpData) {
    return res.status(400).json({ error: 'OTP পাওয়া যায়নি বা সময় শেষ' });
  }

  if (Date.now() > storedOtpData.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ error: 'OTP সময় শেষ' });
  }

  if (storedOtpData.otp === otp) {
    delete otpStore[email];
    res.json({ 
      success: true, 
      message: 'OTP সফলভাবে ভেরিফাই হয়েছে' 
    });
  } else {
    res.status(400).json({ 
      error: 'ভুল OTP' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`সার্ভার চালু হয়েছে পোর্ট ${PORT}-এ`);
});