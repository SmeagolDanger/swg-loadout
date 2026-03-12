const TIME_RE = /^(?:\[\s*Combat\s*]\s*)?(\d{2}):(\d{2}):(\d{2})\s+(.+)$/i;

const DMG_WITH_RE = /^(.+?)\s+attacks\s+(.+?)\s+(?:with|using)\s+(.+?)\s+(?:and\s+(hits|glances|crits|critically\s+hits|critical\s+hits|strikes\s+through|punishing\s+blows))?(?:\s*\((\d+)\s*%(?:\s*evaded)?\))?\s*for\s+(\d+)\s+points/i;
const DMG_BARE_RE = /^(.+?)\s+attacks\s+(.+?)(?:\s+and\s+)?(?:(hits|glances|crits|critically\s+hits|critical\s+hits|strikes\s+through|punishing\s+blows))?(?:\s*\((\d+)\s*%(?:\s*evaded)?\))?\s*for\s+(\d+)\s+points/i;
const DMG_GENERIC_RE = /^(.+?)\s+damages\s+(.+?)\s+for\s+(\d+)\s+points(?:\s+(?:with|using)\s+(.+?))?$/i;
const DOT_SUFFERS_RE = /^(.+?)\s+suffers\s+(\d+)\s+points\s+of\s+damage\s+from\s+(.+?)\s+over\s+time/i;
const DMG_HAS_CAUSED_ELEM_RE = /^(.+?)\s+has\s+caused\s+(.+?)\s+to\s+take\s+(\d+)\s+points\s+of\s+([a-z]+)\s+damage/i;
const DMG_HAS_CAUSED_RE = /^(.+?)\s+has\s+caused\s+(.+?)\s+to\s+take\s+(\d+)\s+points\s+of\s+damage/i;
const DMG_CAUSED_RE = /^(.+?)\s+causes\s+(.+?)\s+to\s+take\s+(\d+)\s+points\s+of\s+damage/i;

const MISSES_PAREN_RE = /^(.+?)\s+attacks\s+(.+?)(?:\s+(?:with|using)\s+.+?)?\s+(?:and\s+)?misses\s*\((dodge|parry|parries)\)\.?$/i;
const DODGE_PARRY_1_RE = /^(.+?)\s+attacks\s+(.+?)\s+(?:with|using)\s+.*?(?:,?\s+)?(?:but|and)\s+\2\s+(dodges|parries)\b/i;
const DODGE_PARRY_2_RE = /^(.+?)\s+attacks\s+(.+?)(?:\s+(?:but|and))\s+\2\s+(dodges|parries)\b/i;
const DODGE_PARRY_3_RE = /^(.+?)\s+(dodges|parries)\s+(.+?)'?s?\s+attack\b/i;
const DODGE_PARRY_4_RE = /^(.+?)'?s?\s+attack\s+(?:is|was)\s+(dodged|parried)\s+by\s+(.+?)\b/i;

const HEAL_RE = /^(.+?)\s+heals\s+(.+?)\s+for\s+(\d+)\s+points(?:\s+with\s+(.+))?/i;
const PERFORM_RE = /^(.+?)\s+performs\s+(.+?)\.?\s*$/i;
const GAIN_RE = /^(.+?)\s+gains\s+(.+)\.$/i;
const INFUSE_RE = /^(.+?)\s+infuses\s+(.+?)\s+with\s+a\s+large\s+amount\s+of\s+bacta\.?$/i;
const FREE_SHOT_RE = /^(.+?)\s+snaps\s+off\s+a\s+free\s+shot!?$/i;
const DEATH_RE = /^(.+?)\s+is\s+no\s+more\.?$/i;

const GROUP_SHARE_RE = /^\[GROUP]\s+You\s+receive\s+(\d+)\s+credits\s+as\s+your\s+share\.?$/i;
const GROUP_LOOT_RE = /^\[GROUP]\s+(.+?)\s+looted\s+(\d+)\s+credits\s+from\s+(.+)\.?$/i;

