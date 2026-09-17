const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Helper to generate next ticket number: REP-2026-000X
async function getNextTicketNumber() {
  const row = await db.prepare(`
    SELECT ticket_number FROM tickets 
    ORDER BY id DESC LIMIT 1
  `).get();

  const year = new Date().getFullYear();
  if (!row) {
    return `REP-${year}-0001`;
  }

  const match = row.ticket_number.match(/REP-(\d+)-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[2], 10) + 1;
    return `REP-${year}-${String(nextNum).padStart(4, '0')}`;
  }
  return `REP-${year}-${Date.now().toString().slice(-4)}`;
}

// GET all tickets with filtering & search
router.get('/', async (req, res) => {
  try {
    const { status, priority, technician_id, search } = req.query;
    let query = `
      SELECT 
        t.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        tech.name as technician_name,
        tech.status as technician_status,
        (SELECT COUNT(*) FROM ticket_parts WHERE ticket_id = t.id) as parts_count
      FROM tickets t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND t.status = ?`;
      params.push(status);
    }
    if (priority && priority !== 'ALL') {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }
    if (technician_id && technician_id !== 'ALL') {
      query += ` AND t.technician_id = ?`;
      params.push(technician_id);
    }
    if (search) {
      query += ` AND (
        t.ticket_number ILIKE ? OR 
        c.name ILIKE ? OR 
        c.phone ILIKE ? OR 
        t.model ILIKE ? OR 
        t.brand ILIKE ? OR
        t.serial_number ILIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    query += ` ORDER BY t.created_at DESC`;

    const tickets = await db.prepare(query).all(...params);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single ticket by ID
router.get('/:id', async (req, res) => {
  try {
    const ticket = await db.prepare(`
      SELECT 
        t.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.alt_phone as customer_alt_phone,
        c.email as customer_email,
        c.address as customer_address,
        tech.name as technician_name,
        tech.phone as technician_phone,
        tech.specialization as technician_specialization,
        tech.status as technician_status
      FROM tickets t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Parse JSON fields safely if string
    ticket.accessories = typeof ticket.accessories === 'string' ? JSON.parse(ticket.accessories) : (ticket.accessories || []);
    ticket.physical_condition = typeof ticket.physical_condition === 'string' ? JSON.parse(ticket.physical_condition) : (ticket.physical_condition || []);
    ticket.inspection_checklist = typeof ticket.inspection_checklist === 'string' ? JSON.parse(ticket.inspection_checklist) : (ticket.inspection_checklist || {});

    // Get parts used
    const parts = await db.prepare(`
      SELECT tp.*, i.sku, i.category
      FROM ticket_parts tp
      LEFT JOIN inventory i ON tp.inventory_id = i.id
      WHERE tp.ticket_id = ?
      ORDER BY tp.created_at ASC
    `).all(req.params.id);

    // Get timeline logs
    const timeline = await db.prepare(`
      SELECT * FROM timeline_logs 
      WHERE ticket_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    // Check for existing invoice
    const invoice = await db.prepare(`
      SELECT * FROM invoices WHERE ticket_id = ? ORDER BY id DESC LIMIT 1
    `).get(req.params.id);

    res.json({
      ...ticket,
      parts,
      timeline,
      invoice
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new repair ticket
router.post('/', async (req, res) => {
  try {
    const {
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      device_type,
      brand,
      model,
      serial_number,
      device_password,
      accessories,
      physical_condition,
      inspection_checklist,
      problem_description,
      priority,
      technician_id,
      estimated_cost,
      estimated_delivery,
      advance_paid
    } = req.body;

    let targetCustomerId = customer_id;

    // Auto-create or lookup customer by phone if customer_id not provided
    if (!targetCustomerId && customer_phone) {
      let existingCustomer = await db.prepare('SELECT id FROM customers WHERE phone = ?').get(customer_phone);
      if (!existingCustomer) {
        const createCust = await db.prepare(`
          INSERT INTO customers (name, phone, email, address, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(customer_name || 'Walk-in Customer', customer_phone, customer_email || '', customer_address || '');
        targetCustomerId = createCust.lastInsertRowid;
      } else {
        targetCustomerId = existingCustomer.id;
      }
    }

    if (!targetCustomerId) {
      return res.status(400).json({ error: 'Customer information is required' });
    }

    const ticket_number = await getNextTicketNumber();

    const insert = await db.prepare(`
      INSERT INTO tickets (
        ticket_number, customer_id, device_type, brand, model, serial_number, device_password,
        accessories, physical_condition, inspection_checklist, problem_description,
        priority, status, technician_id, estimated_cost, estimated_delivery, advance_paid,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      ticket_number,
      targetCustomerId,
      device_type || 'Laptop',
      brand || 'Unknown',
      model || 'Unknown',
      serial_number || '',
      device_password || '',
      JSON.stringify(accessories || []),
      JSON.stringify(physical_condition || []),
      JSON.stringify(inspection_checklist || {}),
      problem_description || 'General inspection',
      priority || 'Normal',
      technician_id || null,
      parseFloat(estimated_cost || 0),
      estimated_delivery || null,
      parseFloat(advance_paid || 0)
    );

    const ticketId = insert.lastInsertRowid;

    // Log timeline
    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, 'Ticket Created', ?, 'Front Desk', CURRENT_TIMESTAMP)
    `).run(ticketId, `Job card created for ${brand} ${model}. Reported issue: ${problem_description}`);

    if (technician_id) {
      const tech = await db.prepare('SELECT name FROM technicians WHERE id = ?').get(technician_id);
      await db.prepare(`
        INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
        VALUES (?, 'Assigned', ?, 'System', CURRENT_TIMESTAMP)
      `).run(ticketId, `Assigned to ${tech ? tech.name : 'Technician'}`);
    }

    res.status(201).json({
      id: ticketId,
      ticket_number,
      message: 'Repair ticket created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update ticket info & diagnosis
router.put('/:id', async (req, res) => {
  try {
    const {
      device_type,
      brand,
      model,
      serial_number,
      device_password,
      accessories,
      physical_condition,
      inspection_checklist,
      problem_description,
      diagnosis_notes,
      internal_notes,
      priority,
      status,
      technician_id,
      estimated_cost,
      estimated_delivery,
      customer_approved,
      advance_paid
    } = req.body;

    const oldTicket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!oldTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const targetTechId = req.body.technician_id !== undefined
      ? (req.body.technician_id === '' || req.body.technician_id === null ? null : parseInt(req.body.technician_id, 10))
      : oldTicket.technician_id;

    await db.prepare(`
      UPDATE tickets SET
        device_type = COALESCE(?, device_type),
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        serial_number = COALESCE(?, serial_number),
        device_password = COALESCE(?, device_password),
        accessories = COALESCE(?, accessories),
        physical_condition = COALESCE(?, physical_condition),
        inspection_checklist = COALESCE(?, inspection_checklist),
        problem_description = COALESCE(?, problem_description),
        diagnosis_notes = COALESCE(?, diagnosis_notes),
        internal_notes = COALESCE(?, internal_notes),
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        technician_id = ?,
        estimated_cost = COALESCE(?, estimated_cost),
        estimated_delivery = COALESCE(?, estimated_delivery),
        customer_approved = COALESCE(?, customer_approved),
        advance_paid = COALESCE(?, advance_paid),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      device_type,
      brand,
      model,
      serial_number,
      device_password,
      accessories ? JSON.stringify(accessories) : null,
      physical_condition ? JSON.stringify(physical_condition) : null,
      inspection_checklist ? JSON.stringify(inspection_checklist) : null,
      problem_description,
      diagnosis_notes,
      internal_notes,
      priority,
      status,
      targetTechId,
      estimated_cost,
      estimated_delivery,
      customer_approved,
      advance_paid,
      req.params.id
    );

    // If technician changed, record in timeline
    if (req.body.technician_id !== undefined && targetTechId !== oldTicket.technician_id) {
      const newTech = targetTechId ? await db.prepare('SELECT name FROM technicians WHERE id = ?').get(targetTechId) : null;
      await db.prepare(`
        INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
        VALUES (?, 'Technician Reassigned', ?, 'Staff', CURRENT_TIMESTAMP)
      `).run(req.params.id, newTech ? `Reassigned to ${newTech.name}` : 'Unassigned from technician');
    }

    // If status changed, record in timeline
    if (status && status !== oldTicket.status) {
      await db.prepare(`
        INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
        VALUES (?, 'Status Changed', ?, 'Staff', CURRENT_TIMESTAMP)
      `).run(req.params.id, `Status updated from ${oldTicket.status} to ${status}`);

      if (status === 'DELIVERED') {
        await db.prepare("UPDATE tickets SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
      }
    }

    res.json({ message: 'Ticket updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST change status directly
router.post('/:id/status', async (req, res) => {
  try {
    const { status, note, actor } = req.body;
    const ticket = await db.prepare('SELECT status FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    await db.prepare(`
      UPDATE tickets 
      SET status = ?, updated_at = CURRENT_TIMESTAMP ${status === 'DELIVERED' ? ", delivered_at = CURRENT_TIMESTAMP" : ''}
      WHERE id = ?
    `).run(status, req.params.id);

    const desc = note ? `Status changed to ${status}: ${note}` : `Status changed from ${ticket.status} to ${status}`;
    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, 'Status Changed', ?, ?, CURRENT_TIMESTAMP)
    `).run(req.params.id, desc, actor || 'Staff');

    res.json({ message: 'Status updated successfully', status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST attach spare part to ticket (auto-deducts inventory - Bug 2.2 fix)
router.post('/:id/parts', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({ error: 'Valid ticket ID is required' });
    }

    const ticket = await db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { inventory_id, part_name, quantity, unit_price } = req.body;

    if (!part_name || typeof part_name !== 'string' || !part_name.trim()) {
      return res.status(400).json({ error: 'Part name is required' });
    }

    // Bug 2.2 fix: Strictly require positive integer quantity (minimum 1)
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer (minimum 1)' });
    }

    // Strictly validate unit_price
    const price = Number(unit_price || 0);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'Unit price must be a valid non-negative number' });
    }

    const totalPrice = Math.round(qty * price * 100) / 100;

    // Check inventory if inventory_id provided
    const invId = inventory_id ? parseInt(inventory_id, 10) : null;
    if (invId) {
      const item = await db.prepare('SELECT * FROM inventory WHERE id = ?').get(invId);
      if (!item) return res.status(404).json({ error: 'Inventory item not found' });
      if (item.stock_quantity < qty) {
        return res.status(400).json({ error: `Insufficient stock for ${item.name}. Available: ${item.stock_quantity}` });
      }

      // Deduct inventory
      await db.prepare('UPDATE inventory SET stock_quantity = stock_quantity - ? WHERE id = ?').run(qty, invId);
    }

    const insertPart = await db.prepare(`
      INSERT INTO ticket_parts (ticket_id, inventory_id, part_name, quantity, unit_price, total_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(ticketId, invId || null, part_name.trim(), qty, price, totalPrice);

    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, 'Part Added', ?, 'Technician', CURRENT_TIMESTAMP)
    `).run(ticketId, `Installed ${qty}x ${part_name.trim()} (₹${totalPrice.toLocaleString()})`);

    res.status(201).json({ id: insertPart.lastInsertRowid, message: 'Part added to repair ticket' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE remove spare part (restores inventory stock)
router.delete('/:id/parts/:partId', async (req, res) => {
  try {
    const part = await db.prepare('SELECT * FROM ticket_parts WHERE id = ? AND ticket_id = ?').get(req.params.partId, req.params.id);
    if (!part) return res.status(404).json({ error: 'Part record not found' });

    if (part.inventory_id) {
      await db.prepare('UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE id = ?').run(part.quantity, part.inventory_id);
    }

    await db.prepare('DELETE FROM ticket_parts WHERE id = ?').run(req.params.partId);

    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, 'Part Removed', ?, 'Technician', CURRENT_TIMESTAMP)
    `).run(req.params.id, `Removed part: ${part.part_name}`);

    res.json({ message: 'Part removed and inventory restored' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add manual timeline log
router.post('/:id/timeline', async (req, res) => {
  try {
    const { action, description, actor } = req.body;
    await db.prepare(`
      INSERT INTO timeline_logs (ticket_id, action, description, actor, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(req.params.id, action || 'Note', description, actor || 'Technician');

    res.status(201).json({ message: 'Timeline note added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;