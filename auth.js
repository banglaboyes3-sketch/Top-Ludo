const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('./User');
const Settings = require('./Settings');

const otpStore = new Map();

// Check if Login & Signup is enabled by Admin
async function isAuthEnabled() {
  try {
    const setting = await Settings.findOne({ key: 'authEnabled' });
    if (!setting) return true; // default ON
    return setting.value === true || setting.value === 'true';
  } catch {
    return true;
  }
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Real OTP Email sender - faster timeout version
 */
async function sendOTPEmail(email, otp) {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '').replace(/["']/g, '');

  const allowDev = process.env.ALLOW_DEV_OTP === 'true';

  if (!user || !pass) {
    console.log('[OTP] EMAIL_USER or EMAIL_PASS is missing');
    if (allowDev) {
      console.log('[DEV OTP] Allowed. OTP for', email, '=', otp);
      return { ok: false, dev: true, otp, reason: 'EMAIL credentials missing (DEV mode)' };
    }
    throw new Error('Email system not configured. Please set EMAIL_USER and EMAIL_PASS in Environment Variables.');
  }

  console.log('[MAIL] Trying to send OTP to', email, 'from', user);

  // Port 587 is usually more reliable on Render / cloud hosts
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,          // true for 465, false for 587
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 8000,   // 8 seconds (faster fail)
    greetingTimeout: 8000,
    socketTimeout: 10000
  });

  try {
    await transporter.sendMail({
      from: `"Top Ludo" <${user}>`,
      to: email,
      subject: 'Top Ludo - Your OTP ' + otp,
      text: `Your Top Ludo OTP is: ${otp}\n\nThis OTP is valid for 5 minutes.\nDo not share it with anyone.`,
      html: `
        <div style="font-family:sans-serif;padding:24px;background:#0a0a1a;color:#fff;border-radius:12px;text-align:center;max-width:400px;margin:0 auto">
          <h2 style="color:#FFD700;margin:0 0 16px">Top Ludo</h2>
          <p style="margin:0 0 8px;color:#ccc">Your One-Time Password</p>
          <p style="font-size:36px;letter-spacing:10px;color:#FFD700;font-weight:bold;margin:16px 0">${otp}</p>
          <p style="color:#888;font-size:13px;margin:0">Valid for 5 minutes only</p>
        </div>
      `
    });

    console.log('[MAIL] OTP sent successfully to', email);
    return { ok: true };
  } catch (err) {
    console.error('[MAIL ERROR]', err.message);

    let friendly = 'Failed to send OTP email. Please try again.';
    if (err.message.includes('Invalid login') || err.message.includes('Username and Password not accepted') || err.message.includes('BadCredentials')) {
      friendly = 'Gmail login failed. Check EMAIL_USER and use a valid App Password.';
    } else if (err.message.includes('Less secure')) {
      friendly = 'Less secure apps blocked. Use Gmail App Password.';
    } else if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.message.includes('timeout') || err.message.includes('ECONNREFUSED')) {
      friendly = 'Could not connect to Gmail. Please try again in a few seconds.';
    }

    if (allowDev) {
      console.log('[DEV OTP] Email failed but DEV mode is on. OTP for', email, '=', otp);
      return { ok: false, dev: true, otp, reason: friendly };
    }

    throw new Error(friendly);
  }
}

// ====================== REGISTER OTP ======================
router.post('/register-otp', async (req, res) => {
  try {
    // Check Admin On/Off
    const enabled = await isAuthEnabled();
    if (!enabled) {
      return res.status(403).json({ message: 'Login & Signup is currently OFF by Admin. Please try later.' });
    }

    const { name, phone, email } = req.body;
    if (!name || !phone || !email) {
      return res.status(400).json({ message: 'Name, phone and email required' });
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

    const result = await sendOTPEmail(emailLower, otp);

    if (result.dev) {
      return res.json({
        message: 'DEV MODE: Email not working. Use the OTP below.',
        devOtp: result.otp
      });
    }

    res.json({ message: 'OTP sent to your Gmail. Check Inbox + Spam folder.' });
  } catch (error) {
    console.log('register-otp error:', error.message);
    res.status(500).json({ message: error.message || 'Failed to send OTP' });
  }
});

// ====================== LOGIN OTP ======================
router.post('/login-otp', async (req, res) => {
  try {
    // Check Admin On/Off
    const enabled = await isAuthEnabled();
    if (!enabled) {
      return res.status(403).json({ message: 'Login & Signup is currently OFF by Admin. Please try later.' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

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

    const result = await sendOTPEmail(emailLower, otp);

    if (result.dev) {
      return res.json({
        message: 'DEV MODE: Email not working. Use the OTP below.',
        devOtp: result.otp
      });
    }

    res.json({ message: 'OTP sent to your Gmail. Check Inbox + Spam folder.' });
  } catch (error) {
    console.log('login-otp error:', error.message);
    res.status(500).json({ message: error.message || 'Failed to send OTP' });
  }
});

// ====================== VERIFY OTP ======================
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP required' });
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
      if (!user) return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: error.message });
  }
});

// ====================== PROFILE ======================
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
