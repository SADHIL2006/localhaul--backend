// routes/notifications.js  –  /api/notifications/*
const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// ─── Helper: create a notification ───────────────────────────────────────────
async function createNotification(user_id, title, message, type = 'info', delivery_id = null) {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, delivery_id)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, title, message, type, delivery_id]
    );
  } catch (err) {
    console.error('[notification create]', err);
  }
}

// ─── GET /api/notifications  –  get current user's notifications ──────────────
router.get('/', auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[notifications GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/notifications/unread-count  –  count unread notifications ───────
router.get('/unread-count', auth(), async (req, res) => {
  try {
    const [[row]] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count: row.count });
  } catch (err) {
    console.error('[notifications/unread-count]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/notifications/read-all  –  mark all as read ──────────────────
router.patch('/read-all', auth(), async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[notifications/read-all]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/notifications/:id/read  –  mark one as read ──────────────────
router.patch('/:id/read', auth(), async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('[notifications/read]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
