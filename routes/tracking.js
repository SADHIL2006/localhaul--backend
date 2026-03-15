// routes/tracking.js  –  /api/tracking/*
const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// ─── GET /api/tracking/:deliveryId  –  get full tracking history ──────────────
router.get('/:deliveryId', auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.fn, u.ln
       FROM tracking t
       LEFT JOIN users u ON u.id = t.updated_by
       WHERE t.delivery_id = ?
       ORDER BY t.created_at ASC`,
      [req.params.deliveryId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[tracking GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/tracking  –  add a tracking update (partner/admin) ─────────────
router.post('/', auth(['partner', 'admin']), async (req, res) => {
  try {
    const { delivery_id, status, location, note } = req.body;
    if (!delivery_id || !status) {
      return res.status(400).json({ error: 'delivery_id and status are required' });
    }

    await db.query(
      `INSERT INTO tracking (delivery_id, status, location, note, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [delivery_id, status, location || null, note || null, req.user.id]
    );

    res.status(201).json({ message: 'Tracking updated' });
  } catch (err) {
    console.error('[tracking POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
