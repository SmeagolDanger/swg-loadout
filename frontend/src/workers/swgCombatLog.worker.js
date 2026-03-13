const COMBAT_LINE_RE = /^\[(?<channel>[^\]]+)]\s+(?<time>\d{2}:\d{2}:\d{2})\s+(?<message>.+)$/;
const ATTACK_RE = /^(?<actor>.+?) attacks (?:(?<target>.+?) )?(?:(?:using|with) (?<ability>.+?) )?and (?<outcome>hits|crits|glances|misses|strikes through)(?: \((?<qualifiers>[^)]*)\))?(?: for (?<amount>\d+) points(?: \((?<damageTypes>[^)]*)\))?)?\.?(?: Armor absorbed (?<absorbed>\d+) points out of (?<mitigated>\d+)\.)?$/;
const DOT_RE = /^(?<actor>.+?) has caused (?<target>.+?) to take (?<amount>\d+) points of (?<damageType>[a-zA-Z ]+) damage\. \((?<details>[^)]*)\)$/;
const HEAL_RE = /^(?<actor>.+?) heals (?<target>.+?) for (?<amount>\d+) points of damage\.$/;
const PERFORM_RE = /^(?<actor>.+?) performs (?<ability>.+?)(?: on (?<target>.+?))?\.$/;
const INFUSE_RE = /^(?<actor>.+?) infuses (?<target>.+?) with a large amount of bacta\.$/;
const GAIN_RE = /^(?<actor>.+?) gains (?<effect>.+)\.$/;
const FREE_SHOT_RE = /^(?<actor>.+?) snaps off a free shot!$/;
const GROUP_SHARE_RE = /^\[GROUP] You receive (?<amount>\d+) credits as your share\.$/;
const GROUP_SPLIT_RE = /^\[GROUP] You split (?<total>\d+) credits and receive (?<share>\d+) credits as your share\.$/;
const GROUP_LOOT_CREDITS_RE = /^\[GROUP] (?<actor>.+?) looted (?<amount>\d+) credits from (?<target>.+)\.$/;
const GROUP_LOOT_ITEM_RE = /^\[GROUP] (?<actor>.+?) looted (?<item>.+?) from (?<target>.+)\.$/;
const TOO_FAR_LOOT_RE = /^You are too far away to loot (?<target>.+)\.$/;
const NOTHING_VALUE_RE = /^You find nothing else of value on the selected corpse\.$/;
const LOOTED_ALL_RE = /^You have completely looted the corpse of all items\.$/;
const QUEST_RECEIVED_RE = /^Quest received: (?<quest>.+)$/;
const NEW_ABILITY_RE = /^You have acquired a new ability: (?<ability>.+)!$/;
const DESTROYED_RE = /^The (?<target>.+?) has been Destroyed!$/;

const ENCOUNTER_GAP_SECONDS = 15;

