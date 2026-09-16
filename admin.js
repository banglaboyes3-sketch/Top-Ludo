const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./User');

// Admin Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
  res.json({ token });
});

// Middleware for admin
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (!decoded.isAdmin) return res.status(403).json({ message: 'Not admin' });
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all pending deposits
router.get('/deposits', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ 'depositRequests.status': 'pending' });
    const pending = [];
    users.forEach(u => {
      u.depositRequests.forEach((d, i) => {
        if (d.status === 'pending') {
          pending.push({
            userId: u._id,
            name: u.name,
            phone: u.phone,
            requestIndex: i,
            amount: d.amount,
            transactionId: d.transactionId,
            method: d.method,
            status: d.status,
            createdAt: d.createdAt
          });
        }
      });
    });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve / Reject Deposit
router.post('/deposit-action', adminAuth, async (req, res) => {
  try {
    const { userId, requestIndex, action } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const reqItem = user.depositRequests[requestIndex];
    if (!reqItem || reqItem.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (action === 'approve') {
      reqItem.status = 'approved';
      user.balance += reqItem.amount;
    } else {
      reqItem.status = 'rejected';
    }

    await user.save();
    res.json({ message: `Deposit ${action}d successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending withdraws
router.get('/withdraws', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ 'withdrawRequests.status': 'pending' });
    const pending = [];
    users.forEach(u => {
      u.withdrawRequests.forEach((w, i) => {
        if (w.status === 'pending') {
          pending.push({
            userId: u._id,
            name: u.name,
            phone: u.phone,
            balance: u.balance,
            requestIndex: i,
            amount: w.amount,
            accountNumber: w.accountNumber,
            method: w.method,
            status: w.status,
            createdAt: w.createdAt
          });
        }
      });
    });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve / Reject Withdraw
router.post('/withdraw-action', adminAuth, async (req, res) => {
  try {
    const { userId, requestIndex, action } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const reqItem = user.withdrawRequests[requestIndex];
    if (!reqItem || reqItem.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (action === 'approve') {
      if (user.balance < reqItem.amount) {
        return res.status(400).json({ message: 'User has insufficient balance' });
      }
      reqItem.status = 'approved';
      user.balance -= reqItem.amount;
    } else {
      reqItem.status = 'rejected';
    }

    await user.save();
    res.json({ message: `Withdraw ${action}d successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// All users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
