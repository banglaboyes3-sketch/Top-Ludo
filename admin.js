const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./User');
const DepositMethod = require('./DepositMethod');
const Settings = require('./Settings');

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

// ====================== DEPOSIT SETTINGS ======================

// Get all deposit methods
router.get('/deposit-methods', adminAuth, async (req, res) => {
  try {
    const methods = await DepositMethod.find().sort({ createdAt: -1 });
    res.json(methods);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new deposit method
router.post('/deposit-methods', adminAuth, async (req, res) => {
  try {
    const { name, number, logo, instructions, isActive } = req.body;
    if (!name || !number) {
      return res.status(400).json({ message: 'Name and Number are required' });
    }
    const method = new DepositMethod({
      name: name.trim(),
      number: number.trim(),
      logo: (logo || '').trim(),
      instructions: (instructions || '').trim(),
      isActive: isActive !== false
    });
    await method.save();
    res.json({ message: 'Deposit method added successfully', method });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update deposit method
router.put('/deposit-methods/:id', adminAuth, async (req, res) => {
  try {
    const { name, number, logo, instructions, isActive } = req.body;
    const method = await DepositMethod.findById(req.params.id);
    if (!method) return res.status(404).json({ message: 'Method not found' });

    if (name) method.name = name.trim();
    if (number) method.number = number.trim();
    if (logo !== undefined) method.logo = (logo || '').trim();
    if (instructions !== undefined) method.instructions = (instructions || '').trim();
    if (isActive !== undefined) method.isActive = isActive;

    await method.save();
    res.json({ message: 'Deposit method updated successfully', method });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete deposit method
router.delete('/deposit-methods/:id', adminAuth, async (req, res) => {
  try {
    const method = await DepositMethod.findByIdAndDelete(req.params.id);
    if (!method) return res.status(404).json({ message: 'Method not found' });
    res.json({ message: 'Deposit method deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ====================== AUTH SYSTEM ON/OFF ======================

// Get auth status (Login & Signup)
router.get('/auth-status', adminAuth, async (req, res) => {
  try {
    let setting = await Settings.findOne({ key: 'authEnabled' });
    if (!setting) {
      // Default ON
      setting = await Settings.create({ key: 'authEnabled', value: true });
    }
    res.json({ authEnabled: setting.value === true || setting.value === 'true' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update auth status (Login & Signup On/Off)
router.post('/auth-status', adminAuth, async (req, res) => {
  try {
    const { authEnabled } = req.body;
    let setting = await Settings.findOne({ key: 'authEnabled' });
    if (!setting) {
      setting = new Settings({ key: 'authEnabled', value: !!authEnabled });
    } else {
      setting.value = !!authEnabled;
    }
    await setting.save();
    res.json({
      message: authEnabled ? 'Login & Signup is now ON' : 'Login & Signup is now OFF',
      authEnabled: !!authEnabled
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
