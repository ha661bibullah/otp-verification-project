// server.js
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// স্টোর OTPs
const otpStore = {};

// OTP পাঠানোর এন্ডপয়েন্ট
app.post('/send-otp', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'ইমেইল প্রয়োজন' });
    }
    
    // OTP জেনারেট করুন
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;
    
    console.log(`OTP for ${email}: ${otp}`);
    
    res.json({ 
        success: true, 
        message: 'OTP জেনারেট করা হয়েছে',
        otp: otp // ডেমোর জন্য
    });
});

// OTP ভেরিফাই করার এন্ডপয়েন্ট
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ error: 'ইমেইল এবং OTP প্রয়োজন' });
    }
    
    if (otpStore[email] === otp) {
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
    console.log(`সার্ভার চালু হয়েছে: http://localhost:${PORT}`);
});