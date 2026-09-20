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

    // 2. Comprehensive Customer-Wise Due Breakdown (Invoices + Active Uninvoiced Repair Jobs)
    const allCustomers = await db.prepare('SELECT id, name, phone, email FROM customers ORDER BY name ASC').all();
    const allInvoices = await db.prepare(`
      SELECT inv.*, c.name as customer_name, c.phone as customer_phone, t.ticket_number
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN tickets t ON inv.ticket_id = t.id
    `).all();
    const allActiveTickets = await db.prepare(`
      SELECT 
        t.id as ticket_id,
        t.ticket_number,
        t.customer_id,
        t.status as ticket_status,
        t.estimated_cost,
        t.advance_paid,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        (SELECT COALESCE(SUM(total_price), 0) FROM ticket_parts WHERE ticket_id = t.id) as parts_sum
      FROM tickets t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.status != 'CANCELLED'
    `).all();

    const invoicedTicketIds = new Set();
    const customerMap = {};
    const pendingInvoices = [];

    (allCustomers || []).forEach(c => {
      customerMap[c.id] = {
        customer_id: c.id,
        customer_name: c.name,
        customer_phone: c.phone || '-',
        customer_email: c.email || '',
        total_due: 0,
        total_invoiced: 0,
        total_paid: 0,
        unpaid_invoice_count: 0,
        pending_ticket_count: 0,
        items: [],
        invoice_numbers: []
      };
    });

    (allInvoices || []).forEach(inv => {
      if (inv.ticket_id) invoicedTicketIds.add(inv.ticket_id);
      const cid = inv.customer_id;
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customer_id: cid,
          customer_name: inv.customer_name || 'Customer #' + cid,
          customer_phone: inv.customer_phone || '-',
          customer_email: '',
          total_due: 0,
          total_invoiced: 0,
          total_paid: 0,
          unpaid_invoice_count: 0,
          pending_ticket_count: 0,
          items: [],
          invoice_numbers: []
        };
      }
      const due = Number(inv.balance_due) || 0;
      const billed = Number(inv.grand_total) || 0;
      const paid = Number(inv.amount_paid) || 0;

      customerMap[cid].total_invoiced += billed;
      customerMap[cid].total_paid += paid;

      if (due > 0) {
        pendingInvoices.push(inv);
        customerMap[cid].total_due += due;
        customerMap[cid].unpaid_invoice_count += 1;
        if (inv.invoice_number) customerMap[cid].invoice_numbers.push(inv.invoice_number);
        customerMap[cid].items.push({
          type: 'invoice',
          id: inv.id,
          ticket_id: inv.ticket_id,
          ref: inv.invoice_number,
          status: inv.payment_status || 'Unpaid',
          total: billed,
          paid: paid,
          due: due
        });
      }
    });

    (allActiveTickets || []).forEach(t => {
      if (!invoicedTicketIds.has(t.ticket_id)) {
        const parts = Number(t.parts_sum) || 0;
        const est = Number(t.estimated_cost) || 0;
        const jobTotal = Math.max(est, parts);
        const adv = Number(t.advance_paid) || 0;
        const due = Math.max(0, jobTotal - adv);
        const cid = t.customer_id;

        if (customerMap[cid]) {
          customerMap[cid].total_invoiced += jobTotal;
          customerMap[cid].total_paid += adv;

          if (due > 0) {
            customerMap[cid].total_due += due;
            customerMap[cid].pending_ticket_count += 1;
            customerMap[cid].items.push({
              type: 'ticket',
              id: t.ticket_id,
              ticket_id: t.ticket_id,
              ref: t.ticket_number,
              status: t.ticket_status,
              total: jobTotal,
              paid: adv,
              due: due
            });
          }
        }
      }
    });

    const customerList = Object.values(customerMap);
    const customerWiseDue = customerList
      .filter(c => c.total_due > 0)
      .map(c => ({
        ...c,
        invoice_numbers: c.invoice_numbers.length > 0 
          ? c.invoice_numbers.join(', ') 
          : c.items.map(it => it.ref).join(', ')
      }))
      .sort((a, b) => b.total_due - a.total_due);

    const overallTotalDue = customerWiseDue.reduce((sum, c) => sum + c.total_due, 0);

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
      totalDue: overallTotalDue,
      allTimeInvoices: Number(allTimeRev?.total_invoices || 0),

      monthRevenue: Number(monthRev?.month_revenue || 0),
      monthBilled: Number(monthRev?.month_billed || 0),
      monthDue: Number(monthRev?.month_due || 0),
      monthInvoices: Number(monthRev?.month_invoices || 0),

      customerWiseDue: customerWiseDue || [],
      allCustomers: customerList || [],
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
