// routes/users.js  –  /api/users/*
const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// ─── GET /api/users/me  –  current user profile ──────────────────────────────
router.get('/me', auth(), async (req, res) => {
  try {
    const [[user]] = await db.query(
      `SELECT id, fn, ln, email, phone, role, vehicle,
              id_doc AS idDoc, verified, rating, trips, joined
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[users/me]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/users/partners  –  admin: list all partners ─────────────────────
router.get('/partners', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, fn, ln, email, phone, vehicle,
              id_doc AS idDoc, verified, rating, trips, joined
       FROM users WHERE role = 'partner'
       ORDER BY joined DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[users/partners]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/users/senders  –  admin: list all senders ──────────────────────
router.get('/senders', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.fn, u.ln, u.email, u.phone, u.joined,
              COUNT(d.id) AS deliveryCount
       FROM users u
       LEFT JOIN deliveries d ON d.sid = u.id
       WHERE u.role = 'sender'
       GROUP BY u.id
       ORDER BY u.joined DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[users/senders]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/users/pending-verification  –  admin: unverified partners ───────
router.get('/pending-verification', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, fn, ln, email, phone, vehicle, id_doc AS idDoc, joined
       FROM users WHERE role='partner' AND verified=0
       ORDER BY joined ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[users/pending-verification]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/users/:id/verify  –  admin: verify a partner ─────────────────
router.patch('/:id/verify', auth(['admin']), async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT id, role FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'partner') return res.status(400).json({ error: 'User is not a partner' });

    await db.query('UPDATE users SET verified=1 WHERE id=?', [req.params.id]);
    res.json({ message: 'Partner verified' });
  } catch (err) {
    console.error('[users/verify]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/users/:id/revoke  –  admin: revoke verification ───────────────
router.patch('/:id/revoke', auth(['admin']), async (req, res) => {
  try {
    await db.query('UPDATE users SET verified=0 WHERE id=? AND role="partner"', [req.params.id]);
    res.json({ message: 'Verification revoked' });
  } catch (err) {
    console.error('[users/revoke]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/users/:id  –  admin: reject & remove a partner ───────────────
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT id, role FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin account' });

    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ message: 'User removed' });
  } catch (err) {
    console.error('[users/delete]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/users/stats  –  admin: platform stats ──────────────────────────
router.get('/stats', auth(['admin']), async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT
         SUM(role='sender')  AS senders,
         SUM(role='partner') AS partners,
         SUM(role='admin')   AS admins
       FROM users`
    );
    const [[delStats]] = await db.query(
      `SELECT
         COUNT(*)                           AS total,
         SUM(status='pending')              AS pending,
         SUM(status='active')               AS active,
         SUM(status='delivered')            AS delivered,
         SUM(status='cancelled')            AS cancelled,
         COALESCE(SUM(price),0)             AS totalRevenue
       FROM deliveries`
    );
    res.json({ users: counts, deliveries: delStats });
  } catch (err) {
    console.error('[users/stats]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
