const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch"); // install করতে হবে

require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { email: "your_verified_email@domain.com" },
        to: [{ email }],
        subject: "Your OTP Code",
        htmlContent: `<p>Your OTP is: <b>${otp}</b></p>`
      })
    });

    if (!response.ok) {
      throw new Error(`Brevo API Error: ${response.statusText}`);
    }

    res.json({ success: true, otp });
  } catch (err) {
    console.error("❌ Email Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
