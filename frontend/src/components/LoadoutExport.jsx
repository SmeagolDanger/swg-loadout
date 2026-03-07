import React, { useCallback, useState } from 'react';
import { Download, Clipboard, Check, Image } from 'lucide-react';

// ── Theme ───────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0c10',
  card:     '#111318',
  cardHead: '#0e1015',
  border:   '#272c38',
  divider:  '#1f232c',
  muted:    '#3d4455',
  text3:    '#6b7494',
  text2:    '#9ca3bd',
  text1:    '#c8cdd8',
  bright:   '#e2e5ec',
  plasma:   '#33ddff',
  plasmaDim:'#00d4ff',
  yellow:   '#ffaa00',
  red:      '#ff3344',
  green:    '#00cc66',
};

const F = {
  title:    '700 20px Rajdhani, sans-serif',
  subtitle: '600 12px Rajdhani, sans-serif',
  cardHead: '700 11px Rajdhani, sans-serif',
  label:    '500 10px "Exo 2", sans-serif',
  value:    '500 10px "JetBrains Mono", monospace',
  footer:   '600 9px Rajdhani, sans-serif',
};

const COMP_STAT_LABELS = {
  reactor:        ['Mass', 'Generation'],
  engine:         ['Drain', 'Mass', 'Pitch', 'Yaw', 'Roll', 'Top Speed'],
  booster:        ['Drain', 'Mass', 'Energy', 'Recharge', 'Consumption', 'Accel', 'Top Speed'],
  shield:         ['Drain', 'Mass', 'HP', 'Recharge'],
  front_armor:    ['HP', 'Mass'],
  rear_armor:     ['HP', 'Mass'],
  capacitor:      ['Drain', 'Mass', 'Energy', 'Recharge'],
  droid_interface: ['Drain', 'Mass', 'Cmd Speed'],
  cargo_hold:     ['Mass'],
};
const WEAPON_LABELS = ['Drain', 'Mass', 'Min Dmg', 'Max Dmg', 'Vs Shld', 'Vs Armr', 'E/Shot', 'Refire'];
const ORD_LABELS    = ['Drain', 'Mass', 'Min Dmg', 'Max Dmg', 'Vs Shld', 'Vs Armr', 'Ammo', 'PvE Mult'];
const CM_LABELS     = ['Drain', 'Mass', 'Ammo'];

const PAD = 16;
const LINE_H = 14;
const CARD_PAD = 8;
const CARD_HEAD_H = 20;
const GAP = 8;

// ── Drawing helpers ─────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function truncText(ctx, text, maxW) {
  if (!text) return '—';
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function cardHeight(lineCount) {
  return CARD_HEAD_H + CARD_PAD + lineCount * LINE_H + CARD_PAD;
}

function drawCard(ctx, x, y, w, title, lines) {
  const h = cardHeight(lines.length);
  // Card background
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = C.card; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
  // Header band
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, CARD_HEAD_H); ctx.clip();
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = C.cardHead; ctx.fill();
  ctx.restore();
  // Header bottom edge
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + CARD_HEAD_H, w, 0.5);
  // Title
  ctx.font = F.cardHead;
  ctx.fillStyle = C.plasma;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + CARD_PAD, y + CARD_HEAD_H / 2 + 1);
  // Stat lines
  ctx.textBaseline = 'alphabetic';
  const valueMaxW = w * 0.55;
  let ly = y + CARD_HEAD_H + CARD_PAD + 10;
  for (const line of lines) {
    const [label, value, opts = {}] = line;
    ctx.font = F.label;
    ctx.fillStyle = opts.highlight ? C.plasma : C.text3;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + CARD_PAD, ly);
    ctx.font = F.value;
    ctx.fillStyle = opts.warn ? C.red : opts.highlight ? C.plasma : C.text1;
    ctx.textAlign = 'right';
    ctx.fillText(truncText(ctx, String(value ?? '—'), valueMaxW), x + w - CARD_PAD, ly);
    ctx.textAlign = 'left';
    ly += LINE_H;
  }
  return h;
}

function compCardLines(comp, statLabels) {
  const name = comp?.name && comp.name !== 'None' ? comp.name : '—';
  const stats = comp?.stats || [];
  return [
    ['Name', name],
    ...statLabels.map((sl, i) => [sl, stats[i] != null && stats[i] !== 0 ? stats[i] : '—']),
  ];
}

function slotStatLabels(comp) {
  if (!comp?.comp_type) return WEAPON_LABELS;
  const ct = comp.comp_type.toLowerCase();
  if (ct.includes('ordnance')) return ORD_LABELS;
  if (ct.includes('counter')) return CM_LABELS;
  return WEAPON_LABELS;
}

