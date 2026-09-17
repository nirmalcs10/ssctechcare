const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET dashboard metrics & overview
router.get('/', async (req, res) => {
  try {
    // 1. Status breakdown
    const statusCounts = await db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tickets 
      GROUP BY status
    `).all();

    const statusMap = {
      RECEIVED: 0,
      IN_DIAGNOSIS: 0,
      QUOTATION_PENDING: 0,
      APPROVED: 0,
      WAITING_PARTS: 0,
      IN_REPAIR: 0,
      TESTING_QC: 0,
      READY_FOR_PICKUP: 0,
      DELIVERED: 0,
      CANCELLED: 0
    };
    statusCounts.forEach(r => {
      statusMap[r.status] = parseInt(r.count, 10) || 0;
    });

    // 2. Active Repairs (all except Delivered and Cancelled)
    const activeRepairsRes = await db.prepare(`
      SELECT COUNT(*) as count FROM tickets 
      WHERE status NOT IN ('DELIVERED', 'CANCELLED')
    `).get();
    const activeRepairs = activeRepairsRes ? parseInt(activeRepairsRes.count, 10) : 0;

    // 3. Ready for pickup
    const readyForPickup = statusMap.READY_FOR_PICKUP || 0;

    // 4. Delivered count
    const deliveredCount = statusMap.DELIVERED || 0;

    // 5. Total revenue collected (disabled for front desk staff)
    const isFrontDesk = req.user && req.user.role === 'frontdesk';
    let totalRevenue = null;
    let totalPending = null;

    if (!isFrontDesk) {
      const revenue = await db.prepare(`
        SELECT 
          COALESCE(SUM(amount_paid), 0) as total_revenue,
          COALESCE(SUM(balance_due), 0) as total_pending
        FROM invoices
      `).get();
      totalRevenue = revenue ? parseFloat(revenue.total_revenue) : 0;
      totalPending = revenue ? parseFloat(revenue.total_pending) : 0;
    }

    // 6. Urgent / High Priority active tickets
    const urgentTickets = await db.prepare(`
      SELECT 
        t.id, t.ticket_number, t.brand, t.model, t.priority, t.status, t.estimated_delivery,
        c.name as customer_name, c.phone as customer_phone,
        tech.name as technician_name
      FROM tickets t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      WHERE t.priority IN ('High', 'Urgent') 
        AND t.status NOT IN ('DELIVERED', 'CANCELLED')
      ORDER BY 
        CASE t.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 ELSE 3 END,
        t.created_at ASC
      LIMIT 5
    `).all();

    // 7. Low stock items
    const lowStockItems = await db.prepare(`
      SELECT id, sku, name, category, stock_quantity, min_threshold
      FROM inventory 
      WHERE stock_quantity <= min_threshold
      ORDER BY stock_quantity ASC
    `).all();

    // 8. Device category breakdown
    const deviceBreakdown = await db.prepare(`
      SELECT device_type, COUNT(*) as count
      FROM tickets
      GROUP BY device_type
      ORDER BY count DESC
    `).all();

    // 9. Recent activity timeline
    const recentActivity = await db.prepare(`
      SELECT 
        tl.*,
        t.ticket_number,
        t.brand,
        t.model
      FROM timeline_logs tl
      JOIN tickets t ON tl.ticket_id = t.id
      ORDER BY tl.created_at DESC
      LIMIT 8
    `).all();

    res.json({
      activeRepairs,
      readyForPickup,
      deliveredCount,
      inRepairCount: statusMap.IN_REPAIR || 0,
      inDiagnosisCount: statusMap.IN_DIAGNOSIS || 0,
      totalRevenue,
      totalPending,
      isRevenueDisabled: isFrontDesk,
      statusMap,
      urgentTickets,
      lowStockItems,
      deviceBreakdown,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;