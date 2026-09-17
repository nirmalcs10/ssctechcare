const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('./auth');

// GET all customers with search & stats
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        c.*,
        COUNT(t.id) as total_tickets,
        COALESCE(SUM(inv.grand_total), 0) as total_spent
      FROM customers c
      LEFT JOIN tickets t ON c.id = t.customer_id
      LEFT JOIN invoices inv ON c.id = inv.customer_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const customers = db.prepare(query).all(...params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single customer with complete ticket history
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const tickets = db.prepare(`
      SELECT 
        t.*,
        tech.name as technician_name,
        inv.invoice_number,
        inv.payment_status,
        inv.grand_total
      FROM tickets t
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      LEFT JOIN invoices inv ON t.id = inv.ticket_id
      WHERE t.customer_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.id);

    res.json({ ...customer, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add new customer
router.post('/', (req, res) => {
  try {
    const { name, phone, alt_phone, email, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }

    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
    if (existing) {
      return res.status(400).json({ error: 'A customer with this phone number already exists', existingId: existing.id });
    }

    const insert = db.prepare(`
      INSERT INTO customers (name, phone, alt_phone, email, address, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(name, phone, alt_phone || '', email || '', address || '', notes || '');

    res.status(201).json({ id: insert.lastInsertRowid, message: 'Customer registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update customer
router.put('/:id', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const { name, phone, alt_phone, email, address, notes } = req.body;

    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if new phone is already taken by another customer
    if (phone && phone !== existing.phone) {
      const duplicate = db.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?').get(phone, customerId);
      if (duplicate) {
        return res.status(400).json({ error: 'This phone number is already registered to another customer' });
      }
    }

    db.prepare(`
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

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.json({ message: 'Customer updated successfully', customer: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE customer (supports force=true to cascade delete associated records - Admin only)
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const ticketCount = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE customer_id = ?').get(customerId).count;
    const force = req.query.force === 'true';

    if (ticketCount > 0 && !force) {
      return res.status(400).json({ 
        error: `Cannot delete customer with ${ticketCount} existing repair ticket(s). Confirm force deletion to remove customer along with associated repair records.`,
        ticketCount
      });
    }

    if (ticketCount > 0 && force) {
      const deleteTx = db.transaction(() => {
        // Delete invoices for customer
        db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(customerId);
        // Find tickets for customer
        const tickets = db.prepare('SELECT id FROM tickets WHERE customer_id = ?').all(customerId);
        for (const t of tickets) {
          db.prepare('DELETE FROM ticket_parts WHERE ticket_id = ?').run(t.id);
          db.prepare('DELETE FROM timeline_logs WHERE ticket_id = ?').run(t.id);
          db.prepare('DELETE FROM invoices WHERE ticket_id = ?').run(t.id);
        }
        db.prepare('DELETE FROM tickets WHERE customer_id = ?').run(customerId);
        db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
      });
      deleteTx();
    } else {
      db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(customerId);
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
