require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('Working dir:', __dirname);
console.log('Root files:', fs.readdirSync(__dirname));

// Serve static from root (index.html, admin.html are here)
app.use(express.static(__dirname));

// Also try public folder if it exists
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log('Public folder found');
}

// API routes
try {
  app.use('/api/auth', require('./auth'));
  app.use('/api/admin', require('./admin'));
  app.use('/api/wallet', require('./wallet'));
  console.log('API routes loaded');
} catch (e) {
  console.log('API routes error:', e.message);
}

function sendHtml(res, filename) {
  // Try root first, then public/
  const rootPath = path.join(__dirname, filename);
  const pubPath = path.join(__dirname, 'public', filename);
  if (fs.existsSync(rootPath)) {
    return res.sendFile(rootPath);
  }
  if (fs.existsSync(pubPath)) {
    return res.sendFile(pubPath);
  }
  return res.status(404).send(filename + ' not found. Files: ' + fs.readdirSync(__dirname).join(', '));
}

// Main page
app.get('/', (req, res) => sendHtml(res, 'index.html'));

// Admin panel
app.get('/admin', (req, res) => sendHtml(res, 'admin.html'));
app.get('/admin.html', (req, res) => sendHtml(res, 'admin.html'));

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Top Ludo server is running',
    time: new Date().toISOString(),
    rootFiles: fs.readdirSync(__dirname).filter(f => !f.startsWith('.') && f !== 'node_modules')
  });
});

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || '';
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('MongoDB error:', err.message));
} else {
  console.log('No MONGODB_URI set');
}

app.listen(PORT, () => {
  console.log('Top Ludo server running on port ' + PORT);
});
