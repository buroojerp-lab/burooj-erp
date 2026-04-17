// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');

const generateTokens = (userId, role) => {
  const access = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const refresh = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d' }
  );
  return { access, refresh };
};

// POST /auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const result = await query(
    'SELECT id, name, email, phone, role, password_hash, is_active FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { access, refresh } = generateTokens(user.id, user.role);

  // Store refresh token & update last login
  await query(
    'UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2',
    [refresh, user.id]
  );

  logger.info(`User login: ${user.email} (${user.role})`);

  res.json({
    message: 'Login successful',
    token: access,
    refreshToken: refresh,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
};

// POST /auth/register (Admin only)
exports.register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }

  const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists.rows[0]) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 12);

  const result = await query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, phone, role`,
    [name, email.toLowerCase(), phone, hash, role || 'sales_agent']
  );

  res.status(201).json({
    message: 'User created successfully',
    user: result.rows[0],
  });
};

// POST /auth/refresh
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const result = await query(
      'SELECT id, role, is_active, refresh_token FROM users WHERE id = $1',
      [decoded.userId]
    );

    const user = result.rows[0];
    if (!user || user.refresh_token !== refreshToken || !user.is_active) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { access, refresh } = generateTokens(user.id, user.role);
    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refresh, user.id]);

    res.json({ token: access, refreshToken: refresh });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

// POST /auth/logout
exports.logout = async (req, res) => {
  await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
  res.json({ message: 'Logged out successfully' });
};

// GET /auth/me
exports.getMe = async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar_url, u.last_login,
            a.id as agent_id, a.agent_code, a.commission_rate,
            e.id as emp_id, e.emp_code, e.designation
     FROM users u
     LEFT JOIN agents a ON a.user_id = u.id
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json({ user: result.rows[0] });
};

// POST /auth/change-password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

  res.json({ message: 'Password changed successfully' });
};
