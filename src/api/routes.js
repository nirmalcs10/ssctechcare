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
      `SELECT u.id, u.username, u.full_name, u.role, u.is_active, s.expires_at 
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

// Generate sequential ticket number
async function generateTicketNumber(db) {
  const year = new Date().getFullYear();
  const countRow = await d1.get(
    db,
    `SELECT COUNT(*) as count FROM tickets WHERE ticket_number LIKE ?`,
    `TC-${year}-%`
  );
  const nextNum = (countRow?.count || 0) + 1;
  return `TC-${year}-${String(nextNum).padStart(4, '0')}`;
}

// Generate sequential invoice number
async function generateInvoiceNumber(db) {
  const year = new Date().getFullYear();
  const countRow = await d1.get(
    db,
    `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?`,
    `INV-${year}-%`
  );
  const nextNum = (countRow?.count || 0) + 1;
  return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
}

export async function handleApiRequest(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // Parse body safely for write methods
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const { staffUser, masterUser } = await getAuthContext(request, db);

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

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await d1.run(
      db,
      'INSERT INTO master_sessions (token, master_account_id, expires_at) VALUES (?, ?, ?)',
      token, account.id, expiresAt
    );
    await d1.run(db, 'UPDATE master_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', account.id);

    return json({
      masterToken: token,
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
    const { masterToken } = await getAuthContext(request, db);
    if (masterToken) {
      await d1.run(db, 'DELETE FROM master_sessions WHERE token = ?', masterToken);
    }
    return json({ success: true });
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
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return err('Invalid username or password', 401);
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await d1.run(
      db,
      'INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
      token, user.id, expiresAt
    );
    await d1.run(db, 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', user.id);

    return json({
      token,
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
    const { token } = await getAuthContext(request, db);
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
    await d1.run(db, 'DELETE FROM users WHERE id = ?', userId);
    return json({ success: true });
  }

  // -------------------------------------------------------------
  // 2. DASHBOARD & KPIS
  // -------------------------------------------------------------
  if (path === '/api/dashboard' && method === 'GET') {
    const totalRow = await d1.get(db, 'SELECT COUNT(*) as count FROM tickets');
    const inRepairRow = await d1.get(db, "SELECT COUNT(*) as count FROM tickets WHERE status = 'IN_REPAIR'");
    const readyRow = await d1.get(db, "SELECT COUNT(*) as count FROM tickets WHERE status = 'READY_FOR_DELIVERY'");
    const completedTodayRow = await d1.get(
      db,
      "SELECT COUNT(*) as count FROM tickets WHERE status = 'DELIVERED' AND date(delivered_at) = date('now')"
    );
    const revenueRow = await d1.get(
      db,
      "SELECT COALESCE(SUM(amount_paid), 0) as total FROM invoices WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
    );
    const lowStockRow = await d1.get(
      db,
      'SELECT COUNT(*) as count FROM inventory WHERE stock_quantity <= min_threshold'
    );

    const recentTickets = await d1.all(
      db,
      `SELECT t.*, c.name as customer_name, c.phone as customer_phone, tech.name as technician_name
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN technicians tech ON t.technician_id = tech.id
       ORDER BY t.created_at DESC LIMIT 5`
    );

    const statusCounts = await d1.all(
      db,
      'SELECT status, COUNT(*) as count FROM tickets GROUP BY status'
    );
    const statusDistribution = statusCounts.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    return json({
      total_tickets: totalRow?.count || 0,
      in_repair: inRepairRow?.count || 0,
      ready_delivery: readyRow?.count || 0,
      completed_today: completedTodayRow?.count || 0,
      revenue_month: revenueRow?.total || 0,
      low_stock_count: lowStockRow?.count || 0,
      recent_tickets: recentTickets,
      status_distribution: statusDistribution
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
      SELECT t.*, c.name as customer_name, c.phone as customer_phone, tech.name as technician_name
      FROM tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN technicians tech ON t.technician_id = tech.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (t.ticket_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR t.model LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }
    if (priority) {
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
      serial_number || '', device_password || '', accessories || '', physical_condition || '',
      typeof inspection_checklist === 'object' ? JSON.stringify(inspection_checklist) : (inspection_checklist || ''),
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

    const parts = await d1.all(db, 'SELECT * FROM ticket_parts WHERE ticket_id = ? ORDER BY id ASC', ticketId);
    const timeline = await d1.all(db, 'SELECT * FROM timeline_logs WHERE ticket_id = ? ORDER BY created_at DESC', ticketId);
    const invoice = await d1.get(db, 'SELECT * FROM invoices WHERE ticket_id = ?', ticketId);

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
        if (key === 'inspection_checklist' && typeof val === 'object') {
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

  if (path === '/api/inventory' && method === 'POST') {
    let { sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location } = body;
    if (!name) return err('Part name is required', 400);

    if (!sku) {
      const prefix = (category || 'PART').substring(0, 3).toUpperCase();
      sku = `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    const res = await d1.run(
      db,
      `INSERT INTO inventory (sku, name, category, brand_compat, serial_no, cost_price, selling_price, stock_quantity, min_threshold, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sku, name, category || 'General', brand_compat || '', serial_no || null,
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
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const t = `%${search}%`;
      params.push(t, t, t);
    }
    sql += ' ORDER BY name ASC';
    const customers = await d1.all(db, sql, ...params);
    return json(customers);
  }

  const customerDetailMatch = path.match(/^\/api\/customers\/(\d+)$/);
  if (customerDetailMatch && method === 'GET') {
    const id = customerDetailMatch[1];
    const customer = await d1.get(db, 'SELECT * FROM customers WHERE id = ?', id);
    if (!customer) return err('Customer not found', 404);
    const tickets = await d1.all(db, 'SELECT * FROM tickets WHERE customer_id = ? ORDER BY created_at DESC', id);
    return json({ ...customer, tickets });
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

  if (customerDetailMatch && method === 'DELETE') {
    await d1.run(db, 'DELETE FROM customers WHERE id = ?', customerDetailMatch[1]);
    return json({ success: true });
  }

  // -------------------------------------------------------------
  // 6. TECHNICIANS
  // -------------------------------------------------------------
  if (path === '/api/technicians' && method === 'GET') {
    const techs = await d1.all(db, 'SELECT * FROM technicians ORDER BY name ASC');
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
    await d1.run(db, 'DELETE FROM technicians WHERE id = ?', techDetailMatch[1]);
    return json({ success: true });
  }

  const techTicketsMatch = path.match(/^\/api\/technicians\/(\d+)\/tickets$/);
  if (techTicketsMatch && method === 'GET') {
    const tickets = await d1.all(db, 'SELECT * FROM tickets WHERE technician_id = ? ORDER BY created_at DESC', techTicketsMatch[1]);
    return json(tickets);
  }

  // -------------------------------------------------------------
  // 7. INVOICES & BILLING
  // -------------------------------------------------------------
  if (path === '/api/invoices' && method === 'GET') {
    const search = url.searchParams.get('search') || '';
    let sql = `
      SELECT inv.*, c.name as customer_name, c.phone as customer_phone, t.ticket_number
      FROM invoices inv
      LEFT JOIN customers c ON inv.customer_id = c.id
      LEFT JOIN tickets t ON inv.ticket_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      sql += ' AND (inv.invoice_number LIKE ? OR c.name LIKE ? OR t.ticket_number LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
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
      `SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
              t.ticket_number, t.brand, t.model, t.problem_description
       FROM invoices inv
       LEFT JOIN customers c ON inv.customer_id = c.id
       LEFT JOIN tickets t ON inv.ticket_id = t.id
       WHERE inv.id = ?`,
      id
    );
    if (!invoice) return err('Invoice not found', 404);

    let parts = [];
    if (invoice.ticket_id) {
      parts = await d1.all(db, 'SELECT * FROM ticket_parts WHERE ticket_id = ?', invoice.ticket_id);
    }
    return json({ ...invoice, parts });
  }

  if (path === '/api/invoices' && method === 'POST') {
    const { ticket_id, customer_id, labor_charges, parts_total, tax_rate, discount, advance_deducted, amount_paid, payment_method, notes } = body;
    if (!customer_id) return err('Customer ID is required', 400);

    const labor = Number(labor_charges) || 0;
    const parts = Number(parts_total) || 0;
    const subtotal = labor + parts;
    const rate = Number(tax_rate) || 0;
    const taxAmount = (subtotal * rate) / 100;
    const disc = Number(discount) || 0;
    const grandTotal = Math.max(0, subtotal + taxAmount - disc);
    const adv = Number(advance_deducted) || 0;
    const paid = Number(amount_paid) || 0;
    const balanceDue = Math.max(0, grandTotal - adv - paid);
    const paymentStatus = balanceDue === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid');

    const invoiceNumber = await generateInvoiceNumber(db);

    const res = await d1.run(
      db,
      `INSERT INTO invoices (
        invoice_number, ticket_id, customer_id, labor_charges, parts_total,
        subtotal, tax_rate, tax_amount, discount, grand_total, advance_deducted,
        amount_paid, balance_due, payment_method, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      invoiceNumber, ticket_id || null, customer_id, labor, parts,
      subtotal, rate, taxAmount, disc, grandTotal, adv, paid, balanceDue,
      payment_method || 'Cash', paymentStatus, notes || ''
    );

    const created = await d1.get(db, 'SELECT * FROM invoices WHERE id = ?', res.lastInsertRowid);
    return json(created, 201);
  }

  const invoicePaymentMatch = path.match(/^\/api\/invoices\/(\d+)\/payment$/);
  if (invoicePaymentMatch && method === 'POST') {
    const id = invoicePaymentMatch[1];
    const { amount, payment_method } = body;
    const payment = Number(amount) || 0;

    const inv = await d1.get(db, 'SELECT * FROM invoices WHERE id = ?', id);
    if (!inv) return err('Invoice not found', 404);

    const newPaid = inv.amount_paid + payment;
    const newBalance = Math.max(0, inv.grand_total - inv.advance_deducted - newPaid);
    const newStatus = newBalance === 0 ? 'Paid' : 'Partial';

    await d1.run(
      db,
      'UPDATE invoices SET amount_paid = ?, balance_due = ?, payment_status = ?, payment_method = ? WHERE id = ?',
      newPaid, newBalance, newStatus, payment_method || inv.payment_method, id
    );

    const updated = await d1.get(db, 'SELECT * FROM invoices WHERE id = ?', id);
    return json(updated);
  }

  // -------------------------------------------------------------
  // 8. SETTINGS
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
      engine: 'cloudflare-d1',
      tables: 12,
      tickets: tCount?.c || 0,
      customers: cCount?.c || 0,
      inventory: iCount?.c || 0,
      invoices: invCount?.c || 0
    });
  }

  // -------------------------------------------------------------
  // 9. PUBLIC TRACKING LOOKUP
  // -------------------------------------------------------------
  const trackMatch = path.match(/^\/api\/track\/(.+)$/);
  if (trackMatch && method === 'GET') {
    const identifier = decodeURIComponent(trackMatch[1]).trim();
    const ticket = await d1.get(
      db,
      `SELECT t.ticket_number, t.device_type, t.brand, t.model, t.problem_description,
              t.status, t.priority, t.estimated_cost, t.estimated_delivery, t.created_at, t.delivered_at,
              c.name as customer_name
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

    return json({ ticket, timeline });
  }

  // -------------------------------------------------------------
  // 10. HEALTH CHECK
  // -------------------------------------------------------------
  if (path === '/api/health') {
    return json({ status: 'ok', engine: 'cloudflare-d1', time: new Date().toISOString() });
  }

  return err(`API endpoint ${method} ${path} not found`, 404);
}
