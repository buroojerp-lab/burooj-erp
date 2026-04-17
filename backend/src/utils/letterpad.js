// ============================================================
// BUROOJ MARKETING (Pvt.) Ltd. — OFFICIAL LETTERPAD UTILITY
// ============================================================

const fs   = require('fs');
const path = require('path');

const TEAL        = '#0098B4';
const TEAL_DARK   = '#007A91';
const GRAY_MED    = '#7F7F7F';
const GRAY_LIGHT  = '#B0B0B0';
const GRAY_VLIGHT = '#D4D4D4';
const TEXT_DARK   = '#1A1A1A';
const TEXT_MID    = '#3D3D3D';

const LOGO_PATH      = path.join(__dirname, '../assets/logo.jpg');
const BRANDMARK_PATH = path.join(__dirname, '../assets/brandmark.jpg');
const W = 595, H = 842;

// Right strip occupies x = W-21 to W (two 10px columns)
const STRIP_X = W - 21;   // = 574

// Content safe area
const CONTENT = { left: 28, right: STRIP_X - 8, top: 122, bottom: 690 };

/**
 * Draw the full Burooj Marketing letterpad on the current page.
 * @param {PDFDocument} doc
 * @param {{ date?: string, ref?: string }} opts
 */
function drawLetterpad(doc, opts = {}) {

  // ── 1. TOP-LEFT: Logo ────────────────────────────────────
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, CONTENT.left, 10, { height: 82 }); } catch (_) {}
  } else {
    doc.fontSize(26).font('Helvetica-Bold').fillColor(TEAL)
       .text('BUROOJ', CONTENT.left, 18, { lineBreak: false });
    doc.fontSize(9).font('Helvetica').fillColor(GRAY_MED)
       .text('MARKETING (Pvt.) Ltd.', CONTENT.left, 48, { lineBreak: false });
  }

  // ── 2. BLUE LINE — full width under logo (logo bottom ≈ y 92) ──
  doc.rect(0, 94, W, 3).fill(TEAL);
  doc.rect(0, 97, W, 1).fill(TEAL_DARK);

  // ── 3. Tagline — below blue line ─────────────────────────
  doc.fontSize(8).font('Helvetica-Oblique').fillColor(TEAL)
     .text('We Believe in Building Relations', CONTENT.left, 103, { lineBreak: false });

  // ── 4. RIGHT EDGE: Vertical strip of alternating gray squares ──
  // Two-column strip (each 10×10), x = 574–584 and 584–594, y = 108..700
  for (let y = 108; y < 700; y += 11) {
    const even = Math.floor((y - 108) / 11) % 2 === 0;
    doc.rect(STRIP_X,      y, 10, 10).fill(even ? GRAY_LIGHT  : GRAY_VLIGHT);
    doc.rect(STRIP_X + 11, y, 10, 10).fill(even ? GRAY_VLIGHT : GRAY_LIGHT);
  }

  // ── 5. DATE / REF (top-right, aligned with logo) ─────────
  const drX = STRIP_X - 195, drY = 20;
  doc.fontSize(7.5).font('Helvetica').fillColor(GRAY_MED)
     .text('Date :', drX, drY,      { lineBreak: false })
     .text('Ref  :', drX, drY + 16, { lineBreak: false });
  const lineVal = opts.date || '_______________';
  const refVal  = opts.ref  || '_______________';
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold')
     .text(lineVal, drX + 32, drY,      { lineBreak: false })
     .text(refVal,  drX + 32, drY + 16, { lineBreak: false });

  // ── 6. BOTTOM-LEFT: Solid teal vertical bar ──────────────
  doc.rect(0, 450, 14, H - 450).fill(TEAL);

  // ── 7. BOTTOM-RIGHT: Brand mark — aligned with grey strip bottom ──
  // Strip ends at y=700. Anchor brandmark bottom to strip bottom.
  const BM_H = 160;
  const BM_Y = 700 - BM_H;     // top of image = 540, bottom = 700 (matches strip end)
  const BM_X = STRIP_X - 72;   // flush left of the right strip (4px gap)
  if (fs.existsSync(BRANDMARK_PATH)) {
    try { doc.image(BRANDMARK_PATH, BM_X, BM_Y, { height: BM_H }); } catch (_) {}
  } else {
    const BQ = 20;
    doc.rect(BM_X,          BM_Y,              BQ * 2, BQ * 2).fill(GRAY_MED);
    doc.rect(BM_X + BQ + 2, BM_Y,              BQ - 2, BQ - 2).fill(GRAY_LIGHT);
    doc.rect(BM_X,          BM_Y + BQ * 2 + 2, BQ * 2, BQ * 2).fill(TEAL);
    doc.rect(BM_X + BQ + 2, BM_Y + BQ * 2 + 2, BQ - 2, BQ - 2).fill(TEAL_DARK);
  }

  // ── 8. FOOTER — anchored just below the grey strip / brandmark bottom (y=700) ──
  const FY = 710;  // strip ends at 700; 10px breathing room

  // Thin teal separator line above footer text
  doc.moveTo(CONTENT.left, FY - 5)
     .lineTo(STRIP_X - 4,  FY - 5)
     .lineWidth(0.5).strokeColor(TEAL).stroke();

  doc.fontSize(7).font('Helvetica-Bold').fillColor(TEXT_DARK)
     .text('HEAD OFFICE:', CONTENT.left, FY, { lineBreak: false, continued: true })
     .font('Helvetica').fillColor(TEXT_MID)
     .text('  Burooj Marketing (Pvt.) Ltd., 5-6 Commercial, Main Boulevard Dream Housing, Raiwind Road, Lahore.',
       { lineBreak: false });

  doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MID)
     .text(
       'www.buroojmarketing.com  |  @Buroojmarketing  |  UAN: 0322-1786111',
       CONTENT.left, FY + 11,
       { lineBreak: false, width: STRIP_X - CONTENT.left - 10 }
     );
}

module.exports = { drawLetterpad, CONTENT, W, H, TEAL, TEAL_DARK, GRAY_MED, GRAY_LIGHT };