const BLOCKED_RE = /\((?:[^)]*?,\s*)?(\d+)\s+points\s+blocked\)/i;
const ABSORBED_RE = /Armor\s+absorbed\s+(\d+)\s+points\s+out\s+of\s+(\d+)/i;
const ABSORB_SIMPLE_RE = /\((\d+)\s+absorbed(?:\s*\/\s*(\d+)\s+resisted\.?)?\)/i;
const EVADED_RE = /\((\d+)\s*%(?:\s*evaded)?\)/i;

const ENCOUNTER_GAP_SECONDS = 15;
const MAX_REALISTIC_HIT = 60000;
const NPC_PREFIX_RE = /^(?:a|an|the)\s+/i;
const CORPSE_RE = /^corpse\s+of\s+/i;
const NPC_TOKEN_RE = /\b(?:wampa|stormtrooper|commando|commander|trooper|berserker|brute|defender|crew\s+member|assassin|droid|walker|phalanx|evac|imperial|rebel|lower\s+hangar)\b/i;
const VEHICLE_RE = /^(?:AT-ST|AT-AT)$/i;

const DEFAULT_ALIASES = {
  'shepard effectmass': 'Shepard',
  'lurcio leering-creeper': 'Lurcio',
};

function toEpochSeconds(hh, mm, ss) {
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

function clean(value = '') {
  return String(value).replace(/^[`'\"]+|[`'\"]+$/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeAbility(raw = '') {
  return clean(raw)
    .replace(/^(with|using)\s+/i, '')
    .replace(/[\[(].*?[\])]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeNpc(name = '') {
  const value = clean(name);
  if (!value) return false;
  if (value === 'You') return false;
  return CORPSE_RE.test(value) || NPC_PREFIX_RE.test(value) || VEHICLE_RE.test(value) || NPC_TOKEN_RE.test(value);
}

function canonicalizeNpcName(name = '') {
  const value = clean(name);
  if (!value) return '';
  const prefix = value.match(NPC_PREFIX_RE);
  if (!prefix) return value;
  const article = prefix[0].trim().toLowerCase();
  const proper = article === 'a' ? 'A' : article === 'an' ? 'An' : 'The';
  return `${proper} ${value.slice(prefix[0].length).trim()}`;
}

function normalizeActorName(raw, seenActors, aliases) {
  const original = clean(raw);
  if (!original) return '';
  const lc = original.toLowerCase();

  if (aliases[lc]) return aliases[lc];
  if (DEFAULT_ALIASES[lc]) {
    aliases[lc] = DEFAULT_ALIASES[lc];
    return aliases[lc];
  }

  if (looksLikeNpc(original)) {
    const canon = canonicalizeNpcName(original);
    aliases[lc] = canon;
    return canon;
  }

  const effectMatch = original.match(/^([A-Za-z][\w'\-]*)\s+(Effect[\w'\-]*)$/i);
  if (effectMatch) {
    const base = effectMatch[1];
    const baseLc = base.toLowerCase();
    const existing = aliases[baseLc] || Array.from(seenActors).find((name) => name.toLowerCase() === baseLc);
    const canon = existing || base;
    aliases[lc] = canon;
    aliases[baseLc] = canon;
    return canon;
  }

  const tokenMatch = original.match(/^(.+?)\s+([A-Za-z][\w'\-]+)$/);
  if (tokenMatch) {
    const base = tokenMatch[1];
    const baseLc = base.toLowerCase();
    const existing = Array.from(seenActors).find((name) => name.toLowerCase() === baseLc);
    if (existing) {
      aliases[lc] = existing;
      return existing;
    }
  }

  aliases[lc] = original;
  return original;
}

function parseElementBreakdown(text = '') {
  const result = [];
  const parts = text.split(/\s*(?:,|and)\s*/i).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/(\d+)\s+([a-z]+)/i);
    if (match) {
      result.push({ amount: Number(match[1]), type: match[2].toLowerCase() });
    }
  }
  return result;
}

function extractElements(rest) {
  const paren = rest.match(/for\s+\d+\s+points\s*\(([^)]+)\)/i);
  if (paren && paren[1] && !/points\s+blocked/i.test(paren[1])) {
    const parsed = parseElementBreakdown(paren[1]);
    if (parsed.length) return parsed;
  }
  const single = rest.match(/for\s+(\d+)\s+(kinetic|energy|heat|cold|acid|electricity|electric|poison)s?\b/i);
  if (single) return [{ amount: Number(single[1]), type: single[2].toLowerCase() }];
  return [];
}

function actorActivitySeed(name) {
  return {
    name,
    sourceCount: 0,
    targetCount: 0,
    attacks: 0,
    dots: 0,
    heals: 0,
    performs: 0,
    utilities: 0,
    credits: 0,
    actorRole: 'unknown',
  };
}

function getOrCreate(map, name) {
  if (!name) return null;
  if (!map.has(name)) map.set(name, actorActivitySeed(name));
  return map.get(name);
}

function classifyOutcome(raw = '') {
  const value = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (['crits', 'critically hits', 'critical hits'].includes(value)) return 'crit';
  if (value === 'glances') return 'glance';
  if (value.startsWith('strikes through') || value.startsWith('punishing blows')) return 'strikethrough';
  if (value === 'hits') return 'hit';
  return '';
}

function parseCombatLine(rest, normalizeNames, seenActors, aliases) {
  let match;
  const blocked = rest.match(BLOCKED_RE);
  const absorb = rest.match(ABSORBED_RE);
  const absorbSimple = rest.match(ABSORB_SIMPLE_RE);
  const evaded = rest.match(EVADED_RE);
  const explicitElements = extractElements(rest);

  if ((match = DEATH_RE.exec(rest))) {
    return { type: 'death', actor: normalizeActorName(match[1], seenActors, aliases), target: '', ability: 'Death', amount: 0, raw: rest };
  }
  if ((match = PERFORM_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const ability = normalizeAbility(match[2]);
    return { type: 'perform', actor, target: '', ability, amount: 0, raw: rest };
  }
  if ((match = GAIN_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    return { type: 'utility', actor, target: '', ability: clean(match[2]), amount: 0, raw: rest };
  }
  if ((match = INFUSE_RE.exec(rest))) {
    return {
      type: 'utility',
      actor: normalizeActorName(match[1], seenActors, aliases),
      target: normalizeActorName(match[2], seenActors, aliases),
      ability: 'Bacta Infusion',
      amount: 0,
      raw: rest,
    };
  }
  if ((match = FREE_SHOT_RE.exec(rest))) {
    return { type: 'utility', actor: normalizeActorName(match[1], seenActors, aliases), target: '', ability: 'Free Shot', amount: 0, raw: rest };
  }

  if ((match = MISSES_PAREN_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const target = normalizeActorName(match[2], seenActors, aliases);
    return { type: 'attack', actor, target, ability: 'attack', outcome: match[3].toLowerCase().startsWith('dodg') ? 'dodge' : 'parry', amount: 0, raw: rest };
  }
  if ((match = DODGE_PARRY_1_RE.exec(rest)) || (match = DODGE_PARRY_2_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const target = normalizeActorName(match[2], seenActors, aliases);
    return { type: 'attack', actor, target, ability: 'attack', outcome: match[3].toLowerCase().startsWith('dodg') ? 'dodge' : 'parry', amount: 0, raw: rest };
  }
  if ((match = DODGE_PARRY_3_RE.exec(rest))) {
    const target = normalizeActorName(match[1], seenActors, aliases);
    const actor = normalizeActorName(match[3], seenActors, aliases);
    return { type: 'attack', actor, target, ability: 'attack', outcome: match[2].toLowerCase().startsWith('dodg') ? 'dodge' : 'parry', amount: 0, raw: rest };
  }
  if ((match = DODGE_PARRY_4_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const target = normalizeActorName(match[3], seenActors, aliases);
    return { type: 'attack', actor, target, ability: 'attack', outcome: match[2].toLowerCase().startsWith('dodg') ? 'dodge' : 'parry', amount: 0, raw: rest };
  }

  if ((match = DMG_WITH_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const target = normalizeActorName(match[2], seenActors, aliases);
    const ability = normalizeAbility(match[3]) || 'attack';
    const amount = Number(match[6]);
    if (!looksLikeNpc(actor) && amount > MAX_REALISTIC_HIT) return null;
    return {
      type: 'attack', actor, target, ability, outcome: classifyOutcome(match[4] || ''), amount,
      blocked: blocked ? Number(blocked[1]) : 0,
      absorbed: absorb ? Number(absorb[1]) : absorbSimple ? Number(absorbSimple[1]) : 0,
      preMitTotal: absorb ? Number(absorb[2]) : 0,
      evadedPct: match[5] ? Number(match[5]) : evaded ? Number(evaded[1]) : null,
      damageTypes: explicitElements, raw: rest,
    };
  }
  if ((match = DMG_BARE_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const target = normalizeActorName(match[2], seenActors, aliases);
    const amount = Number(match[5]);
    if (!looksLikeNpc(actor) && amount > MAX_REALISTIC_HIT) return null;
    return {
      type: 'attack', actor, target, ability: 'attack', outcome: classifyOutcome(match[3] || ''), amount,
      blocked: blocked ? Number(blocked[1]) : 0,
      absorbed: absorb ? Number(absorb[1]) : absorbSimple ? Number(absorbSimple[1]) : 0,
      preMitTotal: absorb ? Number(absorb[2]) : 0,
      evadedPct: match[4] ? Number(match[4]) : evaded ? Number(evaded[1]) : null,
      damageTypes: explicitElements, raw: rest,
    };
  }
  if ((match = DMG_GENERIC_RE.exec(rest))) {
    const actor = normalizeActorName(match[1], seenActors, aliases);
    const target = normalizeActorName(match[2], seenActors, aliases);
    const amount = Number(match[3]);
    if (!looksLikeNpc(actor) && amount > MAX_REALISTIC_HIT) return null;
    return {
      type: 'attack', actor, target, ability: normalizeAbility(match[4] || 'attack'), outcome: 'hit', amount,
      blocked: blocked ? Number(blocked[1]) : 0,
      absorbed: absorb ? Number(absorb[1]) : absorbSimple ? Number(absorbSimple[1]) : 0,
      preMitTotal: absorb ? Number(absorb[2]) : 0,
      evadedPct: evaded ? Number(evaded[1]) : null,
      damageTypes: explicitElements, raw: rest,
    };
  }
  if ((match = DOT_SUFFERS_RE.exec(rest))) {
    const target = normalizeActorName(match[1], seenActors, aliases);
    return {
      type: 'dot', actor: '', target, ability: normalizeAbility(match[3]) || 'Periodic', outcome: 'periodic', amount: Number(match[2]), damageTypes: [], raw: rest,
    };
  }
  if ((match = DMG_HAS_CAUSED_ELEM_RE.exec(rest))) {
    return {
      type: 'dot',
      actor: normalizeActorName(match[1], seenActors, aliases),
      target: normalizeActorName(match[2], seenActors, aliases),
      ability: 'Periodic', outcome: 'periodic', amount: Number(match[3]),
      damageTypes: [{ amount: Number(match[3]), type: match[4].toLowerCase() }], raw: rest,
    };
  }
  if ((match = DMG_HAS_CAUSED_RE.exec(rest)) || (match = DMG_CAUSED_RE.exec(rest))) {
    return {
      type: 'dot',
      actor: normalizeActorName(match[1], seenActors, aliases),
      target: normalizeActorName(match[2], seenActors, aliases),
      ability: 'Periodic', outcome: 'periodic', amount: Number(match[3]), damageTypes: [], raw: rest,
    };
  }
  if ((match = HEAL_RE.exec(rest))) {
    return {
      type: 'heal', actor: normalizeActorName(match[1], seenActors, aliases), target: normalizeActorName(match[2], seenActors, aliases), ability: normalizeAbility(match[4] || 'Healing'), amount: Number(match[3]), raw: rest,
    };
  }

  return null;
}

function parseChatLine(rest, seenActors, aliases) {
  let match;
  if ((match = GROUP_SHARE_RE.exec(rest))) {
    return { type: 'groupCredits', actor: 'You', target: '', ability: '', amount: Number(match[1]), raw: rest };
  }
  if ((match = GROUP_LOOT_RE.exec(rest))) {
    return { type: 'lootCredits', actor: normalizeActorName(match[1], seenActors, aliases), target: normalizeActorName(match[3], seenActors, aliases), ability: '', amount: Number(match[2]), raw: rest };
  }
  return null;
}

function parseFiles(files) {
  const events = [];
  const seenActors = new Set();
  const aliases = { ...DEFAULT_ALIASES };
  const lastDamageSourceForTarget = {};
  const lastCasterForDot = {};

  files.forEach((file, sourceIndex) => {
    const lines = file.text.split(/\r?\n/);
    let dayOffset = 0;
    let previousSecondsOfDay = null;

    lines.forEach((line, lineIndex) => {
      const match = line.match(TIME_RE);
      if (!match) return;
      const [, hh, mm, ss, rest] = match;
      const secondsOfDay = toEpochSeconds(hh, mm, ss);
      if (previousSecondsOfDay !== null && secondsOfDay < previousSecondsOfDay - 43200) dayOffset += 86400;
      previousSecondsOfDay = secondsOfDay;
      const epochSec = sourceIndex * 10_000_000 + dayOffset + secondsOfDay;

      let parsed = parseCombatLine(rest.trim(), null, seenActors, aliases);
      if (!parsed) parsed = parseChatLine(rest.trim(), seenActors, aliases);
      if (!parsed) return;

      if (parsed.actor && !looksLikeNpc(parsed.actor)) seenActors.add(parsed.actor);
      if (parsed.target && !looksLikeNpc(parsed.target)) seenActors.add(parsed.target);

      if (parsed.type === 'dot' && !parsed.actor && parsed.target) {
        const dotKey = `${normalizeAbility(parsed.ability)}||${parsed.target}`;
        parsed.actor = lastCasterForDot[dotKey] || lastDamageSourceForTarget[parsed.target] || '';
      }
      if ((parsed.type === 'attack' || parsed.type === 'dot') && parsed.actor && parsed.target && parsed.amount > 0 && parsed.outcome !== 'periodic') {
        lastDamageSourceForTarget[parsed.target] = parsed.actor;
      }
      if ((parsed.type === 'attack' || parsed.type === 'dot') && parsed.actor && parsed.target) {
        const key = `${normalizeAbility(parsed.ability)}||${parsed.target}`;
        lastCasterForDot[key] = parsed.actor;
      }

      events.push({
        ...parsed,
        timestamp: `${hh}:${mm}:${ss}`,
        epochSec,
        channel: 'Combat',
        sourceFile: file.name,
        lineNumber: lineIndex + 1,
      });
    });
  });

  events.sort((a, b) => a.epochSec - b.epochSec || a.lineNumber - b.lineNumber);

  const activity = new Map();
  const ensure = (name) => getOrCreate(activity, name);

  for (const event of events) {
    const actor = ensure(event.actor);
    const target = ensure(event.target);
    if (actor) {
      if (event.type === 'attack') actor.attacks += 1;
      if (event.type === 'dot') actor.dots += 1;
      if (event.type === 'heal') actor.heals += 1;
      if (event.type === 'perform') actor.performs += 1;
      if (event.type === 'utility') actor.utilities += 1;
      if (event.type === 'groupCredits' || event.type === 'lootCredits') actor.credits += event.amount || 0;
      if (['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type)) actor.sourceCount += 1;
    }
    if (target && event.target) target.targetCount += 1;
  }

  const roleMap = new Map();
  for (const [name, row] of activity.entries()) {
    let role = 'unknown';
    const playerSignals = row.heals + row.performs + row.utilities + (row.credits > 0 ? 1 : 0);
    const combatSourceSignals = row.attacks + row.dots;
    if (looksLikeNpc(name)) role = 'npc';
    else if (name === 'You') role = 'player';
    else if (playerSignals > 0) role = 'player';
    else if (combatSourceSignals >= 3 && row.sourceCount >= Math.max(2, row.targetCount * 0.35)) role = 'player';
    else if (row.targetCount > row.sourceCount * 2) role = 'npc';
    roleMap.set(name, role);
  }

  const actorInsights = Array.from(activity.values()).map((row) => {
    const role = roleMap.get(row.name) || 'unknown';
    const reasons = [];
    let score = 0;

    if (row.name === 'You') {
      score += 100;
      reasons.push('self');
    }
    if (role === 'npc') score -= 100;
    if (row.heals > 0) {
      score += row.heals * 4;
      reasons.push('healing');
    }
    if (row.performs > 0) {
      score += row.performs * 4;
      reasons.push('performs');
    }
    if (row.utilities > 0) {
      score += row.utilities * 3;
      reasons.push('utility');
    }
    if (row.credits > 0) {
      score += 2;
      reasons.push('credits');
    }
    if (row.attacks + row.dots >= 3) {
      score += 2;
      reasons.push('active source');
    }
    if (row.targetCount > row.sourceCount * 2) {
      score -= 3;
      reasons.push('mostly target');
    }

    const suggestedPlayer = role !== 'npc' && (row.name === 'You' || row.heals > 0 || row.performs > 0 || row.utilities > 0 || (row.sourceCount >= 3 && row.targetCount <= row.sourceCount * 1.5));

    return {
      ...row,
      role,
      score,
      suggestedPlayer,
      reason: reasons.slice(0, 3).join(', ') || (role === 'npc' ? 'npc pattern' : 'seen in logs'),
    };
  }).sort((a, b) => {
    if (b.suggestedPlayer !== a.suggestedPlayer) return Number(b.suggestedPlayer) - Number(a.suggestedPlayer);
    return b.score - a.score || a.name.localeCompare(b.name);
  });

  const suggestedPlayers = actorInsights.filter((row) => row.suggestedPlayer).map((row) => row.name);

  const actorBuckets = new Map();
  function ensureSummaryBucket(name) {
    if (!name) return null;
    if (!actorBuckets.has(name)) {
      actorBuckets.set(name, {
        name,
        role: roleMap.get(name) || 'unknown',
        directDamage: 0,
        dotDamage: 0,
        healing: 0,
        hits: 0,
        crits: 0,
        glances: 0,
        misses: 0,
        performs: 0,
        utility: 0,
        abilities: new Map(),
      });
    }
    return actorBuckets.get(name);
  }
  function bumpAbility(bucket, ability, update) {
    if (!bucket) return;
    const key = normalizeAbility(ability || 'attack') || 'attack';
    if (!bucket.abilities.has(key)) bucket.abilities.set(key, { actor: bucket.name, ability: key, uses: 0, damage: 0, healing: 0, type: 'mixed' });
    const record = bucket.abilities.get(key);
    record.uses += update.uses || 0;
    record.damage += update.damage || 0;
    record.healing += update.healing || 0;
    record.type = update.type || record.type;
  }

  for (const event of events) {
    event.actorRole = roleMap.get(event.actor) || 'unknown';
    event.targetRole = roleMap.get(event.target) || 'unknown';
    const bucket = ensureSummaryBucket(event.actor);
    if (event.type === 'attack') {
      if (bucket) {
        bucket.directDamage += event.amount || 0;
        if (event.outcome === 'hit' || event.outcome === 'strikethrough') bucket.hits += 1;
        if (event.outcome === 'crit') bucket.crits += 1;
        if (event.outcome === 'glance') bucket.glances += 1;
        if (['miss', 'dodge', 'parry'].includes(event.outcome)) bucket.misses += 1;
        bumpAbility(bucket, event.ability || 'attack', { uses: 1, damage: event.amount || 0, type: 'attack' });
      }
    } else if (event.type === 'dot') {
      if (bucket) {
        bucket.dotDamage += event.amount || 0;
        bumpAbility(bucket, event.ability || 'Periodic', { uses: 1, damage: event.amount || 0, type: 'dot' });
      }
    } else if (event.type === 'heal') {
      if (bucket) {
        bucket.healing += event.amount || 0;
        bumpAbility(bucket, event.ability || 'Healing', { uses: 1, healing: event.amount || 0, type: 'heal' });
      }
    } else if (event.type === 'perform') {
      if (bucket) {
        bucket.performs += 1;
        bumpAbility(bucket, event.ability || 'Perform', { uses: 1, type: 'perform' });
      }
    } else if (event.type === 'utility') {
      if (bucket) {
        bucket.utility += 1;
        bumpAbility(bucket, event.ability || 'Utility', { uses: 1, type: 'utility' });
      }
    }
  }

  const actorsSummary = Array.from(actorBuckets.values()).map((bucket) => ({
    ...bucket,
    totalDamage: bucket.directDamage + bucket.dotDamage,
    abilities: Array.from(bucket.abilities.values()).sort((a, b) => (b.damage + b.healing) - (a.damage + a.healing) || b.uses - a.uses || a.ability.localeCompare(b.ability)),
  })).sort((a, b) => b.totalDamage - a.totalDamage || b.healing - a.healing || a.name.localeCompare(b.name));

  const encounters = [];
  let current = null;
  for (const event of events) {
    if (!['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type)) continue;
    if (!current || event.epochSec - current.lastEpochSec > ENCOUNTER_GAP_SECONDS) {
      current = { id: `enc-${encounters.length + 1}`, startEpochSec: event.epochSec, endEpochSec: event.epochSec, lastEpochSec: event.epochSec, startTime: event.timestamp, endTime: event.timestamp, events: [] };
      encounters.push(current);
    }
    current.events.push(event);
    current.lastEpochSec = event.epochSec;
    current.endEpochSec = event.epochSec;
    current.endTime = event.timestamp;
  }

  const summarizedEncounters = encounters.map((encounter, index) => {
    const targetDamage = new Map();
    const localActorBuckets = new Map();
    let directDamage = 0;
    let dotDamage = 0;
    let healing = 0;
    let credits = 0;
    const eventAbilityMap = new Map();
    const targets = new Set();

    function localBucket(name) {
      if (!name) return null;
      if (!localActorBuckets.has(name)) {
        localActorBuckets.set(name, {
          name,
          role: roleMap.get(name) || 'unknown',
          directDamage: 0,
          dotDamage: 0,
          healing: 0,
          hits: 0,
          crits: 0,
          glances: 0,
          misses: 0,
          performs: 0,
          utility: 0,
          abilities: new Map(),
        });
      }
      return localActorBuckets.get(name);
    }
    function localAbility(actor, ability, type, damage = 0, heal = 0) {
      const key = `${actor}||${normalizeAbility(ability || 'attack') || 'attack'}`;
      if (!eventAbilityMap.has(key)) eventAbilityMap.set(key, { actor, ability: normalizeAbility(ability || 'attack') || 'attack', uses: 0, damage: 0, healing: 0, type, actorRole: roleMap.get(actor) || 'unknown' });
      const record = eventAbilityMap.get(key);
      record.uses += 1;
      record.damage += damage;
      record.healing += heal;
    }

    for (const event of encounter.events) {
      if (event.target) targets.add(event.target);
      const bucket = localBucket(event.actor);
      if (event.type === 'attack') {
        bucket.directDamage += event.amount || 0;
        if (event.outcome === 'hit' || event.outcome === 'strikethrough') bucket.hits += 1;
        if (event.outcome === 'crit') bucket.crits += 1;
        if (event.outcome === 'glance') bucket.glances += 1;
        if (['miss', 'dodge', 'parry'].includes(event.outcome)) bucket.misses += 1;
        directDamage += event.amount || 0;
        if (event.target) targetDamage.set(event.target, (targetDamage.get(event.target) || 0) + (event.amount || 0));
        localAbility(event.actor, event.ability, 'attack', event.amount || 0, 0);
      } else if (event.type === 'dot') {
        bucket.dotDamage += event.amount || 0;
        dotDamage += event.amount || 0;
        if (event.target) targetDamage.set(event.target, (targetDamage.get(event.target) || 0) + (event.amount || 0));
        localAbility(event.actor, event.ability, 'dot', event.amount || 0, 0);
      } else if (event.type === 'heal') {
        bucket.healing += event.amount || 0;
        healing += event.amount || 0;
        localAbility(event.actor, event.ability, 'heal', 0, event.amount || 0);
      } else if (event.type === 'perform') {
        bucket.performs += 1;
        localAbility(event.actor, event.ability, 'perform');
      } else if (event.type === 'utility') {
        bucket.utility += 1;
        localAbility(event.actor, event.ability, 'utility');
      } else if (event.type === 'groupCredits' || event.type === 'lootCredits') {
        credits += event.amount || 0;
      }
    }

    const actors = Array.from(localActorBuckets.values()).map((bucket) => ({
      ...bucket,
      totalDamage: bucket.directDamage + bucket.dotDamage,
      abilities: Array.from(bucket.abilities.values()),
    })).sort((a, b) => b.totalDamage - a.totalDamage || b.healing - a.healing || a.name.localeCompare(b.name));

    const npcTargets = Array.from(targetDamage.entries()).filter(([name]) => (roleMap.get(name) || 'unknown') !== 'player').sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const dominantNpc = npcTargets[0]?.[0] || '';
    const label = dominantNpc ? `Encounter ${index + 1} · ${dominantNpc}` : `Encounter ${index + 1}${actors[0]?.name ? ` · ${actors[0].name}` : ''}`;
    const durationSec = Math.max(1, encounter.endEpochSec - encounter.startEpochSec + 1);

    return {
      id: encounter.id,
      number: index + 1,
      label,
      startTime: encounter.startTime,
      endTime: encounter.endTime,
      durationSec,
      eventCount: encounter.events.length,
      directDamage,
      dotDamage,
      totalDamage: directDamage + dotDamage,
      healing,
      credits,
      dps: (directDamage + dotDamage) / durationSec,
      hps: healing / durationSec,
      actors,
      targets: Array.from(targets).sort(),
      abilities: Array.from(eventAbilityMap.values()).sort((a, b) => (b.damage + b.healing) - (a.damage + a.healing) || b.uses - a.uses || a.ability.localeCompare(b.ability)),
      events: encounter.events,
      dominantNpc,
    };
  });

  return {
    summary: {
      totalEvents: events.length,
      totalDamage: actorsSummary.reduce((sum, actor) => sum + actor.totalDamage, 0),
      directDamage: actorsSummary.reduce((sum, actor) => sum + actor.directDamage, 0),
      dotDamage: actorsSummary.reduce((sum, actor) => sum + actor.dotDamage, 0),
      totalHealing: actorsSummary.reduce((sum, actor) => sum + actor.healing, 0),
      totalSharedCredits: events.filter((event) => event.type === 'groupCredits').reduce((sum, event) => sum + (event.amount || 0), 0),
      totalLootedCredits: events.filter((event) => event.type === 'lootCredits').reduce((sum, event) => sum + (event.amount || 0), 0),
      encounterCount: summarizedEncounters.length,
      actorCount: actorsSummary.length,
      actors: actorsSummary,
    },
    encounters: summarizedEncounters,
    recentEvents: events.slice(-200).reverse(),
    actors: Array.from(roleMap.entries()).map(([name, role]) => ({ name, role })).sort((a, b) => a.name.localeCompare(b.name)),
    actorInsights,
    suggestedPlayers,
  };
}

self.onmessage = (event) => {
  const { type, payload } = event.data || {};
  if (type !== 'parseLogs') return;

  try {
    const result = parseFiles(payload.files || []);
    self.postMessage({ type: 'parsed', payload: result });
  } catch (error) {
    self.postMessage({ type: 'error', payload: { message: error instanceof Error ? error.message : 'Failed to parse logs.' } });
  }
};
