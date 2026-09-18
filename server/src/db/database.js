const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Try requiring PostgreSQL
let pgModule = null;
try {
  pgModule = require('pg');
  // Automatically parse PostgreSQL BIGINT and NUMERIC
  pgModule.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
  pgModule.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
} catch (e) {
  // pg not available
}

// Active database engine: 'postgres' | 'sqlite'
let activeEngine = null;
let pgPool = null;
let sqliteDb = null;

// Initial state tracking
let initPromise = null;

// Password hashing & security helpers
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

// Helper to normalize parameters: handles single array or spread arguments
function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

// Convert SQLite ?, @named or PostgreSQL $1, $2 to target dialect
function formatPostgresQuery(sql, params = []) {
  let values = [];
  let formattedSql = sql;

  const namedMatches = [...sql.matchAll(/@(\w+)/g)];
  if (namedMatches.length > 0 && params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0]) && params[0] !== null) {
    const obj = params[0];
    let i = 1;
    formattedSql = sql.replace(/@(\w+)/g, (match, key) => {
      values.push(obj[key] !== undefined ? obj[key] : null);
      return `$${i++}`;
    });
  } else {
    values = normalizeParams(params);
    let i = 1;
    formattedSql = sql.replace(/\?/g, () => `$${i++}`);
  }

  return { sql: formattedSql, values };
}

function formatSqliteQuery(sql, params = []) {
  let formattedSql = sql
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');

  let values = [];
  const namedMatches = [...formattedSql.matchAll(/@(\w+)/g)];
  if (namedMatches.length > 0 && params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0]) && params[0] !== null) {
    const obj = params[0];
    formattedSql = formattedSql.replace(/@(\w+)/g, (match, key) => {
      values.push(obj[key] !== undefined ? obj[key] : null);
      return '?';
    });
  } else {
    values = normalizeParams(params);
    // Convert $1, $2 to ? for SQLite
    formattedSql = formattedSql.replace(/\$\d+/g, '?');
  }

  return { sql: formattedSql, values };
}

// Unified Database Interface
async function query(text, params = []) {
  await ensureInitialized();

  if (activeEngine === 'postgres') {
    const { sql, values } = formatPostgresQuery(text, params);
    return pgPool.query(sql, values);
  } else {
    const { sql, values } = formatSqliteQuery(text, params);
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH')) {
      const stmt = sqliteDb.prepare(sql);
      const rows = stmt.all(...values);
      return { rows, rowCount: rows.length };
    } else {
      const stmt = sqliteDb.prepare(sql);
      const info = stmt.run(...values);
      return { rows: [], rowCount: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
    }
  }
}

async function get(text, params = []) {
  await ensureInitialized();

  if (activeEngine === 'postgres') {
    const { sql, values } = formatPostgresQuery(text, params);
    const res = await pgPool.query(sql, values);
    return res.rows[0] || null;
  } else {
    const { sql, values } = formatSqliteQuery(text, params);
    const stmt = sqliteDb.prepare(sql);
    const row = stmt.get(...values);
    return row || null;
  }
}

async function all(text, params = []) {
  await ensureInitialized();

  if (activeEngine === 'postgres') {
    const { sql, values } = formatPostgresQuery(text, params);
    const res = await pgPool.query(sql, values);
    return res.rows;
  } else {
    const { sql, values } = formatSqliteQuery(text, params);
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...values);
  }
}

async function run(text, params = []) {
  await ensureInitialized();

  if (activeEngine === 'postgres') {
    let { sql, values } = formatPostgresQuery(text, params);
    const isInsert = /^\s*insert\s+into\s+/i.test(sql);
    const hasReturning = /returning\s+/i.test(sql);
    if (isInsert && !hasReturning) {
      sql += ' RETURNING id';
    }

    const res = await pgPool.query(sql, values);
    return {
      lastInsertRowid: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null,
      rowCount: res.rowCount,
      changes: res.rowCount
    };
  } else {
    const { sql, values } = formatSqliteQuery(text, params);
    const stmt = sqliteDb.prepare(sql);
    const res = stmt.run(...values);
    return {
      lastInsertRowid: Number(res.lastInsertRowid),
      rowCount: res.changes,
      changes: res.changes
    };
  }
}

