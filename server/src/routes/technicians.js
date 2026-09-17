const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('./auth');

// GET all technicians with workload statistics
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        tech.id, tech.name, tech.phone, tech.email, tech.specialization, tech.status, tech.created_at,
        COUNT(CASE WHEN t.status NOT IN ('DELIVERED', 'CANCELLED') THEN 1 END) as active_jobs,
        COUNT(CASE WHEN t.status = 'DELIVERED' THEN 1 END) as completed_jobs,
        COUNT(t.id) as total_jobs
      FROM technicians tech
      LEFT JOIN tickets t ON tech.id = t.technician_id
      GROUP BY tech.id, tech.name, tech.phone, tech.email, tech.specialization, tech.status, tech.created_at
      ORDER BY tech.name ASC
    `;
    const technicians = await db.prepare(query).all();
    res.json(technicians);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add new technician (Admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, email, specialization, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Technician name is required' });

    const insert = await db.prepare(`
      INSERT INTO technicians (name, phone, email, specialization, status, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(name, phone || '', email || '', specialization || 'General Hardware', status || 'Active');

    res.status(201).json({ id: insert.lastInsertRowid, message: 'Technician added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update technician (Admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, email, specialization, status } = req.body;

    await db.prepare(`
      UPDATE technicians SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        specialization = COALESCE(?, specialization),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(name, phone, email, specialization, status, req.params.id);

    res.json({ message: 'Technician updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE delete technician (Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const techId = parseInt(req.params.id, 10);
    const tech = await db.prepare('SELECT * FROM technicians WHERE id = ?').get(techId);
    if (!tech) {
      return res.status(404).json({ error: 'Technician not found' });
    }

    const countRes = await db.prepare('SELECT COUNT(*) as c FROM tickets WHERE technician_id = ?').get(techId);
    const assignedCount = countRes ? countRes.c : 0;

    await db.transaction(async (tx) => {
      // Safely unassign technician from existing tickets
      if (assignedCount > 0) {
        await tx.prepare('UPDATE tickets SET technician_id = NULL WHERE technician_id = ?').run(techId);
      }
      await tx.prepare('DELETE FROM technicians WHERE id = ?').run(techId);
    });

    res.json({
      success: true,
      message: `Technician "${tech.name}" deleted successfully`,
      unassignedCount: assignedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET tickets assigned to a technician
router.get('/:id/tickets', async (req, res) => {
  try {
    const tickets = await db.prepare(`
      SELECT t.*, c.name as customer_name, c.phone as customer_phone
      FROM tickets t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.technician_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.id);

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;