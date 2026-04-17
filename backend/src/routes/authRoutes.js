// routes/index.js - All routes combined for reference

// ── authRoutes.js ──
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', auth.login);
router.post('/register', auth.register);
router.post('/refresh', auth.refreshToken);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.getMe);
router.post('/change-password', authenticate, auth.changePassword);

module.exports = router;