function prepare(sql) {
  return {
    get: async (...args) => get(sql, args),
    all: async (...args) => all(sql, args),
    run: async (...args) => run(sql, args)
  };
}

async function transaction(fn) {
  await ensureInitialized();

  if (activeEngine === 'postgres') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        query: (text, params) => {
          const { sql, values } = formatPostgresQuery(text, params);
          return client.query(sql, values);
        },
        prepare: (text) => ({
          get: async (...args) => {
            const { sql, values } = formatPostgresQuery(text, args);
            const res = await client.query(sql, values);
            return res.rows[0] || null;
          },
          all: async (...args) => {
            const { sql, values } = formatPostgresQuery(text, args);
            const res = await client.query(sql, values);
            return res.rows;
          },
          run: async (...args) => {
            let { sql, values } = formatPostgresQuery(text, args);
            const isInsert = /^\s*insert\s+into\s+/i.test(sql);
            const hasReturning = /returning\s+/i.test(sql);
            if (isInsert && !hasReturning) sql += ' RETURNING id';
            const res = await client.query(sql, values);
            return {
              lastInsertRowid: res.rows && res.rows[0]?.id ? res.rows[0].id : null,
              rowCount: res.rowCount,
              changes: res.rowCount
            };
          }
        })
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    sqliteDb.exec('BEGIN TRANSACTION');
    try {
      const tx = {
        query: async (text, params) => query(text, params),
        prepare: (text) => prepare(text)
      };
      const result = await fn(tx);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      sqliteDb.exec('ROLLBACK');
      throw err;
    }
  }
}