function timeToSeconds(value) {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function shortenPlayerName(rawName) {
  const name = (rawName || '').trim();
  if (!name) return '';
  if (/^(a|an|the)\s+/i.test(name)) return name;
  if (/^corpse of /i.test(name)) return name;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[0];
  return name;
}

function normalizeDamageTypes(raw) {
  if (!raw) return [];
  return raw
    .split(' and ')
    .map((part) => part.trim())
    .map((part) => {
      const match = part.match(/(?<amount>\d+)\s+(?<type>.+)/);
      if (!match?.groups) return null;
      return { type: match.groups.type.trim(), amount: Number(match.groups.amount) };
    })
    .filter(Boolean);
}

function parseQualifiers(raw) {
  if (!raw) return { blocked: 0, evadedPct: null, raw };
  const blockedMatch = raw.match(/(?<blocked>\d+) points blocked/);
  const evadedMatch = raw.match(/(?<evaded>\d+)% evaded/);
  return {
    blocked: blockedMatch?.groups ? Number(blockedMatch.groups.blocked) : 0,
    evadedPct: evadedMatch?.groups ? Number(evadedMatch.groups.evaded) : null,
    raw,
  };
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
    activeActionCount: 0,
    lootedCredits: 0,
    sharedCredits: 0,
    splitCredits: 0,
    lootItems: 0,
    lootNotices: 0,
    abilities: new Map(),
    items: new Map(),
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

function bumpLootItem(bucket, itemName) {
  if (!bucket || !itemName) return;
  bucket.items.set(itemName, (bucket.items.get(itemName) || 0) + 1);
}

function finalizeAbilityMap(bucket) {
  return Array.from(bucket.abilities.values()).sort((a, b) => {
    const aImpact = a.directDamage + a.dotDamage + a.healing;
    const bImpact = b.directDamage + b.dotDamage + b.healing;
    return bImpact - aImpact || b.uses - a.uses || a.name.localeCompare(b.name);
  });
}

function finalizeItemMap(bucket) {
  return Array.from(bucket.items.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function parseCombatMessage(message) {
  let match = message.match(ATTACK_RE);
  if (match?.groups) {
    const qualifiers = parseQualifiers(match.groups.qualifiers || '');
    return {
      type: 'attack',
      actor: shortenPlayerName(match.groups.actor.trim()),
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
      actor: shortenPlayerName(match.groups.actor.trim()),
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
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: shortenPlayerName(match.groups.target.trim()),
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
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: match.groups.target?.trim() ? shortenPlayerName(match.groups.target.trim()) : '',
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
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: shortenPlayerName(match.groups.target.trim()),
      ability: 'Bacta Infusion',
      outcome: 'infuses',
      amount: 0,
      countsAsAction: true,
      raw: message,
    };
  }

  match = message.match(GAIN_RE);
  if (match?.groups) {
    return {
      type: 'utility',
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: '',
      ability: match.groups.effect.trim(),
      outcome: 'gains',
      amount: 0,
      countsAsAction: false,
      raw: message,
    };
  }

  match = message.match(FREE_SHOT_RE);
  if (match?.groups) {
    return {
      type: 'utility',
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: '',
      ability: 'Free Shot',
      outcome: 'utility',
      amount: 0,
      countsAsAction: true,
      raw: message,
    };
  }

  return null;
}

function parseChatMessage(channel, message) {
  if (!['Chat', 'System Message'].includes(channel)) return null;

  let match = message.match(GROUP_SPLIT_RE);
  if (match?.groups) {
    return {
      type: 'groupCredits',
      actor: 'You',
      target: '',
      ability: '',
      amount: Number(match.groups.share),
      totalAmount: Number(match.groups.total),
      raw: message,
      subtype: 'splitShare',
    };
  }

  match = message.match(GROUP_SHARE_RE);
  if (match?.groups) {
    return {
      type: 'groupCredits',
      actor: 'You',
      target: '',
      ability: '',
      amount: Number(match.groups.amount),
      raw: message,
      subtype: 'share',
    };
  }

  match = message.match(GROUP_LOOT_CREDITS_RE);
  if (match?.groups) {
    return {
      type: 'lootCredits',
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: match.groups.target.trim(),
      ability: '',
      amount: Number(match.groups.amount),
      raw: message,
    };
  }

  match = message.match(GROUP_LOOT_ITEM_RE);
  if (match?.groups) {
    return {
      type: 'lootItem',
      actor: shortenPlayerName(match.groups.actor.trim()),
      target: match.groups.target.trim(),
      ability: '',
      amount: 1,
      item: match.groups.item.trim(),
      raw: message,
    };
  }

  match = message.match(TOO_FAR_LOOT_RE);
  if (match?.groups) {
    return { type: 'lootNotice', actor: 'You', target: match.groups.target.trim(), ability: 'Too far to loot', amount: 0, raw: message };
  }

  if (NOTHING_VALUE_RE.test(message)) {
    return { type: 'lootNotice', actor: 'You', target: '', ability: 'Nothing of value', amount: 0, raw: message };
  }

  if (LOOTED_ALL_RE.test(message)) {
    return { type: 'lootNotice', actor: 'You', target: '', ability: 'Looted corpse fully', amount: 0, raw: message };
  }

  match = message.match(QUEST_RECEIVED_RE);
  if (match?.groups) {
    return { type: 'quest', actor: 'You', target: '', ability: match.groups.quest.trim(), amount: 0, raw: message };
  }

  match = message.match(NEW_ABILITY_RE);
  if (match?.groups) {
    return { type: 'unlock', actor: 'You', target: '', ability: match.groups.ability.trim(), amount: 0, raw: message };
  }

  match = message.match(DESTROYED_RE);
  if (match?.groups) {
    return { type: 'system', actor: '', target: match.groups.target.trim(), ability: 'Destroyed', amount: 0, raw: message };
  }

  return null;
}

function createInsight(name) {
  return {
    name,
    heals: 0,
    performs: 0,
    utilities: 0,
    directSources: 0,
    distinctAbilities: new Set(),
    targetCount: 0,
    role: 'unknown',
    suggestedPlayer: false,
    reasons: [],
  };
}

function buildActorInsights(events) {
  const map = new Map();
  const ensure = (name) => {
    if (!name) return null;
    if (!map.has(name)) map.set(name, createInsight(name));
    return map.get(name);
  };

  for (const event of events) {
    const actor = ensure(event.actor);
    const target = ensure(event.target);
    if (actor) {
      if (['attack', 'heal', 'perform', 'utility'].includes(event.type)) actor.directSources += 1;
      if (event.type === 'heal') actor.heals += 1;
      if (event.type === 'perform') actor.performs += 1;
      if (event.type === 'utility') actor.utilities += 1;
      if (event.ability) actor.distinctAbilities.add(event.ability);
    }
    if (target) target.targetCount += 1;
  }

  return Array.from(map.values()).map((entry) => {
    const name = entry.name;
    const isSingleToken = !name.includes(' ');
    const hardNpc = /^corpse of /i.test(name) || /^(a|an|the)\s+/i.test(name) || /^(AT-ST|AT-AT)$/i.test(name);
    const playerSignals = [
      isSingleToken,
      entry.directSources >= 3,
      entry.heals > 0 || entry.performs > 0,
      entry.distinctAbilities.size >= 2,
    ].filter(Boolean).length;
    const targetHeavy = entry.targetCount > entry.directSources * 2;
    const suggestedPlayer = !hardNpc && isSingleToken && playerSignals >= 2 && !targetHeavy;
    const reasons = [];
    if (isSingleToken) reasons.push('combat short-name');
    if (entry.directSources >= 3) reasons.push('repeated source activity');
    if (entry.heals > 0) reasons.push('healing/support actions');
    if (entry.performs > 0) reasons.push('ability usage');
    if (targetHeavy) reasons.push('mostly seen as target');
    if (hardNpc) reasons.push('npc-style name');
    return {
      ...entry,
      distinctAbilities: entry.distinctAbilities.size,
      suggestedPlayer,
      reasons,
    };
  }).sort((a, b) => Number(b.suggestedPlayer) - Number(a.suggestedPlayer) || b.directSources - a.directSources || a.name.localeCompare(b.name));
}

function classifyActors(events) {
  const insights = buildActorInsights(events);
  const map = new Map();
  for (const entry of insights) {
    let role = 'unknown';
    if (entry.suggestedPlayer) role = 'player';
    else if (/^corpse of /i.test(entry.name) || /^(a|an|the)\s+/i.test(entry.name) || /^(AT-ST|AT-AT)$/i.test(entry.name) || entry.targetCount > entry.directSources * 2) role = 'npc';
    map.set(entry.name, role);
  }
  return map;
}

function aggregateEncounterAbilities(events) {
  const map = new Map();
  for (const event of events) {
    if (!event.actor || !event.ability || !['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type)) continue;
    const key = `${event.actor}__${event.ability}`;
    if (!map.has(key)) {
      map.set(key, { actor: event.actor, ability: event.ability, uses: 0, damage: 0, healing: 0 });
    }
    const record = map.get(key);
    record.uses += 1;
    if (event.type === 'attack') record.damage += event.amount;
    if (event.type === 'dot') record.damage += event.amount;
    if (event.type === 'heal') record.healing += event.amount;
  }
  return Array.from(map.values()).sort((a, b) => b.damage + b.healing - (a.damage + a.healing) || b.uses - a.uses || a.ability.localeCompare(b.ability));
}

function summarizeEncounter(encounter, number, roleMap) {
  const actorMap = new Map();
  const targetSet = new Set();
  const targetDamage = new Map();
  let directDamage = 0;
  let dotDamage = 0;
  let healing = 0;
  let credits = 0;
  let lootItems = 0;

  for (const event of encounter.events) {
    if (event.target) targetSet.add(event.target);
    const bucket = getActorBucket(actorMap, event.actor, roleMap.get(event.actor) || 'unknown');
    if (!bucket) continue;

    if (event.type === 'attack') {
      bucket.actionCount += 1;
      bucket.activeActionCount += 1;
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
      bumpAbility(bucket, event.ability || 'Basic Attack', { uses: 1, directDamage: event.amount, hits: event.outcome === 'hits' || event.outcome === 'strikes through' ? 1 : 0, crits: event.outcome === 'crits' ? 1 : 0, glances: event.outcome === 'glances' ? 1 : 0, misses: event.outcome === 'misses' ? 1 : 0 });
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
      bucket.activeActionCount += 1;
      bucket.healing += event.amount;
      healing += event.amount;
      bumpAbility(bucket, event.ability, { uses: 1, healing: event.amount });
    } else if (event.type === 'perform') {
      bucket.actionCount += 1;
      bucket.activeActionCount += 1;
      bucket.performs += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'utility') {
      bucket.actionCount += 1;
      if (event.countsAsAction) bucket.activeActionCount += 1;
      bucket.utility += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'groupCredits' || event.type === 'lootCredits') {
      credits += event.amount;
    } else if (event.type === 'lootItem') {
      lootItems += 1;
    }
  }

  const actors = Array.from(actorMap.values()).map((actor) => ({
    ...actor,
    totalDamage: actor.directDamage + actor.dotDamage,
    abilities: finalizeAbilityMap(actor),
    items: finalizeItemMap(actor),
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
    label: dominantNpc ? `${dominantNpc} · ${number}` : `Encounter ${number}${topActor ? ` · ${topActor}` : ''}`,
    startTime: encounter.startTime,
    endTime: encounter.endTime,
    durationSec,
    eventCount: encounter.events.length,
    directDamage,
    dotDamage,
    totalDamage,
    healing,
    credits,
    lootItems,
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
      current = { id: `enc-${encounters.length + 1}`, startEpochSec: event.epochSec, endEpochSec: event.epochSec, lastEpochSec: event.epochSec, startTime: event.timestamp, endTime: event.timestamp, events: [] };
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
  let splitCredits = 0;
  let lootedCredits = 0;
  let lootItemCount = 0;
  const uniqueItems = new Set();
  let questCount = 0;
  let abilityUnlockCount = 0;
  let lootNoticeCount = 0;
  let systemNoticeCount = 0;

  for (const event of events) {
    const bucket = getActorBucket(actorMap, event.actor, roleMap.get(event.actor) || 'unknown');
    if (event.type === 'attack') {
      bucket.actionCount += 1;
      bucket.activeActionCount += 1;
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
      bumpAbility(bucket, event.ability || 'Basic Attack', { uses: 1, directDamage: event.amount, hits: event.outcome === 'hits' || event.outcome === 'strikes through' ? 1 : 0, crits: event.outcome === 'crits' ? 1 : 0, glances: event.outcome === 'glances' ? 1 : 0, misses: event.outcome === 'misses' ? 1 : 0 });
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
      bucket.activeActionCount += 1;
      bucket.healing += event.amount;
      healing += event.amount;
      bumpAbility(bucket, event.ability, { uses: 1, healing: event.amount });
    } else if (event.type === 'perform') {
      bucket.actionCount += 1;
      bucket.activeActionCount += 1;
      bucket.performs += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'utility') {
      bucket.actionCount += 1;
      if (event.countsAsAction) bucket.activeActionCount += 1;
      bucket.utility += 1;
      bumpAbility(bucket, event.ability, { uses: 1 });
    } else if (event.type === 'groupCredits') {
      sharedCredits += event.amount;
      if (bucket) {
        bucket.sharedCredits += event.amount;
        if (event.subtype === 'splitShare') bucket.splitCredits += event.amount;
      }
      if (event.subtype === 'splitShare') splitCredits += event.amount;
    } else if (event.type === 'lootCredits') {
      lootedCredits += event.amount;
      if (bucket) bucket.lootedCredits += event.amount;
    } else if (event.type === 'lootItem') {
      lootItemCount += 1;
      uniqueItems.add(event.item);
      if (bucket) {
        bucket.lootItems += 1;
        bumpLootItem(bucket, event.item);
      }
    } else if (event.type === 'lootNotice') {
      lootNoticeCount += 1;
      if (bucket) bucket.lootNotices += 1;
    } else if (event.type === 'quest') {
      questCount += 1;
    } else if (event.type === 'unlock') {
      abilityUnlockCount += 1;
    } else if (event.type === 'system') {
      systemNoticeCount += 1;
    }
  }

  const actors = Array.from(actorMap.values()).map((actor) => ({
    ...actor,
    totalDamage: actor.directDamage + actor.dotDamage,
    abilities: finalizeAbilityMap(actor),
    items: finalizeItemMap(actor),
  }));
  actors.sort((a, b) => b.totalDamage - a.totalDamage || b.healing - a.healing || a.name.localeCompare(b.name));

  const looters = actors
    .filter((actor) => actor.lootedCredits > 0 || actor.lootItems > 0 || actor.sharedCredits > 0)
    .sort((a, b) => (b.lootedCredits + b.sharedCredits) - (a.lootedCredits + a.sharedCredits) || b.lootItems - a.lootItems || a.name.localeCompare(b.name));

  const recentLoot = events
    .filter((event) => ['lootCredits', 'lootItem', 'groupCredits', 'lootNotice'].includes(event.type))
    .slice(-120)
    .reverse();

  const totalDurationSec = encounters.reduce((sum, encounter) => sum + encounter.durationSec, 0);

  return {
    totalEvents: events.length,
    combatEventCount: events.filter((event) => ['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type)).length,
    logEventCount: events.filter((event) => !['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type)).length,
    totalDamage: directDamage + dotDamage,
    directDamage,
    dotDamage,
    totalHealing: healing,
    totalSharedCredits: sharedCredits,
    totalSplitCredits: splitCredits,
    totalLootedCredits: lootedCredits,
    totalLootItems: lootItemCount,
    uniqueLootItems: uniqueItems.size,
    lootNoticeCount,
    questCount,
    abilityUnlockCount,
    systemNoticeCount,
    encounterCount: encounters.length,
    actorCount: actors.length,
    totalDurationSec,
    actors,
    looters,
    recentLoot,
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
      const epochSec = sourceOrder * 10000000 + dayOffset + secondsOfDay;

      let parsed = null;
      if (channel === 'Combat') parsed = parseCombatMessage(message);
      if (!parsed) parsed = parseChatMessage(channel, message);
      if (!parsed) continue;

      events.push({ ...parsed, channel, timestamp, epochSec, source: file.name, lineNumber: lineIndex + 1 });
    }

    sourceOrder += 1;
  }

  const dedupeSeen = new Set();
  const dedupedEvents = [];
  for (const event of events) {
    const key = `${event.epochSec}|${event.type}|${event.actor}|${event.target}|${event.ability}|${event.amount}|${event.raw}`;
    if (dedupeSeen.has(key)) continue;
    dedupeSeen.add(key);
    dedupedEvents.push(event);
  }

  dedupedEvents.sort((a, b) => a.epochSec - b.epochSec || a.lineNumber - b.lineNumber);
  const roleMap = classifyActors(dedupedEvents);
  const actorInsights = buildActorInsights(dedupedEvents).map((entry) => ({ ...entry, role: roleMap.get(entry.name) || 'unknown' }));
  const suggestedPlayers = actorInsights.filter((entry) => entry.suggestedPlayer).map((entry) => entry.name);

  dedupedEvents.forEach((event) => {
    event.actorRole = roleMap.get(event.actor) || 'unknown';
    event.targetRole = roleMap.get(event.target) || 'unknown';
  });
  const encounters = buildEncounters(dedupedEvents, roleMap);
  const summary = summarizeAll(dedupedEvents, encounters, roleMap);
  return {
    summary,
    encounters,
    recentEvents: dedupedEvents.slice(-200).reverse(),
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
    self.postMessage({ type: 'error', payload: { message: error instanceof Error ? error.message : 'Failed to parse log files.' } });
  }
};
