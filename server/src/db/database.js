const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'service_center.db');

let currentDb = new Database(dbPath);
currentDb.pragma('journal_mode = WAL');
currentDb.pragma('foreign_keys = ON');

function closeConnection() {
  if (currentDb && currentDb.open) {
    try {
      currentDb.close();
    } catch (err) {
      console.warn('Error closing database connection:', err.message);
    }
  }
}

function reopenConnection() {
  closeConnection();
  currentDb = new Database(dbPath);
  currentDb.pragma('journal_mode = WAL');
  currentDb.pragma('foreign_keys = ON');
  return currentDb;
}

const extraProps = {
  closeConnection,
  reopenConnection,
  initDatabase,
  dbPath,
  dbDir,
  hashPassword,
  verifyPassword,
  generateToken
};

const db = new Proxy(extraProps, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    if (prop === 'db') {
      return db;
    }
    const val = currentDb[prop];
    if (typeof val === 'function') {
      return val.bind(currentDb);
    }
    return val;
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});

function initDatabase() {
  const schema = `
    -- System Settings
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL DEFAULT 'SSC TechCare Computer Solutions',
      shop_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
      shop_email TEXT NOT NULL DEFAULT 'support@ssctechcare.com',
      shop_address TEXT NOT NULL DEFAULT 'Shop #12, First Floor, Silicon Arcade, Tech Park Road',
      tax_rate REAL DEFAULT 18.0,
      currency_symbol TEXT DEFAULT '₹',
      terms_conditions TEXT DEFAULT '1. Minimum diagnostic fee applies for all inspected equipment.\n2. SSC TechCare is not responsible for data loss. Please back up your data prior to service.\n3. Goods left uncollected beyond 30 days from completion date may incur storage charges or be liquidated to recover service costs.\n4. 30-day warranty on replaced hardware parts unless specified otherwise by manufacturer.',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      alt_phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Technicians
    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      specialization TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Inventory / Spare Parts
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand_compat TEXT,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      min_threshold INTEGER DEFAULT 3,
      location TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Repair Tickets
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      device_type TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT,
      device_password TEXT,
      accessories TEXT, -- JSON array
      physical_condition TEXT, -- JSON array
      inspection_checklist TEXT, -- JSON object
      problem_description TEXT NOT NULL,
      diagnosis_notes TEXT,
      internal_notes TEXT,
      priority TEXT DEFAULT 'Normal',
      status TEXT DEFAULT 'RECEIVED',
      technician_id INTEGER REFERENCES technicians(id),
      estimated_cost REAL DEFAULT 0,
      estimated_delivery TEXT,
      customer_approved INTEGER DEFAULT 0, -- 0: Pending, 1: Approved, -1: Rejected
      advance_paid REAL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      delivered_at DATETIME
    );

    -- Spare Parts Used in Repair Tickets
    CREATE TABLE IF NOT EXISTS ticket_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      inventory_id INTEGER REFERENCES inventory(id),
      part_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Ticket Activity / Timeline Audit Log
    CREATE TABLE IF NOT EXISTS timeline_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      actor TEXT DEFAULT 'Staff',
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Invoices & Billing
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      labor_charges REAL DEFAULT 0,
      parts_total REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      advance_deducted REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      payment_status TEXT DEFAULT 'Unpaid',
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- System Users / Authentication
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'technician', 'frontdesk'
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      last_login DATETIME
    );

    -- Active User Sessions
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- Master Accounts (Main Login - email + password gateway)
    CREATE TABLE IF NOT EXISTS master_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      last_login DATETIME
    );

    -- Master Sessions (Main Login sessions)
    CREATE TABLE IF NOT EXISTS master_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      master_account_id INTEGER NOT NULL REFERENCES master_accounts(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `;

  db.exec(schema);

  // Check if settings table has default row
  const hasSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (hasSettings.count === 0) {
    db.prepare('INSERT INTO settings (id) VALUES (1)').run();
  }

  // Seed initial users if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultUsers = [
      { username: 'admin', password: 'admin123', full_name: 'Administrator', role: 'admin' },
      { username: 'tech', password: 'tech123', full_name: 'Lead Technician', role: 'technician' },
      { username: 'staff', password: 'staff123', full_name: 'Front Desk Reception', role: 'frontdesk' }
    ];

    const insertTx = db.transaction(() => {
      for (const u of defaultUsers) {
        const { hash, salt } = hashPassword(u.password);
        insertUser.run(u.username, hash, salt, u.full_name, u.role);
      }
    });
    insertTx();
    console.log('✅ Default users initialized: admin, tech, staff');
  }

  // Seed initial master account if empty
  const masterCount = db.prepare('SELECT COUNT(*) as count FROM master_accounts').get();
  if (masterCount.count === 0) {
    const { hash, salt } = hashPassword('admin123');
    db.prepare(`
      INSERT INTO master_accounts (email, password_hash, salt, display_name)
      VALUES (?, ?, ?, ?)
    `).run('admin@ssctechcare.com', hash, salt, 'SSC TechCare Admin');
    console.log('✅ Default master account initialized: admin@ssctechcare.com / admin123');
  }
}

const crypto = require('crypto');

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

initDatabase();

module.exports = db;
