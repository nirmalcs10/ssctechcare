const express = require('express');
const router = express.Router();
const db = require('../db/database');

const handleRevenueAnalytics = async (req, res) => {
  try {
    if (req.user && req.user.role === 'frontdesk') {
      return res.status(403).json({ error: 'Access denied: Revenue and financial analytics are restricted.' });
    }

    // 1. Total Revenue All-Time
    const allTimeRev = await db.prepare(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) as total_revenue,
        COALESCE(SUM(grand_total), 0) as total_billed,
        COALESCE(SUM(balance_due), 0) as total_due,
        COUNT(id) as total_invoices
      FROM invoices
    `).get();

    // Month Revenue
    const monthRev = await db.prepare(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) as month_revenue,
        COALESCE(SUM(grand_total), 0) as month_billed,
        COALESCE(SUM(balance_due), 0) as month_due,
        COUNT(id) as month_invoices
      FROM invoices
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();

    // 2. Customer-Wise Due Breakdown
    const customerWiseDue = await db.prepare(`
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        COUNT(inv.id) as unpaid_invoice_count,
        COALESCE(SUM(inv.balance_due), 0) as total_due,
        COALESCE(SUM(inv.grand_total), 0) as total_invoiced,
        COALESCE(SUM(inv.amount_paid), 0) as total_paid,
        GROUP_CONCAT(inv.invoice_number, ', ') as invoice_numbers
      FROM customers c
      JOIN invoices inv ON c.id = inv.customer_id
      WHERE inv.balance_due > 0
      GROUP BY c.id, c.name, c.phone, c.email
      ORDER BY total_due DESC
    `).all();

    const pendingInvoices = await db.prepare(`
      SELECT 
        inv.id,
        inv.invoice_number,
        inv.customer_id,
        inv.ticket_id,
        inv.grand_total,
        inv.amount_paid,
        inv.balance_due,
        inv.payment_status,
        inv.payment_method,
        inv.created_at,
        c.name as customer_name,
        c.phone as customer_phone,
        t.ticket_number
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN tickets t ON inv.ticket_id = t.id
      WHERE inv.balance_due > 0
      ORDER BY inv.balance_due DESC
    `).all();

    // 3. Total Profit This Month
    const monthInvoiceStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(labor_charges), 0) as labor_total,
        COALESCE(SUM(parts_total), 0) as parts_total,
        COALESCE(SUM(discount), 0) as discount_total,
        COALESCE(SUM(tax_amount), 0) as tax_total,
        COALESCE(SUM(grand_total), 0) as grand_total,
        COALESCE(SUM(amount_paid), 0) as amount_paid
      FROM invoices
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();

    const monthPartsCostRow = await db.prepare(`
      SELECT 
        COALESCE(SUM(tp.quantity * COALESCE(i.cost_price, 0)), 0) as parts_cost
      FROM ticket_parts tp
      JOIN invoices inv ON tp.ticket_id = inv.ticket_id
      LEFT JOIN inventory i ON tp.inventory_id = i.id
      WHERE strftime('%Y-%m', inv.created_at) = strftime('%Y-%m', 'now')
    `).get();

    const laborIncome = Number(monthInvoiceStats?.labor_total || 0);
    const partsRevenue = Number(monthInvoiceStats?.parts_total || 0);
    const partsCost = Number(monthPartsCostRow?.parts_cost || 0);
    const discountGiven = Number(monthInvoiceStats?.discount_total || 0);
    const partsMargin = Math.max(0, partsRevenue - partsCost);
    const totalProfitThisMonth = Math.max(0, (laborIncome + partsMargin) - discountGiven);

    // 4. Total Purchase This Month
    const monthPurchaseRow = await db.prepare(`
      SELECT 
        COALESCE(SUM(cost_price * stock_quantity), 0) as total_purchase,
        COALESCE(SUM(stock_quantity), 0) as units_purchased,
        COUNT(*) as items_count
      FROM inventory
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();

    // 5. Total Unused Stock Amount
    const unusedStockRow = await db.prepare(`
      SELECT 
        COALESCE(SUM(cost_price * stock_quantity), 0) as total_unused_stock_cost,
        COALESCE(SUM(selling_price * stock_quantity), 0) as total_unused_stock_retail,
        COALESCE(SUM(stock_quantity), 0) as total_stock_units,
        COUNT(*) as distinct_skus
      FROM inventory
      WHERE stock_quantity > 0
    `).get();

    res.json({
      totalRevenue: Number(allTimeRev?.total_revenue || 0),
      totalBilled: Number(allTimeRev?.total_billed || 0),
      totalDue: Number(allTimeRev?.total_due || 0),
      allTimeInvoices: Number(allTimeRev?.total_invoices || 0),

      monthRevenue: Number(monthRev?.month_revenue || 0),
      monthBilled: Number(monthRev?.month_billed || 0),
      monthDue: Number(monthRev?.month_due || 0),
      monthInvoices: Number(monthRev?.month_invoices || 0),

      customerWiseDue: customerWiseDue || [],
      pendingInvoices: pendingInvoices || [],

      profitThisMonth: {
        totalProfit: totalProfitThisMonth,
        laborIncome,
        partsRevenue,
        partsCost,
        partsMargin,
        discountGiven,
        totalCollected: Number(monthInvoiceStats?.amount_paid || 0)
      },

      purchaseThisMonth: {
        totalPurchase: Number(monthPurchaseRow?.total_purchase || 0),
        unitsPurchased: Number(monthPurchaseRow?.units_purchased || 0),
        itemsCount: Number(monthPurchaseRow?.items_count || 0)
      },

      unusedStock: {
        totalCost: Number(unusedStockRow?.total_unused_stock_cost || 0),
        totalRetail: Number(unusedStockRow?.total_unused_stock_retail || 0),
        potentialProfit: Math.max(0, Number(unusedStockRow?.total_unused_stock_retail || 0) - Number(unusedStockRow?.total_unused_stock_cost || 0)),
        totalUnits: Number(unusedStockRow?.total_stock_units || 0),
        distinctSkus: Number(unusedStockRow?.distinct_skus || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Route handlers
router.get('/', handleRevenueAnalytics);
router.get('/analytics', handleRevenueAnalytics);

module.exports = router;
