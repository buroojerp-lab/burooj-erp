// services/financialEngine.js — AI Financial Calculation Engine
'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pv(rate, t, fv) {
  return fv / Math.pow(1 + rate, t);
}

function npv(monthlyRate, cashflows) {
  return cashflows.reduce((sum, cf, t) => sum + pv(monthlyRate, t, cf), 0);
}

function irr(cashflows, guess = 0.01, maxIter = 2000, tol = 1e-7) {
  let r = guess;
  for (let i = 0; i < maxIter; i++) {
    const f  = cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
    const df = cashflows.reduce((s, cf, t) => s - t * cf / Math.pow(1 + r, t + 1), 0);
    if (Math.abs(df) < 1e-14) break;
    const rNew = r - f / df;
    if (Math.abs(rNew - r) < tol) { r = rNew; break; }
    r = rNew;
  }
  return isFinite(r) ? r * 12 * 100 : null; // annualised %
}

function sCurveWeight(month, totalMonths) {
  // Logistic S-curve spend distribution
  const k = 10, mid = totalMonths / 2;
  const w = 1 / (1 + Math.exp(-k * (month - mid) / totalMonths));
  return w;
}

function buildSCurveWeights(months) {
  const raw = Array.from({ length: months }, (_, i) => sCurveWeight(i + 1, months));
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map(w => w / sum); // normalise
}

// ── Core Cost Calculator ──────────────────────────────────────────────────────

function calcCosts(inp) {
  const builtUpArea = inp.total_floors * inp.floor_plate_sqft;

  const constructionCost = builtUpArea * inp.construction_cost_sqft;
  const finishingCost    = builtUpArea * inp.finishing_cost_sqft;
  const mepCost          = builtUpArea * inp.mep_cost_sqft;
  const hardCost         = constructionCost + finishingCost + mepCost;

  const consultantFee    = hardCost * (inp.consultant_fee_pct / 100);
  const marketingCost    = 0; // calculated on revenue side
  const softCost         = consultantFee;

  const contingency      = (hardCost + softCost) * (inp.contingency_pct / 100);
  const landCost         = inp.land_cost;

  const baseCost         = landCost + hardCost + softCost + contingency;
  const loanAmount       = baseCost * (inp.loan_pct / 100);
  const financingCost    = loanAmount * (inp.interest_rate_annual / 100) * (inp.loan_term_months / 12);

  const totalCost        = baseCost + financingCost;

  return {
    builtUpArea,
    landCost,
    constructionCost,
    finishingCost,
    mepCost,
    hardCost,
    softCost,
    consultantFee,
    contingency,
    baseCost,
    loanAmount,
    financingCost,
    totalCost,
  };
}

// ── Revenue Calculator ─────────────────────────────────────────────────────────

function calcRevenue(inp, units) {
  let totalRevenue = 0;
  let totalUnits   = 0;

  const breakdown = units.map(u => {
    const rev = u.count * u.avg_size_sqft * u.price_per_sqft;
    totalRevenue += rev;
    totalUnits   += u.count;
    return { ...u, revenue: rev };
  });

  // Fallback: if no unit mix, use aggregate inputs
  if (totalUnits === 0) {
    const landArea   = inp.land_area_sqft;
    const floors     = inp.total_floors;
    const builtUp    = floors * inp.floor_plate_sqft;
    totalRevenue     = builtUp * inp.avg_price_sqft;
    totalUnits       = Math.round(builtUp / 900); // ~900 sqft avg
  }

  const marketingCost = totalRevenue * (inp.marketing_cost_pct / 100);
  const netRevenue    = totalRevenue - marketingCost;

  return { totalRevenue, netRevenue, marketingCost, breakdown, totalUnits };
}

// ── Cashflow Projector ────────────────────────────────────────────────────────

