const mongoose = require('mongoose');

const depositMethodSchema = new mongoose.Schema({
  name: { type: String, required: true },          // bKash, Nagad, Rocket etc.
  number: { type: String, required: true },        // Account / Wallet number
  logo: { type: String, default: '' },             // Logo image URL
  instructions: { type: String, default: '' },     // Optional note for users
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DepositMethod', depositMethodSchema);
