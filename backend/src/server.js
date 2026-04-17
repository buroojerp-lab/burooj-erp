// ============================================================
// BUROOJ HEIGHTS ERP - MAIN SERVER
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('express-async-errors');

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { scheduleCronJobs } = require('./services/cronService');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const customerRoutes = require('./routes/customerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const installmentRoutes = require('./routes/installmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const agentRoutes = require('./routes/agentRoutes');
const investorRoutes = require('./routes/investorRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const hrRoutes = require('./routes/hrRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const procurementRoutes = require('./routes/procurementRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const financeRoutes = require('./routes/financeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const backupRoutes = require('./routes/backupRoutes');
const auditRoutes  = require('./routes/auditRoutes');
const chatRoutes   = require('./routes/chatRoutes');
const emailRoutes  = require('./routes/emailRoutes');
const scanRoutes   = require('./routes/scanRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ── Security Middleware ──
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
  ],
  credentials: true,
}));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts.' },
});

// ── General Middleware ──
app.use(compression());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Socket.IO ──
app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join_room', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ── Health Check ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Burooj Heights ERP API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
const prefix = process.env.API_PREFIX || '/api/v1';

app.use(`${prefix}/auth`, authLimiter, authRoutes);
app.use(`${prefix}/users`, userRoutes);
app.use(`${prefix}/property`, propertyRoutes);
app.use(`${prefix}/customers`, customerRoutes);
app.use(`${prefix}/bookings`, bookingRoutes);
app.use(`${prefix}/installments`, installmentRoutes);
app.use(`${prefix}/payments`, paymentRoutes);
app.use(`${prefix}/agents`, agentRoutes);
app.use(`${prefix}/investors`, investorRoutes);
app.use(`${prefix}/expenses`, expenseRoutes);
app.use(`${prefix}/hr`, hrRoutes);
app.use(`${prefix}/payroll`, payrollRoutes);
app.use(`${prefix}/vendors`, vendorRoutes);
app.use(`${prefix}/procurement`, procurementRoutes);
app.use(`${prefix}/facility`, facilityRoutes);
app.use(`${prefix}/finance`, financeRoutes);
app.use(`${prefix}/reports`, reportRoutes);
app.use(`${prefix}/whatsapp`, whatsappRoutes);
app.use(`${prefix}/dashboard`, dashboardRoutes);
app.use(`${prefix}/notifications`, notificationRoutes);
app.use(`${prefix}/upload`, uploadRoutes);
app.use(`${prefix}/backup`, backupRoutes);
app.use(`${prefix}/audit`,  auditRoutes);
app.use(`${prefix}/chat`,   chatRoutes);
app.use(`${prefix}/email`,  emailRoutes);
app.use(`${prefix}/scan`,   scanRoutes);

// ── Serve uploaded files (bills, booking forms, docs) ──
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Desktop / Electron Mode: Serve React Build ──
if (process.env.SERVE_STATIC === 'true') {
  const buildPath = process.env.FRONTEND_BUILD_PATH ||
    path.join(__dirname, '../../frontend/build');
  // Cache JS/CSS assets normally (they have content-hash filenames)
  // but never cache index.html so new builds are always picked up
  app.use(express.static(buildPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──
app.use(errorHandler);

// ── Start Server ──
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    logger.info('✅ Database connected');

    initializeFirebase();
    logger.info('✅ Firebase initialized');

    scheduleCronJobs();
    logger.info('✅ Cron jobs scheduled');

    server.listen(PORT, () => {
      logger.info(`🚀 Burooj ERP Server running on port ${PORT}`);
      logger.info(`📖 API: http://localhost:${PORT}${prefix}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
