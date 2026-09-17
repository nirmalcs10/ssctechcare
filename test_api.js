const http = require('http');

let authToken = null;

// Helper to make JSON HTTP request
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
    };
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AUTOMATED API VERIFICATION ===\n');
  let passCount = 0;
  let failCount = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passCount++;
    } else {
      console.error(`✗ FAIL: ${name} ${details}`);
      failCount++;
    }
  }

  try {
    // 0. Auth Login
    const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    if (loginRes.status === 200 && loginRes.data.token) {
      authToken = loginRes.data.token;
      assert('Auth Login with Admin Credentials', true);
    } else {
      assert('Auth Login with Admin Credentials', false, 'Failed to acquire token');
    }

    // 1. Health check
    const health = await request('GET', '/api/health');
    assert('API Health Check', health.status === 200 && health.data.status === 'online');

    // 2. Dashboard KPIs
    const dash = await request('GET', '/api/dashboard');
    assert('Dashboard KPIs', dash.status === 200 && typeof dash.data.activeRepairs === 'number');

    // 3. List initial tickets
    const tickets = await request('GET', '/api/tickets');
    assert('Fetch Tickets List', tickets.status === 200 && Array.isArray(tickets.data) && tickets.data.length > 0);

    const uniquePhone = '99' + Date.now().toString().slice(-8);
    const newTicketPayload = {
      customer_name: 'Test Customer',
      customer_phone: uniquePhone,
      customer_email: 'test@example.com',
      device_type: 'Laptop',
      brand: 'HP',
      model: 'EliteBook 840 G8',
      serial_number: 'TEST-SN-9988',
      device_password: 'PIN 1234',
      accessories: ['Power Adapter / Charger'],
      physical_condition: ['Minor body scratches'],
      inspection_checklist: { powerState: 'Powers On', display: 'OK' },
      problem_description: 'Automated test: Keyboard keys not registering and fan noisy',
      priority: 'High',
      technician_id: 1,
      estimated_cost: 2500,
      estimated_delivery: '2026-09-20',
      advance_paid: 500
    };

    const createTicketRes = await request('POST', '/api/tickets', newTicketPayload);
    assert('Create Repair Ticket', createTicketRes.status === 201 && createTicketRes.data.id > 0);
    const createdTicketId = createTicketRes.data.id;
    const ticketNumber = createTicketRes.data.ticket_number;

    // 5. Check ticket detail
    const ticketDetail = await request('GET', `/api/tickets/${createdTicketId}`);
    assert('Fetch Ticket Detail', ticketDetail.status === 200 && ticketDetail.data.ticket_number === ticketNumber);

    // 6. Test Status Transition
    const statusRes = await request('POST', `/api/tickets/${createdTicketId}/status`, {
      status: 'IN_REPAIR',
      note: 'Started disassembling keyboard',
      actor: 'Amit Sharma'
    });
    assert('Transition Ticket Status', statusRes.status === 200 && statusRes.data.status === 'IN_REPAIR');

    // 7. Check Inventory Stock before attaching part
    const invItem = await request('GET', '/api/inventory/1');
    const initialStock = invItem.data.stock_quantity;

    // 8. Attach spare part to ticket
    const addPartRes = await request('POST', `/api/tickets/${createdTicketId}/parts`, {
      inventory_id: 1,
      part_name: invItem.data.name,
      quantity: 1,
      unit_price: invItem.data.selling_price
    });
    assert('Attach Spare Part to Ticket', addPartRes.status === 201);

    // Verify inventory decremented
    const invAfterAdd = await request('GET', '/api/inventory/1');
    assert('Inventory Auto-Decremented', invAfterAdd.data.stock_quantity === initialStock - 1);

    // 9. Generate Invoice for Ticket
    const invPayload = {
      ticket_id: createdTicketId,
      labor_charges: 800,
      tax_rate: 18.0,
      discount: 100,
      amount_paid: 1000,
      payment_method: 'UPI / QR',
      notes: 'Automated test invoice'
    };
    const invoiceRes = await request('POST', '/api/invoices', invPayload);
    assert('Generate Tax Invoice', invoiceRes.status === 201 && invoiceRes.data.grand_total > 0);
    const invoiceId = invoiceRes.data.id;

    // 10. Record additional payment on invoice
    const payRes = await request('POST', `/api/invoices/${invoiceId}/payment`, {
      amount: invoiceRes.data.balance_due,
      payment_method: 'Cash'
    });
    assert('Record Payment & Mark Paid', payRes.status === 200 && payRes.data.payment_status === 'Paid');

    // 11. Public Customer Tracking Portal
    const trackRes = await request('GET', `/api/track/${ticketNumber}`);
    assert('Public Customer Tracking Lookup', trackRes.status === 200 && trackRes.data.ticket.ticket_number === ticketNumber);

    // 12. Test Customer Information Edit
    const customerId = ticketDetail.data.customer_id;
    const updatedPhone = '88' + Date.now().toString().slice(-8);
    const editCustomerRes = await request('PUT', `/api/customers/${customerId}`, {
      name: 'Test Customer (Updated)',
      phone: updatedPhone,
      alt_phone: '9999911122',
      email: 'updated.customer@example.com',
      address: 'Suite 404, Tech Park Valley',
      notes: 'Customer prefers SMS & WhatsApp notifications'
    });
    assert('Update Customer Information', editCustomerRes.status === 200 && editCustomerRes.data && editCustomerRes.data.customer && editCustomerRes.data.customer.name === 'Test Customer (Updated)');

    // Verify ticket detail reflects updated customer info
    const refreshedTicket = await request('GET', `/api/tickets/${createdTicketId}`);
    assert('Ticket Reflects Updated Customer Info', refreshedTicket.data.customer_name === 'Test Customer (Updated)' && refreshedTicket.data.customer_phone === updatedPhone);

    // 13. Settings endpoint
    const settingsRes = await request('GET', '/api/settings');
    assert('Fetch Settings', settingsRes.status === 200 && settingsRes.data.shop_name.length > 0);

    console.log(`\n=== TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);
    process.exit(failCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

// Start server in background for testing and run tests
const server = require('./server/src/server.js');
setTimeout(runTests, 1000);
