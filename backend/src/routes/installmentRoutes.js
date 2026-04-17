// routes/installmentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/installmentController');
const multer = require('multer');

router.use(authenticate);

router.get('/', ctrl.getInstallments);
router.get('/summary/:bookingId', ctrl.getBookingSummary);
router.post('/:id/pay', ctrl.recordPayment);

module.exports = router;
