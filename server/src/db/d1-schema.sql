-- Cloudflare D1 Database Schema & Initial Seed for SSC TechCare

-- 1. Settings Table
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

-- 2. Customers Table
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

-- 3. Technicians Table
CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialization TEXT,
  status TEXT DEFAULT 'Active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. Inventory Table
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

-- 5. Tickets Table
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

-- 6. Ticket Spare Parts Table
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

-- 7. Timeline Logs Table
CREATE TABLE IF NOT EXISTS timeline_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  actor TEXT DEFAULT 'Staff',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 8. Invoices Table
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

-- 9. Staff Users Table
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

-- 10. Staff Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 11. Master Gateway Accounts Table
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

-- 12. Master Gateway Sessions Table
CREATE TABLE IF NOT EXISTS master_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  master_account_id INTEGER NOT NULL REFERENCES master_accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS master_accounts_email_lower_idx ON master_accounts (LOWER(email));

-- ==========================================
-- DEFAULT INITIAL SEED DATA
-- ==========================================

-- Default Settings
INSERT OR IGNORE INTO settings (id, shop_name, shop_phone, shop_email, shop_address)
VALUES (1, 'SSC TechCare Computer Solutions', '+91 98765 43210', 'support@ssctechcare.com', 'Shop #12, First Floor, Silicon Arcade, Tech Park Road');

-- Master Accounts:
-- 1. admin@ssctechcare.com / admin123
INSERT OR IGNORE INTO master_accounts (id, email, password_hash, salt, display_name)
VALUES (1, 'admin@ssctechcare.com', '49eeb65c8738d940d1d88974547613a4de54b6661afe0e5d8fbea5d3d3f2a1425a8f7e41501cb0638a3239e9b22eafca061ccc6b90fc580b98bc73b671b85b61', 'a334f605d8b32ef797331dfb5b9baa23', 'SSC TechCare Admin');

-- 2. nirmalaws10@gmail.com / 071825
INSERT OR IGNORE INTO master_accounts (id, email, password_hash, salt, display_name)
VALUES (2, 'nirmalaws10@gmail.com', '5047845972f7df65bee502e6a424d9fb00662d4e98ab69d66dec620759a957f3428cb1b5ddb7c38820d13e4c3c9395469297ffa6e1fbc13523be009e4126056d', 'e60dd6fefb114bac5d4ef684e862d209', 'Nirmal Gateway Admin');

-- Staff Accounts:
-- admin / admin123
INSERT OR IGNORE INTO users (id, username, password_hash, salt, plain_password, full_name, role)
VALUES (1, 'admin', '6531a9a655fdb25b272bd924b70fb9e711f145541d47270f8bc0a4e814baaba70d2d85bb7f7fc6e79038591ba0107e7cd9018c21f884932e6e4f06e11521e0d4', 'cfa104b97d5318dc3d0250729cb78ca5', 'admin123', 'Administrator', 'admin');

-- tech / tech123
INSERT OR IGNORE INTO users (id, username, password_hash, salt, plain_password, full_name, role)
VALUES (2, 'tech', '7a675e9d2f1024ab05c28fcaea10e3e1f91d36afb6105a6c37ed3dd4008be2ca8cca60a90348f4cb4eb8fd252de88a04c909a92d090846917a5118f40bd20533', '2f4e2ca9f114c1a323dbadb7784ae4c2', 'tech123', 'Lead Technician', 'technician');

-- staff / staff123
INSERT OR IGNORE INTO users (id, username, password_hash, salt, plain_password, full_name, role)
VALUES (3, 'staff', 'f887d78770d3a786f876637a78df32abb19a4ab20d4c31019806a7e92a6466d074324e6bd606a24cd9abab2b3aa73b77a5c2cb8c1763cde21e0e5cc309628bad', 'b6512a71901252fb38ed2fb2398f84a2', 'staff123', 'Front Desk Reception', 'frontdesk');

-- Default Technicians
INSERT OR IGNORE INTO technicians (id, name, phone, email, specialization, status) VALUES
(1, 'Amit Sharma', '+91 98230 11223', 'amit@ssctechcare.com', 'Chip Level / Motherboard & Micro-soldering', 'Active'),
(2, 'Rajesh Varma', '+91 98450 33445', 'rajesh@ssctechcare.com', 'Display Panels, Hinges & Body Fabrication', 'Active'),
(3, 'Priya Nair', '+91 98710 55667', 'priya@ssctechcare.com', 'Storage Upgrades, OS & Data Recovery', 'Active'),
(4, 'Karan Patel', '+91 98990 77889', 'karan@ssctechcare.com', 'Gaming Rigs, Thermals & PSU Diagnostics', 'Active');

-- Default Inventory Items
INSERT OR IGNORE INTO inventory (id, sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location) VALUES
(1, 'RAM-D4-8GB', 'Crucial 8GB DDR4 3200MHz SODIMM Laptop RAM', 'RAM', 'Universal (Dell, HP, Lenovo, Acer)', 1200, 1850, 14, 4, 'Bin A-1'),
(2, 'RAM-D4-16GB', 'Kingston Fury 16GB DDR4 3200MHz SODIMM Laptop RAM', 'RAM', 'Universal', 2400, 3400, 8, 3, 'Bin A-2'),
(3, 'SSD-NVME-500', 'Crucial P3 500GB M.2 NVMe PCIe 3.0 SSD', 'Storage', 'Universal M.2', 2200, 3200, 12, 5, 'Bin B-1'),
(4, 'SSD-NVME-1TB', 'Samsung 980 Pro 1TB Gen4 NVMe SSD with Heatsink', 'Storage', 'PCIe 4.0 Desktops/Laptops', 5800, 7900, 6, 3, 'Bin B-2'),
(5, 'DISP-156-FHD', '15.6" Slim 30-Pin FHD (1920x1080) IPS Matte Screen', 'Display', 'Dell, HP, Lenovo, Asus 15.6"', 3800, 5500, 4, 2, 'Rack Display-1');
