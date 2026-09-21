const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Helper to generate next invoice number: INV-YYYY-000X
async function getNextInvoiceNumber(attempt = 0) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const row = await db.prepare('SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1').get(`${prefix}%`);
  if (!row || !row.invoice_number) return `${prefix}${String(1 + attempt).padStart(4, '0')}`;

  const match = row.invoice_number.match(/INV-\d+-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1 + attempt;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }
  return `${prefix}${String(1 + attempt).padStart(4, '0')}`;
}

// GET all invoices
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT 
        inv.*,
        c.name as customer_name,
        c.phone as customer_phone,
        t.ticket_number,
        t.brand as device_brand,
        t.model as device_model
      FROM invoices inv
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN tickets t ON inv.ticket_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND inv.payment_status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (inv.invoice_number ILIKE ? OR c.name ILIKE ? OR c.phone ILIKE ? OR t.ticket_number ILIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY inv.created_at DESC`;

    const invoices = await db.prepare(query).all(...params);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single invoice with complete print data & shop settings
router.get('/:id', async (req, res) => {
  try {
    const invoice = await db.prepare(`
      SELECT 
        inv.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        c.address as customer_address,
        t.ticket_number,
        t.device_type,
        t.brand as device_brand,
        t.model as device_model,
        t.serial_number,
        t.problem_description,
        t.diagnosis_notes,
        tech.name as technician_name
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      JOIN tickets t ON inv.ticket_id = t.id
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      WHERE inv.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Fetch itemized parts attached to this ticket
    const parts = await db.prepare(`
      SELECT * FROM ticket_parts WHERE ticket_id = ?
    `).all(invoice.ticket_id);

    // Fetch shop settings
    const settings = await db.prepare('SELECT * FROM settings WHERE id = 1').get();

    res.json({
      ...invoice,
      parts,
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST generate invoice for a ticket (Bug 2.1 & Bug 2.3 fixes)
router.post('/', async (req, res) => {
  try {
    const {
      ticket_id,
      labor_charges = 0,
      tax_rate = 18.0,
      discount = 0,
      amount_paid = 0,
      payment_method = 'Cash',
      notes = ''
    } = req.body;

    const ticketId = parseInt(ticket_id, 10);
    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({ error: 'Valid ticket_id is required' });
    }

    const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Bug 2.3 fix: Check for existing invoice for this repair ticket
    const existingInvoice = await db.prepare('SELECT id, invoice_number, grand_total, payment_status FROM invoices WHERE ticket_id = ?').get(ticketId);
    if (existingInvoice) {
      return res.status(409).json({
        error: `An invoice (${existingInvoice.invoice_number}) already exists for this repair ticket.`,
        invoice: existingInvoice
      });
    }

    // Bug 2.1 fix: Validate all financial values against NaN / Infinity / negative inputs
    const labor = Number(labor_charges);
    const taxRate = Number(tax_rate);
    const disc = Number(discount);
    const paidNow = Number(amount_paid);

    if (!Number.isFinite(labor) || labor < 0) {
      return res.status(400).json({ error: 'Labor charges must be a valid non-negative number' });
    }
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return res.status(400).json({ error: 'Tax rate must be a valid percentage between 0 and 100' });
    }
    if (!Number.isFinite(disc) || disc < 0) {
      return res.status(400).json({ error: 'Discount must be a valid non-negative number' });
    }
    if (!Number.isFinite(paidNow) || paidNow < 0) {
      return res.status(400).json({ error: 'Amount paid must be a valid non-negative number' });
    }

    // Calculate total from parts
    const partsSum = await db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total FROM ticket_parts WHERE ticket_id = ?
    `).get(ticketId);

    const parts_total = Math.round(Number(partsSum ? partsSum.total : 0) * 100) / 100;
    const subtotal = Math.round((parts_total + labor) * 100) / 100;
    const tax_amount = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const grand_total = Math.max(0, Math.round((subtotal + tax_amount - disc) * 100) / 100);

    const advance = Math.max(0, Number(ticket.advance_paid || 0));
    const totalPaid = Math.round((advance + paidNow) * 100) / 100;
    const balance_due = Math.max(0, Math.round((grand_total - totalPaid) * 100) / 100);

    let payment_status = 'Unpaid';
    if (balance_due <= 0.01) {
      payment_status = 'Paid';
    } else if (totalPaid > 0) {
      payment_status = 'Partial';
    }

    const invoice_number = await getNextInvoiceNumber();

    const insert = await db.prepare(`
      INSERT INTO invoices (
        invoice_number, ticket_id, customer_id, labor_charges, parts_total, subtotal,
        tax_rate, tax_amount, discount, grand_total, advance_deducted, amount_paid,
        balance_due, payment_method, payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      invoice_number,
      ticketId,
      ticket.customer_id,
      labor,
      parts_total,
      subtotal,
      taxRate,
      tax_amount,
      disc,
      grand_total,
      advance,
      totalPaid,
      balance_due,
      payment_method,
      payment_status,
      notes
    );

    const invoiceId = insert.lastInsertRowid;

    // Log timeline on ticket
    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, 'Invoice Generated', ?, 'Billing', CURRENT_TIMESTAMP)
    `).run(ticketId, `Invoice ${invoice_number} generated for ₹${grand_total.toLocaleString()}. Status: ${payment_status}`);

    res.status(201).json({
      id: invoiceId,
      invoice_number,
      grand_total,
      balance_due,
      payment_status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST record payment on an invoice (Bug 2.1 fix)
router.post('/:id/payment', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    if (isNaN(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: 'Valid invoice ID is required' });
    }

    const { amount, payment_method, note } = req.body;
    const payAmount = Number(amount);

    // Bug 2.1: Reject NaN, Infinity, negative, zero, or non-numeric amounts
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount required' });
    }

    const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    if (Number(inv.balance_due) <= 0) {
      return res.status(400).json({ error: 'Invoice is already fully paid' });
    }

    if (payAmount > Number(inv.balance_due) + 0.01) {
      return res.status(400).json({
        error: `Payment amount (₹${payAmount}) exceeds remaining balance due (₹${inv.balance_due})`
      });
    }

    const newAmountPaid = Math.round((Number(inv.amount_paid) + payAmount) * 100) / 100;
    const newBalance = Math.max(0, Math.round((Number(inv.grand_total) - newAmountPaid) * 100) / 100);
    const newStatus = newBalance <= 0.01 ? 'Paid' : 'Partial';

    await db.prepare(`
      UPDATE invoices 
      SET amount_paid = ?, balance_due = ?, payment_status = ?, payment_method = COALESCE(?, payment_method)
      WHERE id = ?
    `).run(newAmountPaid, newBalance, newStatus, payment_method, invoiceId);

    // Timeline on ticket
    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, 'Payment Received', ?, 'Cashier', CURRENT_TIMESTAMP)
    `).run(inv.ticket_id, `Payment of ₹${payAmount.toLocaleString()} received via ${payment_method || 'Cash'}. Remaining balance: ₹${newBalance.toLocaleString()}`);

    res.json({
      message: 'Payment recorded successfully',
      amount_paid: newAmountPaid,
      balance_due: newBalance,
      payment_status: newStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;