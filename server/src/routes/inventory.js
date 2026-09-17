const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('./auth');

// GET all inventory items with optional search & filter
router.get('/', async (req, res) => {
  try {
    const { category, search, low_stock } = req.query;
    let query = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];

    if (category && category !== 'ALL') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (low_stock === 'true') {
      query += ' AND stock_quantity <= min_threshold';
    }

    if (search) {
      query += ' AND (sku ILIKE ? OR name ILIKE ? OR brand_compat ILIKE ? OR location ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY category ASC, name ASC';

    const items = await db.prepare(query).all(...params);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET categories list
router.get('/categories', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT DISTINCT category FROM inventory ORDER BY category ASC').all();
    res.json(rows.map(r => r.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single inventory item with usage in repair tickets
router.get('/:id', async (req, res) => {
  try {
    const item = await db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const usages = await db.prepare(`
      SELECT tp.*, t.ticket_number, t.brand, t.model, c.name as customer_name
      FROM ticket_parts tp
      JOIN tickets t ON tp.ticket_id = t.id
      JOIN customers c ON t.customer_id = c.id
      WHERE tp.inventory_id = ?
      ORDER BY tp.created_at DESC
      LIMIT 10
    `).all(req.params.id);

    res.json({ ...item, usages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add new inventory item
router.post('/', async (req, res) => {
  try {
    const { sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ error: 'SKU, Name, and Category are required' });
    }

    const existing = await db.prepare('SELECT id FROM inventory WHERE sku = ?').get(sku);
    if (existing) {
      return res.status(400).json({ error: `Part with SKU "${sku}" already exists` });
    }

    const insert = await db.prepare(`
      INSERT INTO inventory (sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      sku,
      name,
      category,
      brand_compat || '',
      parseFloat(cost_price || 0),
      parseFloat(selling_price || 0),
      parseInt(stock_quantity || 0, 10),
      parseInt(min_threshold || 3, 10),
      location || ''
    );

    res.status(201).json({ id: insert.lastInsertRowid, message: 'Item added to inventory' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update inventory item
router.put('/:id', async (req, res) => {
  try {
    const { sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location } = req.body;

    await db.prepare(`
      UPDATE inventory SET
        sku = COALESCE(?, sku),
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        brand_compat = COALESCE(?, brand_compat),
        cost_price = COALESCE(?, cost_price),
        selling_price = COALESCE(?, selling_price),
        stock_quantity = COALESCE(?, stock_quantity),
        min_threshold = COALESCE(?, min_threshold),
        location = COALESCE(?, location)
      WHERE id = ?
    `).run(sku, name, category, brand_compat, cost_price, selling_price, stock_quantity, min_threshold, location, req.params.id);

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST adjust stock
router.post('/:id/stock', async (req, res) => {
  try {
    const { change, reason } = req.body;
    const num = parseInt(change, 10);
    if (isNaN(num) || num === 0) return res.status(400).json({ error: 'Valid quantity change required' });

    const item = await db.prepare('SELECT stock_quantity FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newQty = item.stock_quantity + num;
    if (newQty < 0) return res.status(400).json({ error: 'Stock cannot fall below zero' });

    await db.prepare('UPDATE inventory SET stock_quantity = ? WHERE id = ?').run(newQty, req.params.id);

    res.json({ message: `Stock adjusted by ${num > 0 ? '+' + num : num}`, new_stock: newQty });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE inventory item (Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const usage = await db.prepare('SELECT COUNT(*) as count FROM ticket_parts WHERE inventory_id = ?').get(req.params.id);
    if (usage && parseInt(usage.count, 10) > 0) {
      return res.status(400).json({ error: 'Cannot delete part that has been used in repair tickets' });
    }

    await db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;