function buildCashflow(inp, costs, revenue, scenarioAdj = {}) {
  const cm = inp.construction_months;
  const salesMonths = Math.ceil(revenue.totalUnits / inp.sales_velocity_units);
  const totalMonths = Math.max(cm, salesMonths) + 6; // 6-month buffer

  const scWeights     = buildSCurveWeights(cm);
  const constructBudget = costs.hardCost + costs.softCost + costs.contingency;
  const monthlyInterest = (costs.loanAmount * (inp.interest_rate_annual / 100)) / 12;

  // Sales schedule: linear absorption
  const unitsPerMonth  = inp.sales_velocity_units * (scenarioAdj.velocityMult || 1);
  const bookingPct     = inp.booking_pct / 100;
  const progressPct    = 0.4; // 40% on completion
  const completionPct  = 1 - bookingPct - progressPct;

  let soldUnits = 0;
  const cashflows = [];
  let cumulative  = -(costs.landCost * (inp.equity_pct / 100)); // Month 0: equity for land

  cashflows.push({
    month_no:             0,
    month_label:          'M0',
    income:               0,
    construction_expense: costs.landCost,
    financing_expense:    0,
    other_expense:        0,
    net_cashflow:         -costs.landCost,
    cumulative_cf:        cumulative,
  });

  for (let m = 1; m <= totalMonths; m++) {
    // Construction spend (S-curve)
    const constructSpend = m <= cm
      ? constructBudget * scWeights[m - 1] * (1 + (scenarioAdj.costAdj || 0) / 100)
      : 0;

    // Sales income
    const newlySold   = Math.min(unitsPerMonth, revenue.totalUnits - soldUnits);
    const avgRevPerUnit = revenue.totalRevenue / Math.max(revenue.totalUnits, 1);
    const bookingIncome  = newlySold * avgRevPerUnit * bookingPct;
    const progressIncome = newlySold * avgRevPerUnit * progressPct * 0.1; // 10% each installment
    soldUnits = Math.min(soldUnits + newlySold, revenue.totalUnits);

    // Completion income in last month
    const completionIncome = m === cm
      ? soldUnits * avgRevPerUnit * completionPct * (scenarioAdj.revenueAdj !== undefined
          ? 1 + scenarioAdj.revenueAdj / 100 : 1)
      : 0;

    const income     = (bookingIncome + progressIncome + completionIncome)
                       * (1 + (scenarioAdj.revenueAdj || 0) / 100 * (m !== cm ? 1 : 0));
    const financing  = m <= inp.loan_term_months ? monthlyInterest : 0;
    const net        = income - constructSpend - financing;
    cumulative      += net;

    cashflows.push({
      month_no:             m,
      month_label:          `M${m}`,
      income:               Math.round(income),
      construction_expense: Math.round(constructSpend),
      financing_expense:    Math.round(financing),
      other_expense:        0,
      net_cashflow:         Math.round(net),
      cumulative_cf:        Math.round(cumulative),
    });
  }

  return cashflows;
}

// ── IRR & Break-even ─────────────────────────────────────────────────────────

function calcMetrics(cashflows, totalCost, netProfit, discountRate = 0.12) {
  const cfArray   = cashflows.map(c => c.net_cashflow);
  cfArray[0]      = -(totalCost * 0.1); // seed with initial equity outflow

  const irrVal    = irr(cfArray);
  const monthlyR  = discountRate / 12;
  const npvVal    = npv(monthlyR, cfArray);

  const breakevenMonth = cashflows.findIndex(c => c.cumulative_cf >= 0);

  return {
    irr_pct:        irrVal !== null ? parseFloat(irrVal.toFixed(2)) : null,
    npv:            Math.round(npvVal),
    breakeven_month: breakevenMonth >= 0 ? breakevenMonth : null,
  };
}

// ── Risk Scorer ───────────────────────────────────────────────────────────────

function scoreRisk(inp, costs, revenue) {
  let score = 0; // 0 = low risk, 100 = extreme

  // Leverage risk (LTV)
  const ltv = inp.loan_pct;
  score += ltv > 70 ? 25 : ltv > 50 ? 15 : 5;

  // Sales velocity risk
  const projectMonths = inp.construction_months;
  const selloutMonths = Math.ceil(revenue.totalUnits / inp.sales_velocity_units);
  score += selloutMonths > projectMonths * 1.5 ? 25 : selloutMonths > projectMonths ? 15 : 5;

  // Cost margin risk
  const margin = (revenue.totalRevenue - costs.totalCost) / revenue.totalRevenue;
  score += margin < 0.1 ? 30 : margin < 0.2 ? 15 : 5;

  // Construction risk (floors)
  score += inp.total_floors > 40 ? 15 : inp.total_floors > 20 ? 8 : 3;

  return Math.min(Math.round(score), 100);
}

// ── AI Smart Suggestions ─────────────────────────────────────────────────────

function aiSuggestions(inp, costs, revenue, roi) {
  const suggestions = [];
  const warnings    = [];

  if (roi < 15) {
    suggestions.push('ROI is below 15%. Consider increasing price per sqft by 8–12% or reducing finishing cost.');
  }
  if (inp.contingency_pct < 10) {
    warnings.push('Contingency below 10% is risky for high-rise projects. Recommend minimum 12%.');
  }
  if (inp.loan_pct > 65) {
    warnings.push(`Debt ratio of ${inp.loan_pct}% is high. High financing cost will erode margins.`);
  }
  const locationMultiplier = { A: 1.3, B: 1.0, C: 0.75 }[inp.location_tier] || 1.0;
  const suggestedPrice = Math.round(inp.construction_cost_sqft * 3.5 * locationMultiplier);
  if (inp.avg_price_sqft < suggestedPrice * 0.9) {
    suggestions.push(`Suggested price per sqft is PKR ${suggestedPrice.toLocaleString()} based on location tier "${inp.location_tier}" and build cost. Current pricing may be under-market.`);
  }
  if (inp.sales_velocity_units < 3) {
    warnings.push('Sales velocity below 3 units/month will significantly extend payback period and financing cost.');
  }
  if (revenue.totalRevenue < costs.totalCost) {
    warnings.push('⚠️ CRITICAL: Total revenue is less than total cost. Project is currently loss-making.');
  }

  return { suggestions, warnings };
}

