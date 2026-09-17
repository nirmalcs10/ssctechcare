const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Middleware to verify session token and attach user to request
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing' });
  }

  try {
    const session = db.prepare(`
      SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.role, u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token);

    if (!session || !session.is_active) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    req.user = {
      id: session.id,
      username: session.username,
      fullName: session.full_name,
      role: session.role
    };
    req.sessionToken = token;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

// Optional role restriction middleware (e.g., requireRole('admin'))
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// Middleware to verify master session token (Main Login gateway)
function requireMasterAuth(req, res, next) {
  const masterToken = req.headers['x-master-token'];
  if (!masterToken) {
    return res.status(401).json({ error: 'Main authentication required. Please sign in first.' });
  }

  try {
    const session = db.prepare(`
      SELECT ms.token, ms.expires_at, ma.id, ma.email, ma.display_name, ma.is_active
      FROM master_sessions ms
      JOIN master_accounts ma ON ms.master_account_id = ma.id
      WHERE ms.token = ? AND datetime(ms.expires_at) > datetime('now')
    `).get(masterToken);

    if (!session || !session.is_active) {
      return res.status(401).json({ error: 'Main session expired. Please sign in again.' });
    }

    req.masterUser = {
      id: session.id,
      email: session.email,
      displayName: session.display_name
    };
    req.masterToken = masterToken;
    next();
  } catch (err) {
    console.error('Master auth verification error:', err);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

// POST /api/auth/login
router.post('/login', requireMasterAuth, (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE username = ?
    `).get(username.trim());

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValid = db.verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate session token valid for 30 days
    const token = db.generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO user_sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, user.id, expiresAt);

    // Update last login
    db.prepare(`
      UPDATE users SET last_login = datetime('now', 'localtime') WHERE id = ?
    `).run(user.id);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed due to server error' });
  }
});

// GET /api/auth/me - Verify active token and fetch current user profile
router.get('/me', requireMasterAuth, requireAuth, (req, res) => {
  return res.json({
    user: req.user
  });
});

// POST /api/auth/logout - Invalidate active session
router.post('/logout', requireMasterAuth, requireAuth, (req, res) => {
  try {
    const token = req.sessionToken;
    if (token) {
      db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/users - List staff accounts (Admin only, requires Master Gateway)
router.get('/users', requireMasterAuth, requireAuth, requireRole('admin'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, full_name, role, is_active, created_at, last_login
      FROM users ORDER BY id ASC
    `).all();
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/auth/users - Create new staff account (Admin only, requires Master Gateway)
router.post('/users', requireMasterAuth, requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { username, password, fullName, role = 'technician' } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const { hash, salt } = db.hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(username.trim(), hash, salt, fullName.trim(), role);

    return res.status(201).json({
      success: true,
      user: {
        id: result.lastInsertRowid,
        username: username.trim(),
        fullName: fullName.trim(),
        role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

// PUT /api/auth/password - Change authenticated user password (requires Master Gateway)
router.put('/password', requireMasterAuth, requireAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = db.verifyPassword(oldPassword, user.password_hash, user.salt);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const { hash, salt } = db.hashPassword(newPassword);
    db.prepare(`
      UPDATE users SET password_hash = ?, salt = ? WHERE id = ?
    `).run(hash, salt, user.id);

    // Revoke all other active sessions for this user (Bug 1.4 fix)
    db.prepare(`
      DELETE FROM user_sessions WHERE user_id = ? AND token != ?
    `).run(user.id, req.sessionToken);

    return res.json({ success: true, message: 'Password updated successfully. Other active sessions revoked.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update password: ' + err.message });
  }
});

// PUT /api/auth/users/:id/toggle - Toggle user active status (Admin only, requires Master Gateway)
router.put('/users/:id/toggle', requireMasterAuth, requireAuth, requireRole('admin'), (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    if (targetId === 1) {
      return res.status(400).json({ error: 'Primary administrator account cannot be deactivated' });
    }

    const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newStatus = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, targetId);

    // If deactivating, kill their sessions
    if (newStatus === 0) {
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
    }

    return res.json({ success: true, is_active: newStatus });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user status: ' + err.message });
  }
});

// DELETE /api/auth/users/:id - Remove staff member (Admin only, requires Master Gateway)
router.delete('/users/:id', requireMasterAuth, requireAuth, requireRole('admin'), (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    if (targetId === 1) {
      return res.status(400).json({ error: 'Primary administrator account cannot be deleted' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

// ========== MASTER ACCOUNT ENDPOINTS (Main Login Gateway) ==========

// POST /api/auth/master-login
router.post('/master-login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const account = db.prepare(`
      SELECT * FROM master_accounts WHERE email = ?
    `).get(email.trim());

    if (!account || !account.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = db.verifyPassword(password, account.password_hash, account.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate master session token valid for 30 days
    const token = db.generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO master_sessions (token, master_account_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, account.id, expiresAt);

    // Update last login
    db.prepare(`
      UPDATE master_accounts SET last_login = datetime('now', 'localtime') WHERE id = ?
    `).run(account.id);

    return res.json({
      success: true,
      masterToken: token,
      masterUser: {
        id: account.id,
        email: account.email,
        displayName: account.display_name
      }
    });
  } catch (err) {
    console.error('Master login error:', err);
    return res.status(500).json({ error: 'Login failed due to server error' });
  }
});

// GET /api/auth/master-me — Verify active master session
router.get('/master-me', requireMasterAuth, (req, res) => {
  return res.json({
    masterUser: req.masterUser
  });
});

// POST /api/auth/master-logout — Invalidate master session
router.post('/master-logout', requireMasterAuth, (req, res) => {
  try {
    if (req.masterToken) {
      db.prepare('DELETE FROM master_sessions WHERE token = ?').run(req.masterToken);
    }
    return res.json({ success: true, message: 'Master session ended' });
  } catch (err) {
    console.error('Master logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// PUT /api/auth/master-password — Update master account credentials
router.put('/master-password', requireMasterAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const account = db.prepare('SELECT * FROM master_accounts WHERE id = ?').get(req.masterUser.id);
    if (!account) {
      return res.status(404).json({ error: 'Master account not found' });
    }

    const isMatch = db.verifyPassword(oldPassword, account.password_hash, account.salt);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const { hash, salt } = db.hashPassword(newPassword);
    db.prepare(`
      UPDATE master_accounts SET password_hash = ?, salt = ? WHERE id = ?
    `).run(hash, salt, account.id);

    // Revoke all other active master sessions for this account (Bug 1.4 fix)
    db.prepare(`
      DELETE FROM master_sessions WHERE master_account_id = ? AND token != ?
    `).run(account.id, req.masterToken);

    return res.json({ success: true, message: 'Master password updated successfully. Other active sessions revoked.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update master password: ' + err.message });
  }
});

// Periodic cleanup of expired sessions (runs every 30 minutes)
setInterval(() => {
  try {
    db.prepare(`DELETE FROM user_sessions WHERE datetime(expires_at) <= datetime('now')`).run();
    db.prepare(`DELETE FROM master_sessions WHERE datetime(expires_at) <= datetime('now')`).run();
  } catch (e) {
    // Non-fatal background cleanup error
  }
}, 30 * 60 * 1000).unref();

module.exports = {
  router,
  requireAuth,
  requireRole,
  requireMasterAuth
};