// ── Main render ─────────────────────────────────────────────────────
function renderLoadoutCard({ loadoutName, chassis, components, calcResults, chassisData, overloads }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 960;
  const col4W = (W - PAD * 2 - GAP * 3) / 4;
  const col3W = (W - PAD * 2 - GAP * 2) / 3;
  const col2W = (W - PAD * 2 - GAP) / 2;

  const mass = calcResults?.mass;
  const drain = calcResults?.drain;
  const prop = calcResults?.propulsion;
  const weaponStats = calcResults?.weapon_stats;
  const capCombat = calcResults?.cap_combat;

  // ── Build all card data ──
  const statusLines = [];
  if (mass) {
    statusLines.push(['Total Mass', `${mass.total_mass} / ${mass.chassis_mass}`, { warn: mass.over_limit }]);
    statusLines.push(['Mass %', `${mass.percent}%`, { warn: mass.over_limit }]);
  }
  if (drain) {
    statusLines.push(['Total Drain', drain.total_drain, { warn: drain.over_limit }]);
    statusLines.push(['Reactor Gen', drain.overloaded_gen]);
    statusLines.push(['Drain %', `${drain.utilization}%`, { warn: drain.over_limit }]);
    statusLines.push(['Min Gen Req', drain.min_gen_required]);
  }

  const olMap = { ro: 'Reactor OL', eo: 'Engine OL', co: 'Cap OC', wo: 'Weapon OL' };
  const olLines = Object.entries(olMap).map(([k, label]) => {
    const v = overloads?.[k];
    return [label, v && v !== 'None' ? `Level ${v}` : 'None', v && v !== 'None' ? { highlight: true } : {}];
  });

  const propLines = [];
  if (prop) {
    propLines.push(['Speed Mod', prop.speed_mod_foils ? `${prop.speed_mod} (${prop.speed_mod_foils})` : prop.speed_mod]);
    propLines.push(['Accel / Decel', `${prop.accel} / ${prop.decel}`]);
    propLines.push(['P/Y/R', `${prop.pitch}/${prop.yaw}/${prop.roll}`]);
    propLines.push(['Top Speed', prop.top_speed != null ? (prop.top_speed_foils ? `${prop.top_speed} (${prop.top_speed_foils})` : prop.top_speed) : '—']);
    propLines.push(['Boosted Spd', prop.boosted_top_speed != null ? (prop.boosted_top_speed_foils ? `${prop.boosted_top_speed} (${prop.boosted_top_speed_foils})` : prop.boosted_top_speed) : '—']);
    propLines.push(['Boost Dist', prop.boost_distance != null ? `${prop.boost_distance}m` : '—']);
    propLines.push(['Uptime', prop.booster_uptime != null ? `${prop.booster_uptime}%` : '—']);
  }

  const combatLines = [];
  if (capCombat?.overloaded_ce) {
    combatLines.push(['Overloaded CE', capCombat.overloaded_ce]);
    combatLines.push(['Overloaded RR', capCombat.overloaded_rr]);
    combatLines.push(['Full Cap Dmg', capCombat.full_cap_damage, { highlight: true }]);
    combatLines.push(['Fire Time', capCombat.fire_time]);
    combatLines.push(['Rech. Time', capCombat.cap_recharge_time]);
    combatLines.push(['Fire Ratio', capCombat.firing_ratio || '—']);
  }
  if (weaponStats?.weapon_damages?.length > 0) {
    weaponStats.weapon_damages.forEach(wd => combatLines.push([wd.slot, `${wd.pve} / ${wd.pvp}`]));
    combatLines.push(['Pilot Total', `${weaponStats.pilot_total_pve} / ${weaponStats.pilot_total_pvp}`, { highlight: true }]);
  }

  // Weapon slot cards
  const weaponSlots = [];
  if (chassisData?.slots) {
    chassisData.slots.forEach((header, i) => {
      if (!header) return;
      const comp = components[`slot${i + 1}`];
      if (comp && comp.name !== 'None') weaponSlots.push({ label: header, comp });
    });
  }

  // ── Measure heights ──
  const headerH = 50;
  const summaryH = Math.max(
    statusLines.length ? cardHeight(statusLines.length) : 0,
    cardHeight(olLines.length),
    propLines.length ? cardHeight(propLines.length) : 0,
    combatLines.length ? cardHeight(combatLines.length) : 0,
  );

  const compKeys = [
    ['reactor', 'engine', 'booster'],
    ['shield', 'front_armor', 'rear_armor'],
    ['capacitor', 'droid_interface', 'cargo_hold'],
  ];
  const compRowHeights = compKeys.map(row =>
    Math.max(...row.map(k => cardHeight((COMP_STAT_LABELS[k]?.length || 0) + 1)))
  );

  let weaponRowsH = 0;
  const weaponRowCount = Math.ceil(weaponSlots.length / 2);
  for (let r = 0; r < weaponRowCount; r++) {
    const a = weaponSlots[r * 2];
    const b = weaponSlots[r * 2 + 1];
    const hA = a ? cardHeight(slotStatLabels(a.comp).length + 1) : 0;
    const hB = b ? cardHeight(slotStatLabels(b.comp).length + 1) : 0;
    weaponRowsH += Math.max(hA, hB) + GAP;
  }

  const totalH = headerH + GAP + summaryH + GAP
    + compRowHeights.reduce((a, h) => a + h + GAP, 0)
    + weaponRowsH + 24 + PAD;

  // ── Render canvas ──
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  roundRect(ctx, 0, 0, W, totalH, 6);
  ctx.fillStyle = C.bg; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();

  // Header
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.plasmaDim;
  ctx.fillRect(PAD, PAD, 3, 30);
  ctx.font = F.title; ctx.fillStyle = C.bright;
  ctx.fillText(loadoutName || 'Untitled Loadout', PAD + 10, PAD);
  ctx.font = F.subtitle; ctx.fillStyle = C.text2;
  ctx.fillText(chassis || 'No Chassis', PAD + 10, PAD + 24);
  ctx.font = F.footer; ctx.fillStyle = C.muted; ctx.textAlign = 'right';
  ctx.fillText('SWG:L TOOLS  ·  space.jawatracks.com', W - PAD, PAD + 4);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.border;
  ctx.fillRect(PAD, headerH, W - PAD * 2, 1);
  ctx.textBaseline = 'alphabetic';

  // Summary row (4 columns)
  let y = headerH + GAP;
  if (statusLines.length) drawCard(ctx, PAD, y, col4W, 'SHIP STATUS', statusLines);
  drawCard(ctx, PAD + (col4W + GAP), y, col4W, 'OVERLOADS', olLines);
  if (propLines.length) drawCard(ctx, PAD + (col4W + GAP) * 2, y, col4W, 'PROPULSION', propLines);
  if (combatLines.length) drawCard(ctx, PAD + (col4W + GAP) * 3, y, col4W, 'COMBAT', combatLines);
  y += summaryH + GAP;

  // Component rows (3 columns each)
  compKeys.forEach((row, ri) => {
    row.forEach((key, ci) => {
      const labels = COMP_STAT_LABELS[key] || [];
      const lines = compCardLines(components[key], labels);
      drawCard(ctx, PAD + ci * (col3W + GAP), y, col3W, key.replace('_', ' ').toUpperCase(), lines);
    });
    y += compRowHeights[ri] + GAP;
  });

  // Weapon slots (2 columns)
  for (let r = 0; r < weaponRowCount; r++) {
    const a = weaponSlots[r * 2];
    const b = weaponSlots[r * 2 + 1];
    let rowH = 0;
    if (a) {
      const lines = compCardLines(a.comp, slotStatLabels(a.comp));
      const h = drawCard(ctx, PAD, y, col2W, a.label.toUpperCase(), lines);
      rowH = Math.max(rowH, h);
    }
    if (b) {
      const lines = compCardLines(b.comp, slotStatLabels(b.comp));
      const h = drawCard(ctx, PAD + col2W + GAP, y, col2W, b.label.toUpperCase(), lines);
      rowH = Math.max(rowH, h);
    }
    y += rowH + GAP;
  }

  return canvas;
}

