const COMBAT_LINE_RE = /^\[(?<channel>[^\]]+)]\s+(?<time>\d{2}:\d{2}:\d{2})\s+(?<message>.+)$/;
const ATTACK_RE = /^(?<actor>.+?) attacks (?:(?<target>.+?) )?(?:(?:using|with) (?<ability>.+?) )?and (?<outcome>hits|crits|glances|misses|strikes through)(?: \((?<qualifiers>[^)]*)\))?(?: for (?<amount>\d+) points(?: \((?<damageTypes>[^)]*)\))?)?\.?(?: Armor absorbed (?<absorbed>\d+) points out of (?<mitigated>\d+)\.)?$/;
const DOT_RE = /^(?<actor>.+?) has caused (?<target>.+?) to take (?<amount>\d+) points of (?<damageType>[a-zA-Z ]+) damage\. \((?<details>[^)]*)\)$/;
const HEAL_RE = /^(?<actor>.+?) heals (?<target>.+?) for (?<amount>\d+) points of damage\.$/;
const PERFORM_RE = /^(?<actor>.+?) performs (?<ability>.+?)(?: on (?<target>.+?))?\.$/;
const INFUSE_RE = /^(?<actor>.+?) infuses (?<target>.+?) with a large amount of bacta\.$/;
const GAIN_RE = /^(?<actor>.+?) gains (?<effect>.+)\.$/;
const FREE_SHOT_RE = /^(?<actor>.+?) snaps off a free shot!$/;
const GROUP_SHARE_RE = /^\[GROUP] You receive (?<amount>\d+) credits as your share\.$/;
const GROUP_LOOT_RE = /^\[GROUP] (?<actor>.+?) looted (?<amount>\d+) credits from (?<target>.+)\.$/;

const ENCOUNTER_GAP_SECONDS = 15;

