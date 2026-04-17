// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/stats',               ctrl.getStats);
router.get('/revenue-chart',       ctrl.getRevenueChart);
router.get('/unit-status-chart',   ctrl.getUnitStatusChart);
router.get('/installments-chart',  ctrl.getInstallmentForecast);
router.get('/installment-forecast',ctrl.getInstallmentForecast);
router.get('/recent-activities',   ctrl.getRecentActivities);
router.get('/overdue-alerts',      ctrl.getOverdueAlerts);
router.get('/top-agents',          ctrl.getTopAgents);
router.get('/financial-kpis',      ctrl.getFinancialKPIs);
router.get('/top-customers',       ctrl.getTopCustomers);
router.get('/payables',            ctrl.getPayables);
router.get('/receivables',         ctrl.getReceivables);
router.get('/cash-bank',           ctrl.getCashBank);
router.get('/top-items',           ctrl.getTopItems);

module.exports = router;
