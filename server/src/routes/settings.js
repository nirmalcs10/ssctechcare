const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('./auth');

// GET settings
router.get('/', async (req, res) => {
  try {
    const settings = await db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update settings (Admin only)
router.put('/', requireRole('admin'), async (req, res) => {
  try {
    const { shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions } = req.body;

    await db.prepare(`
      UPDATE settings SET
        shop_name = COALESCE(?, shop_name),
        shop_phone = COALESCE(?, shop_phone),
        shop_email = COALESCE(?, shop_email),
        shop_address = COALESCE(?, shop_address),
        tax_rate = COALESCE(?, tax_rate),
        currency_symbol = COALESCE(?, currency_symbol),
        terms_conditions = COALESCE(?, terms_conditions),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions);

    const updated = await db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/system-stats - System health, storage, and record counts
router.get('/system-stats', async (req, res) => {
  try {
    let dbSizeBytes = 0;
    try {
      const sizeRes = await db.query('SELECT pg_database_size(current_database()) as size');
      dbSizeBytes = sizeRes.rows[0]?.size ? parseInt(sizeRes.rows[0].size, 10) : 0;
    } catch (e) {
      dbSizeBytes = 0;
    }

    const ticketsRes = await db.prepare('SELECT COUNT(*) as c FROM tickets').get();
    const customersRes = await db.prepare('SELECT COUNT(*) as c FROM customers').get();
    const inventoryRes = await db.prepare('SELECT COUNT(*) as c FROM inventory').get();
    const invoicesRes = await db.prepare('SELECT COUNT(*) as c FROM invoices').get();
    const usersRes = await db.prepare('SELECT COUNT(*) as c FROM users').get();

    const tickets = ticketsRes ? parseInt(ticketsRes.c, 10) : 0;
    const customers = customersRes ? parseInt(customersRes.c, 10) : 0;
    const inventory = inventoryRes ? parseInt(inventoryRes.c, 10) : 0;
    const invoices = invoicesRes ? parseInt(invoicesRes.c, 10) : 0;
    const users = usersRes ? parseInt(usersRes.c, 10) : 0;

    const timeRow = await db.prepare('SELECT CURRENT_TIMESTAMP as t').get();

    res.json({
      dbSize: dbSizeBytes,
      dbSizeBytes,
      dbSizeFormatted: `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
      recordCounts: {
        tickets,
        customers,
        inventory,
        invoices,
        users
      },
      systemTime: {
        serverTime: new Date().toISOString(),
        localTime: timeRow ? timeRow.t : new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      },
      databaseType: 'PostgreSQL',
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: Math.round(process.memoryUsage().rss / (1024 * 1024)) + ' MB'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/backup - Export structured JSON database snapshot (Admin only)
router.get('/backup', requireRole('admin'), async (req, res) => {
  try {
    const tables = [
      'settings',
      'customers',
      'technicians',
      'inventory',
      'tickets',
      'ticket_parts',
      'timeline_logs',
      'invoices',
      'users',
      'master_accounts'
    ];

    const backupData = {
      app: 'SSC TechCare Service Center Management System',
      version: '2.0.0',
      database: 'PostgreSQL',
      exported_at: new Date().toISOString(),
      tables: {}
    };

    for (const table of tables) {
      const rows = await db.query(`SELECT * FROM ${table} ORDER BY id ASC`);
      backupData.tables[table] = rows.rows;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `SSC_TechCare_Backup_${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ error: 'Failed to create database backup: ' + error.message });
  }
});

// POST /api/settings/restore - Upload and restore database from JSON backup (Admin only)
router.post('/restore', requireRole('admin'), express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    const fileBuffer = req.body;
    if (!fileBuffer || fileBuffer.length < 10) {
      return res.status(400).json({ error: 'Invalid or empty backup file.' });
    }

    let backupData;
    try {
      backupData = JSON.parse(fileBuffer.toString('utf8'));
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid backup file format. Expected JSON backup.' });
    }

    if (!backupData.tables || typeof backupData.tables !== 'object') {
      return res.status(400).json({ error: 'Backup does not contain valid table data.' });
    }

    const { tables } = backupData;
    const requiredTables = ['users', 'settings', 'tickets', 'customers'];
    const missing = requiredTables.filter(t => !tables[t]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Uploaded backup is missing required tables: ${missing.join(', ')}` });
    }

    await db.transaction(async (tx) => {
      // Disable triggers/foreign key checks temporarily if needed, or truncate in reverse dependency order
      const truncateOrder = [
        'timeline_logs',
        'ticket_parts',
        'invoices',
        'tickets',
        'inventory',
        'technicians',
        'customers',
        'settings'
      ];

      for (const t of truncateOrder) {
        await tx.query(`TRUNCATE TABLE ${t} CASCADE`);
      }

      // Restore settings
      if (tables.settings && tables.settings.length > 0) {
        for (const s of tables.settings) {
          await tx.query(
            `INSERT INTO settings (id, shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [s.id, s.shop_name, s.shop_phone, s.shop_email, s.shop_address, s.tax_rate, s.currency_symbol, s.terms_conditions, s.updated_at || new Date()]
          );
        }
      }

      // Restore customers
      if (tables.customers) {
        for (const c of tables.customers) {
          await tx.query(
            `INSERT INTO customers (id, name, phone, alt_phone, email, address, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [c.id, c.name, c.phone, c.alt_phone, c.email, c.address, c.notes, c.created_at || new Date()]
          );
        }
      }

      // Restore technicians
      if (tables.technicians) {
        for (const t of tables.technicians) {
          await tx.query(
            `INSERT INTO technicians (id, name, phone, email, specialization, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [t.id, t.name, t.phone, t.email, t.specialization, t.status, t.created_at || new Date()]
          );
        }
      }

      // Restore inventory
      if (tables.inventory) {
        for (const i of tables.inventory) {
          await tx.query(
            `INSERT INTO inventory (id, sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [i.id, i.sku, i.name, i.category, i.brand_compat, i.cost_price, i.selling_price, i.stock_quantity, i.min_threshold, i.location, i.created_at || new Date()]
          );
        }
      }

      // Restore tickets
      if (tables.tickets) {
        for (const tk of tables.tickets) {
          await tx.query(
            `INSERT INTO tickets (id, ticket_number, customer_id, device_type, brand, model, serial_number, device_password, accessories, physical_condition, inspection_checklist, problem_description, diagnosis_notes, internal_notes, priority, status, technician_id, estimated_cost, estimated_delivery, customer_approved, advance_paid, created_at, updated_at, delivered_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
            [
              tk.id, tk.ticket_number, tk.customer_id, tk.device_type, tk.brand, tk.model, tk.serial_number, tk.device_password,
              typeof tk.accessories === 'object' ? JSON.stringify(tk.accessories) : tk.accessories,
              typeof tk.physical_condition === 'object' ? JSON.stringify(tk.physical_condition) : tk.physical_condition,
              typeof tk.inspection_checklist === 'object' ? JSON.stringify(tk.inspection_checklist) : tk.inspection_checklist,
              tk.problem_description, tk.diagnosis_notes, tk.internal_notes, tk.priority, tk.status, tk.technician_id,
              tk.estimated_cost, tk.estimated_delivery, tk.customer_approved, tk.advance_paid, tk.created_at || new Date(), tk.updated_at || new Date(), tk.delivered_at
            ]
          );
        }
      }

      // Restore ticket_parts
      if (tables.ticket_parts) {
        for (const tp of tables.ticket_parts) {
          await tx.query(
            `INSERT INTO ticket_parts (id, ticket_id, inventory_id, part_name, quantity, unit_price, total_price, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tp.id, tp.ticket_id, tp.inventory_id, tp.part_name, tp.quantity, tp.unit_price, tp.total_price, tp.created_at || new Date()]
          );
        }
      }

      // Restore timeline_logs
      if (tables.timeline_logs) {
        for (const tl of tables.timeline_logs) {
          await tx.query(
            `INSERT INTO timeline_logs (id, ticket_id, action, description, actor, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tl.id, tl.ticket_id, tl.action, tl.description, tl.actor, tl.created_at || new Date()]
          );
        }
      }

      // Restore invoices
      if (tables.invoices) {
        for (const inv of tables.invoices) {
          await tx.query(
            `INSERT INTO invoices (id, invoice_number, ticket_id, customer_id, labor_charges, parts_total, subtotal, tax_rate, tax_amount, discount, grand_total, advance_deducted, amount_paid, balance_due, payment_method, payment_status, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              inv.id, inv.invoice_number, inv.ticket_id, inv.customer_id, inv.labor_charges, inv.parts_total, inv.subtotal,
              inv.tax_rate, inv.tax_amount, inv.discount, inv.grand_total, inv.advance_deducted, inv.amount_paid, inv.balance_due,
              inv.payment_method, inv.payment_status, inv.notes, inv.created_at || new Date()
            ]
          );
        }
      }

      // Sync serial ID sequences to maximum ID + 1
      const tablesWithSerial = ['settings', 'customers', 'technicians', 'inventory', 'tickets', 'ticket_parts', 'timeline_logs', 'invoices'];
      for (const t of tablesWithSerial) {
        await tx.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE(MAX(id), 1)) FROM ${t}`);
      }
    });

    const ticketCountRes = await db.prepare('SELECT COUNT(*) as c FROM tickets').get();
    const customerCountRes = await db.prepare('SELECT COUNT(*) as c FROM customers').get();
    const invoiceCountRes = await db.prepare('SELECT COUNT(*) as c FROM invoices').get();

    const ticketCount = ticketCountRes ? parseInt(ticketCountRes.c, 10) : 0;
    const customerCount = customerCountRes ? parseInt(customerCountRes.c, 10) : 0;
    const invoiceCount = invoiceCountRes ? parseInt(invoiceCountRes.c, 10) : 0;

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
    res.status(500).json({ error: 'Database restore failed: ' + error.message });
  }
});

module.exports = router;