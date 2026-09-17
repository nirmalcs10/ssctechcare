const express = require('express');
const router = express.Router();
const db = require('../db/database');

// In-memory sliding window rate limiter: max 20 tracking requests per 15 minutes per IP
const trackingAttempts = new Map();

// Periodic cleanup of expired rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of trackingAttempts.entries()) {
    if (now - data.firstRequestTime > 15 * 60 * 1000) {
      trackingAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

function trackingRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 20;

  const record = trackingAttempts.get(ip);

  if (!record || (now - record.firstRequestTime > windowMs)) {
    trackingAttempts.set(ip, { count: 1, firstRequestTime: now });
    return next();
  }

  if (record.count >= maxAttempts) {
    const retryAfterMinutes = Math.ceil((windowMs - (now - record.firstRequestTime)) / 60000);
    return res.status(429).json({
      error: `Too many tracking requests from your IP. Please try again in ${retryAfterMinutes} minute(s).`
    });
  }

  record.count++;
  next();
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

// GET public ticket tracking info (Rate-limited & PII-masked)
router.get('/:identifier', trackingRateLimiter, async (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = (identifier || '').trim();

    // Input length & format validation to block scans and fuzzing
    if (!cleanId || cleanId.length < 4 || cleanId.length > 50) {
      return res.status(400).json({ error: 'Please provide a valid ticket number or phone number' });
    }

    const isDigitsOnly = /^\d+$/.test(cleanId);
    if (isDigitsOnly && cleanId.length < 7) {
      return res.status(400).json({ error: 'Please provide at least 7 digits for phone search' });
    }

    // Check if identifier is ticket number or phone
    let ticket = await db.prepare(`
      SELECT 
        t.id,
        t.ticket_number,
        t.device_type,
        t.brand,
        t.model,
        t.status,
        t.problem_description,
        t.estimated_delivery,
        t.estimated_cost,
        t.advance_paid,
        t.created_at,
        t.updated_at,
        t.delivered_at,
        c.name as customer_name,
        c.phone as customer_phone
      FROM tickets t
      JOIN customers c ON t.customer_id = c.id
      WHERE UPPER(t.ticket_number) = UPPER(?) OR c.phone = ?
      ORDER BY t.created_at DESC
      LIMIT 1
    `).get(cleanId, cleanId);

    if (!ticket) {
      return res.status(404).json({ error: 'No repair ticket found for this ticket number or phone' });
    }

    // Get public timeline milestones
    const timeline = await db.prepare(`
      SELECT action, description, created_at
      FROM timeline_logs
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).all(ticket.id);

    // Get shop contact details
    const settings = await db.prepare(`
      SELECT shop_name, shop_phone, shop_email, shop_address
      FROM settings WHERE id = 1
    `).get();

    // Mask sensitive PII before responding publicly
    const safeTicket = {
      ...ticket,
      customer_name: maskName(ticket.customer_name),
      customer_phone: maskPhone(ticket.customer_phone)
    };

    res.json({
      ticket: safeTicket,
      timeline,
      shop: settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;