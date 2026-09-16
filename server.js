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

const publicPath = path.join(__dirname, 'public');

console.log('Working dir:', __dirname);
console.log('Public path:', publicPath);
console.log('Public exists:', fs.existsSync(publicPath));
if (fs.existsSync(publicPath)) {
  console.log('Public files:', fs.readdirSync(publicPath));
}
console.log('Root files:', fs.readdirSync(__dirname));

app.use(express.static(publicPath));

try {
  const authRoutes = require('./auth');
  const adminRoutes = require('./admin');
  const walletRoutes = require('./wallet');
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/wallet', walletRoutes);
  console.log('API routes loaded');
} catch (e) {
  console.log('API routes error:', e.message);
}

app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send('<!DOCTYPE html><html><head><title>Top Ludo</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;background:#0a0a1a;color:#FFD700;text-align:center;padding:40px}</style></head><body><h1>Top Ludo</h1><p>Server is running</p><p><a href="/admin.html" style="color:#FFD700">Admin Panel</a></p><p><a href="/health" style="color:#aaa">Health Check</a></p></body></html>');
});

app.get('/admin', (req, res) => {
  const adminPath = path.join(publicPath, 'admin.html');
  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }
  res.status(404).send('admin.html not found. Check deploy files.');
});

app.get('/admin.html', (req, res) => {
  const adminPath = path.join(publicPath, 'admin.html');
  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }
  res.status(404).send('admin.html not found');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Top Ludo server is running',
    time: new Date().toISOString(),
    publicExists: fs.existsSync(publicPath),
    files: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : [],
    rootFiles: fs.readdirSync(__dirname)
  });
});

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
