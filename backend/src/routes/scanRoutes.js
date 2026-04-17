// routes/scanRoutes.js — Booking form image scan via Claude Vision
const express   = require('express');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const logger    = require('../config/logger');

const router = express.Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/booking-forms');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `form_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png)$/i.test(file.originalname) && /image\/(jpeg|png)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG/PNG images are supported. For PDF, take a photo or screenshot first.'));
    }
  },
});

const EXTRACT_PROMPT = `You are a data extraction assistant for Burooj Heights real estate (Pakistan).
Analyze this booking/application form image. The form may be handwritten, printed, or mixed Urdu/English.

Extract all visible information and return ONLY a valid JSON object — no explanation, no markdown, just raw JSON:
{
  "customer": {
    "name": "full name as written",
    "father_name": "father or husband name if visible",
    "cnic": "CNIC number exactly as written (e.g. 35201-1234567-1)",
    "phone": "mobile or phone number",
    "email": "email address if present",
    "address": "complete address",
    "city": "city name",
    "occupation": "profession or job title",
    "nationality": "nationality (default Pakistani if not specified)"
  },
  "booking": {
    "unit_number": "unit, flat, shop or plot number",
    "tower": "tower, block or building name",
    "floor": "floor number or name",
    "area_sqft": null,
    "total_price": null,
    "booking_date": "YYYY-MM-DD format if date is visible",
    "application_no": "application or form reference number"
  },
  "payment": {
    "down_payment": null,
    "monthly_installment": null,
    "installment_months": null
  }
}

Rules:
- Use null for any field not found or not readable
- Strip commas and currency symbols from numbers (write 2500000 not "2,500,000" or "PKR 2.5M")
- If a field is partially readable, extract what you can
- For Urdu text, transliterate names to English spelling`;

// POST /api/v1/scan/booking-form
router.post('/booking-form', upload.single('form'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileUrl = `/uploads/booking-forms/${req.file.filename}`;

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key') {
    logger.warn('SCAN: ANTHROPIC_API_KEY not configured — returning file URL only');
    return res.json({ success: false, fileUrl, extracted: {}, error: 'AI scanning not configured. File saved — please fill details manually.' });
  }

  try {
    const buffer    = fs.readFileSync(req.file.path);
    const base64    = buffer.toString('base64');
    const mediaType = req.file.mimetype; // image/jpeg or image/png

    const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text',  text: EXTRACT_PROMPT },
        ],
      }],
    });

    const text      = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    logger.info(`SCAN: Form scanned successfully — ${req.file.filename}`);
    res.json({ success: true, fileUrl, extracted });

  } catch (err) {
    logger.error(`SCAN: Failed for ${req.file.filename}: ${err.message}`);
    res.json({
      success: false,
      fileUrl,
      extracted: {},
      error: 'Could not auto-extract data. Please fill in manually.',
    });
  }
});

module.exports = router;