// Schemas
const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    shop_name TEXT NOT NULL DEFAULT 'SSC TechCare Computer Solutions',
    shop_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
    shop_email TEXT NOT NULL DEFAULT 'support@ssctechcare.com',
    shop_address TEXT NOT NULL DEFAULT 'Shop #12, First Floor, Silicon Arcade, Tech Park Road',
    tax_rate REAL DEFAULT 18.0,
    currency_symbol TEXT DEFAULT '₹',
    terms_conditions TEXT DEFAULT '1. Minimum diagnostic fee applies for all inspected equipment.\n2. SSC TechCare is not responsible for data loss. Please back up your data prior to service.\n3. Goods left uncollected beyond 30 days from completion date may incur storage charges or be liquidated to recover service costs.\n4. 30-day warranty on replaced hardware parts unless specified otherwise by manufacturer.',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    alt_phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS technicians (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    specialization TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand_compat TEXT,
    cost_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_threshold INTEGER DEFAULT 3,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    serial_number TEXT,
    device_password TEXT,
    accessories TEXT,
    physical_condition TEXT,
    inspection_checklist TEXT,
    problem_description TEXT NOT NULL,
    diagnosis_notes TEXT,
    internal_notes TEXT,
    priority TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'RECEIVED',
    technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
    estimated_cost REAL DEFAULT 0,
    estimated_delivery TEXT,
    customer_approved INTEGER DEFAULT 0,
    advance_paid REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS ticket_parts (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    part_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timeline_logs (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    actor TEXT DEFAULT 'Staff',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS master_accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS master_sessions (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    master_account_id INTEGER NOT NULL REFERENCES master_accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
  CREATE UNIQUE INDEX IF NOT EXISTS master_accounts_email_lower_idx ON master_accounts (LOWER(email));
`;

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT NOT NULL DEFAULT 'SSC TechCare Computer Solutions',
    shop_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
    shop_email TEXT NOT NULL DEFAULT 'support@ssctechcare.com',
    shop_address TEXT NOT NULL DEFAULT 'Shop #12, First Floor, Silicon Arcade, Tech Park Road',
    tax_rate REAL DEFAULT 18.0,
    currency_symbol TEXT DEFAULT '₹',
    terms_conditions TEXT DEFAULT '1. Minimum diagnostic fee applies for all inspected equipment.\n2. SSC TechCare is not responsible for data loss. Please back up your data prior to service.\n3. Goods left uncollected beyond 30 days from completion date may incur storage charges or be liquidated to recover service costs.\n4. 30-day warranty on replaced hardware parts unless specified otherwise by manufacturer.',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    alt_phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    specialization TEXT,
    status TEXT DEFAULT 'Active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    serial_number TEXT,
    device_password TEXT,
    accessories TEXT,
    physical_condition TEXT,
    inspection_checklist TEXT,
    problem_description TEXT NOT NULL,
    diagnosis_notes TEXT,
    internal_notes TEXT,
    priority TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'RECEIVED',
    technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
    estimated_cost REAL DEFAULT 0,
    estimated_delivery TEXT,
    customer_approved INTEGER DEFAULT 0,
    advance_paid REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ticket_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    part_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timeline_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    actor TEXT DEFAULT 'Staff',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS master_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS master_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    master_account_id INTEGER NOT NULL REFERENCES master_accounts(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
  CREATE UNIQUE INDEX IF NOT EXISTS master_accounts_email_lower_idx ON master_accounts (LOWER(email));
`;

// Seed default rows if tables are empty
async function seedDefaults() {
  const settingsRow = await get('SELECT COUNT(*) as c FROM settings');
  if (parseInt(settingsRow.c, 10) === 0) {
    await run('INSERT INTO settings (id) VALUES (1)');
  }

  const usersCount = await get('SELECT COUNT(*) as c FROM users');
  if (parseInt(usersCount.c, 10) === 0) {
    const defaultUsers = [
      { username: 'admin', password: 'admin123', full_name: 'Administrator', role: 'admin' },
      { username: 'tech', password: 'tech123', full_name: 'Lead Technician', role: 'technician' },
      { username: 'staff', password: 'staff123', full_name: 'Front Desk Reception', role: 'frontdesk' }
    ];

    for (const u of defaultUsers) {
      const { hash, salt } = hashPassword(u.password);
      await run(
        'INSERT INTO users (username, password_hash, salt, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [u.username, hash, salt, u.full_name, u.role]
      );
    }
    console.log('✔ Initialized default staff accounts: admin, tech, staff');
  }

  const defaultMasterAccounts = [
    { email: 'admin@ssctechcare.com', password: 'admin123', display_name: 'SSC TechCare Admin' },
    { email: 'nirmalaws10@gmail.com', password: '071825', display_name: 'Nirmal Gateway Admin' }
  ];

  for (const m of defaultMasterAccounts) {
    const existing = await get('SELECT id, password_hash, salt FROM master_accounts WHERE LOWER(email) = LOWER(?)', [m.email]);
    if (!existing) {
      const { hash, salt } = hashPassword(m.password);
      await run(
        'INSERT INTO master_accounts (email, password_hash, salt, display_name) VALUES (?, ?, ?, ?)',
        [m.email, hash, salt, m.display_name]
      );
      console.log(`✔ Initialized default master gateway account: ${m.email}`);
    } else {
      // Ensure configured default credentials match in active database
      const isValid = verifyPassword(m.password, existing.password_hash, existing.salt);
      if (!isValid) {
        const { hash, salt } = hashPassword(m.password);
        await run('UPDATE master_accounts SET password_hash = ?, salt = ?, is_active = 1 WHERE id = ?', [hash, salt, existing.id]);
        console.log(`✔ Updated master gateway account password: ${m.email}`);
      }
    }
  }

  // Seed default technicians
  const techCount = await get('SELECT COUNT(*) as c FROM technicians');
  if (parseInt(techCount.c, 10) === 0) {
    const defaultTechs = [
      ['Amit Sharma', '+91 98230 11223', 'amit@ssctechcare.com', 'Chip Level / Motherboard & Micro-soldering', 'Active'],
      ['Rajesh Varma', '+91 98450 33445', 'rajesh@ssctechcare.com', 'Display Panels, Hinges & Body Fabrication', 'Active'],
      ['Priya Nair', '+91 98710 55667', 'priya@ssctechcare.com', 'Storage Upgrades, OS & Data Recovery', 'Active'],
      ['Karan Patel', '+91 98990 77889', 'karan@ssctechcare.com', 'Gaming Rigs, Thermals & PSU Diagnostics', 'Active']
    ];
    for (const t of defaultTechs) {
      await run('INSERT INTO technicians (name, phone, email, specialization, status) VALUES (?, ?, ?, ?, ?)', t);
    }
    console.log('✔ Initialized default technicians');
  }

  // Seed default inventory
  const invCount = await get('SELECT COUNT(*) as c FROM inventory');
  if (parseInt(invCount.c, 10) === 0) {
    const defaultInv = [
      ['RAM-D4-8GB', 'Crucial 8GB DDR4 3200MHz SODIMM Laptop RAM', 'RAM', 'Universal (Dell, HP, Lenovo, Acer)', 1200, 1850, 14, 4, 'Bin A-1'],
      ['RAM-D4-16GB', 'Kingston Fury 16GB DDR4 3200MHz SODIMM Laptop RAM', 'RAM', 'Universal', 2400, 3400, 8, 3, 'Bin A-2'],
      ['SSD-NVME-500', 'Crucial P3 500GB M.2 NVMe PCIe 3.0 SSD', 'Storage', 'Universal M.2', 2200, 3200, 12, 5, 'Bin B-1'],
      ['SSD-NVME-1TB', 'Samsung 980 Pro 1TB Gen4 NVMe SSD with Heatsink', 'Storage', 'PCIe 4.0 Desktops/Laptops', 5800, 7900, 6, 3, 'Bin B-2'],
      ['DISP-156-FHD', '15.6" Slim 30-Pin FHD (1920x1080) IPS Matte Screen', 'Display', 'Dell, HP, Lenovo, Asus 15.6"', 3800, 5500, 4, 2, 'Rack Display-1']
    ];
    for (const item of defaultInv) {
      await run('INSERT INTO inventory (sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', item);
    }
    console.log('✔ Initialized default inventory spare parts');
  }
}

// Database Initialization with automatic fallback
async function initDatabase() {
  if (activeEngine) return activeEngine;

  // Step 1: Try PostgreSQL if connection string is configured or explicitly requested
  const connectionString = process.env.DATABASE_URL;
  if (pgModule && connectionString) {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const sslRequired = process.env.DATABASE_SSL === 'true' || 
        (process.env.DATABASE_SSL !== 'false' && (isProduction || connectionString.includes('sslmode=require')));

      const poolConfig = { connectionString };
      if (sslRequired) {
        poolConfig.ssl = { rejectUnauthorized: false };
      }

      const testPool = new pgModule.Pool(poolConfig);
      await testPool.query('SELECT 1');
      pgPool = testPool;
      activeEngine = 'postgres';
      console.log('✔ Connected to PostgreSQL database successfully.');

      await pgPool.query(POSTGRES_SCHEMA);
      await seedDefaults();
      return 'postgres';
    } catch (err) {
      console.warn('⚠ Could not connect to PostgreSQL:', err.message);
      console.warn('⚠ Falling back to local embedded SQLite database...');
    }
  }

  // Step 2: Fallback to SQLite (built-in node:sqlite in Node 22+)
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dataDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'ssctechcare.sqlite');
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec(SQLITE_SCHEMA);
    activeEngine = 'sqlite';
    console.log(`✔ Connected to local SQLite database at: ${dbPath}`);

    await seedDefaults();
    return 'sqlite';
  } catch (sqliteErr) {
    console.error('❌ Failed to initialize SQLite engine:', sqliteErr.message);
    throw sqliteErr;
  }
}

function ensureInitialized() {
  if (activeEngine) {
    return Promise.resolve(activeEngine);
  }
  if (!initPromise) {
    initPromise = initDatabase();
  }
  return initPromise;
}

// Automatically start initialization on module load
ensureInitialized();

module.exports = {
  getEngine: () => activeEngine,
  query,
  get,
  all,
  run,
  prepare,
  transaction,
  initDatabase,
  hashPassword,
  verifyPassword,
  generateToken
};