// routes/deliveries.js  –  /api/deliveries/*
const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');
const { createNotification } = require('./notifications');

const V_LIMITS = { bike: 5, car: 20, van: 100 };

// ─── Helper: generate delivery id ───────────────────────────────────────────
async function nextDeliveryId() {
  const [[row]] = await db.query('SELECT id FROM deliveries ORDER BY id DESC LIMIT 1');
  if (!row) return 'LH-0001';
  const num = parseInt(row.id.split('-')[1]) + 1;
  return 'LH-' + String(num).padStart(4, '0');
}

// ─── Helper: compute price ───────────────────────────────────────────────────
function computePrice(dist, wt, vehicle) {
  const base    = { bike: 30, car: 50, van: 80 }[vehicle] || 50;
  const perKm   = { bike: 1.2, car: 1.5, van: 2.5 }[vehicle] || 1.5;
  const perKg   = { bike: 5, car: 4, van: 3 }[vehicle] || 4;
  return Math.round(base + dist * perKm + wt * perKg);
}

// ══════════════════════════════════════════════════════════════════════════════
// SENDER ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/deliveries/mine  –  sender's own deliveries
router.get('/mine', auth(['sender']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*,
              u.fn AS partner_fn, u.ln AS partner_ln, u.phone AS partner_phone,
              u.vehicle AS partner_vehicle, u.rating AS partner_rating
       FROM deliveries d
       LEFT JOIN users u ON u.id = d.pid
       WHERE d.sid = ?
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[deliveries/mine]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deliveries  –  create a new delivery
router.post('/', auth(['sender']), async (req, res) => {
  try {
    const { from, to, dist, wt, description, vehicle, rname, rphone, notes } = req.body;

    if (!from || !to || !dist || !wt || !description || !vehicle || !rname || !rphone) {
      return res.status(400).json({ error: 'Missing required delivery fields' });
    }
    if (!V_LIMITS[vehicle]) {
      return res.status(400).json({ error: 'Invalid vehicle type' });
    }
    if (parseFloat(wt) > V_LIMITS[vehicle]) {
      return res.status(400).json({ error: `Weight exceeds ${vehicle} limit of ${V_LIMITS[vehicle]} kg` });
    }
    if (parseFloat(dist) > 100) {
      return res.status(400).json({ error: 'Distance exceeds 100 km limit' });
    }

    const id    = await nextDeliveryId();
    const price = computePrice(parseFloat(dist), parseFloat(wt), vehicle);
    const today = new Date().toISOString().split('T')[0];

    await db.query(
      `INSERT INTO deliveries (id, sid, pid, from_loc, to_loc, dist, wt, description, vehicle, status, price, rname, rphone, notes)
       VALUES (?,?,NULL,?,?,?,?,?,?,'pending',?,?,?,?)`,
      [id, req.user.id, from.trim(), to.trim(), dist, wt, description.trim(),
       vehicle, price, rname.trim(), rphone.trim(), (notes || '').trim()]
    );

    const [[delivery]] = await db.query('SELECT * FROM deliveries WHERE id = ?', [id]);

    // Auto-create first tracking entry
    await db.query(
      `INSERT INTO tracking (delivery_id, status, location, note, updated_by)
       VALUES (?, 'requested', ?, 'Delivery requested', ?)`,
      [id, from.trim(), req.user.id]
    );

    // Auto-create payment record
    await db.query(
      `INSERT INTO payments (delivery_id, user_id, amount, method, status)
       VALUES (?, ?, ?, 'cash', 'pending')`,
      [id, req.user.id, price]
    );

    res.status(201).json(delivery);
  } catch (err) {
    console.error('[deliveries POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/deliveries/:id  –  sender cancels pending delivery
router.delete('/:id', auth(['sender']), async (req, res) => {
  try {
    const [[delivery]] = await db.query('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.sid !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (delivery.status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending deliveries' });
    }
    await db.query("UPDATE deliveries SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ message: 'Delivery cancelled' });
  } catch (err) {
    console.error('[deliveries DELETE]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/deliveries/available  –  pending deliveries partner can accept
router.get('/available', auth(['partner']), async (req, res) => {
  try {
    const [[partner]] = await db.query(
      'SELECT vehicle, verified FROM users WHERE id = ?', [req.user.id]
    );
    if (!partner.verified) {
      return res.status(403).json({ error: 'Your account is pending verification' });
    }

    const [rows] = await db.query(
      `SELECT d.*, u.fn AS sender_fn, u.ln AS sender_ln
       FROM deliveries d
       JOIN users u ON u.id = d.sid
       WHERE d.status = 'pending' AND d.vehicle = ?
       ORDER BY d.created_at DESC`,
      [partner.vehicle]
    );
    res.json(rows);
  } catch (err) {
    console.error('[deliveries/available]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/deliveries/myjobs  –  partner's accepted/active jobs
router.get('/myjobs', auth(['partner']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, u.fn AS sender_fn, u.ln AS sender_ln, u.phone AS sender_phone
       FROM deliveries d
       JOIN users u ON u.id = d.sid
       WHERE d.pid = ?
       ORDER BY d.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[deliveries/myjobs]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deliveries/:id/accept  –  partner accepts a job
router.post('/:id/accept', auth(['partner']), async (req, res) => {
  try {
    const [[partnerInfo]] = await db.query('SELECT fn, ln, verified FROM users WHERE id=?', [req.user.id]);
    if (!partnerInfo.verified) return res.status(403).json({ error: 'Account not verified' });

    const [[delivery]] = await db.query('SELECT * FROM deliveries WHERE id=?', [req.params.id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.status !== 'pending') return res.status(400).json({ error: 'Delivery is no longer available' });

    await db.query("UPDATE deliveries SET pid=?, status='active' WHERE id=?",
      [req.user.id, req.params.id]);

    // Add tracking entry
    await db.query(
      `INSERT INTO tracking (delivery_id, status, location, note, updated_by)
       VALUES (?, 'partner_assigned', ?, 'Partner assigned', ?)`,
      [req.params.id, delivery.from_loc, req.user.id]
    );

    // Notify sender
    await createNotification(
      delivery.sid,
      'Delivery Accepted',
      `Your delivery ${req.params.id} has been accepted by ${partnerInfo.fn} ${partnerInfo.ln}`,
      'success',
      req.params.id
    );

    res.json({ message: 'Job accepted' });
  } catch (err) {
    console.error('[deliveries/accept]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deliveries/:id/delivered  –  partner marks as delivered
router.post('/:id/delivered', auth(['partner']), async (req, res) => {
  try {
    const [[delivery]] = await db.query('SELECT * FROM deliveries WHERE id=?', [req.params.id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.pid !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (delivery.status !== 'active') return res.status(400).json({ error: 'Delivery is not active' });

    await db.query("UPDATE deliveries SET status='delivered' WHERE id=?", [req.params.id]);

    // Add tracking entry
    await db.query(
      `INSERT INTO tracking (delivery_id, status, location, note, updated_by)
       VALUES (?, 'delivered', ?, 'Delivered successfully', ?)`,
      [req.params.id, delivery.to_loc, req.user.id]
    );

    // Increment partner's trip count
    await db.query('UPDATE users SET trips = trips + 1 WHERE id=?', [req.user.id]);

    // Notify sender
    await createNotification(
      delivery.sid,
      'Delivery Complete ✅',
      `Your delivery ${req.params.id} has been delivered successfully!`,
      'success',
      req.params.id
    );

    res.json({ message: 'Marked as delivered' });
  } catch (err) {
    console.error('[deliveries/delivered]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/deliveries  –  all deliveries (admin only)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT d.*,
                 s.fn AS sender_fn, s.ln AS sender_ln,
                 p.fn AS partner_fn, p.ln AS partner_ln
               FROM deliveries d
               JOIN users s ON s.id = d.sid
               LEFT JOIN users p ON p.id = d.pid`;
    const params = [];
    if (status) { sql += ' WHERE d.status = ?'; params.push(status); }
    sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[deliveries/ admin]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
