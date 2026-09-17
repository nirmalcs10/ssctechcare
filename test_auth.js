// Automated integration test for SSC TechCare Authentication System
const http = require('http');

const PORT = 5000;

function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('   SSC TechCare Authentication & Security Tests         ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(` ✅ PASS: ${name}`);
      passed++;
    } else {
      console.log(` ❌ FAIL: ${name} - ${details}`);
      failed++;
    }
  }

  try {
    // Test 1: Public Health Check
    const health = await makeRequest('/api/health');
    assert(health.status === 200 && health.body.status === 'online', 'Public Health Check accessible without auth');

    // Test 2: Public Customer Tracker (Unauthenticated)
    const track = await makeRequest('/api/track/REP-2026-0001');
    assert(track.status === 200 && track.body.ticket, 'Public Customer Tracker accessible without auth');

    // Test 3: Protected endpoint without auth -> should be 401
    const unauthTickets = await makeRequest('/api/tickets');
    assert(unauthTickets.status === 401, 'Internal management route /api/tickets blocks unauthenticated request (401)');

    // Test 4: Invalid login credentials
    const badLogin = await makeRequest('/api/auth/login', 'POST', { username: 'admin', password: 'wrongpassword' });
    assert(badLogin.status === 401 && badLogin.body.error, 'Invalid password correctly rejected with 401');

    // Test 5: Successful Admin login
    const adminLogin = await makeRequest('/api/auth/login', 'POST', { username: 'admin', password: 'admin123' });
    assert(adminLogin.status === 200 && adminLogin.body.token && adminLogin.body.user.role === 'admin', 'Admin login succeeds and returns valid session token');
    const adminToken = adminLogin.body.token;

    // Test 6: Successful Technician login
    const techLogin = await makeRequest('/api/auth/login', 'POST', { username: 'tech', password: 'tech123' });
    assert(techLogin.status === 200 && techLogin.body.user.role === 'technician', 'Technician login succeeds with technician role');

    // Test 7: Verify session with /api/auth/me
    const me = await makeRequest('/api/auth/me', 'GET', null, adminToken);
    assert(me.status === 200 && me.body.user.username === 'admin', 'Verify active session token via /api/auth/me');

    // Test 8: Access protected route with valid token
    const authTickets = await makeRequest('/api/tickets', 'GET', null, adminToken);
    assert(authTickets.status === 200 && Array.isArray(authTickets.body), 'Access protected route /api/tickets with Bearer token');

    // Test 9: Access protected route with bogus token -> should be 401
    const fakeTokenReq = await makeRequest('/api/tickets', 'GET', null, 'invalid-random-token-12345');
    assert(fakeTokenReq.status === 401, 'Access with forged token correctly blocked with 401');

    // Test 10: Logout session
    const logout = await makeRequest('/api/auth/logout', 'POST', null, adminToken);
    assert(logout.status === 200 && logout.body.success, 'Logout successfully deletes session');

    // Test 11: Access after logout -> should be 401
    const afterLogoutMe = await makeRequest('/api/auth/me', 'GET', null, adminToken);
    assert(afterLogoutMe.status === 401, 'Session token properly revoked after logout');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n========================================================');
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================');

  if (failed > 0) process.exit(1);
}

runTests();