function timeToSeconds(value) {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeDamageTypes(raw) {
  if (!raw) return [];
  return raw
    .split(' and ')
    .map((part) => part.trim())
    .map((part) => {
      const match = part.match(/(?<amount>\d+)\s+(?<type>.+)/);
      if (!match?.groups) return null;
      return {
        type: match.groups.type.trim(),
        amount: Number(match.groups.amount),
      };
    })
    .filter(Boolean);
}

function parseQualifiers(raw) {
  if (!raw) return { blocked: 0, evadedPct: null, raw };
  let blocked = 0;
  let evadedPct = null;

  const blockedMatch = raw.match(/(?<blocked>\d+) points blocked/);
  if (blockedMatch?.groups) blocked = Number(blockedMatch.groups.blocked);

  const evadedMatch = raw.match(/(?<evaded>\d+)% evaded/);
  if (evadedMatch?.groups) evadedPct = Number(evadedMatch.groups.evaded);

  return { blocked, evadedPct, raw };
}

function parseDotDetails(raw) {
  const absorbedMatch = raw.match(/(?<absorbed>\d+) absorbed/);
  const resistedMatch = raw.match(/(?<resisted>\d+) resisted/);
  return {
    absorbed: absorbedMatch?.groups ? Number(absorbedMatch.groups.absorbed) : 0,
    resisted: resistedMatch?.groups ? Number(resistedMatch.groups.resisted) : 0,
    raw,
  };
}

function createActorBucket(name, role = 'unknown') {
  return {
    name,
    role,
    directDamage: 0,
    dotDamage: 0,
    takenDamage: 0,
    healing: 0,
    hits: 0,
    crits: 0,
    glances: 0,
    misses: 0,
    performs: 0,
    utility: 0,
    actionCount: 0,
    abilities: new Map(),
  };
}

function getActorBucket(map, name, role = 'unknown') {
  if (!name) return null;
  if (!map.has(name)) map.set(name, createActorBucket(name, role));
  const bucket = map.get(name);
  if (bucket.role === 'unknown' && role !== 'unknown') bucket.role = role;
  return bucket;
}

function bumpAbility(bucket, ability, fields) {
  if (!bucket || !ability) return;
  if (!bucket.abilities.has(ability)) {
    bucket.abilities.set(ability, {
      name: ability,
      uses: 0,
      directDamage: 0,
      dotDamage: 0,
      healing: 0,
      hits: 0,
      crits: 0,
      glances: 0,
      misses: 0,
    });
  }
  const record = bucket.abilities.get(ability);
  Object.entries(fields).forEach(([key, value]) => {
    record[key] = (record[key] || 0) + value;
  });
}

function finalizeAbilityMap(bucket) {
  return Array.from(bucket.abilities.values()).sort((a, b) => {
    const aImpact = a.directDamage + a.dotDamage + a.healing;
    const bImpact = b.directDamage + b.dotDamage + b.healing;
    return bImpact - aImpact || b.uses - a.uses || a.name.localeCompare(b.name);
  });
}

function parseCombatMessage(message) {
  let match = message.match(ATTACK_RE);
  if (match?.groups) {
    const qualifiers = parseQualifiers(match.groups.qualifiers || '');
    return {
      type: 'attack',
      actor: match.groups.actor.trim(),
      target: match.groups.target?.trim() || '',
      ability: match.groups.ability?.trim() || '',
      outcome: match.groups.outcome,
      amount: match.groups.amount ? Number(match.groups.amount) : 0,
      absorbed: match.groups.absorbed ? Number(match.groups.absorbed) : 0,
      mitigated: match.groups.mitigated ? Number(match.groups.mitigated) : 0,
      damageTypes: normalizeDamageTypes(match.groups.damageTypes || ''),
      blocked: qualifiers.blocked,
      evadedPct: qualifiers.evadedPct,
      qualifiers: qualifiers.raw,
      raw: message,
    };
  }

  match = message.match(DOT_RE);
  if (match?.groups) {
    const details = parseDotDetails(match.groups.details || '');
    return {
      type: 'dot',
      actor: match.groups.actor.trim(),
      target: match.groups.target.trim(),
      ability: `${match.groups.damageType.trim()} DoT`,
      outcome: 'ticks',
      amount: Number(match.groups.amount),
      absorbed: details.absorbed,
      resisted: details.resisted,
      damageTypes: [{ type: match.groups.damageType.trim(), amount: Number(match.groups.amount) }],
      raw: message,
    };
  }

  match = message.match(HEAL_RE);
  if (match?.groups) {
    return {
      type: 'heal',
      actor: match.groups.actor.trim(),
      target: match.groups.target.trim(),
      ability: 'Healing',
      outcome: 'heals',
      amount: Number(match.groups.amount),
      raw: message,
    };
  }

  match = message.match(PERFORM_RE);
  if (match?.groups) {
    return {
      type: 'perform',
      actor: match.groups.actor.trim(),
      target: match.groups.target?.trim() || '',
      ability: match.groups.ability.trim(),
      outcome: 'performs',
      amount: 0,
      raw: message,
    };
  }

  match = message.match(INFUSE_RE);
  if (match?.groups) {
    return {
      type: 'utility',
      actor: match.groups.actor.trim(),
      target: match.groups.target.trim(),
      ability: 'Bacta Infusion',
      outcome: 'infuses',
      amount: 0,
      raw: message,
    };
  }

  match = message.match(GAIN_RE);
  if (match?.groups) {
    return {
      type: 'utility',
      actor: match.groups.actor.trim(),
      target: '',
      ability: match.groups.effect.trim(),
      outcome: 'gains',
      amount: 0,
      raw: message,
    };
  }

  match = message.match(FREE_SHOT_RE);
  if (match?.groups) {
    return {
      type: 'utility',
      actor: match.groups.actor.trim(),
      target: '',
      ability: 'Free Shot',
      outcome: 'utility',
      amount: 0,
      raw: message,
    };
  }

  return null;
}

function parseChatMessage(channel, message) {
  if (channel !== 'Chat') return null;

  let match = message.match(GROUP_SHARE_RE);
  if (match?.groups) {
    return {
      type: 'groupCredits',
      actor: 'You',
      target: '',
      ability: '',
      amount: Number(match.groups.amount),
      raw: message,
    };
  }

  match = message.match(GROUP_LOOT_RE);
  if (match?.groups) {
    return {
      type: 'lootCredits',
      actor: match.groups.actor.trim(),
      target: match.groups.target.trim(),
      ability: '',
      amount: Number(match.groups.amount),
      raw: message,
    };
  }

  return null;
}

function buildActorInsights(events) {
  const map = new Map();
  const ensure = (name) => {
    if (!name) return null;
    if (!map.has(name)) {
      map.set(name, {
        name,
        heals: 0,
        performs: 0,
        utilities: 0,
        supportiveTargets: 0,
        attacks: 0,
        dots: 0,
        incomingHits: 0,
        incomingDots: 0,
        credits: 0,
        score: 0,
      });
    }
    return map.get(name);
  };

  for (const event of events) {
    const actor = ensure(event.actor);
    const target = ensure(event.target);

    if (event.type === 'heal') {
      if (actor) actor.heals += 1;
      if (target) target.supportiveTargets += 1;
    } else if (event.type === 'perform') {
      if (actor) actor.performs += 1;
      if (target) target.supportiveTargets += 1;
    } else if (event.type === 'utility') {
      if (actor) actor.utilities += 1;
      if (target) target.supportiveTargets += 1;
    } else if (event.type === 'groupCredits' || event.type === 'lootCredits') {
      if (actor) actor.credits += event.amount || 0;
    } else if (event.type === 'attack') {
      if (actor) actor.attacks += 1;
      if (target) target.incomingHits += 1;
    } else if (event.type === 'dot') {
      if (actor) actor.dots += 1;
      if (target) target.incomingDots += 1;
    }
  }

  const insights = Array.from(map.values()).map((entry) => {
    let score = 0;
    if (entry.name === 'You') score += 10;
    score += entry.heals * 3;
    score += entry.performs * 3;
    score += entry.utilities * 2;
    score += entry.supportiveTargets * 2;
    score += entry.credits > 0 ? 2 : 0;
    score += entry.attacks > 0 ? 1 : 0;
    score += entry.dots > 0 ? 1 : 0;
    score -= entry.incomingHits > 0 && entry.attacks === 0 && entry.heals === 0 && entry.performs === 0 && entry.utilities === 0 ? 2 : 0;
    score -= entry.incomingDots > 0 && entry.dots === 0 && entry.heals === 0 && entry.performs === 0 && entry.utilities === 0 ? 1 : 0;

    return {
      ...entry,
      score,
      suggestedPlayer:
        entry.name === 'You' || score >= 4 || entry.heals > 0 || entry.performs > 0 || entry.utilities > 0,
    };
  });

  insights.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return insights;
}

function classifyActors(events) {
  const playerNames = new Set(['You']);
  const npcNames = new Set();

  for (const event of events) {
    if (event.type === 'heal' || event.type === 'perform' || event.type === 'utility' || event.type === 'groupCredits') {
      if (event.actor) playerNames.add(event.actor);
      if (event.target) playerNames.add(event.target);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const event of events) {
      if (event.type !== 'attack' && event.type !== 'dot') continue;

      if (playerNames.has(event.actor) && event.target && !playerNames.has(event.target) && !npcNames.has(event.target)) {
        npcNames.add(event.target);
        changed = true;
      }

      if (playerNames.has(event.target) && event.actor && !playerNames.has(event.actor) && !npcNames.has(event.actor)) {
        npcNames.add(event.actor);
        changed = true;
      }

      if (event.type === 'heal' && event.target && playerNames.has(event.target) && event.actor && !playerNames.has(event.actor)) {
        playerNames.add(event.actor);
        changed = true;
      }
    }
  }

  const roleMap = new Map();
  const allNames = new Set();
  for (const event of events) {
    if (event.actor) allNames.add(event.actor);
    if (event.target) allNames.add(event.target);
  }

  for (const name of allNames) {
    if (playerNames.has(name)) roleMap.set(name, 'player');
    else if (npcNames.has(name)) roleMap.set(name, 'npc');
    else roleMap.set(name, 'unknown');
  }

  return roleMap;
}

function labelEncounter(number, dominantNpc, npcTargetCount, topActor) {
  if (dominantNpc) {
    return npcTargetCount > 1 ? `${dominantNpc} +${npcTargetCount - 1}` : dominantNpc;
  }
  if (topActor) return topActor;
  return `Encounter ${number}`;
}

function aggregateEncounterAbilities(events) {
  const map = new Map();
  for (const event of events) {
    const ability = event.ability || (event.type === 'attack' ? 'Basic Attack' : event.type);
    const key = `${event.actor}::${ability}`;
    if (!map.has(key)) {
      map.set(key, {
        actor: event.actor,
        ability,
        uses: 0,
        damage: 0,
        healing: 0,
        type: event.type,
      });
    }
    const record = map.get(key);
    record.uses += 1;
    if (event.type === 'attack' || event.type === 'dot') record.damage += event.amount || 0;
    if (event.type === 'heal') record.healing += event.amount || 0;
  }
  return Array.from(map.values()).sort((a, b) => (b.damage + b.healing) - (a.damage + a.healing) || b.uses - a.uses);
}

function summarizeEncounter(encounter, number, roleMap) {
  const actorMap = new Map();
  const targetSet = new Set();
  const targetDamage = new Map();
  let directDamage = 0;
  let dotDamage = 0;
  let healing = 0;
  let credits = 0;

  for (const event of encounter.events) {
    if (event.target) targetSet.add(event.target);
    const bucket = getActorBucket(actorMap, event.actor, roleMap.get(event.actor) || 'unknown');

    if (event.type === 'attack') {
      bucket.actionCount += 1;
      if (event.outcome === 'hits') bucket.hits += 1;
      if (event.outcome === 'crits') bucket.crits += 1;
      if (event.outcome === 'glances') bucket.glances += 1;
      if (event.outcome === 'misses') bucket.misses += 1;
      if (event.outcome === 'strikes through') bucket.hits += 1;
      bucket.directDamage += event.amount;
      directDamage += event.amount;
      if (event.target) {
        targetDamage.set(event.target, (targetDamage.get(event.target) || 0) + event.amount);
        const targetBucket = getActorBucket(actorMap, event.target, roleMap.get(event.target) || 'unknown');
        if (targetBucket) targetBucket.takenDamage += event.amount;
      }
      bumpAbility(bucket, event.ability || 'Basic Attack', {
        uses: 1,
        directDamage: event.amount,
        hits: event.outcome === 'hits' || event.outcome === 'strikes through' ? 1 : 0,
        crits: event.outcome === 'crits' ? 1 : 0,
        glances: event.outcome === 'glances' ? 1 : 0,
        misses: event.outcome === 'misses' ? 1 : 0,
      });
    } else if (event.type === 'dot') {
      bucket.actionCount += 1;
      bucket.dotDamage += event.amount;
      dotDamage += event.amount;
      if (event.target) {
        targetDamage.set(event.target, (targetDamage.get(event.target) || 0) + event.amount);
        const targetBucket = getActorBucket(actorMap, event.target, roleMap.get(event.target) || 'unknown');
        if (targetBucket) targetBucket.takenDamage += event.amount;
      }
      bumpAbility(bucket, event.ability, { uses: 1, dotDamage: event.amount });
    } else if (event.type === 'heal') {
      bucket.actionCount += 1;
      bucket.healing += event.amount;
      healing += event.amount;
      bumpAbility(bucket, event.ability, { uses: 1, healing: event.amount });
    } else if (event.type === 'perform') {
      bucket.actionCount += 1;
      bucket.performs += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'utility') {
      bucket.actionCount += 1;
      bucket.utility += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'groupCredits' || event.type === 'lootCredits') {
      credits += event.amount;
    }
  }

  const actors = Array.from(actorMap.values()).map((actor) => ({
    ...actor,
    totalDamage: actor.directDamage + actor.dotDamage,
    abilities: finalizeAbilityMap(actor),
  }));
  actors.sort((a, b) => b.totalDamage - a.totalDamage || b.healing - a.healing || a.name.localeCompare(b.name));

  const durationSec = Math.max(1, encounter.endEpochSec - encounter.startEpochSec + 1);
  const totalDamage = directDamage + dotDamage;
  const topAbilities = aggregateEncounterAbilities(encounter.events);
  const npcTargets = Array.from(targetDamage.entries())
    .filter(([name]) => (roleMap.get(name) || 'unknown') !== 'player')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dominantNpc = npcTargets[0]?.[0] || '';
  const topActor = actors[0]?.name || '';

  return {
    id: encounter.id,
    number,
    label: labelEncounter(number, dominantNpc, npcTargets.length, topActor),
    startTime: encounter.startTime,
    endTime: encounter.endTime,
    durationSec,
    eventCount: encounter.events.length,
    directDamage,
    dotDamage,
    totalDamage,
    healing,
    credits,
    dps: totalDamage / durationSec,
    hps: healing / durationSec,
    actors,
    targets: Array.from(targetSet).sort(),
    abilities: topAbilities,
    events: encounter.events,
    dominantNpc,
  };
}

function buildEncounters(events, roleMap) {
  const encounters = [];
  let current = null;

  for (const event of events) {
    const isCombatish = ['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type);
    if (!isCombatish) continue;

    if (!current || event.epochSec - current.lastEpochSec > ENCOUNTER_GAP_SECONDS) {
      current = {
        id: `enc-${encounters.length + 1}`,
        startEpochSec: event.epochSec,
        endEpochSec: event.epochSec,
        lastEpochSec: event.epochSec,
        startTime: event.timestamp,
        endTime: event.timestamp,
        events: [],
      };
      encounters.push(current);
    }

    current.events.push(event);
    current.lastEpochSec = event.epochSec;
    current.endEpochSec = event.epochSec;
    current.endTime = event.timestamp;
  }

  return encounters.map((encounter, index) => summarizeEncounter(encounter, index + 1, roleMap));
}

function summarizeAll(events, encounters, roleMap) {
  const actorMap = new Map();
  let directDamage = 0;
  let dotDamage = 0;
  let healing = 0;
  let sharedCredits = 0;
  let lootedCredits = 0;

  for (const event of events) {
    const bucket = getActorBucket(actorMap, event.actor, roleMap.get(event.actor) || 'unknown');
    if (event.type === 'attack') {
      bucket.actionCount += 1;
      bucket.directDamage += event.amount;
      directDamage += event.amount;
      if (event.target) {
        const targetBucket = getActorBucket(actorMap, event.target, roleMap.get(event.target) || 'unknown');
        if (targetBucket) targetBucket.takenDamage += event.amount;
      }
      if (event.outcome === 'hits' || event.outcome === 'strikes through') bucket.hits += 1;
      if (event.outcome === 'crits') bucket.crits += 1;
      if (event.outcome === 'glances') bucket.glances += 1;
      if (event.outcome === 'misses') bucket.misses += 1;
      bumpAbility(bucket, event.ability || 'Basic Attack', {
        uses: 1,
        directDamage: event.amount,
        hits: event.outcome === 'hits' || event.outcome === 'strikes through' ? 1 : 0,
        crits: event.outcome === 'crits' ? 1 : 0,
        glances: event.outcome === 'glances' ? 1 : 0,
        misses: event.outcome === 'misses' ? 1 : 0,
      });
    } else if (event.type === 'dot') {
      bucket.actionCount += 1;
      bucket.dotDamage += event.amount;
      dotDamage += event.amount;
      if (event.target) {
        const targetBucket = getActorBucket(actorMap, event.target, roleMap.get(event.target) || 'unknown');
        if (targetBucket) targetBucket.takenDamage += event.amount;
      }
      bumpAbility(bucket, event.ability, { uses: 1, dotDamage: event.amount });
    } else if (event.type === 'heal') {
      bucket.actionCount += 1;
      bucket.healing += event.amount;
      healing += event.amount;
      bumpAbility(bucket, event.ability, { uses: 1, healing: event.amount });
    } else if (event.type === 'perform') {
      bucket.actionCount += 1;
      bucket.performs += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'utility') {
      bucket.actionCount += 1;
      bucket.utility += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'groupCredits') {
      sharedCredits += event.amount;
    } else if (event.type === 'lootCredits') {
      lootedCredits += event.amount;
    }
  }

  const actors = Array.from(actorMap.values()).map((actor) => ({
    ...actor,
    totalDamage: actor.directDamage + actor.dotDamage,
    abilities: finalizeAbilityMap(actor),
  }));
  actors.sort((a, b) => b.totalDamage - a.totalDamage || b.healing - a.healing || a.name.localeCompare(b.name));

  const totalDurationSec = encounters.reduce((sum, encounter) => sum + encounter.durationSec, 0);

  return {
    totalEvents: events.length,
    totalDamage: directDamage + dotDamage,
    directDamage,
    dotDamage,
    totalHealing: healing,
    totalSharedCredits: sharedCredits,
    totalLootedCredits: lootedCredits,
    encounterCount: encounters.length,
    actorCount: actors.length,
    totalDurationSec,
    actors,
  };
}

function parseFiles(files) {
  const events = [];
  let sourceOrder = 0;

  for (const file of files) {
    const lines = file.text.split(/\r?\n/);
    let dayOffset = 0;
    let previousSecondsOfDay = null;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const match = line.match(COMBAT_LINE_RE);
      if (!match?.groups) continue;

      const channel = match.groups.channel.trim();
      const timestamp = match.groups.time;
      const message = match.groups.message.trim();
      const secondsOfDay = timeToSeconds(timestamp);
      if (previousSecondsOfDay !== null && secondsOfDay < previousSecondsOfDay - 43200) {
        dayOffset += 86400;
      }
      previousSecondsOfDay = secondsOfDay;
      const epochSec = sourceOrder * 10_000_000 + dayOffset + secondsOfDay;

      let parsed = null;
      if (channel === 'Combat') parsed = parseCombatMessage(message);
      if (!parsed) parsed = parseChatMessage(channel, message);
      if (!parsed) continue;

      events.push({
        ...parsed,
        channel,
        timestamp,
        epochSec,
        source: file.name,
        lineNumber: lineIndex + 1,
      });
    }

    sourceOrder += 1;
  }

  events.sort((a, b) => a.epochSec - b.epochSec || a.lineNumber - b.lineNumber);
  const roleMap = classifyActors(events);
  const actorInsights = buildActorInsights(events).map((entry) => ({
    ...entry,
    role: roleMap.get(entry.name) || 'unknown',
  }));
  const suggestedPlayers = actorInsights.filter((entry) => entry.suggestedPlayer).map((entry) => entry.name);

  events.forEach((event) => {
    event.actorRole = roleMap.get(event.actor) || 'unknown';
    event.targetRole = roleMap.get(event.target) || 'unknown';
  });
  const encounters = buildEncounters(events, roleMap);
  const summary = summarizeAll(events, encounters, roleMap);
  return {
    summary,
    encounters,
    recentEvents: events.slice(-200).reverse(),
    actors: Array.from(roleMap.entries())
      .map(([name, role]) => ({ name, role }))
      .sort((a, b) => a.name.localeCompare(b.name)),
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
    self.postMessage({
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Failed to parse log files.' },
    });
  }
};
