// routes/auth.js  –  /api/auth/*
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');

const SALT_ROUNDS = 10;

// ─── Helper: generate sequential user id ────────────────────────────────────
async function nextUserId() {
  const [[row]] = await db.query('SELECT id FROM users ORDER BY id DESC LIMIT 1');
  if (!row) return 'U001';
  const num = parseInt(row.id.slice(1)) + 1;
  return 'U' + String(num).padStart(3, '0');
}

// ─── Helper: sign tokens ────────────────────────────────────────────────────
function signAccess(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { fn, ln, email, phone, password, role, vehicle, idDoc } = req.body;

    // Validation
    if (!fn || !ln || !email || !phone || !password || !role) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }
    if (!['sender', 'partner'].includes(role)) {
      return res.status(400).json({ error: 'Role must be sender or partner' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (role === 'partner' && !vehicle) {
      return res.status(400).json({ error: 'Partners must provide vehicle type' });
    }

    // Check email uniqueness
    const [[existing]] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const id        = await nextUserId();
    const passHash  = await bcrypt.hash(password, SALT_ROUNDS);
    const joined    = new Date().toISOString().split('T')[0];

    await db.query(
      `INSERT INTO users (id, fn, ln, email, pass_hash, phone, role, vehicle, id_doc, verified, rating, trips, joined)
       VALUES (?,?,?,?,?,?,?,?,?,1,0,0,?)`,
      [id, fn.trim(), ln.trim(), email.toLowerCase(), passHash, phone.trim(),
       role, vehicle || null, null, joined]
    );

    const [[user]] = await db.query(
      'SELECT id, fn, ln, email, phone, role, vehicle, id_doc AS idDoc, verified, rating, trips, joined FROM users WHERE id = ?',
      [id]
    );

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [id, refreshToken, expiresAt]);

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [[user]] = await db.query(
      'SELECT id, fn, ln, email, pass_hash, phone, role, vehicle, id_doc AS idDoc, verified, rating, trips, joined FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.pass_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const { pass_hash, ...safeUser } = user;

    const accessToken  = signAccess(safeUser);
    const refreshToken = signRefresh(safeUser);

    // Persist refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [safeUser.id, refreshToken, expiresAt]);

    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const [[stored]] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [refreshToken]
    );
    if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const [[user]] = await db.query(
      'SELECT id, fn, ln, email, role FROM users WHERE id = ?', [decoded.id]
    );
    if (!user) return res.status(401).json({ error: 'User not found' });

    const accessToken = signAccess(user);
    res.json({ accessToken });
  } catch (err) {
    console.error('[refresh]', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('[logout]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
