// routes/feasibilityRoutes.js — AI Feasibility & Investment Dashboard API
'use strict';
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction }  = require('../config/database');
const engine = require('../services/financialEngine');
const logger = require('../config/logger');

router.use(authenticate);

// ────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ────────────────────────────────────────────────────────────────────────────

// GET /feasibility/projects
router.get('/projects', async (req, res) => {
  const { tower_id, status } = req.query;
  const conditions = ['1=1'];
  const params = [];

  if (tower_id) { conditions.push(`fp.tower_id = $${params.length+1}`); params.push(tower_id); }
  if (status)   { conditions.push(`fp.status = $${params.length+1}`);   params.push(status);   }

  const result = await query(`
    SELECT fp.*,
           fr.roi_pct, fr.irr_pct, fr.net_profit, fr.total_project_cost,
           fr.total_revenue, fr.risk_score,
           u.name creator_name
    FROM feasibility_projects fp
    LEFT JOIN feasibility_results fr ON fr.project_id = fp.id
    LEFT JOIN users u ON u.id = fp.created_by
    WHERE ${conditions.join(' AND ')}
    ORDER BY fp.created_at DESC
  `, params);

  res.json({ data: result.rows });
});

// POST /feasibility/projects
router.post('/projects', async (req, res) => {
  const { name, description, location, project_type = 'high-rise', tower_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const result = await query(`
    INSERT INTO feasibility_projects (name, description, location, project_type, tower_id, created_by)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [name, description, location, project_type, tower_id || null, req.user.id]);

  res.status(201).json({ project: result.rows[0] });
});

// GET /feasibility/projects/:id
router.get('/projects/:id', async (req, res) => {
  const { id } = req.params;
  const [proj, inp, units, results] = await Promise.all([
    query('SELECT * FROM feasibility_projects WHERE id = $1', [id]),
    query('SELECT * FROM feasibility_inputs    WHERE project_id = $1', [id]),
    query('SELECT * FROM feasibility_units     WHERE project_id = $1 ORDER BY unit_type', [id]),
    query('SELECT * FROM feasibility_results   WHERE project_id = $1', [id]),
  ]);
  if (!proj.rows[0]) return res.status(404).json({ error: 'Project not found' });

  res.json({
    project:  proj.rows[0],
    inputs:   inp.rows[0]   || null,
    units:    units.rows,
    results:  results.rows[0] || null,
  });
});

// DELETE /feasibility/projects/:id
router.delete('/projects/:id', authorize('admin', 'manager'), async (req, res) => {
  await query('DELETE FROM feasibility_projects WHERE id = $1', [req.params.id]);
  res.json({ message: 'Project deleted' });
});

// ────────────────────────────────────────────────────────────────────────────
// INPUTS — upsert project inputs and unit mix
// ────────────────────────────────────────────────────────────────────────────

// PUT /feasibility/projects/:id/inputs
router.put('/projects/:id/inputs', async (req, res) => {
  const { id } = req.params;
  const {
    land_cost = 0, land_area_sqft = 0, location_tier = 'B',
    total_floors = 20, basement_levels = 1,
    floor_plate_sqft = 10000, construction_type = 'RCC Frame',
    construction_cost_sqft = 1200, finishing_cost_sqft = 400,
    mep_cost_sqft = 250, contingency_pct = 10,
    consultant_fee_pct = 3, marketing_cost_pct = 2,
    avg_price_sqft = 5000, booking_pct = 20,
    sales_velocity_units = 5, construction_months = 36,
    equity_pct = 40, loan_pct = 60,
    interest_rate_annual = 12, loan_term_months = 48,
    investor_share_pct = 30,
    units = [],
  } = req.body;

  await withTransaction(async (client) => {
    // Upsert inputs
    await client.query(`
      INSERT INTO feasibility_inputs
        (project_id, land_cost, land_area_sqft, location_tier,
         total_floors, basement_levels, floor_plate_sqft, construction_type,
         construction_cost_sqft, finishing_cost_sqft, mep_cost_sqft,
         contingency_pct, consultant_fee_pct, marketing_cost_pct,
         avg_price_sqft, booking_pct, sales_velocity_units, construction_months,
         equity_pct, loan_pct, interest_rate_annual, loan_term_months, investor_share_pct,
         updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        land_cost = EXCLUDED.land_cost,
        land_area_sqft = EXCLUDED.land_area_sqft,
        location_tier = EXCLUDED.location_tier,
        total_floors = EXCLUDED.total_floors,
        basement_levels = EXCLUDED.basement_levels,
        floor_plate_sqft = EXCLUDED.floor_plate_sqft,
        construction_type = EXCLUDED.construction_type,
        construction_cost_sqft = EXCLUDED.construction_cost_sqft,
        finishing_cost_sqft = EXCLUDED.finishing_cost_sqft,
        mep_cost_sqft = EXCLUDED.mep_cost_sqft,
        contingency_pct = EXCLUDED.contingency_pct,
        consultant_fee_pct = EXCLUDED.consultant_fee_pct,
        marketing_cost_pct = EXCLUDED.marketing_cost_pct,
        avg_price_sqft = EXCLUDED.avg_price_sqft,
        booking_pct = EXCLUDED.booking_pct,
        sales_velocity_units = EXCLUDED.sales_velocity_units,
        construction_months = EXCLUDED.construction_months,
        equity_pct = EXCLUDED.equity_pct,
        loan_pct = EXCLUDED.loan_pct,
        interest_rate_annual = EXCLUDED.interest_rate_annual,
        loan_term_months = EXCLUDED.loan_term_months,
        investor_share_pct = EXCLUDED.investor_share_pct,
        updated_at = NOW()
    `, [id, land_cost, land_area_sqft, location_tier,
        total_floors, basement_levels, floor_plate_sqft, construction_type,
        construction_cost_sqft, finishing_cost_sqft, mep_cost_sqft,
        contingency_pct, consultant_fee_pct, marketing_cost_pct,
        avg_price_sqft, booking_pct, sales_velocity_units, construction_months,
        equity_pct, loan_pct, interest_rate_annual, loan_term_months, investor_share_pct]);

    // Replace unit mix
    if (units.length > 0) {
      await client.query('DELETE FROM feasibility_units WHERE project_id = $1', [id]);
      for (const u of units) {
        await client.query(`
          INSERT INTO feasibility_units (project_id, unit_type, count, avg_size_sqft, price_per_sqft)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, u.unit_type, u.count || 0, u.avg_size_sqft || 0, u.price_per_sqft || 0]);
      }
    }

    // Mark project as active
    await client.query(`UPDATE feasibility_projects SET status='active', updated_at=NOW() WHERE id=$1`, [id]);
  });

  res.json({ message: 'Inputs saved' });
});

