// Cloudflare Worker Native REST API Router for SSC TechCare
import { d1, hashPassword, verifyPassword, generateToken } from '../db/d1.js';

// JSON Response Helper
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders
    }
  });
}

// Error Response Helper
export function err(message, status = 400) {
  return json({ error: message }, status);
}

// Safely parse JSON strings with fallback
function safeParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// PII Masking helpers for public responses
function maskName(name) {
  if (!name || typeof name !== 'string') return 'Customer';
  return name.trim().split(/\s+/).map(part => {
    if (part.length <= 2) return part[0] + '*';
    return part[0] + '*'.repeat(Math.min(part.length - 2, 6)) + part[part.length - 1];
  }).join(' ');
}

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '*'.repeat(Math.min(digits.length - 4, 6)) + digits.slice(-4);
}

// Auth extraction helper
async function getAuthContext(request, db) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const masterToken = request.headers.get('X-Master-Token') || '';

  let staffUser = null;
  let masterUser = null;

  if (token) {
    staffUser = await d1.get(
      db,
      `SELECT u.id, u.username, u.plain_password, u.full_name, u.role, u.is_active, s.expires_at 
       FROM user_sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.token = ?`,
      token
    );
  }

  if (masterToken) {
    masterUser = await d1.get(
      db,
      `SELECT m.id, m.email, m.display_name, m.is_active, s.expires_at 
       FROM master_sessions s 
       JOIN master_accounts m ON s.master_account_id = m.id 
       WHERE s.token = ?`,
      masterToken
    );
  }

  return { staffUser, masterUser, token, masterToken };
}

// Generate sequential ticket number (REP-YYYY-000X)
async function generateTicketNumber(db) {
  const year = new Date().getFullYear();
  const lastTicket = await d1.get(
    db,
    `SELECT ticket_number FROM tickets ORDER BY id DESC LIMIT 1`
  );
  if (!lastTicket) return `REP-${year}-0001`;

  const match = lastTicket.ticket_number?.match(/REP-(\d+)-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[2], 10) + 1;
    return `REP-${year}-${String(nextNum).padStart(4, '0')}`;
  }
  const countRow = await d1.get(db, 'SELECT COUNT(*) as count FROM tickets');
  const nextNum = (countRow?.count || 0) + 1;
  return `REP-${year}-${String(nextNum).padStart(4, '0')}`;
}

// Generate sequential invoice number (INV-YYYY-000X)
async function generateInvoiceNumber(db) {
  const year = new Date().getFullYear();
  const lastInv = await d1.get(
    db,
    `SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1`
  );
  if (!lastInv) return `INV-${year}-0001`;

  const match = lastInv.invoice_number?.match(/INV-(\d+)-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[2], 10) + 1;
    return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
  }
  const countRow = await d1.get(db, 'SELECT COUNT(*) as count FROM invoices');
  const nextNum = (countRow?.count || 0) + 1;
  return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
}

