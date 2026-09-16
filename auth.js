const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('./User');

const otpStore = new Map();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTPEmail(email, otp) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.log('[DEV OTP] for', email, '=', otp);
    return { ok: true, dev: true, otp };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  await transporter.sendMail({
    from: `"Top Ludo" <${user}>`,
    to: email,
    subject: 'Top Ludo - Your OTP Code',
    text: `Your Top Ludo OTP is: ${otp}\n\nValid for 5 minutes.\nDo not share this code.`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;background:#0a0a1a;color:#fff;border-radius:12px;">
        <h2 style="color:#FFD700;text-align:center;">Top Ludo</h2>
        <p style="text-align:center;color:#aaa;">Your verification code</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;color:#FFD700;margin:24px 0;">${otp}</p>
        <p style="text-align:center;color:#888;font-size:13px;">Valid for 5 minutes. Do not share this code.</p>
      </div>
    `
  });

  return { ok: true };
}

router.post('/register-otp', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone || !email) {
      return res.status(400).json({ message: 'Name, phone and email are required' });
    }

    const emailLower = email.trim().toLowerCase();
    const existing = await User.findOne({ email: emailLower });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }

    const otp = generateOTP();
    otpStore.set(emailLower, {
      otp,
      name: name.trim(),
      phone: phone.trim(),
      type: 'register',
      expires: Date.now() + 5 * 60 * 1000
    });

    try {
      const result = await sendOTPEmail(emailLower, otp);
      const response = { message: 'OTP sent to your Gmail' };
      if (result.dev) {
        response.devOtp = otp;
        response.message = 'Email not configured. Use Dev OTP below.';
      }
      res.json(response);
    } catch (mailErr) {
      console.log('Email send failed:', mailErr.message);
      // Still allow testing with OTP in response if mail fails
      res.json({
        message: 'Email failed. Use Dev OTP (check spam or fix EMAIL_PASS).',
        devOtp: otp,
        error: mailErr.message
      });
    }
  } catch (error) {
    console.log('register-otp error:', error.message);
    res.status(500).json({ message: 'Failed: ' + error.message });
  }
});

router.post('/login-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailLower = email.trim().toLowerCase();
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({ message: 'No account found. Please register first.' });
    }

    const otp = generateOTP();
    otpStore.set(emailLower, {
      otp,
      type: 'login',
      expires: Date.now() + 5 * 60 * 1000
    });

    try {
      const result = await sendOTPEmail(emailLower, otp);
      const response = { message: 'OTP sent to your Gmail' };
      if (result.dev) {
        response.devOtp = otp;
        response.message = 'Email not configured. Use Dev OTP below.';
      }
      res.json(response);
    } catch (mailErr) {
      console.log('Email send failed:', mailErr.message);
      res.json({
        message: 'Email failed. Use Dev OTP.',
        devOtp: otp,
        error: mailErr.message
      });
    }
  } catch (error) {
    console.log('login-otp error:', error.message);
    res.status(500).json({ message: 'Failed: ' + error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const emailLower = email.trim().toLowerCase();
    const stored = otpStore.get(emailLower);

    if (!stored) {
      return res.status(400).json({ message: 'OTP expired or not found. Request a new one.' });
    }
    if (Date.now() > stored.expires) {
      otpStore.delete(emailLower);
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }
    if (String(stored.otp) !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    otpStore.delete(emailLower);

    let user;
    if (stored.type === 'register') {
      user = new User({
        name: stored.name,
        phone: stored.phone,
        email: emailLower
      });
      await user.save();
    } else {
      user = await User.findOne({ email: emailLower });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.json({
      message: stored.type === 'register' ? 'Registration successful' : 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (error) {
    console.log('verify-otp error:', error.message);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.userId).select('-depositRequests -withdrawRequests');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
