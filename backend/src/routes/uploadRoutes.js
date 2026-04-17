// routes/uploadRoutes.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { authenticate } = require('../middleware/auth');
const { expenseController } = require('../controllers/expenseController');

const router = express.Router();
router.use(authenticate);

// Local storage (use S3 in production)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/bills');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `bill_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/i;
    if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, PDF files are allowed'));
    }
  },
});

// POST /upload/bill/:expenseId
router.post('/bill/:expenseId', upload.single('bill'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  req.params.id = req.params.expenseId;
  // Delegate to expense controller
  const { uploadBill } = require('../controllers/expenseController');
  return uploadBill(req, res);
});

// POST /upload/document (general documents)
router.post('/document', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileUrl = `/uploads/bills/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
});

// Serve uploaded files
router.use('/files', express.static(path.join(__dirname, '../../uploads')));

module.exports = router;