// ── Exported Component ──────────────────────────────────────────────
export default function LoadoutExport({ loadoutName, chassis, components, calcResults, chassisData, overloads }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const getCanvas = useCallback(async () => {
    await document.fonts.ready;
    return renderLoadoutCard({ loadoutName, chassis, components, calcResults, chassisData, overloads });
  }, [loadoutName, chassis, components, calcResults, chassisData, overloads]);

  const handleDownload = useCallback(async () => {
    const canvas = await getCanvas();
    const link = document.createElement('a');
    link.download = `${(loadoutName || 'loadout').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [getCanvas, loadoutName]);

  const handleCopy = useCallback(async () => {
    try {
      const canvas = await getCanvas();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
      handleDownload();
    }
  }, [getCanvas, handleDownload]);

  return (
    <div className="card">
      <div className="card-header"><Image size={16} /> EXPORT</div>
      <div className="p-3 flex flex-wrap gap-2">
        <button onClick={handleCopy} className="btn-primary flex items-center gap-1.5 text-xs">
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? 'Copied!' : 'Copy Image'}
        </button>
        <button onClick={handleDownload} className="btn-ghost flex items-center gap-1.5 text-xs">
          <Download size={14} /> Download PNG
        </button>
        <button onClick={() => setShowPreview(p => !p)} className="btn-ghost flex items-center gap-1.5 text-xs">
          <Image size={14} /> {showPreview ? 'Hide' : 'Preview'}
        </button>
      </div>
      {showPreview && <div className="px-3 pb-3"><LoadoutPreview getCanvas={getCanvas} /></div>}
    </div>
  );
}

function LoadoutPreview({ getCanvas }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let cancelled = false;
    getCanvas().then(canvas => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = '';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.borderRadius = '6px';
      ref.current.appendChild(canvas);
    });
    return () => { cancelled = true; };
  }, [getCanvas]);
  return <div ref={ref} className="mt-2 rounded-lg overflow-hidden border border-hull-500/30" />;
}
