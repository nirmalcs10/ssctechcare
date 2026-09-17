const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('./auth');

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/service_center.db');

// GET settings
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update settings (Admin only)
router.put('/', requireRole('admin'), (req, res) => {
  try {

    const { shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions } = req.body;

    db.prepare(`
      UPDATE settings SET
        shop_name = COALESCE(?, shop_name),
        shop_phone = COALESCE(?, shop_phone),
        shop_email = COALESCE(?, shop_email),
        shop_address = COALESCE(?, shop_address),
        tax_rate = COALESCE(?, tax_rate),
        currency_symbol = COALESCE(?, currency_symbol),
        terms_conditions = COALESCE(?, terms_conditions),
        updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions);

    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/system-stats - System health, storage, and record counts
router.get('/system-stats', (req, res) => {
  try {
    let dbSize = 0;
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size;
    }

    const tickets = db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
    const customers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
    const inventory = db.prepare('SELECT COUNT(*) as c FROM inventory').get().c;
    const invoices = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

    const localTimeRow = db.prepare("SELECT datetime('now', 'localtime') as t").get();

    res.json({
      dbSize,
      dbSizeBytes: dbSize,
      dbSizeFormatted: `${(dbSize / (1024 * 1024)).toFixed(2)} MB`,
      recordCounts: {
        tickets,
        customers,
        inventory,
        invoices,
        users
      },
      systemTime: {
        serverTime: new Date().toISOString(),
        localTime: localTimeRow ? localTimeRow.t : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      },
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: Math.round(process.memoryUsage().rss / (1024 * 1024)) + ' MB'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/backup - One-click live SQLite database file download (Admin only)
router.get('/backup', requireRole('admin'), async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../../data/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const tempExportPath = path.join(backupDir, `export_${Date.now()}.db`);

    // Use SQLite native online backup to create a pristine, 100% self-contained snapshot
    await db.backup(tempExportPath);

    const filename = `SSC_TechCare_Backup_${dateStr}.db`;
    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(tempExportPath);
    fileStream.pipe(res);
    fileStream.on('close', () => {
      try {
        if (fs.existsSync(tempExportPath)) fs.unlinkSync(tempExportPath);
      } catch (e) {}
    });
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ error: 'Failed to create database backup: ' + error.message });
  }
});

// POST /api/settings/restore - Upload and restore SQLite database (Admin only)
router.post('/restore', requireRole('admin'), express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  try {

    const fileBuffer = req.body;
    if (!fileBuffer || fileBuffer.length < 100) {
      return res.status(400).json({ error: 'Invalid or empty backup file.' });
    }

    // Validate SQLite 3 magic header: "SQLite format 3\0"
    const header = fileBuffer.slice(0, 16).toString('utf8');
    if (!header.startsWith('SQLite format 3')) {
      return res.status(400).json({ error: 'Uploaded file is not a valid SQLite 3 database backup.' });
    }

    const backupDir = path.join(__dirname, '../../data/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Step 1: Write uploaded file to a temporary file for verification
    const tempRestorePath = path.join(backupDir, `temp_restore_${Date.now()}.db`);
    fs.writeFileSync(tempRestorePath, fileBuffer);

    // Step 2: Validate database integrity and structure
    const Database = require('better-sqlite3');
    let tempDb = null;
    try {
      tempDb = new Database(tempRestorePath, { readonly: true });
      const check = tempDb.pragma('integrity_check');
      const isOk = check && check.length > 0 && check[0].integrity_check === 'ok';
      if (!isOk) {
        tempDb.close();
        if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
        return res.status(400).json({ error: 'Database integrity check failed. The backup file appears damaged.' });
      }

      // Check required tables exist
      const tables = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
      const requiredTables = ['users', 'settings', 'tickets', 'customers'];
      const missing = requiredTables.filter(t => !tables.includes(t));
      if (missing.length > 0) {
        tempDb.close();
        if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
        return res.status(400).json({ error: `Uploaded backup is missing required service center tables: ${missing.join(', ')}` });
      }
      tempDb.close();
    } catch (testErr) {
      if (tempDb) {
        try { tempDb.close(); } catch (e) {}
      }
      if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
      return res.status(400).json({ error: 'Invalid SQLite database file: ' + testErr.message });
    }

    // Step 3: Safety backup of current database
    const safetyBackupPath = path.join(backupDir, `prerestore_${Date.now()}.db.bak`);
    if (fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, safetyBackupPath);
      } catch (e) {
        console.warn('Warning creating pre-restore backup:', e.message);
      }
    }

    // Step 4: Close active connection and remove WAL/SHM so old transactions never overwrite restored state
    db.closeConnection();

    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) {
      try { fs.unlinkSync(walPath); } catch (e) { console.warn('Could not unlink WAL:', e.message); }
    }
    if (fs.existsSync(shmPath)) {
      try { fs.unlinkSync(shmPath); } catch (e) { console.warn('Could not unlink SHM:', e.message); }
    }

    // Step 5: Replace database file
    fs.copyFileSync(tempRestorePath, dbPath);
    try {
      fs.unlinkSync(tempRestorePath);
    } catch (e) {}

    // Step 6: Reopen connection to newly restored database and ensure all modern schemas exist (Bug 2.4 fix)
    db.reopenConnection();
    db.initDatabase();

    // Step 7: Preserve active Master Gateway session so the user is never locked out (Bug 2.4 fix)
    if (req.masterToken) {
      try {
        const masterAccount = (req.masterUser && req.masterUser.email)
          ? db.prepare('SELECT id FROM master_accounts WHERE email = ?').get(req.masterUser.email)
          : db.prepare('SELECT id FROM master_accounts WHERE is_active = 1 LIMIT 1').get();

        if (masterAccount) {
          db.prepare(`
            INSERT OR REPLACE INTO master_sessions (token, master_account_id, expires_at)
            VALUES (?, ?, datetime('now', '+30 days'))
          `).run(req.masterToken, masterAccount.id);
        }
      } catch (masterErr) {
        console.warn('Could not preserve master session in restored database:', masterErr.message);
      }
    }

    // Step 8: Preserve active Staff session token in restored user_sessions so admin stays logged in
    if (req.user && req.sessionToken) {
      try {
        const userInRestored = db.prepare('SELECT id FROM users WHERE username = ?').get(req.user.username);
        if (userInRestored) {
          db.prepare(`
            INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at)
            VALUES (?, ?, datetime('now', '+7 days'))
          `).run(req.sessionToken, userInRestored.id);
        }
      } catch (sessionErr) {
        console.warn('Could not preserve staff session in restored database:', sessionErr.message);
      }
    }

    // Step 9: Get fresh counts from restored database
    const ticketCount = db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
    const customerCount = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
    const invoiceCount = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;

    res.json({
      success: true,
      message: `Database successfully restored! Loaded ${ticketCount} tickets, ${customerCount} customers, and ${invoiceCount} invoices.`,
      restoredRecords: {
        tickets: ticketCount,
        customers: customerCount,
        invoices: invoiceCount
      }
    });
  } catch (error) {
    console.error('Restore error:', error);
    try {
      db.reopenConnection();
    } catch (e) {}
    res.status(500).json({ error: 'Database restore failed: ' + error.message });
  }
});

module.exports = router;