// ────────────────────────────────────────────────────────────────────────────
// CALCULATE — run engine, store results
// ────────────────────────────────────────────────────────────────────────────

// POST /feasibility/calculate/:id
router.post('/calculate/:id', async (req, res) => {
  const { id } = req.params;

  const [inpRes, unitsRes] = await Promise.all([
    query('SELECT * FROM feasibility_inputs WHERE project_id = $1', [id]),
    query('SELECT * FROM feasibility_units  WHERE project_id = $1', [id]),
  ]);

  const inp   = inpRes.rows[0];
  if (!inp) return res.status(400).json({ error: 'Save project inputs first before calculating' });

  const units = unitsRes.rows.map(u => ({
    unit_type:     u.unit_type,
    count:         parseInt(u.count),
    avg_size_sqft: parseFloat(u.avg_size_sqft),
    price_per_sqft: parseFloat(u.price_per_sqft),
  }));

  // Run engine
  const result = engine.calculate(inp, units);

  await withTransaction(async (client) => {
    // Store results
    await client.query(`
      INSERT INTO feasibility_results
        (project_id, total_project_cost, total_revenue, gross_profit, net_profit,
         roi_pct, irr_pct, npv, breakeven_month, gross_margin_pct, payback_months,
         risk_score, ai_summary, computed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        total_project_cost = EXCLUDED.total_project_cost,
        total_revenue      = EXCLUDED.total_revenue,
        gross_profit       = EXCLUDED.gross_profit,
        net_profit         = EXCLUDED.net_profit,
        roi_pct            = EXCLUDED.roi_pct,
        irr_pct            = EXCLUDED.irr_pct,
        npv                = EXCLUDED.npv,
        breakeven_month    = EXCLUDED.breakeven_month,
        gross_margin_pct   = EXCLUDED.gross_margin_pct,
        payback_months     = EXCLUDED.payback_months,
        risk_score         = EXCLUDED.risk_score,
        ai_summary         = EXCLUDED.ai_summary,
        computed_at        = NOW()
    `, [id,
        result.costs.totalCost, result.revenue.totalRevenue,
        result.grossProfit, result.netProfit,
        result.roi_pct, result.irr_pct, result.npv,
        result.breakeven_month, result.grossMargin_pct,
        result.payback_months, result.riskScore, result.ai.summary]);

    // Store cashflow
    await client.query('DELETE FROM feasibility_cashflow WHERE project_id = $1', [id]);
    for (const cf of result.cashflows) {
      await client.query(`
        INSERT INTO feasibility_cashflow
          (project_id, month_no, month_label, income, construction_expense,
           financing_expense, other_expense, net_cashflow, cumulative_cf)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [id, cf.month_no, cf.month_label, cf.income,
          cf.construction_expense, cf.financing_expense,
          cf.other_expense, cf.net_cashflow, cf.cumulative_cf]);
    }

    // Store scenarios
    for (const sc of result.scenarios) {
      await client.query(`
        INSERT INTO feasibility_scenarios
          (project_id, scenario_type, cost_adjustment_pct, revenue_adjustment_pct,
           total_cost, total_revenue, net_profit, roi_pct, irr_pct, breakeven_month, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (project_id, scenario_type) DO UPDATE SET
          total_cost = EXCLUDED.total_cost,
          total_revenue = EXCLUDED.total_revenue,
          net_profit = EXCLUDED.net_profit,
          roi_pct = EXCLUDED.roi_pct,
          irr_pct = EXCLUDED.irr_pct,
          breakeven_month = EXCLUDED.breakeven_month,
          computed_at = NOW()
      `, [id, sc.scenario_type, sc.cost_adjustment_pct,
          sc.revenue_adjustment_pct, sc.total_cost, sc.total_revenue,
          sc.net_profit, sc.roi_pct, sc.irr_pct, sc.breakeven_month]);
    }
  });

  res.json({ result });
});

// ────────────────────────────────────────────────────────────────────────────
// CASHFLOW
// ────────────────────────────────────────────────────────────────────────────

// GET /feasibility/cashflow/:id
router.get('/cashflow/:id', async (req, res) => {
  const result = await query(
    'SELECT * FROM feasibility_cashflow WHERE project_id = $1 ORDER BY month_no',
    [req.params.id]
  );
  res.json({ data: result.rows });
});

// ────────────────────────────────────────────────────────────────────────────
// SCENARIOS
// ────────────────────────────────────────────────────────────────────────────

// GET /feasibility/scenarios/:id
router.get('/scenarios/:id', async (req, res) => {
  const result = await query(
    'SELECT * FROM feasibility_scenarios WHERE project_id = $1 ORDER BY scenario_type',
    [req.params.id]
  );
  res.json({ data: result.rows });
});

// POST /feasibility/scenarios/:id/run — real-time scenario with custom adjustments
router.post('/scenarios/:id/run', async (req, res) => {
  const { id } = req.params;
  const { cost_adj = 0, revenue_adj = 0, velocity_mult = 1.0 } = req.body;

  const [inpRes, unitsRes] = await Promise.all([
    query('SELECT * FROM feasibility_inputs WHERE project_id = $1', [id]),
    query('SELECT * FROM feasibility_units  WHERE project_id = $1', [id]),
  ]);

  const inp = inpRes.rows[0];
  if (!inp) return res.status(400).json({ error: 'No inputs found' });

  const units = unitsRes.rows.map(u => ({
    unit_type:     u.unit_type,
    count:         parseInt(u.count),
    avg_size_sqft: parseFloat(u.avg_size_sqft),
    price_per_sqft: parseFloat(u.price_per_sqft),
  }));

  const costs   = engine.calcCosts(inp);
  const revenue = engine.calcRevenue(inp, units);
  const adj     = { costAdj: cost_adj, revenueAdj: revenue_adj, velocityMult: velocity_mult };
  const cashflows = engine.buildCashflow(inp, costs, revenue, adj);

  const adjCost    = costs.totalCost    * (1 + cost_adj    / 100);
  const adjRevenue = revenue.totalRevenue * (1 + revenue_adj / 100);
  const netProfit  = adjRevenue - adjCost;
  const roi        = adjCost > 0 ? (netProfit / adjCost) * 100 : 0;
  const metrics    = engine.calcMetrics(cashflows, adjCost, netProfit);

  res.json({
    total_cost:     Math.round(adjCost),
    total_revenue:  Math.round(adjRevenue),
    net_profit:     Math.round(netProfit),
    roi_pct:        parseFloat(roi.toFixed(2)),
    irr_pct:        metrics.irr_pct,
    breakeven_month: metrics.breakeven_month,
    cashflows,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AI SUGGESTIONS — smart pricing & recommendations
// ────────────────────────────────────────────────────────────────────────────

// POST /feasibility/ai-suggest
router.post('/ai-suggest', async (req, res) => {
  const inp = req.body;
  const costs   = engine.calcCosts(inp);
  const revenue = engine.calcRevenue(inp, inp.units || []);
  const netProfit = revenue.totalRevenue - costs.totalCost;
  const roi       = costs.totalCost > 0 ? (netProfit / costs.totalCost) * 100 : 0;
  const riskScore = engine.scoreRisk(inp, costs, revenue);
  const ai        = engine.aiSuggestions(inp, costs, revenue, roi);

  // Optimal pricing suggestion
  const multipliers = { A: 1.35, B: 1.0, C: 0.72 };
  const mult = multipliers[inp.location_tier] || 1.0;
  const suggestedPriceSqft = Math.round(
    (inp.construction_cost_sqft + inp.finishing_cost_sqft + inp.mep_cost_sqft) * 3.2 * mult
  );

  res.json({
    suggested_price_sqft:    suggestedPriceSqft,
    estimated_roi:           parseFloat(roi.toFixed(2)),
    risk_score:              riskScore,
    suggestions:             ai.suggestions,
    warnings:                ai.warnings,
    cost_breakdown_preview: {
      land:         Math.round(costs.landCost),
      construction: Math.round(costs.constructionCost),
      finishing:    Math.round(costs.finishingCost),
      mep:          Math.round(costs.mepCost),
      contingency:  Math.round(costs.contingency),
      financing:    Math.round(costs.financingCost),
      total:        Math.round(costs.totalCost),
    },
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REPORT DATA — structured payload for PDF/Excel generation
// ────────────────────────────────────────────────────────────────────────────

// GET /feasibility/report-data/:id
router.get('/report-data/:id', async (req, res) => {
  const { id } = req.params;

  const [proj, inp, units, results, cashflow, scenarios] = await Promise.all([
    query('SELECT * FROM feasibility_projects WHERE id = $1', [id]),
    query('SELECT * FROM feasibility_inputs    WHERE project_id = $1', [id]),
    query('SELECT * FROM feasibility_units     WHERE project_id = $1', [id]),
    query('SELECT * FROM feasibility_results   WHERE project_id = $1', [id]),
    query('SELECT * FROM feasibility_cashflow  WHERE project_id = $1 ORDER BY month_no', [id]),
    query('SELECT * FROM feasibility_scenarios WHERE project_id = $1', [id]),
  ]);

  if (!proj.rows[0]) return res.status(404).json({ error: 'Project not found' });

  const inpData = inp.rows[0] || {};
  const costs   = inpData.land_cost !== undefined ? engine.calcCosts(inpData) : null;

  res.json({
    project:   proj.rows[0],
    inputs:    inpData,
    units:     units.rows,
    results:   results.rows[0] || null,
    cashflow:  cashflow.rows,
    scenarios: scenarios.rows,
    costs,
    generated_at: new Date().toISOString(),
  });
});

module.exports = router;
