const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('./auth');

// GET all customers with search & stats
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        c.id, c.name, c.phone, c.alt_phone, c.email, c.address, c.notes, c.created_at,
        (SELECT COUNT(*) FROM tickets WHERE customer_id = c.id) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE customer_id = c.id) as ticket_count,
        (SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE customer_id = c.id) as total_spent,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = c.id) as total_invoice_due,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = c.id) as total_due
      FROM customers c
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY c.created_at DESC`;

    const customers = await db.prepare(query).all(...params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single customer with complete ticket and invoice history
router.get('/:id', async (req, res) => {
  try {
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const tickets = await db.prepare(`
      SELECT 
        t.*,
        tech.name as technician_name,
        inv.id as invoice_id,
        inv.invoice_number,
        inv.payment_status,
        inv.grand_total,
        inv.amount_paid,
        inv.balance_due
      FROM tickets t
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      LEFT JOIN invoices inv ON t.id = inv.ticket_id
      WHERE t.customer_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.id);

    const invoices = await db.prepare(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    const totalDue = invoices.reduce((sum, i) => sum + (Number(i.balance_due) || 0), 0);

    res.json({ ...customer, tickets, invoices, total_due: totalDue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add new customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, alt_phone, email, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }

    const existing = await db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
    if (existing) {
      return res.status(400).json({ error: 'A customer with this phone number already exists', existingId: existing.id });
    }

    const insert = await db.prepare(`
      INSERT INTO customers (name, phone, alt_phone, email, address, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(name, phone, alt_phone || '', email || '', address || '', notes || '');

    res.status(201).json({ id: insert.lastInsertRowid, message: 'Customer registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update customer
router.put('/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const { name, phone, alt_phone, email, address, notes } = req.body;

    const existing = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if new phone is already taken by another customer
    if (phone && phone !== existing.phone) {
      const duplicate = await db.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?').get(phone, customerId);
      if (duplicate) {
        return res.status(400).json({ error: 'This phone number is already registered to another customer' });
      }
    }

    await db.prepare(`
      UPDATE customers SET
        name = ?,
        phone = ?,
        alt_phone = ?,
        email = ?,
        address = ?,
        notes = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : existing.name,
      phone !== undefined ? phone : existing.phone,
      alt_phone !== undefined ? alt_phone : existing.alt_phone,
      email !== undefined ? email : existing.email,
      address !== undefined ? address : existing.address,
      notes !== undefined ? notes : existing.notes,
      customerId
    );

    const updated = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.json({ message: 'Customer updated successfully', customer: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE customer (supports force=true to cascade delete associated records - Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const existing = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const ticketCountRes = await db.prepare('SELECT COUNT(*) as count FROM tickets WHERE customer_id = ?').get(customerId);
    const ticketCount = ticketCountRes ? parseInt(ticketCountRes.count, 10) : 0;
    const force = req.query.force === 'true';

    if (ticketCount > 0 && !force) {
      return res.status(400).json({ 
        error: `Cannot delete customer with ${ticketCount} existing repair ticket(s). Confirm force deletion to remove customer along with associated repair records.`,
        ticketCount
      });
    }

    if (ticketCount > 0 && force) {
      await db.transaction(async (tx) => {
        // Delete invoices for customer
        await tx.prepare('DELETE FROM invoices WHERE customer_id = ?').run(customerId);
        // Find tickets for customer
        const tickets = await tx.prepare('SELECT id FROM tickets WHERE customer_id = ?').all(customerId);
        for (const t of tickets) {
          await tx.prepare('DELETE FROM ticket_parts WHERE ticket_id = ?').run(t.id);
          await tx.prepare('DELETE FROM timeline_logs WHERE ticket_id = ?').run(t.id);
          await tx.prepare('DELETE FROM invoices WHERE ticket_id = ?').run(t.id);
        }
        await tx.prepare('DELETE FROM tickets WHERE customer_id = ?').run(customerId);
        await tx.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
      });
    } else {
      await db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(customerId);
      await db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;