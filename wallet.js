const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./User');

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Request Deposit
router.post('/deposit', auth, async (req, res) => {
  try {
    const { amount, transactionId, method } = req.body;
    if (!amount || amount < 10) {
      return res.status(400).json({ message: 'Minimum deposit is 10' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.depositRequests.push({
      amount,
      transactionId: transactionId || '',
      method: method || 'bkash',
      status: 'pending'
    });

    await user.save();
    res.json({ message: 'Deposit request submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request Withdraw
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, accountNumber, method } = req.body;
    if (!amount || amount < 50) {
      return res.status(400).json({ message: 'Minimum withdraw is 50' });
    }
    if (!accountNumber) {
      return res.status(400).json({ message: 'Account number is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.withdrawRequests.push({
      amount,
      accountNumber,
      method: method || 'bkash',
      status: 'pending'
    });

    await user.save();
    res.json({ message: 'Withdraw request submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('balance');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
