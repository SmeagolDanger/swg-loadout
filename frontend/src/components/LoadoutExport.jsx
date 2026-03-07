import React, { useCallback, useState } from 'react';
import { Download, Clipboard, Check, Image } from 'lucide-react';

// ── Theme constants matching tailwind.config ────────────────────────
const C = {
  bg:      '#0a0c10',
  card:    '#111318',
  border:  '#272c38',
  divider: '#1f232c',
  muted:   '#3d4455',
  text3:   '#6b7494',
  text2:   '#9ca3bd',
  text1:   '#c8cdd8',
  bright:  '#e2e5ec',
  plasma:  '#33ddff',
  plasmaDim: '#00d4ff',
  yellow:  '#ffaa00',
  red:     '#ff3344',
  green:   '#00cc66',
};

const FONTS = {
  title:  '700 22px Rajdhani, sans-serif',
  header: '700 13px Rajdhani, sans-serif',
  label:  '500 11px "Exo 2", sans-serif',
  value:  '500 11px "JetBrains Mono", monospace',
  small:  '500 10px "JetBrains Mono", monospace',
  footer: '600 10px Rajdhani, sans-serif',
};

const PAD = 24;
const COL_GAP = 20;
const LINE_H = 17;
const SECTION_GAP = 14;
const CARD_W = 760;

// ── Drawing helpers ─────────────────────────────────────────────────

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function sectionHeader(ctx, x, y, text, colW) {
  ctx.fillStyle = C.divider;
  ctx.fillRect(x, y, colW, 1);
  ctx.font = FONTS.header;
  ctx.fillStyle = C.plasma;
  ctx.fillText(text, x, y + 15);
  return y + 22;
}

function statLine(ctx, x, y, label, value, colW, opts = {}) {
  ctx.font = FONTS.label;
  ctx.fillStyle = opts.warn ? C.red : C.text3;
  ctx.fillText(label, x, y);
  ctx.font = FONTS.value;
  ctx.fillStyle = opts.warn ? C.red : opts.highlight ? C.plasma : C.text1;
  ctx.textAlign = 'right';
  ctx.fillText(value ?? '—', x + colW, y);
  ctx.textAlign = 'left';
  return y + LINE_H;
}

function compLine(ctx, x, y, label, name, colW) {
  ctx.font = FONTS.label;
  ctx.fillStyle = C.text3;
  ctx.fillText(label, x, y);
  ctx.font = FONTS.value;
  const isNone = !name || name === 'None';
  ctx.fillStyle = isNone ? C.muted : C.text1;
  ctx.textAlign = 'right';
  const displayName = isNone ? '—' : truncate(ctx, name, colW - ctx.measureText(label).width - 12);
  ctx.fillText(displayName, x + colW, y);
  ctx.textAlign = 'left';
  return y + LINE_H;
}

function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ── Main render function ────────────────────────────────────────────

