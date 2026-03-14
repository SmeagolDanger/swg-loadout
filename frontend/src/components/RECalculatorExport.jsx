import React, { useCallback, useState } from 'react';
import { Download, Clipboard, Check } from 'lucide-react';

// ── Theme (matches LoadoutExport) ────────────────────────────────────
const C = {
  bg:        '#0a0c10',
  card:      '#111318',
  cardHead:  '#0e1015',
  border:    '#272c38',
  divider:   '#1f232c',
  muted:     '#3d4455',
  text3:     '#6b7494',
  text2:     '#9ca3bd',
  text1:     '#c8cdd8',
  bright:    '#e2e5ec',
  plasma:    '#33ddff',
  plasmaDim: '#00d4ff',
};

const TIER_COLORS = {
  A:       '#ffcc00',
  B:       '#f399ff',
  C:       '#007fff',
  D:       '#29db35',
  unicorn: '#ff69b4',
  reward:  '#ff8080',
};

const RE_BONUS = [2, 3, 3, 4, 4, 5, 5, 6, 7, 7];

const W          = 900;
const PAD        = 16;
const GAP        = 12;
const ROW_H      = 16;
const HEAD_H     = 22;  // card title band
const COL_H      = 18;  // column-header row height
const CARD_PAD   = 8;

const F = {
  title:   '700 18px Rajdhani, sans-serif',
  sub:     '600 11px Rajdhani, sans-serif',
  head:    '700 10px Rajdhani, sans-serif',
  col:     '500 9px "Exo 2", sans-serif',
  label:   '500 10px "Exo 2", sans-serif',
  value:   '500 10px "JetBrains Mono", monospace',
  footer:  '600 9px Rajdhani, sans-serif',
};

// ── Helpers ──────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function trunc(ctx, text, maxW) {
  if (!text) return '—';
  const s = String(text);
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawCardShell(ctx, x, y, w, h, title) {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = C.card; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
  // header band
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, HEAD_H); ctx.clip();
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = C.cardHead; ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.border; ctx.fillRect(x, y + HEAD_H, w, 0.5);
  ctx.font = F.head; ctx.fillStyle = C.plasma;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(title, x + CARD_PAD, y + HEAD_H / 2 + 1);
}

function tierColor(stat) {
  if (!stat) return null;
  if (stat.tier && TIER_COLORS[stat.tier]) return TIER_COLORS[stat.tier];
  const d = stat.rarity_display || '';
  if (d.includes('⋆')) return '#ff69b4';
  if (d === 'Reward') return '#ff8080';
  return null;
}

