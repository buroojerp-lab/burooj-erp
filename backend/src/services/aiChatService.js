// ============================================================
// BUROOJ HEIGHTS ERP — AI ASSISTANT SERVICE
// Powered by Claude (Anthropic) with live DB context
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const { query }  = require('../config/database');
const logger     = require('../config/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Pull live context from DB ─────────────────────────────────
const getLiveContext = async () => {
  const [unitStats, bookingStats, paymentStats, overdueStats, customerCount, recentBookings] = await Promise.all([
    query(`SELECT status, COUNT(*) n FROM units GROUP BY status`),
    query(`SELECT status, COUNT(*) n FROM bookings GROUP BY status`),
    query(`SELECT COALESCE(SUM(amount),0) total FROM payments WHERE created_at >= NOW() - INTERVAL '30 days'`),
    query(`SELECT COUNT(*) n FROM installment_schedules WHERE status='overdue'`),
    query(`SELECT COUNT(*) n FROM customers`),
    query(`
      SELECT b.booking_no, c.name customer_name, u.unit_number, t.name tower_name, b.final_price, b.created_at
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN units u ON u.id = b.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      WHERE b.status NOT IN ('cancelled')
      ORDER BY b.created_at DESC LIMIT 5
    `),
  ]);

  const unitMap    = Object.fromEntries(unitStats.rows.map(r => [r.status, parseInt(r.n)]));
  const bookingMap = Object.fromEntries(bookingStats.rows.map(r => [r.status, parseInt(r.n)]));

  return `
LIVE DATABASE SNAPSHOT (as of ${new Date().toLocaleString('en-PK')}):

UNIT INVENTORY:
  - Available: ${unitMap.available || 0}
  - Sold/Booked: ${unitMap.sold || 0}
  - Reserved: ${unitMap.reserved || 0}
  - Under Maintenance: ${unitMap.maintenance || 0}
  - Total: ${Object.values(unitMap).reduce((a, b) => a + b, 0)}

BOOKINGS:
  - Active: ${bookingMap.active || 0}
  - Pending: ${bookingMap.pending || 0}
  - Completed: ${bookingMap.completed || 0}
  - Cancelled: ${bookingMap.cancelled || 0}

FINANCIALS (last 30 days):
  - Payments Collected: PKR ${parseFloat(paymentStats.rows[0]?.total || 0).toLocaleString('en-PK')}
  - Overdue Installments: ${overdueStats.rows[0]?.n || 0}

CUSTOMERS: ${customerCount.rows[0]?.n || 0} total registered

RECENT BOOKINGS:
${recentBookings.rows.map(b =>
  `  • ${b.booking_no}: ${b.customer_name} — ${b.unit_number} (${b.tower_name}) PKR ${parseFloat(b.final_price).toLocaleString('en-PK')}`
).join('\n')}
`;
};

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = (liveContext) => `You are the AI Assistant for Burooj Heights ERP — a professional real estate management system for Burooj Marketing (Pvt.) Ltd., Lahore, Pakistan.

You have access to live data from the system. Always be professional, helpful, and concise.

ABOUT BUROOJ HEIGHTS:
- Premium residential & commercial real estate project in Lahore
- Located: Main Boulevard Dream Housing, Raiwind Road, Lahore
- Contact: UAN 0322-1786111 | www.buroojmarketing.com
- Units: Apartments, Penthouses, Shops, Offices, Commercial, Lower Ground Commercial, Ground Commercial

YOUR CAPABILITIES:
- Answer questions about inventory, bookings, payments, customers
- Explain ERP features and how to use them
- Provide project information and pricing guidance
- Help with installment schedules and payment plans
- Generate summaries of business performance
- Guide staff through ERP workflows

GUIDELINES:
- For sensitive financial data or customer PII, direct users to proper ERP sections
- Always respond in the same language the user writes in (English or Urdu)
- Keep responses concise and actionable
- Format numbers in PKR (Pakistani Rupees)
- Use professional real estate terminology

${liveContext}`;

// ── Chat with conversation history ───────────────────────────
const chat = async ({ messages, userId, language = 'en' }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { reply: 'AI Assistant is not configured. Please add ANTHROPIC_API_KEY to the environment.' };
  }

  try {
    const liveContext = await getLiveContext();

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT(liveContext),
      messages:   messages.map(m => ({ role: m.role, content: m.content })),
    });

    const reply = response.content[0]?.text || 'I could not generate a response. Please try again.';

    // Log conversation (non-blocking)
    query(
      `INSERT INTO ai_chat_logs (user_id, message_count, tokens_used) VALUES ($1, $2, $3)`,
      [userId, messages.length, response.usage?.output_tokens || 0]
    ).catch(() => {});

    logger.info(`AI chat: user=${userId}, tokens=${response.usage?.output_tokens}`);
    return { reply, usage: response.usage };

  } catch (err) {
    logger.error(`AI chat error: ${err.message}`);
    if (err.status === 401) return { reply: 'AI API key is invalid. Please contact system administrator.' };
    if (err.status === 429) return { reply: 'AI service is busy. Please try again in a moment.' };
    throw err;
  }
};

// ── Quick insight generator (for dashboard) ───────────────────
const generateInsight = async () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const liveContext = await getLiveContext();
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system:     'You are a real estate business analyst. Generate a single, brief (2-3 sentence) business insight based on the data provided. Be specific and actionable.',
      messages:   [{ role: 'user', content: `Based on this data, give one key business insight:\n${liveContext}` }],
    });
    return response.content[0]?.text;
  } catch {
    return null;
  }
};

module.exports = { chat, generateInsight, getLiveContext };
