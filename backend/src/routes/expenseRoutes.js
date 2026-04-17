// routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/expenseController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/bills');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `bill_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|pdf/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

router.use(authenticate);

router.get('/',        ctrl.getExpenses);
router.get('/report',  ctrl.getReport);
router.post('/',       authorize('admin', 'manager', 'accountant'), ctrl.createExpense);
router.put('/:id',     authorize('admin', 'manager', 'accountant'), ctrl.updateExpense);
router.delete('/:id',  authorize('admin', 'manager'), ctrl.deleteExpense);
router.post('/:id/bills', upload.single('bill'), ctrl.uploadBill);

module.exports = router;
