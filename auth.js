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
  let user = (process.env.EMAIL_USER || '').trim();
  let pass = (process.env.EMAIL_PASS || '').replace(/\s/g, '').replace(/"/g, '');

  if (!user || !pass) {
    console.log('[DEV OTP] EMAIL not set. OTP for', email, '=', otp);
    return { ok: false, dev: true, otp, reason: 'EMAIL_USER or EMAIL_PASS missing' };
  }

  console.log('[MAIL] Sending OTP to', email, 'from', user);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000
  });

  await transporter.sendMail({
    from: `"Top Ludo" <${user}>`,
    to: email,
    subject: 'Top Ludo - OTP ' + otp,
    text: 'Your Top Ludo OTP is: ' + otp + '\n\nValid for 5 minutes.',
    html: '<div style="font-family:sans-serif;padding:20px;background:#0a0a1a;color:#fff;border-radius:12px;text-align:center"><h2 style="color:#FFD700">Top Ludo</h2><p style="font-size:36px;letter-spacing:8px;color:#FFD700;font-weight:bold">' + otp + '</p><p style="color:#888">Valid 5 minutes</p></div>'
  });

  console.log('[MAIL] Sent OK to', email);
  return { ok: true };
}

router.post('/register-otp', async (req, res) => {
  try {
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

    try {
      const result = await sendOTPEmail(emailLower, otp);
      if (result.dev) {
        return res.json({
          message: 'Email not configured. Use OTP shown below.',
          devOtp: otp
        });
      }
      res.json({ message: 'OTP sent to your Gmail. Check Inbox + Spam.' });
    } catch (mailErr) {
      console.log('[MAIL ERROR]', mailErr.message);
      // Allow continue with on-screen OTP
      res.json({
        message: 'Email send failed. Use OTP below to continue.',
        devOtp: otp,
        error: mailErr.message
      });
    }
  } catch (error) {
    console.log('register-otp error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/login-otp', async (req, res) => {
  try {
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

    try {
      const result = await sendOTPEmail(emailLower, otp);
      if (result.dev) {
        return res.json({ message: 'Email not configured. Use OTP below.', devOtp: otp });
      }
      res.json({ message: 'OTP sent to your Gmail. Check Inbox + Spam.' });
    } catch (mailErr) {
      console.log('[MAIL ERROR]', mailErr.message);
      res.json({
        message: 'Email send failed. Use OTP below.',
        devOtp: otp,
        error: mailErr.message
      });
    }
  } catch (error) {
    console.log('login-otp error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP required' });
    }

    const emailLower = email.trim().toLowerCase();
    const stored = otpStore.get(emailLower);

    if (!stored) {
      return res.status(400).json({ message: 'OTP expired. Request new one.' });
    }
    if (Date.now() > stored.expires) {
      otpStore.delete(emailLower);
      return res.status(400).json({ message: 'OTP expired. Request new one.' });
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
