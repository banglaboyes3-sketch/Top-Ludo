const mongoose = require('mongoose');

const depositRequestSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  transactionId: { type: String },
  method: { type: String, default: 'bkash' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const withdrawRequestSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  accountNumber: { type: String, required: true },
  method: { type: String, default: 'bkash' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  balance: { type: Number, default: 0 },
  depositRequests: [depositRequestSchema],
  withdrawRequests: [withdrawRequestSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
