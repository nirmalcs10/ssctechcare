const { Pool, types } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Automatically parse PostgreSQL BIGINT (e.g. COUNT(*)) as integer and NUMERIC as float
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ssctechcare';

const isProduction = process.env.NODE_ENV === 'production';
const sslRequired = process.env.DATABASE_SSL === 'true' || 
  (process.env.DATABASE_SSL !== 'false' && (isProduction || (connectionString && connectionString.includes('sslmode=require'))));

const poolConfig = {
  connectionString
};

if (sslRequired) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Helper to convert SQLite syntax (?, @named) to PostgreSQL ($1, $2...)
function parseQuery(sql, params = []) {
  let values = [];
  let formattedSql = sql;

  // Check if query contains @named parameters
  const namedMatches = [...sql.matchAll(/@(\w+)/g)];
  if (namedMatches.length > 0 && params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0]) && params[0] !== null) {
    const obj = params[0];
    let i = 1;
    formattedSql = sql.replace(/@(\w+)/g, (match, key) => {
      values.push(obj[key] !== undefined ? obj[key] : null);
      return `$${i++}`;
    });
  } else {
    // Positional parameters: flatten arguments if passed as multiple args or single array
    values = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    let i = 1;
    formattedSql = sql.replace(/\?/g, () => `$${i++}`);
  }

  return { sql: formattedSql, values };
}

async function query(text, params = []) {
  const { sql: formattedSql, values } = parseQuery(text, params);
  return pool.query(formattedSql, values);
}

async function get(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

async function all(text, params = []) {
  const res = await query(text, params);
  return res.rows;
}

async function run(text, params = []) {
  let { sql: formattedSql, values } = parseQuery(text, params);
  
  // For INSERT statements without RETURNING, append RETURNING id to capture lastInsertRowid
  const isInsert = /^\s*insert\s+into\s+/i.test(formattedSql);
  const hasReturning = /returning\s+/i.test(formattedSql);
  if (isInsert && !hasReturning) {
    formattedSql += ' RETURNING id';
  }

  const res = await pool.query(formattedSql, values);
  return {
    lastInsertRowid: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null,
    rowCount: res.rowCount,
    changes: res.rowCount
  };
}

// Emulate SQLite db.prepare() for seamless async migration
function prepare(sql) {
  return {
    get: async (...args) => {
      const p = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return get(sql, p);
    },
    all: async (...args) => {
      const p = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return all(sql, p);
    },
    run: async (...args) => {
      const p = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return run(sql, p);
    }
  };
}

// Transaction execution wrapper
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create client-scoped prepare helper
    const txDb = {
      query: (text, params = []) => {
        const { sql, values } = parseQuery(text, params);
        return client.query(sql, values);
      },
      get: async (text, params = []) => {
        const { sql, values } = parseQuery(text, params);
        const res = await client.query(sql, values);
        return res.rows[0] || null;
      },
      all: async (text, params = []) => {
        const { sql, values } = parseQuery(text, params);
        const res = await client.query(sql, values);
        return res.rows;
      },
      run: async (text, params = []) => {
        let { sql, values } = parseQuery(text, params);
        const isInsert = /^\s*insert\s+into\s+/i.test(sql);
        const hasReturning = /returning\s+/i.test(sql);
        if (isInsert && !hasReturning) {
          sql += ' RETURNING id';
        }
        const res = await client.query(sql, values);
        return {
          lastInsertRowid: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null,
          rowCount: res.rowCount,
          changes: res.rowCount
        };
      },
      prepare: (sql) => ({
        get: async (...args) => txDb.get(sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
        all: async (...args) => txDb.all(sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
        run: async (...args) => txDb.run(sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args)
      })
    };

    const result = await callback(txDb);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

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

// Schema definition and initialization
async function initDatabase() {
  try {
    const schema = `
      -- System Settings
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

      -- Customers
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

      -- Technicians
      CREATE TABLE IF NOT EXISTS technicians (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        specialization TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- Inventory / Spare Parts
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

      -- Repair Tickets
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

      -- Spare Parts Used in Repair Tickets
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

      -- Ticket Activity / Timeline Audit Log
      CREATE TABLE IF NOT EXISTS timeline_logs (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        actor TEXT DEFAULT 'Staff',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- Invoices & Billing
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

      -- System Users / Authentication
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

      -- Active User Sessions
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- Master Accounts (Main Login - email + password gateway)
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

      -- Master Sessions (Main Login sessions)
      CREATE TABLE IF NOT EXISTS master_sessions (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        master_account_id INTEGER NOT NULL REFERENCES master_accounts(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- Case-insensitive unique indexes for username and email
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
      CREATE UNIQUE INDEX IF NOT EXISTS master_accounts_email_lower_idx ON master_accounts (LOWER(email));
    `;

    await pool.query(schema);

    // Seed default settings row if empty
    const settingsRes = await pool.query('SELECT COUNT(*) as count FROM settings');
    if (parseInt(settingsRes.rows[0].count, 10) === 0) {
      await pool.query('INSERT INTO settings (id) VALUES (1)');
    }

    // Seed initial users if empty
    const userRes = await pool.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userRes.rows[0].count, 10) === 0) {
      const defaultUsers = [
        { username: 'admin', password: 'admin123', full_name: 'Administrator', role: 'admin' },
        { username: 'tech', password: 'tech123', full_name: 'Lead Technician', role: 'technician' },
        { username: 'staff', password: 'staff123', full_name: 'Front Desk Reception', role: 'frontdesk' }
      ];

      for (const u of defaultUsers) {
        const { hash, salt } = hashPassword(u.password);
        await pool.query(
          'INSERT INTO users (username, password_hash, salt, full_name, role) VALUES ($1, $2, $3, $4, $5)',
          [u.username, hash, salt, u.full_name, u.role]
        );
      }
      console.log(' Default users initialized in PostgreSQL: admin, tech, staff');
    }

    // Seed initial master account if empty
    const masterRes = await pool.query('SELECT COUNT(*) as count FROM master_accounts');
    if (parseInt(masterRes.rows[0].count, 10) === 0) {
      const { hash, salt } = hashPassword('admin123');
      await pool.query(
        'INSERT INTO master_accounts (email, password_hash, salt, display_name) VALUES ($1, $2, $3, $4)',
        ['admin@ssctechcare.com', hash, salt, 'SSC TechCare Admin']
      );
      console.log(' Default master account initialized in PostgreSQL: admin@ssctechcare.com / admin123');
    }
  } catch (err) {
    console.error(' PostgreSQL Database initialization error:', err.message);
  }
}

// Trigger initial connection and schema initialization
initDatabase();

module.exports = {
  pool,
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