// src/parser.worker.ts
var T_TIME = /^(?:\[\s*Combat\s*\]\s*)?(\d{2}):(\d{2}):(\d{2})\s+/i;
var toSec = (hh, mm, ss) => +hh * 3600 + +mm * 60 + +ss;
var RX_DMG_WITH = /^(.+?)\s+attacks\s+(.+?)\s+(?:with|using)\s+(.+?)\s+(?:and\s+(hits|glances|crits|critically\s+hits|critical\s+hits|strikes\s+through|punishing\s+blows))?(?:\s*\((\d+)\s*%(?:\s*evaded)?\))?\s*for\s+(\d+)\s+points/i;
var RX_DMG_BARE = /^(.+?)\s+attacks\s+(.+?)(?:\s+and\s+)?(?:(hits|glances|crits|critically\s+hits|critical\s+hits|strikes\s+through|punishing\s+blows))?(?:\s*\((\d+)\s*%(?:\s*evaded)?\))?\s*for\s+(\d+)\s+points/i;
var RX_DMG_GENERIC = /^(.+?)\s+damages\s+(.+?)\s+for\s+(\d+)\s+points(?:\s+(?:with|using)\s+(.+?))?$/i;
var RX_DMG_DOT = /^(.+?)\s+suffers\s+(\d+)\s+points\s+of\s+damage\s+from\s+(.+?)\s+over\s+time/i;
var RX_DMG_CAUSED = /^(.+?)\s+causes\s+(.+?)\s+to\s+take\s+(\d+)\s+points\s+of\s+damage/i;
var RX_DMG_HAS_CAUSED_ELEM = /^(.+?)\s+has\s+caused\s+(.+?)\s+to\s+take\s+(\d+)\s+points\s+of\s+([a-z]+)\s+damage/i;
var RX_DMG_HAS_CAUSED = /^(.+?)\s+has\s+caused\s+(.+?)\s+to\s+take\s+(\d+)\s+points\s+of\s+damage/i;
var RX_MISSES_PAREN = /^(.+?)\s+attacks\s+(.+?)(?:\s+(?:with|using)\s+.+?)?\s+(?:and\s+)?misses\s*\((dodge|parry|parries)\)\.?$/i;
var RX_DODGE_PARRY_1 = /^(.+?)\s+attacks\s+(.+?)\s+(?:with|using)\s+.*?(?:,?\s+)?(?:but|and)\s+\2\s+(dodges|parries)\b/i;
var RX_DODGE_PARRY_2 = /^(.+?)\s+attacks\s+(.+?)(?:\s+(?:but|and))\s+\2\s+(dodges|parries)\b/i;
var RX_DODGE_PARRY_3 = /^(.+?)\s+(dodges|parries)\s+(.+?)'?s?\s+attack\b/i;
var RX_DODGE_PARRY_4 = /^(.+?)'?s?\s+attack\s+(?:is|was)\s+(dodged|parried)\s+by\s+(.+?)\b/i;
var RX_HEAL = /^(.+?)\s+heals\s+(.+?)\s+for\s+(\d+)\s+points(?:\s+with\s+(.+))?/i;
var RX_DEATH = /^(.+?)\s+is\s+no\s+more\./i;
var RX_PERFORM = /^(.+?)\s+performs\s+(.+?)\.?\s*$/i;
var RX_POINTS_BLOCKED = /\((?:[^)]*?,\s*)?(\d+)\s+points\s+blocked\)/i;
var RX_ARMOR_ABSORB = /Armor\s+absorbed\s+(\d+)\s+points\s+out\s+of\s+(\d+)/i;
var RX_ABSORB_SIMPLE = /\((\d+)\s+absorbed(?:\s*\/\s*(\d+)\s+resisted\.?)*\)/i;
var RX_EVADED_PCT = /\((\d+)\s*%(?:\s*evaded)?\)/i;
var ELEMENT_ALIASES = {
  kinetic: "kinetic",
  kin: "kinetic",
  energy: "energy",
  heat: "heat",
  fire: "heat",
  cold: "cold",
  acid: "acid",
  electricity: "electricity",
  electric: "electricity",
  poison: "poison"
};
function parseElementTupleList(s) {
  const out = {};
  const parts = s.split(/\s*(?:,|and)\s*/i).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/(\d+)\s*([a-z]+)/i);
    if (!m) continue;
    const n = +m[1];
    const raw = m[2].toLowerCase();
    const key = ELEMENT_ALIASES[raw] ?? raw;
    out[key] = (out[key] || 0) + n;
  }
  return out;
}
function extractElementsFromRest(rest) {
  const mParen = rest.match(/for\s+\d+\s+points\s*\(([^)]+)\)/i);
  if (mParen && mParen[1] && !/\bpoints\s+blocked\b/i.test(mParen[1])) {
    const parsed = parseElementTupleList(mParen[1]);
    if (Object.keys(parsed).length) return parsed;
  }
  const mSingle = rest.match(/for\s+(\d+)\s+(kinetic|energy|heat|cold|acid|electricity|electric|poison)s?\b/i);
  if (mSingle) {
    const amt = +mSingle[1];
    const key = ELEMENT_ALIASES[mSingle[2].toLowerCase()] ?? mSingle[2].toLowerCase();
    return { [key]: amt };
  }
  return void 0;
}
function clean(s) {
  return (s || "").trim();
}
function normActor(s) {
  return /^(with|using)\s/i.test(s) ? "" : s.trim();
}
function normalizeAbilityName(raw) {
  if (!raw) return "";
  let s = raw.toLowerCase().trim();
  s = s.replace(/^(with|using)\s+/, "");
  s = s.replace(
    /\s+and\s+(?:\d+\s+points\s+blocked|(?:strikes\s+through|hits|glances|crits)(?:\s+\(\d+%.*?\))?)/g,
    ""
  );
  s = s.replace(/[\(\[][^)\]]*[\)\]]/g, "");
  s = s.replace(/\bmark\s*\d+\b/gi, "").replace(/\b[ivxlcdm]+\b/gi, "").replace(/\b\d+\b/g, "");
  s = s.replace(/[:\-–—]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}