function renderLoadoutCard({
  loadoutName, chassis, components, calcResults, chassisData, overloads,
}) {
  // Pre-calculate content height
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Measure dynamic height
  const colW = (CARD_W - PAD * 2 - COL_GAP) / 2;
  let leftY = 0, rightY = 0;

  // Left column: components + weapons
  const COMP_LABELS = [
    ['Reactor', 'reactor'], ['Engine', 'engine'], ['Booster', 'booster'],
    ['Shield', 'shield'], ['Front Armor', 'front_armor'], ['Rear Armor', 'rear_armor'],
    ['Capacitor', 'capacitor'], ['Droid I/F', 'droid_interface'],
  ];
  leftY += 22 + COMP_LABELS.length * LINE_H + SECTION_GAP;

  // Weapon slots
  const weaponSlots = [];
  if (chassisData?.slots) {
    chassisData.slots.forEach((header, i) => {
      if (header && components[`slot${i + 1}`]?.name && components[`slot${i + 1}`].name !== 'None') {
        weaponSlots.push({ label: header, name: components[`slot${i + 1}`].name });
      }
    });
  }
  if (weaponSlots.length > 0) {
    leftY += 22 + weaponSlots.length * LINE_H + SECTION_GAP;
  }

  // Overloads (if any active)
  const activeOLs = [];
  const olLabels = { ro: 'Reactor OL', eo: 'Engine OL', co: 'Cap Overcharge', wo: 'Weapon OL' };
  if (overloads) {
    Object.entries(olLabels).forEach(([key, label]) => {
      if (overloads[key] && overloads[key] !== 'None') {
        activeOLs.push({ label, level: overloads[key] });
      }
    });
  }
  if (activeOLs.length > 0) {
    leftY += 22 + activeOLs.length * LINE_H;
  }

  // Right column: stats
  const mass = calcResults?.mass;
  const drain = calcResults?.drain;
  const prop = calcResults?.propulsion;
  const weaponStats = calcResults?.weapon_stats;
  const capCombat = calcResults?.cap_combat;
  const shield = calcResults?.shield;

  if (mass) rightY += 22 + 2 * LINE_H + SECTION_GAP;
  if (drain) rightY += 22 + 4 * LINE_H + SECTION_GAP;
  if (prop) rightY += 22 + 6 * LINE_H + SECTION_GAP;
  if (weaponStats?.weapon_damages?.length > 0) {
    rightY += 22 + (weaponStats.weapon_damages.length + 1) * LINE_H + SECTION_GAP;
  }
  if (capCombat?.overloaded_ce) rightY += 22 + 4 * LINE_H + SECTION_GAP;
  if (shield && components.shield?.name !== 'None') rightY += 22 + 2 * LINE_H;

  const headerH = 60;
  const footerH = 32;
  const contentH = Math.max(leftY, rightY);
  const totalH = headerH + contentH + footerH + PAD;

  // Set canvas dimensions
  const dpr = 2; // retina quality
  canvas.width = CARD_W * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  // ── Background ──
  drawRoundedRect(ctx, 0, 0, CARD_W, totalH, 8);
  ctx.fillStyle = C.bg;
  ctx.fill();

  // Subtle inner card background
  drawRoundedRect(ctx, 3, 3, CARD_W - 6, totalH - 6, 6);
  ctx.fillStyle = C.card;
  ctx.fill();

  // Border
  drawRoundedRect(ctx, 0, 0, CARD_W, totalH, 8);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Header ──
  // Accent line
  ctx.fillStyle = C.plasmaDim;
  ctx.fillRect(PAD, PAD, 3, 28);

  ctx.font = FONTS.title;
  ctx.fillStyle = C.bright;
  ctx.textBaseline = 'top';
  ctx.fillText(loadoutName || 'Untitled Loadout', PAD + 12, PAD - 1);

  ctx.font = FONTS.header;
  ctx.fillStyle = C.text2;
  ctx.fillText(chassis || 'No Chassis', PAD + 12, PAD + 22);

  // Thin header divider
  ctx.fillStyle = C.border;
  ctx.fillRect(PAD, headerH + 4, CARD_W - PAD * 2, 1);

  // Reset baseline for stat rendering
  ctx.textBaseline = 'alphabetic';

  // ── Columns ──
  const colLeft = PAD;
  const colRight = PAD + colW + COL_GAP;
  let ly = headerH + 12;
  let ry = headerH + 12;

  // Left: Components
  ly = sectionHeader(ctx, colLeft, ly, 'COMPONENTS', colW);
  COMP_LABELS.forEach(([label, key]) => {
    ly = compLine(ctx, colLeft, ly, label, components[key]?.name, colW);
  });
  ly += SECTION_GAP;

  // Left: Weapons
  if (weaponSlots.length > 0) {
    ly = sectionHeader(ctx, colLeft, ly, 'WEAPONS', colW);
    weaponSlots.forEach(({ label, name }) => {
      ly = compLine(ctx, colLeft, ly, label, name, colW);
    });
    ly += SECTION_GAP;
  }

  // Left: Overloads
  if (activeOLs.length > 0) {
    ly = sectionHeader(ctx, colLeft, ly, 'OVERLOADS', colW);
    activeOLs.forEach(({ label, level }) => {
      ly = statLine(ctx, colLeft, ly, label, `Level ${level}`, colW, { highlight: true });
    });
  }

  // Right: Mass
  if (mass) {
    ry = sectionHeader(ctx, colRight, ry, 'MASS', colW);
    ry = statLine(ctx, colRight, ry, 'Total / Limit', `${mass.total_mass} / ${mass.chassis_mass}`, colW, { warn: mass.over_limit });
    ry = statLine(ctx, colRight, ry, 'Utilization', `${mass.percent}%`, colW, { warn: mass.over_limit });
    ry += SECTION_GAP;
  }

  // Right: Drain
  if (drain) {
    ry = sectionHeader(ctx, colRight, ry, 'POWER', colW);
    ry = statLine(ctx, colRight, ry, 'Total Drain', String(drain.total_drain), colW, { warn: drain.over_limit });
    ry = statLine(ctx, colRight, ry, 'Reactor Gen', String(drain.overloaded_gen), colW);
    ry = statLine(ctx, colRight, ry, 'Utilization', `${drain.utilization}%`, colW, { warn: drain.over_limit });
    ry = statLine(ctx, colRight, ry, 'Min Gen Req', String(drain.min_gen_required), colW);
    ry += SECTION_GAP;
  }

  // Right: Propulsion
  if (prop) {
    ry = sectionHeader(ctx, colRight, ry, 'PROPULSION', colW);
    const speedVal = prop.speed_mod_foils ? `${prop.speed_mod} (${prop.speed_mod_foils})` : String(prop.speed_mod);
    ry = statLine(ctx, colRight, ry, 'Speed Mod', speedVal, colW);
    ry = statLine(ctx, colRight, ry, 'Accel / Decel', `${prop.accel} / ${prop.decel}`, colW);
    ry = statLine(ctx, colRight, ry, 'Pitch/Yaw/Roll', `${prop.pitch}/${prop.yaw}/${prop.roll}`, colW);
    const topVal = prop.top_speed != null
      ? (prop.top_speed_foils ? `${prop.top_speed} (${prop.top_speed_foils})` : String(prop.top_speed))
      : '—';
    ry = statLine(ctx, colRight, ry, 'Top Speed', topVal, colW);
    const boostVal = prop.boosted_top_speed != null
      ? (prop.boosted_top_speed_foils ? `${prop.boosted_top_speed} (${prop.boosted_top_speed_foils})` : String(prop.boosted_top_speed))
      : '—';
    ry = statLine(ctx, colRight, ry, 'Boosted Speed', boostVal, colW);
    ry = statLine(ctx, colRight, ry, 'Booster Uptime', prop.booster_uptime != null ? `${prop.booster_uptime}%` : '—', colW);
    ry += SECTION_GAP;
  }

  // Right: Weapon Damage
  if (weaponStats?.weapon_damages?.length > 0) {
    ry = sectionHeader(ctx, colRight, ry, 'WEAPON DAMAGE', colW);
    weaponStats.weapon_damages.forEach((wd) => {
      // Slot name on left, PvE/PvP on right
      ctx.font = FONTS.label;
      ctx.fillStyle = C.text3;
      const slotLabel = truncate(ctx, wd.slot, colW * 0.45);
      ctx.fillText(slotLabel, colRight, ry);
      ctx.font = FONTS.small;
      ctx.fillStyle = C.text1;
      ctx.textAlign = 'right';
      ctx.fillText(`${wd.pve} / ${wd.pvp}`, colRight + colW, ry);
      ctx.textAlign = 'left';
      ry += LINE_H;
    });
    ry = statLine(ctx, colRight, ry, 'Pilot Total', `${weaponStats.pilot_total_pve} / ${weaponStats.pilot_total_pvp}`, colW, { highlight: true });
    ry += SECTION_GAP;
  }

  // Right: Cap Combat
  if (capCombat?.overloaded_ce) {
    ry = sectionHeader(ctx, colRight, ry, 'CAP COMBAT', colW);
    ry = statLine(ctx, colRight, ry, 'Full Cap Dmg', String(capCombat.full_cap_damage), colW, { highlight: true });
    ry = statLine(ctx, colRight, ry, 'Fire Time', String(capCombat.fire_time), colW);
    ry = statLine(ctx, colRight, ry, 'Recharge Time', String(capCombat.cap_recharge_time), colW);
    ry = statLine(ctx, colRight, ry, 'Firing Ratio', capCombat.firing_ratio || '—', colW);
    ry += SECTION_GAP;
  }

  // Right: Shield
  if (shield && components.shield?.name !== 'None' && components.shield) {
    ry = sectionHeader(ctx, colRight, ry, 'SHIELD', colW);
    ry = statLine(ctx, colRight, ry, 'Shield HP', String(components.shield?.stats?.[2] ?? '—'), colW);
    if (shield.front_hp) {
      ry = statLine(ctx, colRight, ry, 'Front / Back', `${shield.front_hp} / ${shield.back_hp}`, colW);
    } else {
      ry = statLine(ctx, colRight, ry, 'Recharge', String(components.shield?.stats?.[3] ?? '—'), colW);
    }
  }

  // ── Footer ──
  const footerY = totalH - 20;
  ctx.font = FONTS.footer;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'center';
  ctx.fillText('SWG:L TOOLS  ·  space.jawatracks.com', CARD_W / 2, footerY);
  ctx.textAlign = 'left';

  return canvas;
}