// ── Scenario Engine ──────────────────────────────────────────────────────────

const SCENARIO_CONFIGS = {
  base: {
    label:          'Base Case',
    costAdj:        0,
    revenueAdj:     0,
    velocityMult:   1.0,
  },
  best: {
    label:          'Best Case',
    costAdj:        -5,   // 5% cost saving
    revenueAdj:     15,   // 15% higher sales
    velocityMult:   1.4,  // 40% faster absorption
  },
  worst: {
    label:          'Worst Case',
    costAdj:        20,   // 20% cost overrun
    revenueAdj:     -15,  // 15% lower pricing
    velocityMult:   0.6,  // 40% slower sales
  },
};

function runScenario(inp, units, scenarioType) {
  const cfg  = SCENARIO_CONFIGS[scenarioType] || SCENARIO_CONFIGS.base;
  const adj  = { costAdj: cfg.costAdj, revenueAdj: cfg.revenueAdj, velocityMult: cfg.velocityMult };

  const costs   = calcCosts(inp);
  const revenue = calcRevenue(inp, units);

  // Apply scenario adjustments
  const adjCost     = costs.totalCost    * (1 + cfg.costAdj    / 100);
  const adjRevenue  = revenue.totalRevenue * (1 + cfg.revenueAdj / 100);
  const adjNet      = adjRevenue - adjCost;
  const adjROI      = adjCost > 0 ? (adjNet / adjCost) * 100 : 0;

  const cashflows   = buildCashflow(inp, costs, revenue, adj);
  const metrics     = calcMetrics(cashflows, adjCost, adjNet);

  return {
    scenario_type:    scenarioType,
    label:            cfg.label,
    cost_adjustment_pct:    cfg.costAdj,
    revenue_adjustment_pct: cfg.revenueAdj,
    total_cost:       Math.round(adjCost),
    total_revenue:    Math.round(adjRevenue),
    net_profit:       Math.round(adjNet),
    roi_pct:          parseFloat(adjROI.toFixed(2)),
    irr_pct:          metrics.irr_pct,
    breakeven_month:  metrics.breakeven_month,
    cashflows,
  };
}

// ── Master Calculate ─────────────────────────────────────────────────────────

function calculate(inp, units = []) {
  const costs       = calcCosts(inp);
  const revenue     = calcRevenue(inp, units);
  const grossProfit = revenue.totalRevenue - costs.baseCost;
  const netProfit   = revenue.totalRevenue - costs.totalCost;
  const roi         = costs.totalCost > 0 ? (netProfit / costs.totalCost) * 100 : 0;
  const grossMargin = revenue.totalRevenue > 0 ? (grossProfit / revenue.totalRevenue) * 100 : 0;

  const cashflows   = buildCashflow(inp, costs, revenue);
  const metrics     = calcMetrics(cashflows, costs.totalCost, netProfit);
  const riskScore   = scoreRisk(inp, costs, revenue);
  const ai          = aiSuggestions(inp, costs, revenue, roi);

  const scenarios = ['base', 'best', 'worst'].map(t => runScenario(inp, units, t));

  const aiSummary = [
    `Total project cost: PKR ${(costs.totalCost / 1e6).toFixed(1)}M`,
    `Expected revenue: PKR ${(revenue.totalRevenue / 1e6).toFixed(1)}M`,
    `Net profit: PKR ${(netProfit / 1e6).toFixed(1)}M (ROI: ${roi.toFixed(1)}%)`,
    metrics.irr_pct ? `IRR: ${metrics.irr_pct.toFixed(1)}% p.a.` : '',
    metrics.breakeven_month ? `Break-even at month ${metrics.breakeven_month}` : '',
    ai.warnings.length > 0 ? `Risks: ${ai.warnings[0]}` : 'No critical risks identified.',
  ].filter(Boolean).join(' | ');

  return {
    costs,
    revenue,
    grossProfit:    Math.round(grossProfit),
    netProfit:      Math.round(netProfit),
    roi_pct:        parseFloat(roi.toFixed(2)),
    grossMargin_pct: parseFloat(grossMargin.toFixed(2)),
    irr_pct:        metrics.irr_pct,
    npv:            metrics.npv,
    breakeven_month: metrics.breakeven_month,
    payback_months: metrics.breakeven_month,
    riskScore,
    cashflows,
    scenarios,
    ai: { ...ai, summary: aiSummary },
  };
}

module.exports = {
  calculate,
  runScenario,
  calcCosts,
  calcRevenue,
  buildCashflow,
  calcMetrics,
  scoreRisk,
  aiSuggestions,
  SCENARIO_CONFIGS,
};