// ── Canvas render ────────────────────────────────────────────────────
function renderRECard({ compType, level, statDefs, inputs, result, matchTarget, projectName }) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const bonus  = RE_BONUS[parseInt(level) - 1] ?? '?';
  const nStats = statDefs.length;

  const leftW  = Math.round((W - PAD * 2 - GAP) * 0.43);
  const rightW = W - PAD * 2 - GAP - leftW;

  // card heights
  // left:  head + col-header-row + n×row + bottom pad
  const leftCardH  = HEAD_H + COL_H + nStats * ROW_H + CARD_PAD + 6;
  // right top: summary
  const summaryCardH = HEAD_H + 60;
  // right bottom: matching  (target row + col header + n×row + bottom pad)
  const matchCardH = HEAD_H + ROW_H + COL_H + nStats * ROW_H + CARD_PAD + 6;
  const rightTotalH = summaryCardH + GAP + matchCardH;

  const headerH  = 44;
  const contentH = Math.max(leftCardH, rightTotalH);
  const totalH   = headerH + GAP + contentH + 20 + PAD;

  const dpr = 2;
  canvas.width  = W * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  // background
  roundRect(ctx, 0, 0, W, totalH, 6);
  ctx.fillStyle = C.bg; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();

  // ── Page header ──
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.plasmaDim;
  ctx.fillRect(PAD, PAD, 3, 30);

  ctx.font = F.title; ctx.fillStyle = C.bright; ctx.textAlign = 'left';
  ctx.fillText(
    `${(compType || 'COMPONENT').toUpperCase()} — RE LEVEL ${level} (${bonus}%)`,
    PAD + 10, PAD + 2,
  );
  if (projectName) {
    ctx.font = F.sub; ctx.fillStyle = C.text2;
    ctx.fillText(projectName, PAD + 10, PAD + 24);
  }
  ctx.font = F.footer; ctx.fillStyle = C.muted; ctx.textAlign = 'right';
  ctx.fillText('SWG:L TOOLS  ·  space.jawatracks.com', W - PAD, PAD + 4);
  ctx.fillStyle = C.border; ctx.fillRect(PAD, headerH, W - PAD * 2, 1);
  ctx.textBaseline = 'alphabetic';

  const y  = headerH + GAP;
  const lx = PAD;
  const rx = PAD + leftW + GAP;

  // ── LEFT: Input stats ──
  drawCardShell(ctx, lx, y, leftW, leftCardH, 'INPUT RAW STATS');

  // column x anchors (right-edge of each column except first)
  const inner   = leftW - CARD_PAD * 2;
  const snW     = Math.round(inner * 0.27);   // stat name
  const inW     = Math.round(inner * 0.20);   // input
  const prW     = Math.round(inner * 0.17);   // post-re
  const rrW     = Math.round(inner * 0.24);   // rarity
  // log delta takes remainder
  const x_sn   = lx + CARD_PAD;
  const x_in   = x_sn + snW + inW;
  const x_pr   = x_in + prW;
  const x_rr   = x_pr + rrW;
  const x_ld   = lx + leftW - CARD_PAD;

  const colY   = y + HEAD_H + 10;
  ctx.font = F.col; ctx.fillStyle = C.text3; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';  ctx.fillText('STAT',    x_sn, colY);
  ctx.textAlign = 'right'; ctx.fillText('INPUT',   x_in, colY);
  ctx.textAlign = 'right'; ctx.fillText('POST-RE', x_pr, colY);
  ctx.textAlign = 'right'; ctx.fillText('RARITY',  x_rr, colY);
  ctx.textAlign = 'right'; ctx.fillText('LOG Δ',   x_ld, colY);
  ctx.fillStyle = C.divider; ctx.fillRect(lx + CARD_PAD, colY + 4, leftW - CARD_PAD * 2, 0.5);

  let ry = colY + 13;
  ctx.font = F.value;
  statDefs.forEach((stat, i) => {
    const r         = result?.stats?.[i];
    const inputVal  = inputs?.[`stat${i}`] ?? '';
    const hasInput  = inputVal !== '';
    const isUnicorn = r?.is_unicorn;

    // subtle alternating row
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(lx + 1, ry - 11, leftW - 2, ROW_H);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isUnicorn ? '#ff69b4' : (hasInput ? C.bright : C.text2);
    ctx.fillText(trunc(ctx, stat.name, snW - 2), x_sn, ry);

    ctx.textAlign = 'right';
    ctx.fillStyle = hasInput ? C.text1 : C.muted;
    ctx.fillText(hasInput ? String(inputVal) : '—', x_in, ry);

    // rounding badge before post-re value
    if (r?.rounding_note && r.rounding_note !== 'none' && r.rounding_note !== '') {
      const badge = r.rounding_note === 'round' ? 'R' : 'N';
      const badgeColor = r.rounding_note === 'round' ? '#f59e0b' : '#60a5fa';
      const valText = r?.output || '—';
      const valW = ctx.measureText(valText).width;
      ctx.font = '700 8px Rajdhani, sans-serif';
      ctx.fillStyle = badgeColor;
      ctx.fillText(badge, x_pr - valW - 4, ry);
      ctx.font = F.value;
    }
    ctx.fillStyle = r?.output ? C.text1 : C.muted;
    ctx.fillText(r?.output || '—', x_pr, ry);

    const rc = tierColor(r);
    ctx.fillStyle = rc || (r?.rarity_display ? C.text2 : C.muted);
    ctx.fillText(r?.rarity_display || '—', x_rr, ry);

    if (r?.log_delta !== '' && r?.log_delta != null) {
      const d  = parseFloat(r.log_delta);
      const ad = Math.abs(d);
      ctx.fillStyle = ad <= 0.08 ? '#4ade80' : ad <= 0.33 ? '#a3e635'
                    : ad <= 0.5  ? '#facc15' : ad <= 0.67 ? '#fb923c' : '#f87171';
      ctx.fillText(`${d >= 0 ? '+' : ''}${d.toFixed(2)}`, x_ld, ry);
    } else {
      ctx.fillStyle = C.muted;
      ctx.fillText('—', x_ld, ry);
    }

    ry += ROW_H;
  });

  // ── RIGHT TOP: Analysis summary ──
  drawCardShell(ctx, rx, y, rightW, summaryCardH, 'ANALYSIS SUMMARY');

  if (result) {
    const sy   = y + HEAD_H + 14;
    const cw   = (rightW - CARD_PAD * 2) / 3;
    const items = [
      { label: 'TARGET RARITY',    value: result.target_rarity_display || '—', color: C.bright },
      { label: 'UNICORN THRESHOLD',value: `⋆${result.unicorn_threshold || '—'}⋆`, color: '#ff69b4' },
      { label: 'RE BONUS',         value: `${bonus}%`,                          color: C.plasma },
    ];
    items.forEach(({ label, value, color }, si) => {
      const sx = rx + CARD_PAD + si * cw;
      ctx.font = F.col; ctx.fillStyle = C.text3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, sx, sy);
      ctx.font = '700 17px Rajdhani, sans-serif'; ctx.fillStyle = color;
      ctx.fillText(value, sx, sy + 17);
    });
  }

  // ── RIGHT BOTTOM: Stat matching ──
  const my = y + summaryCardH + GAP;
  drawCardShell(ctx, rx, my, rightW, matchCardH, 'STAT MATCHING');

  const tgtY = my + HEAD_H + 10;
  ctx.font = F.col;  ctx.fillStyle = C.text3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('TARGET', rx + CARD_PAD, tgtY);
  ctx.font = F.value; ctx.fillStyle = C.text1;
  ctx.fillText(matchTarget || '—', rx + CARD_PAD + 44, tgtY);

  const mColY  = tgtY + ROW_H + 4;
  const mInner = rightW - CARD_PAD * 2;
  const mRawW  = Math.round(mInner * 0.26);
  const mPostW = Math.round(mInner * 0.28);
  const mNameW = mInner - mRawW - mPostW;
  const mx_name = rx + CARD_PAD;
  const mx_raw  = mx_name + mNameW + mRawW;
  const mx_post = rx + rightW - CARD_PAD;

  ctx.font = F.col; ctx.fillStyle = C.text3;
  ctx.textAlign = 'left';  ctx.fillText('STAT',          mx_name, mColY);
  ctx.textAlign = 'right'; ctx.fillText('MATCH RAW',     mx_raw,  mColY);
  ctx.textAlign = 'right'; ctx.fillText('MATCH POST-RE', mx_post, mColY);
  ctx.fillStyle = C.divider; ctx.fillRect(rx + CARD_PAD, mColY + 4, rightW - CARD_PAD * 2, 0.5);

  let mry = mColY + 13;
  ctx.font = F.value;
  (result?.stats || []).forEach((stat, i) => {
    const hasVal = stat.input !== '' && stat.input !== undefined;

    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(rx + 1, mry - 11, rightW - 2, ROW_H);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = hasVal ? C.text1 : C.text3;
    ctx.fillText(trunc(ctx, stat.name, mNameW - 2), mx_name, mry);

    ctx.textAlign = 'right';
    ctx.fillStyle = hasVal ? C.text1 : C.muted;
    ctx.fillText(stat.match_value || '—', mx_raw, mry);

    const pc = (hasVal && stat.tier && TIER_COLORS[stat.tier]) ? TIER_COLORS[stat.tier] : (hasVal ? C.text1 : C.muted);
    ctx.fillStyle = pc;
    ctx.fillText(stat.match_post || '—', mx_post, mry);

    mry += ROW_H;
  });

  // ── Footer ──
  ctx.font = F.footer; ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Generated with SWG:L RE Calculator', W / 2, totalH - 8);

  return canvas;
}

