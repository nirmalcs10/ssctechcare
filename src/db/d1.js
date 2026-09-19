// Cloudflare D1 Database Helper & Cryptography Module
import crypto from 'node:crypto';

// Normalize query parameters: convert undefined to null
export function normalizeParams(params = []) {
  let list = params;
  if (params.length === 1 && Array.isArray(params[0])) {
    list = params[0];
  }
  return list.map((v) => (v === undefined ? null : v));
}

// Convert named parameters @foo to ? if an object is passed
export function formatQuery(sql, params = []) {
  if (
    params.length === 1 &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0]) &&
    params[0] !== null
  ) {
    const obj = params[0];
    const values = [];
    const formatted = sql.replace(/@(\w+)/g, (match, key) => {
      values.push(obj[key] !== undefined ? obj[key] : null);
      return '?';
    });
    return { sql: formatted, params: values };
  }
  return { sql, params: normalizeParams(params) };
}

export const d1 = {
  async get(db, sql, ...params) {
    const formatted = formatQuery(sql, params);
    return await db.prepare(formatted.sql).bind(...formatted.params).first();
  },

  async all(db, sql, ...params) {
    const formatted = formatQuery(sql, params);
    const res = await db.prepare(formatted.sql).bind(...formatted.params).all();
    return res.results || [];
  },

  async run(db, sql, ...params) {
    const formatted = formatQuery(sql, params);
    const res = await db.prepare(formatted.sql).bind(...formatted.params).run();
    return {
      lastInsertRowid: res.meta?.last_row_id || 0,
      changes: res.meta?.changes || 0
    };
  },

  async exec(db, sql) {
    return await db.exec(sql);
  }
};

// Password hashing & verification with scrypt (matches local node:sqlite & pg)
export function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    return false;
  }
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Ensure tables and default seeds exist in Cloudflare D1
let schemaInitialized = false;

export async function ensureD1Schema(db) {
  if (schemaInitialized) return;

  try {
    const check = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").first();
    if (!check) {
      // Create tables
      await db.exec(`
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
          serial_no TEXT,
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
          serial_no TEXT,
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
          plain_password TEXT,
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
      `);

      // Seed Default Settings
      await d1.run(db, `
        INSERT OR IGNORE INTO settings (id, shop_name, shop_phone, shop_email, shop_address)
        VALUES (1, 'SSC TechCare Computer Solutions', '+91 98765 43210', 'support@ssctechcare.com', 'Shop #12, First Floor, Silicon Arcade, Tech Park Road')
      `);

      // Seed Master Accounts
      const master1 = hashPassword('admin123');
      await d1.run(
        db,
        'INSERT OR IGNORE INTO master_accounts (id, email, password_hash, salt, display_name) VALUES (1, ?, ?, ?, ?)',
        'admin@ssctechcare.com', master1.hash, master1.salt, 'SSC TechCare Admin'
      );

      const master2 = hashPassword('071825');
      await d1.run(
        db,
        'INSERT OR IGNORE INTO master_accounts (id, email, password_hash, salt, display_name) VALUES (2, ?, ?, ?, ?)',
        'nirmalaws10@gmail.com', master2.hash, master2.salt, 'Nirmal Gateway Admin'
      );

      // Seed Staff Accounts
      const staffAdmin = hashPassword('admin123');
      await d1.run(
        db,
        'INSERT OR IGNORE INTO users (id, username, password_hash, salt, plain_password, full_name, role) VALUES (1, ?, ?, ?, ?, ?, ?)',
        'admin', staffAdmin.hash, staffAdmin.salt, 'admin123', 'Administrator', 'admin'
      );

      const staffTech = hashPassword('tech123');
      await d1.run(
        db,
        'INSERT OR IGNORE INTO users (id, username, password_hash, salt, plain_password, full_name, role) VALUES (2, ?, ?, ?, ?, ?, ?)',
        'tech', staffTech.hash, staffTech.salt, 'tech123', 'Lead Technician', 'technician'
      );

      const staffFront = hashPassword('staff123');
      await d1.run(
        db,
        'INSERT OR IGNORE INTO users (id, username, password_hash, salt, plain_password, full_name, role) VALUES (3, ?, ?, ?, ?, ?, ?)',
        'staff', staffFront.hash, staffFront.salt, 'staff123', 'Front Desk Reception', 'frontdesk'
      );

      // Seed Technicians
      await d1.run(db, `
        INSERT OR IGNORE INTO technicians (id, name, phone, email, specialization, status) VALUES
        (1, 'Amit Sharma', '+91 98230 11223', 'amit@ssctechcare.com', 'Chip Level / Motherboard & Micro-soldering', 'Active'),
        (2, 'Rajesh Varma', '+91 98450 33445', 'rajesh@ssctechcare.com', 'Display Panels, Hinges & Body Fabrication', 'Active'),
        (3, 'Priya Nair', '+91 98710 55667', 'priya@ssctechcare.com', 'Storage Upgrades, OS & Data Recovery', 'Active'),
        (4, 'Karan Patel', '+91 98990 77889', 'karan@ssctechcare.com', 'Gaming Rigs, Thermals & PSU Diagnostics', 'Active')
      `);

      // Seed Inventory
      await d1.run(db, `
        INSERT OR IGNORE INTO inventory (id, sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location) VALUES
        (1, 'RAM-D4-8GB', 'Crucial 8GB DDR4 3200MHz SODIMM Laptop RAM', 'RAM', 'Universal (Dell, HP, Lenovo, Acer)', 1200, 1850, 14, 4, 'Bin A-1'),
        (2, 'RAM-D4-16GB', 'Kingston Fury 16GB DDR4 3200MHz SODIMM Laptop RAM', 'RAM', 'Universal', 2400, 3400, 8, 3, 'Bin A-2'),
        (3, 'SSD-NVME-500', 'Crucial P3 500GB M.2 NVMe PCIe 3.0 SSD', 'Storage', 'Universal M.2', 2200, 3200, 12, 5, 'Bin B-1'),
        (4, 'SSD-NVME-1TB', 'Samsung 980 Pro 1TB Gen4 NVMe SSD with Heatsink', 'Storage', 'PCIe 4.0 Desktops/Laptops', 5800, 7900, 6, 3, 'Bin B-2'),
        (5, 'DISP-156-FHD', '15.6" Slim 30-Pin FHD (1920x1080) IPS Matte Screen', 'Display', 'Dell, HP, Lenovo, Asus 15.6"', 3800, 5500, 4, 2, 'Rack Display-1')
      `);
    }
    schemaInitialized = true;
  } catch (err) {
    console.error('Error ensuring D1 schema:', err);
  }
}