export async function handleApiRequest(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // Parse body safely for write methods (JSON, raw text, or form-urlencoded)
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const rawText = await request.text();
      if (rawText && rawText.trim()) {
        try {
          body = JSON.parse(rawText);
        } catch {
          try {
            const form = Object.fromEntries(new URLSearchParams(rawText));
            if (Object.keys(form).length > 0) body = form;
          } catch {}
        }
      }
    } catch {
      body = {};
    }
  }

  const { staffUser, masterUser, token, masterToken } = await getAuthContext(request, db);

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & USERS
  // -------------------------------------------------------------

  // Master Gateway Login
  if (path === '/api/auth/master-login' && method === 'POST') {
    const { email, password } = body;
    if (!email || !password) return err('Email and password are required', 400);

    const account = await d1.get(
      db,
      'SELECT * FROM master_accounts WHERE LOWER(email) = LOWER(?) AND is_active = 1',
      email
    );
    if (!account || !verifyPassword(password, account.password_hash, account.salt)) {
      return err('Invalid master gateway credentials', 401);
    }

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await d1.run(
      db,
      'INSERT INTO master_sessions (token, master_account_id, expires_at) VALUES (?, ?, ?)',
      sessionToken, account.id, expiresAt
    );
    await d1.run(db, 'UPDATE master_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', account.id);

    return json({
      masterToken: sessionToken,
      masterUser: {
        id: account.id,
        email: account.email,
        displayName: account.display_name
      }
    });
  }

  // Master Me
  if (path === '/api/auth/master-me' && method === 'GET') {
    if (!masterUser) return err('Unauthorized', 401);
    return json({
      masterUser: {
        id: masterUser.id,
        email: masterUser.email,
        displayName: masterUser.display_name
      }
    });
  }

  // Master Logout
  if (path === '/api/auth/master-logout' && method === 'POST') {
    if (masterToken) {
      await d1.run(db, 'DELETE FROM master_sessions WHERE token = ?', masterToken);
    }
    return json({ success: true });
  }

  // Change Master Password
  if (path === '/api/auth/master-password' && method === 'PUT') {
    const { oldPassword, newPassword } = body;
    if (!oldPassword || !newPassword) return err('Both current password and new password are required', 400);
    if (newPassword.length < 6) return err('New password must be at least 6 characters long', 400);

    const targetId = masterUser?.id || 1;
    const account = await d1.get(db, 'SELECT * FROM master_accounts WHERE id = ?', targetId);
    if (!account) return err('Master account not found', 404);

    if (!verifyPassword(oldPassword, account.password_hash, account.salt)) {
      return err('Current password is incorrect', 400);
    }

    const { hash, salt } = hashPassword(newPassword);
    await d1.run(db, 'UPDATE master_accounts SET password_hash = ?, salt = ? WHERE id = ?', hash, salt, account.id);
    return json({ success: true, message: 'Master password updated successfully' });
  }

  // Staff Login
  if (path === '/api/auth/login' && method === 'POST') {
    const { username, password } = body;
    if (!username || !password) return err('Username and password are required', 400);

    const user = await d1.get(
      db,
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1',
      username
    );
    if (!user || !verifyPassword(password, user.password_hash, user.salt, user.plain_password)) {
      return err('Invalid username or password', 401);
    }

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await d1.run(
      db,
      'INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
      sessionToken, user.id, expiresAt
    );
    await d1.run(db, 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', user.id);

    return json({
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  }

  // Staff Me
  if (path === '/api/auth/me' && method === 'GET') {
    if (!staffUser) return err('Unauthorized', 401);
    return json({
      user: {
        id: staffUser.id,
        username: staffUser.username,
        fullName: staffUser.full_name,
        role: staffUser.role
      }
    });
  }

  // Staff Logout
  if (path === '/api/auth/logout' && method === 'POST') {
    if (token) {
      await d1.run(db, 'DELETE FROM user_sessions WHERE token = ?', token);
    }
    return json({ success: true });
  }

  // Staff Users List
  if (path === '/api/auth/users' && method === 'GET') {
    const users = await d1.all(
      db,
      'SELECT id, username, plain_password, full_name, role, is_active, created_at, last_login FROM users ORDER BY id ASC'
    );
    return json(users);
  }

  // Create Staff User
  if (path === '/api/auth/users' && method === 'POST') {
    const { username, password, fullName, role } = body;
    if (!username || !password || !fullName) return err('Username, password, and full name are required', 400);

    const existing = await d1.get(db, 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)', username);
    if (existing) return err('Username already exists', 400);

    const { hash, salt } = hashPassword(password);
    const res = await d1.run(
      db,
      'INSERT INTO users (username, password_hash, salt, plain_password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      username.trim(), hash, salt, password, fullName.trim(), role || 'technician'
    );
    return json({ id: res.lastInsertRowid, username, fullName, role }, 201);
  }

  // Change Staff Password
  if (path === '/api/auth/password' && method === 'PUT') {
    const { oldPassword, newPassword, userId } = body;
    const targetUserId = userId || staffUser?.id || 1;

    if (!newPassword || newPassword.length < 6) {
      return err('New password must be at least 6 characters long', 400);
    }

    const user = await d1.get(db, 'SELECT * FROM users WHERE id = ?', targetUserId);
    if (!user) return err('User not found', 404);

    if (oldPassword && !verifyPassword(oldPassword, user.password_hash, user.salt, user.plain_password)) {
      return err('Current password is incorrect', 400);
    }

    const { hash, salt } = hashPassword(newPassword);
    await d1.run(
      db,
      'UPDATE users SET password_hash = ?, salt = ?, plain_password = ? WHERE id = ?',
      hash, salt, newPassword, user.id
    );

    return json({ success: true, message: 'Password updated successfully' });
  }

  // Toggle Staff User Status
  const userToggleMatch = path.match(/^\/api\/auth\/users\/(\d+)\/toggle$/);
  if (userToggleMatch && method === 'PUT') {
    const userId = userToggleMatch[1];
    await d1.run(db, 'UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?', userId);
    return json({ success: true });
  }

  // Delete Staff User
  const userDeleteMatch = path.match(/^\/api\/auth\/users\/(\d+)$/);
  if (userDeleteMatch && method === 'DELETE') {
    const userId = userDeleteMatch[1];
    if (userId === '1') return err('Primary administrator account cannot be deleted', 400);
    await d1.run(db, 'DELETE FROM users WHERE id = ?', userId);
    return json({ success: true });
  }

  // -------------------------------------------------------------
  // 2. DASHBOARD & KPIS
  // -------------------------------------------------------------
  if (path === '/api/dashboard' && method === 'GET') {
    const statusCounts = await d1.all(
      db,
      'SELECT status, COUNT(*) as count FROM tickets GROUP BY status'
    );

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
    (statusCounts || []).forEach((r) => {
      statusMap[r.status] = Number(r.count) || 0;
    });

    const activeRepairsRow = await d1.get(
      db,
      "SELECT COUNT(*) as count FROM tickets WHERE status NOT IN ('DELIVERED', 'CANCELLED')"
    );
    const activeRepairs = Number(activeRepairsRow?.count) || 0;

    const readyForPickup = statusMap.READY_FOR_PICKUP || 0;
    const deliveredCount = statusMap.DELIVERED || 0;

    const isFrontDesk = staffUser && staffUser.role === 'frontdesk';
    let totalRevenue = 0;
    let totalPending = 0;

    if (!isFrontDesk) {
      const revRow = await d1.get(
        db,
        `SELECT 
           COALESCE(SUM(amount_paid), 0) as total_revenue,
           COALESCE(SUM(balance_due), 0) as total_pending
         FROM invoices`
      );
      totalRevenue = revRow ? Number(revRow.total_revenue) : 0;
      let invoicePending = revRow ? Number(revRow.total_pending) : 0;

      // Include completed/delivered uninvoiced repair jobs with pending balance
      const allActiveTickets = await d1.all(
        db,
        `SELECT 
           t.id, t.estimated_cost, t.advance_paid,
           (SELECT COALESCE(SUM(total_price), 0) FROM ticket_parts WHERE ticket_id = t.id) as parts_sum
         FROM tickets t
         WHERE t.status IN ('READY_FOR_PICKUP', 'DELIVERED', 'RESOLVED')
           AND t.id NOT IN (SELECT ticket_id FROM invoices WHERE ticket_id IS NOT NULL)`
      );
      let ticketPending = 0;
      (allActiveTickets || []).forEach(t => {
        const parts = Number(t.parts_sum) || 0;
        const est = Number(t.estimated_cost) || 0;
        const jobTotal = Math.max(est, parts);
        const adv = Number(t.advance_paid) || 0;
        ticketPending += Math.max(0, jobTotal - adv);
      });
      totalPending = invoicePending + ticketPending;
    }

    const urgentTickets = await d1.all(
      db,
      `SELECT 
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
       LIMIT 5`
    );

    const lowStockItems = await d1.all(
      db,
      `SELECT id, sku, name, category, stock_quantity, min_threshold
       FROM inventory 
       WHERE stock_quantity <= min_threshold
       ORDER BY stock_quantity ASC`
    );

    const deviceBreakdown = await d1.all(
      db,
      `SELECT device_type, COUNT(*) as count
       FROM tickets
       GROUP BY device_type
       ORDER BY count DESC`
    );

    const recentActivity = await d1.all(
      db,
      `SELECT 
         tl.*,
         t.ticket_number,
         t.brand,
         t.model
       FROM timeline_logs tl
       JOIN tickets t ON tl.ticket_id = t.id
       ORDER BY tl.created_at DESC
       LIMIT 8`
    );

    return json({
      activeRepairs,
      readyForPickup,
      deliveredCount,
      inRepairCount: statusMap.IN_REPAIR || 0,
      inDiagnosisCount: statusMap.IN_DIAGNOSIS || 0,
      totalRevenue: isFrontDesk ? null : totalRevenue,
      totalPending: isFrontDesk ? null : totalPending,
      isRevenueDisabled: isFrontDesk,
      statusMap,
      urgentTickets: urgentTickets || [],
      lowStockItems: lowStockItems || [],
      deviceBreakdown: deviceBreakdown || [],
      recentActivity: recentActivity || []
    });
  }

  // Revenue & Financial Analytics
  if ((path === '/api/revenue' || path === '/api/revenue/' || path === '/api/revenue/analytics' || path === '/api/dashboard/analytics') && method === 'GET') {
    if (staffUser && staffUser.role === 'frontdesk') {
      return err('Access denied: Revenue and financial analytics are restricted.', 403);
    }

    // 1. Total Revenue All-Time
    const allTimeRev = await d1.get(
      db,
      `SELECT 
         COALESCE(SUM(amount_paid), 0) as total_revenue,
         COALESCE(SUM(grand_total), 0) as total_billed,
         COALESCE(SUM(balance_due), 0) as total_due,
         COUNT(id) as total_invoices
       FROM invoices`
    );

    // Month Revenue
    const monthRev = await d1.get(
      db,
      `SELECT 
         COALESCE(SUM(amount_paid), 0) as month_revenue,
         COALESCE(SUM(grand_total), 0) as month_billed,
         COALESCE(SUM(balance_due), 0) as month_due,
         COUNT(id) as month_invoices
       FROM invoices
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );

    // 2. Comprehensive Customer-Wise Due Breakdown (Invoices + Active Uninvoiced Repair Jobs)
    const allCustomers = await d1.all(db, 'SELECT id, name, phone, email FROM customers ORDER BY name ASC');
    const allInvoices = await d1.all(
      db,
      `SELECT inv.*, c.name as customer_name, c.phone as customer_phone, t.ticket_number
       FROM invoices inv
       JOIN customers c ON inv.customer_id = c.id
       LEFT JOIN tickets t ON inv.ticket_id = t.id`
    );
    const allActiveTickets = await d1.all(
      db,
      `SELECT 
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
       WHERE t.status IN ('READY_FOR_PICKUP', 'DELIVERED', 'RESOLVED')`
    );

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
      if (inv.ticket_id != null) invoicedTicketIds.add(Number(inv.ticket_id));
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
      if (!invoicedTicketIds.has(Number(t.ticket_id))) {
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
    const monthInvoiceStats = await d1.get(
      db,
      `SELECT 
         COALESCE(SUM(labor_charges), 0) as labor_total,
         COALESCE(SUM(parts_total), 0) as parts_total,
         COALESCE(SUM(discount), 0) as discount_total,
         COALESCE(SUM(tax_amount), 0) as tax_total,
         COALESCE(SUM(grand_total), 0) as grand_total,
         COALESCE(SUM(amount_paid), 0) as amount_paid
       FROM invoices
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );

    const monthPartsCostRow = await d1.get(
      db,
      `SELECT 
         COALESCE(SUM(tp.quantity * COALESCE(i.cost_price, 0)), 0) as parts_cost
       FROM ticket_parts tp
       JOIN invoices inv ON tp.ticket_id = inv.ticket_id
       LEFT JOIN inventory i ON tp.inventory_id = i.id
       WHERE strftime('%Y-%m', inv.created_at) = strftime('%Y-%m', 'now')`
    );

    const laborIncome = Number(monthInvoiceStats?.labor_total || 0);
    const partsRevenue = Number(monthInvoiceStats?.parts_total || 0);
    const partsCost = Number(monthPartsCostRow?.parts_cost || 0);
    const discountGiven = Number(monthInvoiceStats?.discount_total || 0);
    const partsMargin = Math.max(0, partsRevenue - partsCost);
    const totalProfitThisMonth = Math.max(0, (laborIncome + partsMargin) - discountGiven);

    // 4. Total Purchase This Month
    const monthPurchaseRow = await d1.get(
      db,
      `SELECT 
         COALESCE(SUM(cost_price * stock_quantity), 0) as total_purchase,
         COALESCE(SUM(stock_quantity), 0) as units_purchased,
         COUNT(*) as items_count
       FROM inventory
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );

    // 5. Total Unused Stock Amount (Current Inventory Valuation)
    const unusedStockRow = await d1.get(
      db,
      `SELECT 
         COALESCE(SUM(cost_price * stock_quantity), 0) as total_unused_stock_cost,
         COALESCE(SUM(selling_price * stock_quantity), 0) as total_unused_stock_retail,
         COALESCE(SUM(stock_quantity), 0) as total_stock_units,
         COUNT(*) as distinct_skus
       FROM inventory
       WHERE stock_quantity > 0`
    );

    return json({
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
  }

  // -------------------------------------------------------------
  // 3. TICKETS
  // -------------------------------------------------------------

  // List Tickets
  if (path === '/api/tickets' && method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const priority = url.searchParams.get('priority') || '';
    const techId = url.searchParams.get('technician_id') || '';

    let sql = `
      SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             tech.name as technician_name,
             (SELECT COUNT(*) FROM ticket_parts WHERE ticket_id = t.id) as parts_count
      FROM tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (t.ticket_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR t.model LIKE ? OR t.brand LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (status && status !== 'ALL') {
      sql += ` AND t.status = ?`;
      params.push(status);
    }
    if (priority && priority !== 'ALL') {
      sql += ` AND t.priority = ?`;
      params.push(priority);
    }
    if (techId) {
      sql += ` AND t.technician_id = ?`;
      params.push(techId);
    }

    sql += ` ORDER BY t.created_at DESC`;
    const tickets = await d1.all(db, sql, ...params);
    return json(tickets);
  }

  // Create Ticket
  if (path === '/api/tickets' && method === 'POST') {
    let {
      customer_id, customer_name, customer_phone, customer_email, customer_address,
      device_type, brand, model, serial_number, device_password, accessories,
      physical_condition, inspection_checklist, problem_description,
      priority, technician_id, estimated_cost, estimated_delivery, advance_paid
    } = body;

    if (!problem_description) return err('Problem description is required', 400);

    // Resolve or create customer
    if (!customer_id) {
      if (!customer_phone || !customer_name) {
        return err('Customer name and phone are required', 400);
      }
      let existingCust = await d1.get(db, 'SELECT id FROM customers WHERE phone = ?', customer_phone.trim());
      if (existingCust) {
        customer_id = existingCust.id;
      } else {
        const custRes = await d1.run(
          db,
          'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
          customer_name.trim(), customer_phone.trim(), customer_email || null, customer_address || null
        );
        customer_id = custRes.lastInsertRowid;
      }
    }

    const ticketNumber = await generateTicketNumber(db);

    const res = await d1.run(
      db,
      `INSERT INTO tickets (
        ticket_number, customer_id, device_type, brand, model, serial_number,
        device_password, accessories, physical_condition, inspection_checklist,
        problem_description, priority, status, technician_id, estimated_cost,
        estimated_delivery, advance_paid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ticketNumber, customer_id, device_type || 'Laptop', brand || '', model || '',
      serial_number || '', device_password || '',
      typeof accessories === 'object' ? JSON.stringify(accessories) : (accessories || '[]'),
      typeof physical_condition === 'object' ? JSON.stringify(physical_condition) : (physical_condition || '[]'),
      typeof inspection_checklist === 'object' ? JSON.stringify(inspection_checklist) : (inspection_checklist || '{}'),
      problem_description, priority || 'Normal', technician_id || null,
      Number(estimated_cost) || 0, estimated_delivery || null, Number(advance_paid) || 0
    );

    const ticketId = res.lastInsertRowid;

    // Log timeline
    await d1.run(
      db,
      'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
      ticketId, 'Ticket Created', `Device received for repair: ${problem_description}`, staffUser?.fullName || 'Staff'
    );

    const created = await d1.get(db, 'SELECT * FROM tickets WHERE id = ?', ticketId);
    return json(created, 201);
  }

  // Get Ticket Detail
  const ticketDetailMatch = path.match(/^\/api\/tickets\/(\d+)$/);
  if (ticketDetailMatch && method === 'GET') {
    const ticketId = ticketDetailMatch[1];
    const ticket = await d1.get(
      db,
      `SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address,
              tech.name as technician_name, tech.phone as technician_phone
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN technicians tech ON t.technician_id = tech.id
       WHERE t.id = ?`,
      ticketId
    );
    if (!ticket) return err('Ticket not found', 404);

    // Parse JSON string fields safely for frontend components
    ticket.accessories = safeParse(ticket.accessories, []);
    ticket.physical_condition = safeParse(ticket.physical_condition, []);
    ticket.inspection_checklist = safeParse(ticket.inspection_checklist, {});

    const parts = await d1.all(
      db,
      `SELECT tp.*, i.sku, i.category
       FROM ticket_parts tp
       LEFT JOIN inventory i ON tp.inventory_id = i.id
       WHERE tp.ticket_id = ?
       ORDER BY tp.created_at ASC`,
      ticketId
    );

    const timeline = await d1.all(
      db,
      'SELECT * FROM timeline_logs WHERE ticket_id = ? ORDER BY created_at DESC',
      ticketId
    );

    const invoice = await d1.get(
      db,
      'SELECT * FROM invoices WHERE ticket_id = ? ORDER BY id DESC LIMIT 1',
      ticketId
    );

    return json({ ...ticket, parts, timeline, invoice });
  }

  // Update Ticket
  if (ticketDetailMatch && method === 'PUT') {
    const ticketId = ticketDetailMatch[1];
    const fields = ['device_type', 'brand', 'model', 'serial_number', 'device_password',
      'accessories', 'physical_condition', 'inspection_checklist', 'problem_description',
      'diagnosis_notes', 'internal_notes', 'priority', 'technician_id', 'estimated_cost',
      'estimated_delivery', 'customer_approved', 'advance_paid'];

    const updates = [];
    const values = [];

    for (const key of fields) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`);
        let val = body[key];
        if (['accessories', 'physical_condition', 'inspection_checklist'].includes(key) && typeof val === 'object') {
          val = JSON.stringify(val);
        } else if (key === 'technician_id' && (val === '' || val === undefined)) {
          val = null;
        }
        values.push(val);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(ticketId);
      await d1.run(db, `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, ...values);
    }

    const updated = await d1.get(db, 'SELECT * FROM tickets WHERE id = ?', ticketId);
    return json(updated);
  }

  // Update Ticket Status
  const ticketStatusMatch = path.match(/^\/api\/tickets\/(\d+)\/status$/);
  if (ticketStatusMatch && method === 'POST') {
    const ticketId = ticketStatusMatch[1];
    const { status, note, actor } = body;
    if (!status) return err('Status is required', 400);

    const isDelivered = status === 'DELIVERED';
    await d1.run(
      db,
      `UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP ${isDelivered ? ', delivered_at = CURRENT_TIMESTAMP' : ''} WHERE id = ?`,
      status, ticketId
    );

    await d1.run(
      db,
      'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
      ticketId, `Status: ${status}`, note || `Status updated to ${status}`, actor || staffUser?.fullName || 'Staff'
    );

    const updated = await d1.get(db, 'SELECT * FROM tickets WHERE id = ?', ticketId);
    return json(updated);
  }

  // Attach Spare Part to Ticket
  const ticketPartAddMatch = path.match(/^\/api\/tickets\/(\d+)\/parts$/);
  if (ticketPartAddMatch && method === 'POST') {
    const ticketId = ticketPartAddMatch[1];
    const { inventory_id, part_name, serial_no, quantity = 1, unit_price = 0 } = body;
    if (!part_name) return err('Part name is required', 400);

    const qty = Number(quantity) || 1;
    const price = Number(unit_price) || 0;
    const total = qty * price;

    const res = await d1.run(
      db,
      `INSERT INTO ticket_parts (ticket_id, inventory_id, part_name, serial_no, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ticketId, inventory_id || null, part_name, serial_no || null, qty, price, total
    );

    // Auto-decrement inventory stock if linked
    if (inventory_id) {
      await d1.run(
        db,
        'UPDATE inventory SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?',
        qty, inventory_id
      );
    }

    await d1.run(
      db,
      'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
      ticketId, 'Part Attached', `Added ${qty}x ${part_name} (${serial_no ? `S/N: ${serial_no}` : '₹' + total})`, staffUser?.fullName || 'Technician'
    );

    return json({ id: res.lastInsertRowid, ticket_id: ticketId, part_name, quantity: qty, unit_price: price, total_price: total }, 201);
  }

  // Remove Spare Part from Ticket
  const ticketPartDeleteMatch = path.match(/^\/api\/tickets\/(\d+)\/parts\/(\d+)$/);
  if (ticketPartDeleteMatch && method === 'DELETE') {
    const ticketId = ticketPartDeleteMatch[1];
    const partId = ticketPartDeleteMatch[2];

    const part = await d1.get(db, 'SELECT * FROM ticket_parts WHERE id = ? AND ticket_id = ?', partId, ticketId);
    if (part) {
      if (part.inventory_id) {
        await d1.run(db, 'UPDATE inventory SET stock_quantity = stock_quantity + ? WHERE id = ?', part.quantity, part.inventory_id);
      }
      await d1.run(db, 'DELETE FROM ticket_parts WHERE id = ?', partId);
      await d1.run(
        db,
        'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
        ticketId, 'Part Removed', `Removed spare part: ${part.part_name}`, staffUser?.fullName || 'Technician'
      );
    }
    return json({ success: true });
  }

  // Add Ticket Timeline Note
  const ticketTimelineMatch = path.match(/^\/api\/tickets\/(\d+)\/timeline$/);
  if (ticketTimelineMatch && method === 'POST') {
    const ticketId = ticketTimelineMatch[1];
    const { action, description, actor } = body;
    if (!description) return err('Description is required', 400);

    const res = await d1.run(
      db,
      'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
      ticketId, action || 'Note Added', description, actor || staffUser?.fullName || 'Staff'
    );
    return json({ id: res.lastInsertRowid, ticket_id: ticketId, action, description }, 201);
  }

  // -------------------------------------------------------------
  // 4. INVENTORY & SPARE PARTS
  // -------------------------------------------------------------
  if (path === '/api/inventory' && method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    let sql = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR brand_compat LIKE ?)';
      const t = `%${search}%`;
      params.push(t, t, t);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY name ASC';
    const items = await d1.all(db, sql, ...params);
    return json(items);
  }

  if (path === '/api/inventory/categories' && method === 'GET') {
    const rows = await d1.all(db, 'SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category != "" ORDER BY category ASC');
    return json(rows.map(r => r.category));
  }

  if (path === '/api/inventory/deduplicate' && method === 'POST') {
    const allItems = await d1.all(db, 'SELECT * FROM inventory ORDER BY id ASC');
    const groups = {};

    (allItems || []).forEach(item => {
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
        await d1.run(db, 'UPDATE ticket_parts SET inventory_id = ? WHERE inventory_id = ?', primary.id, dup.id);
        await d1.run(db, 'DELETE FROM inventory WHERE id = ?', dup.id);
        removedIds.push(dup.id);
        mergedCount++;
      }
    }

    return json({
      success: true,
      message: mergedCount > 0 ? `Successfully removed ${mergedCount} duplicate item(s)` : 'No duplicates found in warehouse inventory',
      mergedCount,
      removedIds
    });
  }

  if (path === '/api/inventory' && method === 'POST') {
    let { sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location } = body;
    if (!name) return err('Part name is required', 400);

    const trimmedName = name.trim();
    if (!sku) {
      const prefix = (category || 'PART').substring(0, 3).toUpperCase();
      sku = `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    const existing = await d1.get(
      db,
      `SELECT id, name, sku, stock_quantity FROM inventory 
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) 
          OR (sku IS NOT NULL AND sku != '' AND LOWER(TRIM(sku)) = LOWER(TRIM(?)))
       LIMIT 1`,
      trimmedName, sku
    );
    if (existing) {
      return err(`A part named "${existing.name}" already exists in inventory (SKU: ${existing.sku}, Current Stock: ${existing.stock_quantity}). Please update existing stock instead.`, 400);
    }

    const res = await d1.run(
      db,
      `INSERT INTO inventory (sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sku, trimmedName, category || 'General', brand_compat || '', serial_no || null,
      Number(cost_price) || 0, Number(selling_price) || 0, Number(stock_quantity) || 0,
      Number(min_threshold) || 3, location || ''
    );

    const created = await d1.get(db, 'SELECT * FROM inventory WHERE id = ?', res.lastInsertRowid);
    return json(created, 201);
  }

  const inventoryItemMatch = path.match(/^\/api\/inventory\/(\d+)$/);
  if (inventoryItemMatch && method === 'GET') {
    const item = await d1.get(db, 'SELECT * FROM inventory WHERE id = ?', inventoryItemMatch[1]);
    if (!item) return err('Item not found', 404);
    return json(item);
  }

  if (inventoryItemMatch && method === 'PUT') {
    const id = inventoryItemMatch[1];
    const { sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location } = body;

    await d1.run(
      db,
      `UPDATE inventory SET sku = ?, name = ?, category = ?, brand_compat = ?, serial_no = ?,
              cost_price = ?, selling_price = ?, stock_quantity = ?, min_threshold = ?, location = ?
       WHERE id = ?`,
      sku, name, category, brand_compat, serial_no,
      Number(cost_price) || 0, Number(selling_price) || 0, Number(stock_quantity) || 0,
      Number(min_threshold) || 3, location, id
    );
    const updated = await d1.get(db, 'SELECT * FROM inventory WHERE id = ?', id);
    return json(updated);
  }

  const stockAdjustMatch = path.match(/^\/api\/inventory\/(\d+)\/stock$/);
  if (stockAdjustMatch && method === 'POST') {
    const id = stockAdjustMatch[1];
    const { change } = body;
    await d1.run(db, 'UPDATE inventory SET stock_quantity = MAX(0, stock_quantity + ?) WHERE id = ?', Number(change) || 0, id);
    const updated = await d1.get(db, 'SELECT * FROM inventory WHERE id = ?', id);
    return json(updated);
  }

  if (inventoryItemMatch && method === 'DELETE') {
    await d1.run(db, 'DELETE FROM inventory WHERE id = ?', inventoryItemMatch[1]);
    return json({ success: true });
  }

  // -------------------------------------------------------------
  // 5. CUSTOMERS
  // -------------------------------------------------------------
  if (path === '/api/customers' && method === 'GET') {
    const search = url.searchParams.get('search') || '';
    let sql = `
      SELECT c.*,
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
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      const t = `%${search}%`;
      params.push(t, t, t);
    }
    sql += ' ORDER BY c.name ASC';
    const customers = await d1.all(db, sql, ...params);
    return json(customers);
  }

  const customerDetailMatch = path.match(/^\/api\/customers\/(\d+)$/);
  if (customerDetailMatch && method === 'GET') {
    const id = customerDetailMatch[1];
    const customer = await d1.get(db, 'SELECT * FROM customers WHERE id = ?', id);
    if (!customer) return err('Customer not found', 404);
    const tickets = await d1.all(
      db,
      `SELECT t.*,
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
       ORDER BY t.created_at DESC`,
      id
    );
    const invoices = await d1.all(db, 'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC', id);
    const totalDue = invoices.reduce((sum, i) => sum + (Number(i.balance_due) || 0), 0);
    return json({ ...customer, tickets, invoices, total_due: totalDue });
  }

  if (path === '/api/customers' && method === 'POST') {
    const { name, phone, alt_phone, email, address, notes } = body;
    if (!name || !phone) return err('Name and phone are required', 400);

    const existing = await d1.get(db, 'SELECT id FROM customers WHERE phone = ?', phone.trim());
    if (existing) return err('Customer with this phone number already exists', 400);

    const res = await d1.run(
      db,
      'INSERT INTO customers (name, phone, alt_phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)',
      name.trim(), phone.trim(), alt_phone || null, email || null, address || null, notes || null
    );
    const created = await d1.get(db, 'SELECT * FROM customers WHERE id = ?', res.lastInsertRowid);
    return json(created, 201);
  }

  if (customerDetailMatch && method === 'PUT') {
    const id = customerDetailMatch[1];
    const { name, phone, alt_phone, email, address, notes } = body;
    await d1.run(
      db,
      'UPDATE customers SET name = ?, phone = ?, alt_phone = ?, email = ?, address = ?, notes = ? WHERE id = ?',
      name, phone, alt_phone, email, address, notes, id
    );
    const updated = await d1.get(db, 'SELECT * FROM customers WHERE id = ?', id);
    return json(updated);
  }

  // Delete Customer (supports force=true to cascade delete associated tickets & invoices)
  if (customerDetailMatch && method === 'DELETE') {
    const customerId = customerDetailMatch[1];
    const force = url.searchParams.get('force') === 'true';

    const countRow = await d1.get(db, 'SELECT COUNT(*) as count FROM tickets WHERE customer_id = ?', customerId);
    const ticketCount = Number(countRow?.count) || 0;

    if (ticketCount > 0 && !force) {
      return err(
        `Cannot delete customer with ${ticketCount} existing repair ticket(s). Confirm force deletion to remove customer along with associated repair records.`,
        400
      );
    }

    if (ticketCount > 0 && force) {
      await d1.run(db, 'DELETE FROM invoices WHERE customer_id = ?', customerId);
      const tickets = await d1.all(db, 'SELECT id FROM tickets WHERE customer_id = ?', customerId);
      for (const t of tickets) {
        await d1.run(db, 'DELETE FROM ticket_parts WHERE ticket_id = ?', t.id);
        await d1.run(db, 'DELETE FROM timeline_logs WHERE ticket_id = ?', t.id);
      }
      await d1.run(db, 'DELETE FROM tickets WHERE customer_id = ?', customerId);
    }

    await d1.run(db, 'DELETE FROM customers WHERE id = ?', customerId);
    return json({ success: true });
  }

  // -------------------------------------------------------------
  // 6. TECHNICIANS
  // -------------------------------------------------------------
  if (path === '/api/technicians' && method === 'GET') {
    const techs = await d1.all(
      db,
      `SELECT tech.*,
              (SELECT COUNT(*) FROM tickets WHERE technician_id = tech.id AND status NOT IN ('DELIVERED', 'CANCELLED')) as active_jobs
       FROM technicians tech
       ORDER BY tech.name ASC`
    );
    return json(techs);
  }

  if (path === '/api/technicians' && method === 'POST') {
    const { name, phone, email, specialization, status } = body;
    if (!name) return err('Name is required', 400);

    const res = await d1.run(
      db,
      'INSERT INTO technicians (name, phone, email, specialization, status) VALUES (?, ?, ?, ?, ?)',
      name.trim(), phone || '', email || '', specialization || '', status || 'Active'
    );
    const created = await d1.get(db, 'SELECT * FROM technicians WHERE id = ?', res.lastInsertRowid);
    return json(created, 201);
  }

  const techDetailMatch = path.match(/^\/api\/technicians\/(\d+)$/);
  if (techDetailMatch && method === 'PUT') {
    const id = techDetailMatch[1];
    const { name, phone, email, specialization, status } = body;
    await d1.run(
      db,
      'UPDATE technicians SET name = ?, phone = ?, email = ?, specialization = ?, status = ? WHERE id = ?',
      name, phone, email, specialization, status, id
    );
    const updated = await d1.get(db, 'SELECT * FROM technicians WHERE id = ?', id);
    return json(updated);
  }

  if (techDetailMatch && method === 'DELETE') {
    const techId = techDetailMatch[1];
    // Safely unassign technician from existing tickets before deletion
    await d1.run(db, 'UPDATE tickets SET technician_id = NULL WHERE technician_id = ?', techId);
    await d1.run(db, 'DELETE FROM technicians WHERE id = ?', techId);
    return json({ success: true });
  }

  const techTicketsMatch = path.match(/^\/api\/technicians\/(\d+)\/tickets$/);
  if (techTicketsMatch && method === 'GET') {
    const tickets = await d1.all(
      db,
      `SELECT t.*, c.name as customer_name, c.phone as customer_phone
       FROM tickets t
       JOIN customers c ON t.customer_id = c.id
       WHERE t.technician_id = ?
       ORDER BY t.created_at DESC`,
      techTicketsMatch[1]
    );
    return json(tickets);
  }

  // -------------------------------------------------------------
  // 7. INVOICES & BILLING
  // -------------------------------------------------------------
  if (path === '/api/invoices' && method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    let sql = `
      SELECT inv.*, c.name as customer_name, c.phone as customer_phone,
             t.ticket_number, t.brand as device_brand, t.model as device_model
      FROM invoices inv
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN tickets t ON inv.ticket_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      sql += ` AND inv.payment_status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ' AND (inv.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR t.ticket_number LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    sql += ' ORDER BY inv.created_at DESC';
    const invoices = await d1.all(db, sql, ...params);
    return json(invoices);
  }

  const invoiceDetailMatch = path.match(/^\/api\/invoices\/(\d+)$/);
  if (invoiceDetailMatch && method === 'GET') {
    const id = invoiceDetailMatch[1];
    const invoice = await d1.get(
      db,
      `SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address,
              t.ticket_number, t.device_type, t.brand as device_brand, t.model as device_model, t.serial_number,
              t.problem_description, t.diagnosis_notes, tech.name as technician_name
       FROM invoices inv
       LEFT JOIN customers c ON inv.customer_id = c.id
       LEFT JOIN tickets t ON inv.ticket_id = t.id
       LEFT JOIN technicians tech ON t.technician_id = tech.id
       WHERE inv.id = ?`,
      id
    );
    if (!invoice) return err('Invoice not found', 404);

    let parts = [];
    if (invoice.ticket_id) {
      parts = await d1.all(db, 'SELECT * FROM ticket_parts WHERE ticket_id = ?', invoice.ticket_id);
    }

    const settings = await d1.get(db, 'SELECT * FROM settings WHERE id = 1');

    return json({ ...invoice, parts, settings });
  }

  if (path === '/api/invoices' && method === 'POST') {
    const { ticket_id, customer_id, labor_charges, parts_total, tax_rate, discount, advance_deducted, amount_paid, payment_method, notes } = body;

    let targetCustomerId = customer_id;
    let targetAdvance = Number(advance_deducted) || 0;
    let parts = Math.max(0, Number(parts_total) || 0);

    // If ticket_id provided, verify ticket & existing invoice
    if (ticket_id) {
      const ticket = await d1.get(db, 'SELECT * FROM tickets WHERE id = ?', ticket_id);
      if (!ticket) return err('Ticket not found', 404);
      targetCustomerId = targetCustomerId || ticket.customer_id;
      if (advance_deducted === undefined) {
        targetAdvance = Number(ticket.advance_paid || 0);
      }

      const existingInv = await d1.get(db, 'SELECT invoice_number FROM invoices WHERE ticket_id = ?', ticket_id);
      if (existingInv) {
        return err(`An invoice (${existingInv.invoice_number}) already exists for this repair job`, 409);
      }

      // Automatically query parts sum from ticket_parts to ensure parts total is accurate
      const partsSumRow = await d1.get(
        db,
        'SELECT COALESCE(SUM(total_price), 0) as total FROM ticket_parts WHERE ticket_id = ?',
        ticket_id
      );
      if (partsSumRow && partsSumRow.total !== undefined && partsSumRow.total !== null) {
        const dbPartsTotal = Math.round(Number(partsSumRow.total) * 100) / 100;
        if (dbPartsTotal > 0 || !parts) {
          parts = dbPartsTotal;
        }
      }
    }

    if (!targetCustomerId) return err('Customer ID is required', 400);

    const labor = Math.max(0, Number(labor_charges) || 0);
    const subtotal = Math.round((labor + parts) * 100) / 100;
    const rate = Math.max(0, Math.min(100, Number(tax_rate) || 0));
    const taxAmount = Math.round(((subtotal * rate) / 100) * 100) / 100;
    const disc = Math.max(0, Number(discount) || 0);
    const grandTotal = Math.max(0, Math.round((subtotal + taxAmount - disc) * 100) / 100);
    const adv = Math.max(0, targetAdvance);
    const paid = Math.max(0, Number(amount_paid) || 0);
    const totalPaid = Math.round((adv + paid) * 100) / 100;
    const balanceDue = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);
    const paymentStatus = balanceDue <= 0.01 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid');

    const invoiceNumber = await generateInvoiceNumber(db);

    const res = await d1.run(
      db,
      `INSERT INTO invoices (
        invoice_number, ticket_id, customer_id, labor_charges, parts_total,
        subtotal, tax_rate, tax_amount, discount, grand_total, advance_deducted,
        amount_paid, balance_due, payment_method, payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      invoiceNumber, ticket_id || null, targetCustomerId, labor, parts,
      subtotal, rate, taxAmount, disc, grandTotal, adv, totalPaid, balanceDue,
      payment_method || 'Cash', paymentStatus, notes || ''
    );

    if (ticket_id) {
      await d1.run(
        db,
        'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
        ticket_id, 'Invoice Generated', `Invoice ${invoiceNumber} generated for ₹${grandTotal.toLocaleString()}. Status: ${paymentStatus}`, 'Billing'
      );
    }

    const created = await d1.get(db, 'SELECT * FROM invoices WHERE id = ?', res.lastInsertRowid);
    return json(created, 201);
  }

  const invoicePaymentMatch = path.match(/^\/api\/invoices\/(\d+)\/payment$/);
  if (invoicePaymentMatch && method === 'POST') {
    const id = invoicePaymentMatch[1];
    const { amount, payment_method } = body;
    const payment = Number(amount) || 0;
    if (payment <= 0) return err('Valid payment amount required', 400);

    const inv = await d1.get(db, 'SELECT * FROM invoices WHERE id = ?', id);
    if (!inv) return err('Invoice not found', 404);

    if (Number(inv.balance_due) <= 0) {
      return err('Invoice is already fully paid', 400);
    }

    const curPaid = Number(inv.amount_paid) || 0;
    const curTotal = Number(inv.grand_total) || 0;
    const newPaid = Math.round((curPaid + payment) * 100) / 100;
    const newBalance = Math.max(0, Math.round((curTotal - newPaid) * 100) / 100);
    const newStatus = newBalance <= 0.01 ? 'Paid' : 'Partial';

    await d1.run(
      db,
      'UPDATE invoices SET amount_paid = ?, balance_due = ?, payment_status = ?, payment_method = ? WHERE id = ?',
      newPaid, newBalance, newStatus, payment_method || inv.payment_method, id
    );

    if (inv.ticket_id) {
      await d1.run(
        db,
        'INSERT INTO timeline_logs (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)',
        inv.ticket_id, 'Payment Received', `Payment of ₹${payment.toLocaleString()} received via ${payment_method || 'Cash'}. Remaining balance: ₹${newBalance.toLocaleString()}`, staffUser?.fullName || 'Cashier'
      );
    }

    const updated = await d1.get(db, 'SELECT * FROM invoices WHERE id = ?', id);
    return json(updated);
  }

  // -------------------------------------------------------------
  // 8. SETTINGS, STATS, BACKUP & RESTORE
  // -------------------------------------------------------------
  if (path === '/api/settings' && method === 'GET') {
    let settings = await d1.get(db, 'SELECT * FROM settings LIMIT 1');
    if (!settings) {
      settings = {
        shop_name: 'SSC TechCare Computer Solutions',
        shop_phone: '+91 98765 43210',
        shop_email: 'support@ssctechcare.com',
        shop_address: 'Shop #12, First Floor, Silicon Arcade, Tech Park Road',
        tax_rate: 18.0,
        currency_symbol: '₹'
      };
    }
    return json(settings);
  }

  if (path === '/api/settings' && method === 'PUT') {
    const { shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions } = body;
    await d1.run(
      db,
      `UPDATE settings SET shop_name = ?, shop_phone = ?, shop_email = ?, shop_address = ?,
              tax_rate = ?, currency_symbol = ?, terms_conditions = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      shop_name, shop_phone, shop_email, shop_address,
      Number(tax_rate) || 18.0, currency_symbol || '₹', terms_conditions
    );
    const updated = await d1.get(db, 'SELECT * FROM settings WHERE id = 1');
    return json(updated);
  }

  if (path === '/api/settings/system-stats' && method === 'GET') {
    const tCount = await d1.get(db, 'SELECT COUNT(*) as c FROM tickets');
    const cCount = await d1.get(db, 'SELECT COUNT(*) as c FROM customers');
    const iCount = await d1.get(db, 'SELECT COUNT(*) as c FROM inventory');
    const invCount = await d1.get(db, 'SELECT COUNT(*) as c FROM invoices');

    return json({
      engine: 'Cloudflare D1 (Edge SQLite)',
      tables: 12,
      tickets: tCount?.c || 0,
      customers: cCount?.c || 0,
      inventory: iCount?.c || 0,
      invoices: invCount?.c || 0
    });
  }

  // Export System Backup JSON
  if (path === '/api/settings/backup' && method === 'GET') {
    const tableNames = [
      'settings',
      'customers',
      'technicians',
      'inventory',
      'tickets',
      'ticket_parts',
      'timeline_logs',
      'invoices',
      'users',
      'master_accounts'
    ];
    const backupData = {
      app: 'SSC TechCare Service Center Management System',
      version: '2.0.0',
      database: 'Cloudflare D1',
      exported_at: new Date().toISOString(),
      tables: {}
    };
    for (const tbl of tableNames) {
      backupData.tables[tbl] = await d1.all(db, `SELECT * FROM ${tbl} ORDER BY id ASC`);
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    return json(backupData, 200, {
      'Content-Disposition': `attachment; filename="SSC_TechCare_Backup_${dateStr}.json"`
    });
  }

  // Restore System Backup JSON
  if (path === '/api/settings/restore' && method === 'POST') {
    let backupData = body;
    if (typeof body === 'string') {
      try {
        backupData = JSON.parse(body);
      } catch {
        return err('Invalid JSON backup file', 400);
      }
    }
    if (!backupData?.tables) return err('Backup file does not contain valid table data', 400);

    const { tables } = backupData;
    const required = ['settings', 'customers', 'technicians', 'inventory', 'tickets'];
    for (const req of required) {
      if (!tables[req]) return err(`Missing required table in backup: ${req}`, 400);
    }

    // Clear tables in reverse dependency order
    const clearOrder = ['timeline_logs', 'ticket_parts', 'invoices', 'tickets', 'inventory', 'technicians', 'customers', 'settings'];
    for (const t of clearOrder) {
      await d1.run(db, `DELETE FROM ${t}`);
    }

    // Restore settings
    if (tables.settings?.length > 0) {
      const s = tables.settings[0];
      await d1.run(
        db,
        `INSERT OR REPLACE INTO settings (id, shop_name, shop_phone, shop_email, shop_address, tax_rate, currency_symbol, terms_conditions, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        s.shop_name, s.shop_phone, s.shop_email, s.shop_address, s.tax_rate || 18, s.currency_symbol || '₹', s.terms_conditions || ''
      );
    }

    // Restore customers
    for (const c of (tables.customers || [])) {
      await d1.run(
        db,
        `INSERT INTO customers (id, name, phone, alt_phone, email, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, c.name, c.phone, c.alt_phone, c.email, c.address, c.notes, c.created_at || new Date().toISOString()
      );
    }

    // Restore technicians
    for (const tech of (tables.technicians || [])) {
      await d1.run(
        db,
        `INSERT INTO technicians (id, name, phone, email, specialization, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        tech.id, tech.name, tech.phone, tech.email, tech.specialization, tech.status || 'Active', tech.created_at || new Date().toISOString()
      );
    }

    // Restore inventory
    for (const inv of (tables.inventory || [])) {
      await d1.run(
        db,
        `INSERT INTO inventory (id, sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        inv.id, inv.sku, inv.name, inv.category, inv.brand_compat, inv.serial_no || null,
        inv.cost_price || 0, inv.selling_price || 0, inv.stock_quantity || 0, inv.min_threshold || 3, inv.location || '', inv.created_at || new Date().toISOString()
      );
    }

    // Restore tickets
    for (const tk of (tables.tickets || [])) {
      await d1.run(
        db,
        `INSERT INTO tickets (
          id, ticket_number, customer_id, device_type, brand, model, serial_number, device_password,
          accessories, physical_condition, inspection_checklist, problem_description, diagnosis_notes,
          internal_notes, priority, status, technician_id, estimated_cost, estimated_delivery,
          customer_approved, advance_paid, created_at, updated_at, delivered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        tk.id, tk.ticket_number, tk.customer_id, tk.device_type, tk.brand, tk.model, tk.serial_number, tk.device_password,
        typeof tk.accessories === 'object' ? JSON.stringify(tk.accessories) : tk.accessories,
        typeof tk.physical_condition === 'object' ? JSON.stringify(tk.physical_condition) : tk.physical_condition,
        typeof tk.inspection_checklist === 'object' ? JSON.stringify(tk.inspection_checklist) : tk.inspection_checklist,
        tk.problem_description, tk.diagnosis_notes, tk.internal_notes, tk.priority, tk.status, tk.technician_id,
        tk.estimated_cost, tk.estimated_delivery, tk.customer_approved || 0, tk.advance_paid || 0,
        tk.created_at || new Date().toISOString(), tk.updated_at || new Date().toISOString(), tk.delivered_at
      );
    }

    // Restore ticket_parts
    for (const tp of (tables.ticket_parts || [])) {
      await d1.run(
        db,
        `INSERT INTO ticket_parts (id, ticket_id, inventory_id, part_name, serial_no, quantity, unit_price, total_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        tp.id, tp.ticket_id, tp.inventory_id, tp.part_name, tp.serial_no || null, tp.quantity || 1, tp.unit_price || 0, tp.total_price || 0, tp.created_at || new Date().toISOString()
      );
    }

    // Restore timeline_logs
    for (const tl of (tables.timeline_logs || [])) {
      await d1.run(
        db,
        `INSERT INTO timeline_logs (id, ticket_id, action, description, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        tl.id, tl.ticket_id, tl.action, tl.description, tl.actor || 'Staff', tl.created_at || new Date().toISOString()
      );
    }

    // Restore invoices
    for (const inv of (tables.invoices || [])) {
      await d1.run(
        db,
        `INSERT INTO invoices (
          id, invoice_number, ticket_id, customer_id, labor_charges, parts_total, subtotal,
          tax_rate, tax_amount, discount, grand_total, advance_deducted, amount_paid,
          balance_due, payment_method, payment_status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        inv.id, inv.invoice_number, inv.ticket_id, inv.customer_id, inv.labor_charges || 0, inv.parts_total || 0, inv.subtotal || 0,
        inv.tax_rate || 0, inv.tax_amount || 0, inv.discount || 0, inv.grand_total || 0, inv.advance_deducted || 0, inv.amount_paid || 0,
        inv.balance_due || 0, inv.payment_method || 'Cash', inv.payment_status || 'Unpaid', inv.notes || '', inv.created_at || new Date().toISOString()
      );
    }

    return json({ success: true, message: 'Database restored successfully from backup' });
  }

  // -------------------------------------------------------------
  // 9. PUBLIC TRACKING LOOKUP (With PII Masking)
  // -------------------------------------------------------------
  const trackMatch = path.match(/^\/api\/track\/(.+)$/);
  if (trackMatch && method === 'GET') {
    const identifier = decodeURIComponent(trackMatch[1]).trim();
    if (!identifier || identifier.length < 3 || identifier.length > 50) {
      return err('Please provide a valid ticket number or phone number', 400);
    }

    const ticket = await d1.get(
      db,
      `SELECT t.ticket_number, t.device_type, t.brand, t.model, t.problem_description,
              t.status, t.priority, t.estimated_cost, t.estimated_delivery, t.created_at, t.delivered_at,
              c.name as customer_name, c.phone as customer_phone
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       WHERE t.ticket_number = ? OR c.phone = ?
       ORDER BY t.created_at DESC LIMIT 1`,
      identifier, identifier
    );

    if (!ticket) return err('No ticket found matching the given identifier', 404);

    const timeline = await d1.all(
      db,
      'SELECT action, description, created_at FROM timeline_logs WHERE ticket_id = (SELECT id FROM tickets WHERE ticket_number = ?) ORDER BY created_at ASC',
      ticket.ticket_number
    );

    return json({
      ticket: {
        ...ticket,
        customer_name: maskName(ticket.customer_name),
        customer_phone: maskPhone(ticket.customer_phone)
      },
      timeline: timeline || []
    });
  }

  // -------------------------------------------------------------
  // 10. HEALTH CHECK
  // -------------------------------------------------------------
  if (path === '/api/health') {
    return json({ status: 'ok', engine: 'Cloudflare D1 (Edge SQLite)', time: new Date().toISOString() });
  }

  return err(`API endpoint ${method} ${path} not found`, 404);
}