var ABILITY_ELEMENT_HINTS = {
  "plasma mine": { heat: 1 },
  "focused beam": { energy: 1 },
  "force lightning": { electricity: 1 },
  "force shockwave": { kinetic: 1 },
  "maelstrom": { electricity: 1 }
};
function hintedElementsForAbility(abilityNorm, totalDamage) {
  const hint = ABILITY_ELEMENT_HINTS[abilityNorm];
  if (!hint) return {};
  const out = {};
  let sum = 0;
  for (const v of Object.values(hint)) sum += Number(v || 0);
  if (sum <= 0) return {};
  for (const [k, ratio] of Object.entries(hint)) {
    out[k] = totalDamage * (Number(ratio || 0) / sum);
  }
  return out;
}
var RX_NPC_PREFIX = /^(?:a|an|the)\s+/i;
function looksLikeNPC(name) {
  return RX_NPC_PREFIX.test((name || "").trim());
}
function canonicalizeNPCName(name) {
  let s = (name || "").trim().replace(/\s+/g, " ");
  const m = s.match(RX_NPC_PREFIX);
  if (m) {
    const art = m[0].trim().toLowerCase();
    const cap = art === "a" ? "A " : art === "an" ? "An " : "The ";
    s = cap + s.slice(m[0].length);
  }
  return s;
}
var DEFAULT_ALIASES = {
  "Shepard EffectMass": "Shepard",
  "Lurcio Leering-Creeper": "Lurcio"
};
function stripJunk(s) {
  let t = s.replace(/^[`'"]+|[`'"]+$/g, "").replace(/\s+/g, " ").trim();
  t = t.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/, "");
  return t;
}
function normalizeActorAlias(raw, seen, aliases = DEFAULT_ALIASES) {
  const original = stripJunk(raw);
  if (!original) return "";
  const lc = original.toLowerCase();
  if (aliases[original]) return aliases[original];
  if (aliases[lc]) return aliases[lc];
  if (looksLikeNPC(original)) {
    const canon = canonicalizeNPCName(original);
    aliases[lc] = canon;
    return canon;
  }
  const mEffect = original.match(/^([A-Za-z][\w'\-]*)\s+(Effect[\w'-]*)$/i);
  if (mEffect) {
    const baseRaw = mEffect[1];
    const baseLc = baseRaw.toLowerCase();
    const existing = aliases[baseLc] || Array.from(seen).find((n) => n.toLowerCase() === baseLc);
    const canon = existing || baseRaw;
    aliases[original] = canon;
    aliases[lc] = canon;
    aliases[baseLc] = canon;
    return canon;
  }
  const m = original.match(/^(.+?)\s+([A-Za-z][\w'-]+)$/);
  if (m) {
    const base = m[1];
    const baseLc = base.toLowerCase();
    const seenCanon = Array.from(seen).find((n) => n.toLowerCase() === baseLc);
    if (seenCanon) {
      aliases[lc] = seenCanon;
      aliases[original] = seenCanon;
      return seenCanon;
    }
  }
  aliases[lc] = original;
  return original;
}
self.onmessage = async (ev) => {
  try {
    let dedupeConsecutive = function(lines2) {
      const out = [];
      let removed = 0;
      let prev = "";
      for (const ln of lines2) {
        if (ln === prev) {
          removed++;
          continue;
        }
        out.push(ln);
        prev = ln;
      }
      return { lines: out, removed };
    }, ensureDef = function(name) {
      if (!perDef[name])
        perDef[name] = {
          hits: 0,
          glances: 0,
          glanceDamageSum: 0,
          dodges: 0,
          parries: 0
        };
      return perDef[name];
    }, pushDamage = function(t, src, dst, abilityRaw, amount, elementsOverride, flags, blocked, absorbed, preMitTotal, evadedPct) {
      const MAX_REALISTIC_HIT = 6e4;
      if ((amount ?? 0) > MAX_REALISTIC_HIT && !looksLikeNPC(src)) {
        return;
      }
      const abilityKey = normalizeAbilityName(abilityRaw || "attack");
      const elemHint = elementsOverride && Object.keys(elementsOverride).length ? elementsOverride : hintedElementsForAbility(abilityKey, Number(amount || 0));
      const hasElems = elemHint && Object.keys(elemHint).length > 0;
      damageEvents.push({
        t,
        src,
        dst,
        ability: abilityRaw || abilityKey || "attack",
        amount,
        flags,
        blocked,
        absorbed,
        preMitTotal,
        evadedPct,
        ...hasElems ? { elements: elemHint } : {}
      });
      if (amount > 0) {
        if (!dpsByActor[src]) dpsByActor[src] = [];
        dpsByActor[src][t] = (dpsByActor[src][t] || 0) + amount;
        if (!perAbility[src]) perAbility[src] = {};
        if (!perAbility[src][abilityKey]) perAbility[src][abilityKey] = { hits: 0, dmg: 0, max: 0 };
        const pa = perAbility[src][abilityKey];
        pa.hits++;
        pa.dmg += amount;
        if (amount > pa.max) pa.max = amount;
        if (!perAbilityTargets[src]) perAbilityTargets[src] = {};
        if (!perAbilityTargets[src][abilityKey]) perAbilityTargets[src][abilityKey] = {};
        if (!perAbilityTargets[src][abilityKey][dst]) perAbilityTargets[src][abilityKey][dst] = { hits: 0, dmg: 0, max: 0 };
        const pt = perAbilityTargets[src][abilityKey][dst];
        pt.hits++;
        pt.dmg += amount;
        if (amount > pt.max) pt.max = amount;
        if (src !== dst) {
          perTaken[dst] = (perTaken[dst] || 0) + amount;
          if (!perTakenBy[dst]) perTakenBy[dst] = {};
          perTakenBy[dst][src] = (perTakenBy[dst][src] || 0) + amount;
          const d2 = ensureDef(dst);
          if (flags === "glance") {
            d2.glances += 1;
            d2.glanceDamageSum += amount;
          } else if (flags !== "periodic") {
            d2.hits += 1;
            if (amount > 0 && flags !== "periodic") {
              lastDamageSourceForTarget[dst] = src;
            }
          }
        }
      }
      if (!flags && abilityKey) {
        lastCasterForDot[`${abilityKey}||${dst}`] = src;
      }
    }, pushOutcome = function(t, src, dst, flag) {
      damageEvents.push({ t, src, dst, ability: "attack", amount: 0, flags: flag });
      if (src !== dst) {
        const d2 = ensureDef(dst);
        if (flag === "dodge") d2.dodges += 1;
        else d2.parries += 1;
      }
    }, pushHeal = function(t, src, dst, abilityRaw, amount) {
      healEvents.push({ t, src, dst, ability: abilityRaw, amount });
      if (!hpsByActor[src]) hpsByActor[src] = [];
      hpsByActor[src][t] = (hpsByActor[src][t] || 0) + amount;
    };
    let textStr = "";
    let collectUnparsed = false;
    const d = ev && ev.data ? ev.data : void 0;
    if (typeof d === "string") {
      textStr = d;
    } else if (d && typeof d === "object") {
      if (d.type === "parse") {
        textStr = d.text ?? "";
        collectUnparsed = !!d.collectUnparsed;
      } else {
        textStr = d.text ?? "";
        collectUnparsed = !!d.collectUnparsed;
      }
    }
    self.postMessage({ type: "progress", done: 0, total: 1 });
    const rawText = String(textStr ?? "");
    const rawLines = rawText.replace(/\r\n?/g, "\n").split("\n");
    const { lines, removed: duplicatesDropped } = dedupeConsecutive(rawLines);
    let baseAbs = null;
    let maxAbs = 0, parsed = 0;
    const damageEvents = [];
    const healEvents = [];
    const utilityEvents = [];
    const deathEvents = [];
    const unparsed = [];
    const dpsByActor = {};
    const hpsByActor = {};
    const perAbility = {};
    const perAbilityTargets = {};
    const perTaken = {};
    const perTakenBy = {};
    const lastCasterForDot = {};
    const lastDamageSourceForTarget = {};
    const seenActors = /* @__PURE__ */ new Set();
    const aliasMap = DEFAULT_ALIASES;
    const perDef = {};
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const tm = T_TIME.exec(raw);
      if (!tm) {
        if (collectUnparsed) unparsed.push(raw);
        continue;
      }
      const abs = toSec(tm[1], tm[2], tm[3]);
      if (baseAbs === null) baseAbs = abs;
      const t = abs - baseAbs;
      if (t > maxAbs) maxAbs = t;
      const rest = raw.slice(tm[0].length).trim();
      let m;
      if (m = RX_DEATH.exec(rest)) {
        const name = (m[1] || "").trim();
        deathEvents.push({ t, name });
        continue;
        if (m = RX_PERFORM.exec(rest)) {
          const src = (m[1] || "").trim();
          const ability = (m[2] || "").trim();
          if (src && ability) utilityEvents.push({ t, src, ability });
          continue;
        }
      }
      const normNames = (srcRaw, dstRaw) => {
        const src0 = normActor(clean(srcRaw));
        const dst0 = clean(dstRaw);
        const src = src0 ? normalizeActorAlias(src0, seenActors, aliasMap) : "";
        const dst = normalizeActorAlias(dst0, seenActors, aliasMap);
        if (src && !looksLikeNPC(src)) seenActors.add(src);
        if (dst && !looksLikeNPC(dst)) seenActors.add(dst);
        return { src, dst };
      };
      if (m = RX_MISSES_PAREN.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const kind = (m[3] || "").toLowerCase();
        if (src) {
          const flag = kind.startsWith("dodg") ? "dodge" : "parry";
          pushOutcome(t, src, dst, flag);
          parsed++;
          continue;
        }
      }
      if (m = RX_DODGE_PARRY_1.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const flag = (m[3] || "").toLowerCase();
        if (src) {
          pushOutcome(t, src, dst, flag === "dodges" ? "dodge" : "parry");
          parsed++;
          continue;
        }
      }
      if (m = RX_DODGE_PARRY_2.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const flag = (m[3] || "").toLowerCase();
        if (src) {
          pushOutcome(t, src, dst, flag === "dodges" ? "dodge" : "parry");
          parsed++;
          continue;
        }
      }
      if (m = RX_DODGE_PARRY_3.exec(rest)) {
        const dst = normalizeActorAlias(clean(m[1]), seenActors, aliasMap);
        const flag = (m[2] || "").toLowerCase();
        const src = normalizeActorAlias(clean(m[3]), seenActors, aliasMap);
        if (src && dst) {
          pushOutcome(t, src, dst, flag === "dodges" ? "dodge" : "parry");
          parsed++;
          continue;
        }
      }
      if (m = RX_DODGE_PARRY_4.exec(rest)) {
        const src = normalizeActorAlias(clean(m[1]), seenActors, aliasMap);
        const flagPast = (m[2] || "").toLowerCase();
        const dst = normalizeActorAlias(clean(m[3]), seenActors, aliasMap);
        if (src && dst) {
          pushOutcome(t, src, dst, flagPast === "dodged" ? "dodge" : "parry");
          parsed++;
          continue;
        }
      }
      const blockedMatch = rest.match(RX_POINTS_BLOCKED);
      const blockedAmt = blockedMatch ? +blockedMatch[1] : void 0;
      const absorbMatch = rest.match(RX_ARMOR_ABSORB);
      let absorbedAmt = absorbMatch ? +absorbMatch[1] : void 0;
      let preMitTotal = absorbMatch ? +absorbMatch[2] : void 0;
      const simpleAbsorb = rest.match(RX_ABSORB_SIMPLE);
      if (absorbedAmt == null && simpleAbsorb) {
        absorbedAmt = +simpleAbsorb[1];
      }
      const evadedScan = rest.match(RX_EVADED_PCT);
      const evadedFromScan = evadedScan ? +evadedScan[1] : void 0;
      const elems = extractElementsFromRest(rest);
      if (m = RX_DMG_WITH.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const ability = clean(m[3]);
        const kindRaw = (m[4] || "").toLowerCase().replace(/\s+/g, " ");
        const evadedPct = m[5] ? +m[5] : evadedFromScan;
        const amount = +m[6];
        if (amount > 6e4) {
          parsed++;
          continue;
        }
        const flag = kindRaw === "crits" || kindRaw === "critically hits" || kindRaw === "critical hits" ? "crit" : kindRaw === "hits" ? "hit" : kindRaw === "glances" ? "glance" : kindRaw.startsWith("strikes through") ? "strikethrough" : void 0;
        if (src) {
          pushDamage(
            t,
            src,
            dst,
            ability,
            amount,
            elems,
            flag,
            blockedAmt,
            absorbedAmt,
            preMitTotal,
            evadedPct
          );
          parsed++;
          continue;
        }
      }
      if (m = RX_DMG_BARE.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const kindRaw = (m[3] || "").toLowerCase().replace(/\s+/g, " ");
        const evadedPct = m[4] ? +m[4] : evadedFromScan;
        const amount = +m[5];
        if (amount > 6e4) {
          parsed++;
          continue;
        }
        const flag = kindRaw === "crits" || kindRaw === "critically hits" || kindRaw === "critical hits" ? "crit" : kindRaw === "hits" ? "hit" : kindRaw === "glances" ? "glance" : kindRaw.startsWith("strikes through") ? "strikethrough" : void 0;
        if (src) {
          pushDamage(
            t,
            src,
            dst,
            "attack",
            amount,
            elems,
            flag,
            blockedAmt,
            absorbedAmt,
            preMitTotal,
            evadedPct
          );
          parsed++;
          continue;
        }
      }
      if (m = RX_DMG_GENERIC.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const amount = +m[3];
        if (amount > 6e4) {
          parsed++;
          continue;
        }
        const ability = clean(m[4] || "attack");
        if (src) {
          pushDamage(
            t,
            src,
            dst,
            ability,
            amount,
            elems,
            void 0,
            blockedAmt,
            absorbedAmt,
            preMitTotal,
            evadedFromScan
          );
          parsed++;
          continue;
        }
      }
      if (m = RX_DMG_DOT.exec(rest)) {
        const dstNormOnly = normalizeActorAlias(clean(m[1]), seenActors, aliasMap);
        if (dstNormOnly && !looksLikeNPC(dstNormOnly)) seenActors.add(dstNormOnly);
        const amount = +m[2];
        if (amount > 6e4) {
          parsed++;
          continue;
        }
        const abilityRaw = clean(m[3]);
        const key = normalizeAbilityName(abilityRaw);
        const caster = lastCasterForDot[`${key}||${dstNormOnly}`] || lastDamageSourceForTarget[dstNormOnly] || "";
        pushDamage(
          t,
          caster || key || "Periodic",
          dstNormOnly,
          abilityRaw,
          amount,
          void 0,
          // no explicit elements
          "periodic"
        );
        parsed++;
        continue;
      }
      if (m = RX_DMG_HAS_CAUSED_ELEM.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const amount = +m[3];
        const rawEl = (m[4] || "").toLowerCase();
        const elemKey = ELEMENT_ALIASES[rawEl] || rawEl;
        const elemsOverride = { [elemKey]: amount };
        if (src) {
          pushDamage(t, src, dst, "Periodic", amount, elemsOverride, "periodic");
          parsed++;
          continue;
        }
      }
      if (m = RX_DMG_HAS_CAUSED.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const amount = +m[3];
        if (src) {
          pushDamage(t, src, dst, "Periodic", amount, void 0, "periodic");
          parsed++;
          continue;
        }
      }
      if (m = RX_DMG_CAUSED.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const amount = +m[3];
        if (amount > 6e4) {
          parsed++;
          continue;
        }
        const dtype = "Periodic";
        if (src) {
          pushDamage(t, src, dst, dtype, amount, void 0, "periodic");
          parsed++;
          continue;
        }
      }
      if (m = RX_HEAL.exec(rest)) {
        const { src, dst } = normNames(m[1], m[2]);
        const amount = +m[3];
        const ability = clean(m[4] || "");
        if (src) {
          pushHeal(t, src, dst, ability, amount);
          parsed++;
          continue;
        }
      }
      if (collectUnparsed) unparsed.push(raw);
    }
    (function mergeNamesByFirstToken() {
      const firstToken = (n) => (n || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
      const allTopLevel = /* @__PURE__ */ new Set([
        ...Object.keys(dpsByActor),
        ...Object.keys(hpsByActor),
        ...Object.keys(perAbility),
        ...Object.keys(perTaken),
        ...Object.keys(perTakenBy || {})
      ]);
      const groups = {};
      for (const n of allTopLevel) {
        const ft = firstToken(n);
        if (!ft) continue;
        (groups[ft] ||= []).push(n);
      }
      const CANON = {};
      for (const [ft, list] of Object.entries(groups)) {
        const singles = list.filter((n) => !/\s/.test(n));
        if (singles.length === 0) continue;
        const canon = singles[0];
        for (const n of list) CANON[n] = canon;
      }
      const mapName = (n) => CANON[n] || n;
      function mergeSeriesInPlace(byActor) {
        const out = {};
        for (const name of Object.keys(byActor)) {
          const c = mapName(name);
          const series = byActor[name] || [];
          const arr = out[c] || (out[c] = []);
          const L = Math.max(arr.length, series.length);
          for (let i = 0; i < L; i++) arr[i] = (arr[i] || 0) + (series[i] || 0);
        }
        for (const k of Object.keys(byActor)) delete byActor[k];
        for (const k of Object.keys(out)) byActor[k] = out[k];
      }
      mergeSeriesInPlace(dpsByActor);
      mergeSeriesInPlace(hpsByActor);
      {
        const out = {};
        for (const src of Object.keys(perAbility)) {
          const csrc = mapName(src);
          const abil = perAbility[src];
          const dstA = out[csrc] || (out[csrc] = {});
          for (const ab of Object.keys(abil)) {
            const s = abil[ab];
            const t = dstA[ab] || (dstA[ab] = { hits: 0, dmg: 0, max: 0 });
            t.hits += s.hits;
            t.dmg += s.dmg;
            if (s.max > t.max) t.max = s.max;
          }
        }
        for (const k of Object.keys(perAbility)) delete perAbility[k];
        for (const k of Object.keys(out)) perAbility[k] = out[k];
      }
      {
        const out = {};
        for (const src of Object.keys(perAbilityTargets || {})) {
          const csrc = mapName(src);
          const byAb = perAbilityTargets[src];
          const outSrc = out[csrc] || (out[csrc] = {});
          for (const ab of Object.keys(byAb)) {
            const byDst = byAb[ab];
            const outAb = outSrc[ab] || (outSrc[ab] = {});
            for (const dst of Object.keys(byDst)) {
              const cdst = mapName(dst);
              const s = byDst[dst];
              const t = outAb[cdst] || (outAb[cdst] = { hits: 0, dmg: 0, max: 0 });
              t.hits += s.hits;
              t.dmg += s.dmg;
              if (s.max > t.max) t.max = s.max;
            }
          }
        }
        for (const k of Object.keys(perAbilityTargets || {})) delete perAbilityTargets[k];
        for (const k of Object.keys(out)) perAbilityTargets[k] = out[k];
      }
      {
        const outT = {};
        for (const dst of Object.keys(perTaken || {})) {
          const cdst = mapName(dst);
          outT[cdst] = (outT[cdst] || 0) + perTaken[dst];
        }
        for (const k of Object.keys(perTaken || {})) delete perTaken[k];
        for (const k of Object.keys(outT)) perTaken[k] = outT[k];
        const outTB = {};
        for (const dst of Object.keys(perTakenBy || {})) {
          const cdst = mapName(dst);
          const srcMap = perTakenBy[dst];
          const outDst = outTB[cdst] || (outTB[cdst] = {});
          for (const src of Object.keys(srcMap)) {
            const csrc = mapName(src);
            outDst[csrc] = (outDst[csrc] || 0) + srcMap[src];
          }
        }
        for (const k of Object.keys(perTakenBy || {})) delete perTakenBy[k];
        for (const k of Object.keys(outTB)) perTakenBy[k] = outTB[k];
      }
      {
        const out = {};
        for (const name of Object.keys(perDef || {})) {
          const c = mapName(name);
          const s = perDef[name];
          const t = out[c] || (out[c] = { hits: 0, glances: 0, glanceDamageSum: 0, dodges: 0, parries: 0 });
          t.hits += s.hits;
          t.glances += s.glances;
          t.glanceDamageSum += s.glanceDamageSum;
          t.dodges += s.dodges;
          t.parries += s.parries;
        }
        for (const k of Object.keys(perDef || {})) delete perDef[k];
        for (const k of Object.keys(out)) perDef[k] = out[k];
      }
      for (const e of damageEvents || []) {
        e.src = mapName(e.src);
        e.dst = mapName(e.dst);
      }
      for (const e of healEvents || []) {
        e.src = mapName(e.src);
        e.dst = mapName(e.dst);
      }
    })();
    const actors = /* @__PURE__ */ new Set([
      ...Object.keys(dpsByActor),
      ...Object.keys(hpsByActor)
    ]);
    const rows = [];
    const tl = [];
    for (let sec = 0; sec <= maxAbs; sec++) {
      let d2 = 0, h = 0;
      for (const a of Object.keys(dpsByActor)) d2 += dpsByActor[a][sec] || 0;
      for (const a of Object.keys(hpsByActor)) h += hpsByActor[a][sec] || 0;
      tl.push({ t: sec, dps: d2, hps: h });
    }
    for (const a of actors) {
      let d2 = 0, h = 0;
      const dps = dpsByActor[a] || [];
      const hps = hpsByActor[a] || [];
      for (let sec = 0; sec <= maxAbs; sec++) {
        d2 += dps[sec] || 0;
        h += hps[sec] || 0;
      }
      rows.push({
        name: a,
        damageDealt: d2,
        healingDone: h,
        avgDps: d2 / Math.max(1, maxAbs)
      });
    }
    const defenseDerived = {};
    for (const [defender, v] of Object.entries(perDef)) {
      const landedTotal = v.hits + v.glances;
      const attempts = landedTotal + v.dodges + v.parries;
      const denomGlance = v.hits + v.glances;
      defenseDerived[defender] = {
        // glancing
        hitsTaken: v.hits,
        glanceCount: v.glances,
        glanceChancePct: denomGlance ? v.glances / denomGlance * 100 : 0,
        avgGlance: v.glances ? v.glanceDamageSum / v.glances : 0,
        // attempts-based chances
        attempts,
        dodgeCount: v.dodges,
        parryCount: v.parries,
        dodgeChancePct: attempts ? v.dodges / attempts * 100 : 0,
        parryChancePct: attempts ? v.parries / attempts * 100 : 0
      };
    }
    const payload = {
      rows,
      tl,
      perSrc: dpsByActor,
      perAbility,
      perAbilityTargets,
      perTaken,
      perTakenBy,
      defense: perDef,
      // raw tallies
      defenseDerived,
      // ready-to-render numbers (Flow-consistent)
      duration: maxAbs,
      debug: {
        parsed,
        totalLines: rawLines.length,
        uniqueLines: lines.length,
        duplicatesDropped,
        duration: maxAbs,
        unparsed: collectUnparsed ? unparsed.length : 0
      },
      damageEvents,
      healEvents,
      deathEvents,
      utilityEvents
    };
    self.postMessage({ type: "done", payload });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: String(err && err.message || err || "Unknown error")
    });
  }
};