// ── Exported Component ──────────────────────────────────────────────

export default function LoadoutExport({
  loadoutName, chassis, components, calcResults, chassisData, overloads,
}) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const getCanvas = useCallback(async () => {
    // Ensure custom fonts are loaded before rendering
    await document.fonts.ready;
    return renderLoadoutCard({
      loadoutName, chassis, components, calcResults, chassisData, overloads,
    });
  }, [loadoutName, chassis, components, calcResults, chassisData, overloads]);

  const handleCopy = useCallback(async () => {
    try {
      const canvas = await getCanvas();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
      // Fallback: trigger download instead
      handleDownload();
    }
  }, [getCanvas, handleDownload]);

  const handleDownload = useCallback(async () => {
    const canvas = await getCanvas();
    const link = document.createElement('a');
    const safeName = (loadoutName || 'loadout').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [getCanvas, loadoutName]);

  const handlePreview = useCallback(() => {
    setShowPreview(prev => !prev);
  }, []);

  return (
    <div className="card">
      <div className="card-header"><Image size={16} /> EXPORT</div>
      <div className="p-3 flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="btn-primary flex items-center gap-1.5 text-xs"
        >
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? 'Copied!' : 'Copy Image'}
        </button>
        <button
          onClick={handleDownload}
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          <Download size={14} /> Download PNG
        </button>
        <button
          onClick={handlePreview}
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          <Image size={14} /> {showPreview ? 'Hide' : 'Preview'}
        </button>
      </div>
      {showPreview && (
        <div className="px-3 pb-3">
          <LoadoutPreview getCanvas={getCanvas} />
        </div>
      )}
    </div>
  );
}

function LoadoutPreview({ getCanvas }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    getCanvas().then(canvas => {
      if (cancelled) return;
      const container = canvasRef.current;
      if (!container) return;
      container.innerHTML = '';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.borderRadius = '6px';
      container.appendChild(canvas);
    });
    return () => { cancelled = true; };
  }, [getCanvas]);

  return <div ref={canvasRef} className="mt-2 rounded-lg overflow-hidden border border-hull-500/30" />;
}
