// routes/ratings.js  –  /api/ratings/*
const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// ─── POST /api/ratings  –  sender rates a partner after delivery ──────────────
router.post('/', auth(['sender']), async (req, res) => {
  try {
    const { delivery_id, stars, comment } = req.body;

    if (!delivery_id || !stars) {
      return res.status(400).json({ error: 'delivery_id and stars are required' });
    }
    if (stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Stars must be between 1 and 5' });
    }

    // Verify delivery belongs to this sender and is delivered
    const [[delivery]] = await db.query(
      `SELECT * FROM deliveries WHERE id = ? AND sid = ? AND status = 'delivered'`,
      [delivery_id, req.user.id]
    );
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found or not yet delivered' });
    }
    if (!delivery.pid) {
      return res.status(400).json({ error: 'No partner assigned to this delivery' });
    }

    // Check if already rated
    const [[existing]] = await db.query(
      'SELECT id FROM ratings WHERE delivery_id = ?', [delivery_id]
    ).catch(() => [[null]]);
    if (existing) {
      return res.status(409).json({ error: 'You have already rated this delivery' });
    }

    // Insert rating
    await db.query(
      `INSERT INTO ratings (delivery_id, sender_id, partner_id, stars, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [delivery_id, req.user.id, delivery.pid, stars, comment || null]
    );

    // Update partner's average rating
    const [[avg]] = await db.query(
      'SELECT AVG(stars) AS avg_rating FROM ratings WHERE partner_id = ?',
      [delivery.pid]
    );
    await db.query(
      'UPDATE users SET rating = ? WHERE id = ?',
      [parseFloat(avg.avg_rating).toFixed(1), delivery.pid]
    );

    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    console.error('[ratings POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/ratings/partner/:id  –  get all ratings for a partner ──────────
router.get('/partner/:id', auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.fn AS sender_fn, u.ln AS sender_ln,
              d.from_loc, d.to_loc
       FROM ratings r
       JOIN users u ON u.id = r.sender_id
       JOIN deliveries d ON d.id = r.delivery_id
       WHERE r.partner_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[ratings/partner]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