// ── Exported component ───────────────────────────────────────────────
export default function RECalculatorExport({ compType, level, statDefs, inputs, result, matchTarget, projectName }) {
  const [copied, setCopied] = useState(false);

  const getCanvas = useCallback(async () => {
    await document.fonts.ready;
    return renderRECard({ compType, level, statDefs, inputs, result, matchTarget, projectName });
  }, [compType, level, statDefs, inputs, result, matchTarget, projectName]);

  const handleDownload = useCallback(async () => {
    const canvas = await getCanvas();
    const link   = document.createElement('a');
    const name   = (projectName || `${compType || 'component'}_L${level}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${name}_re.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  }, [getCanvas, compType, level, projectName]);

  const handleCopy = useCallback(async () => {
    try {
      const canvas = await getCanvas();
      const blob   = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      handleDownload();
    }
  }, [getCanvas, handleDownload]);

  const btnCls = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hull-500/50 bg-hull-700/60 text-xs font-medium text-hull-300 hover:text-hull-100 hover:border-hull-400/50 transition-colors';

  return (
    <div className="flex items-center gap-1.5 ml-auto">
      <button onClick={handleCopy} className={btnCls} title="Copy as image">
        {copied ? <Check size={13} className="text-green-400" /> : <Clipboard size={13} />}
        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
      </button>
      <button onClick={handleDownload} className={btnCls} title="Download PNG">
        <Download size={13} />
        <span className="hidden sm:inline">PNG</span>
      </button>
    </div>
  );
}
