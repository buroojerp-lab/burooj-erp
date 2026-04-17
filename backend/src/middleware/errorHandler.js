// middleware/errorHandler.js
const logger = require('../config/logger');

module.exports = (err, req, res, next) => {
  // Custom error with status
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Record already exists' });
  }

  // Postgres foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found' });
  }

  // Multer file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum 10MB allowed.' });
  }

  logger.error(err.stack || err.message);

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
};
