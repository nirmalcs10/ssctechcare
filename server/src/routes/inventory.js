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
      query += ' AND (sku ILIKE ? OR name ILIKE ? OR brand_compat ILIKE ? OR location ILIKE ? OR serial_no ILIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
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
    let { sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    if (!sku) {
      if (serial_no && serial_no.trim()) {
        sku = serial_no.trim();
      } else {
        const catPrefix = category.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PART';
        sku = `${catPrefix}-${Date.now().toString().slice(-6)}`;
      }
    }

    if (!name) {
      name = brand_compat ? `${brand_compat} ${category}` : `${category} ${serial_no ? '(' + serial_no + ')' : 'Spare'}`;
    }

    const trimmedName = (name || '').trim();
    const existing = await db.prepare(`
      SELECT id, name, sku, stock_quantity 
      FROM inventory 
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         OR (sku IS NOT NULL AND sku != '' AND LOWER(TRIM(sku)) = LOWER(TRIM(?)))
      LIMIT 1
    `).get(trimmedName, sku);

    if (existing) {
      return res.status(400).json({ 
        error: `A part named "${existing.name}" already exists in inventory (SKU: ${existing.sku}, Current Stock: ${existing.stock_quantity}). Please adjust existing stock or use a distinct part name.` 
      });
    }

    const insert = await db.prepare(`
      INSERT INTO inventory (sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      sku,
      trimmedName,
      category,
      brand_compat || '',
      serial_no || '',
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

// POST /api/inventory/deduplicate - Automatically clean and merge duplicate inventory rows
router.post('/deduplicate', async (req, res) => {
  try {
    const allItems = await db.all('SELECT * FROM inventory ORDER BY id ASC');
    const groups = {};

    allItems.forEach(item => {
      const key = (item.name || '').trim().toLowerCase();
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    let mergedCount = 0;
    const removedIds = [];

    for (const [key, itemsList] of Object.entries(groups)) {
      if (itemsList.length <= 1) continue;

      const primary = itemsList[0];
      const duplicates = itemsList.slice(1);

      for (const dup of duplicates) {
        await db.run('UPDATE ticket_parts SET inventory_id = ? WHERE inventory_id = ?', [primary.id, dup.id]);
        await db.run('DELETE FROM inventory WHERE id = ?', [dup.id]);
        removedIds.push(dup.id);
        mergedCount++;
      }
    }

    res.json({
      success: true,
      message: mergedCount > 0 ? `Successfully removed ${mergedCount} duplicate item(s)` : 'No duplicates found in warehouse inventory',
      mergedCount,
      removedIds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update inventory item
router.put('/:id', async (req, res) => {
  try {
    const { sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location } = req.body;

    await db.prepare(`
      UPDATE inventory SET
        sku = COALESCE(?, sku),
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        brand_compat = COALESCE(?, brand_compat),
        serial_no = COALESCE(?, serial_no),
        cost_price = COALESCE(?, cost_price),
        selling_price = COALESCE(?, selling_price),
        stock_quantity = COALESCE(?, stock_quantity),
        min_threshold = COALESCE(?, min_threshold),
        location = COALESCE(?, location)
      WHERE id = ?
    `).run(sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location, req.params.id);

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