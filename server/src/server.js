const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Ensure DB is initialized
require('./db/database');

const { router: authRouter, requireAuth, requireMasterAuth } = require('./routes/auth');
const ticketsRouter = require('./routes/tickets');
const inventoryRouter = require('./routes/inventory');
const customersRouter = require('./routes/customers');
const techniciansRouter = require('./routes/technicians');
const invoicesRouter = require('./routes/invoices');
const dashboardRouter = require('./routes/dashboard');
const trackingRouter = require('./routes/tracking');
const settingsRouter = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Public Auth & Tracking Routes
app.use('/api/auth', authRouter);
app.use('/api/track', trackingRouter);

// Protected Internal Management Routes (require both master + staff auth)
app.use('/api/tickets', requireMasterAuth, requireAuth, ticketsRouter);
app.use('/api/inventory', requireMasterAuth, requireAuth, inventoryRouter);
app.use('/api/customers', requireMasterAuth, requireAuth, customersRouter);
app.use('/api/technicians', requireMasterAuth, requireAuth, techniciansRouter);
app.use('/api/invoices', requireMasterAuth, requireAuth, invoicesRouter);
app.use('/api/dashboard', requireMasterAuth, requireAuth, dashboardRouter);
app.use('/api/settings', requireMasterAuth, requireAuth, settingsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'SSC Computer Service Center Management System',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend client in production if built
const path = require('path');
const fs = require('fs');

const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('{*any}', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Central error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large. Maximum allowed size is 2MB.' });
  }
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected server error occurred'
      : (err.message || 'Server error')
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  SSC Service Center API Server running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
