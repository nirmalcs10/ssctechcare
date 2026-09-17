const http = require('http');

function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('Testing Settings API endpoints...');
  // 1. Login
  const login = await makeRequest('/api/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  const token = login.body.token;

  // 2. System Stats
  const stats = await makeRequest('/api/settings/system-stats', 'GET', null, token);
  console.log('System stats:', stats.status === 200 ? 'PASS' : 'FAIL', stats.body.dbSizeFormatted, stats.body.recordCounts);

  // 3. Backup Download
  const backup = await makeRequest('/api/settings/backup', 'GET', null, token);
  const isDb = backup.headers['content-type'] === 'application/vnd.sqlite3';
  console.log('Backup download:', backup.status === 200 && isDb ? 'PASS' : 'FAIL', backup.headers['content-disposition']);

  // 4. Staff Users List
  const users = await makeRequest('/api/auth/users', 'GET', null, token);
  console.log('Users list:', users.status === 200 && Array.isArray(users.body) ? 'PASS' : 'FAIL', `(${users.body.length} users)`);
}

run();
