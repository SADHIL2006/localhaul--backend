// routes/payments.js  –  /api/payments/*
const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// ─── GET /api/payments/mine  –  sender's payment history ─────────────────────
router.get('/mine', auth(['sender']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, d.from_loc, d.to_loc, d.description
       FROM payments p
       JOIN deliveries d ON d.id = p.delivery_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[payments/mine]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/payments  –  create payment for a delivery ────────────────────
router.post('/', auth(['sender']), async (req, res) => {
  try {
    const { delivery_id, method } = req.body;
    if (!delivery_id || !method) {
      return res.status(400).json({ error: 'delivery_id and method are required' });
    }

    // Check delivery belongs to this sender
    const [[delivery]] = await db.query(
      'SELECT * FROM deliveries WHERE id = ? AND sid = ?',
      [delivery_id, req.user.id]
    );
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    // Check if payment already exists
    const [[existing]] = await db.query(
      'SELECT id FROM payments WHERE delivery_id = ?', [delivery_id]
    ).catch(() => [[null]]);

    if (existing) {
      // Update existing payment
      await db.query(
        `UPDATE payments SET method=?, status='completed', paid_at=NOW() WHERE delivery_id=?`,
        [method, delivery_id]
      );
    } else {
      // Create new payment
      await db.query(
        `INSERT INTO payments (delivery_id, user_id, amount, method, status, paid_at)
         VALUES (?, ?, ?, ?, 'completed', NOW())`,
        [delivery_id, req.user.id, delivery.price, method]
      );
    }

    res.json({ message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('[payments POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/payments  –  all payments (admin) ───────────────────────────────
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, d.from_loc, d.to_loc, u.fn, u.ln, u.email
       FROM payments p
       JOIN deliveries d ON d.id = p.delivery_id
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[payments/ admin]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
