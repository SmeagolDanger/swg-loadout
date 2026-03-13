export const ENT_BUFF_POINTS_MAX = 20;
export const ENT_BUFF_REQUEST_TEMPLATE_DEFAULT = '/tt Could you buff me with %Buffs%, please?';

export const ENT_BUFF_CATEGORIES = [
  {
    name: 'Attributes',
    buffs: [
      { name: 'Agility', cost: 1, maxAssignments: 10, effect: 30, description: '30 to attribute per package', prefix: '+', suffix: ' to agility attribute' },
      { name: 'Constitution', cost: 1, maxAssignments: 10, effect: 30, description: '30 to attribute per package', prefix: '+', suffix: ' to constitution attribute' },
      { name: 'Luck', cost: 1, maxAssignments: 10, effect: 30, description: '30 to attribute per package', prefix: '+', suffix: ' to luck attribute' },
      { name: 'Precision', cost: 1, maxAssignments: 10, effect: 30, description: '30 to attribute per package', prefix: '+', suffix: ' to precision attribute' },
      { name: 'Stamina', cost: 1, maxAssignments: 10, effect: 30, description: '30 to attribute per package', prefix: '+', suffix: ' to stamina attribute' },
      { name: 'Strength', cost: 1, maxAssignments: 10, effect: 30, description: '30 to attribute per package', prefix: '+', suffix: ' to strength attribute' },
    ],
  },
  {
    name: 'Combat',
    buffs: [
      { name: 'Action Cost Reduction', cost: 5, maxAssignments: 1, effect: 9, description: '9% bonus per package in reducing all action costs', prefix: '', suffix: '% bonus in reducing all action costs' },
      { name: 'Critical Hit', cost: 5, maxAssignments: 1, effect: 7, description: '7% bonus per package to critical hit chance', prefix: '', suffix: '% bonus to critical hit chance' },
      { name: 'Critical Hit Defense', cost: 5, maxAssignments: 1, effect: 7, description: '7% bonus per package to critical hit defense', prefix: '', suffix: '% bonus to critical hit defense' },
      { name: 'Glancing Blow', cost: 5, maxAssignments: 1, effect: 7, description: '7% bonus per package to glancing blow', prefix: '', suffix: '% bonus to glancing blow' },
    ],
  },
  {
    name: 'Miscellaneous',
    buffs: [
      { name: 'Flush With Success', cost: 2, maxAssignments: 5, effect: 3, description: '3% increase per package in the amount of experience and GCW points earned (ground and space)', prefix: '', suffix: '% increased experience gain' },
      { name: 'Harvest Faire', cost: 2, maxAssignments: 5, effect: 1, description: '1% increase per package on the number of resources gathered with harvesters', prefix: '', suffix: '% increase on the number of resources gathered with harvesters' },
      { name: 'Healer', cost: 2, maxAssignments: 5, effect: 3, description: 'Increase the strength of your heals by 3% per package', prefix: 'Increase the strength of your healing by ', suffix: '%' },
      { name: 'Resilience', cost: 2, maxAssignments: 5, effect: 4, description: 'Reduce the amount of damage received by damage over time effects by 4% per package', prefix: 'Damage received by damage over time effects reduced by ', suffix: '%' },
      { name: 'Go With The Flow', cost: 2, maxAssignments: 5, effect: 5, description: 'Increase all movement rates by 5% per package', prefix: '', suffix: '% increase to all movement rates' },
      { name: 'Second Chance', cost: 2, maxAssignments: 4, effect: 6, description: '6% chance per package to automatically heal damage when hit in combat', prefix: '', suffix: '% chance to automatically heal damage when struck in combat' },
      { name: 'Camouflage Detection', cost: 1, maxAssignments: 5, effect: 20, description: '+20 increase in Camouflage Detection per package.', prefix: '+', suffix: ' increase in Camouflage Detection.' },
    ],
  },
  {
    name: 'Resistances',
    buffs: [
      { name: 'Elemental', cost: 1, maxAssignments: 5, effect: 750, description: '750 to resistance per package', prefix: '+', suffix: ' to resistance' },
      { name: 'Energy', cost: 1, maxAssignments: 5, effect: 750, description: '750 to resistance per package', prefix: '+', suffix: ' to Energy protection' },
      { name: 'Kinetic', cost: 1, maxAssignments: 5, effect: 750, description: '750 to resistance per package', prefix: '+', suffix: ' to Kinetic protection' },
    ],
  },
  {
    name: 'Trade',
    buffs: [
      { name: 'Crafting Assembly', cost: 2, maxAssignments: 5, effect: 2, description: '+2 increase to Assembly and Experience gain for all types of crafting per package', prefix: '+', suffix: ' increase to Assembly and Experience gain for all types of crafting' },
      { name: 'Amazing Success Chance', cost: 5, maxAssignments: 2, effect: 2, description: '2% bonus to Amazing Success crafting results per package', prefix: '', suffix: '% bonus to Amazing Success crafting results' },
      { name: 'Hand Sampling', cost: 2, maxAssignments: 5, effect: 4, description: '4% increase to the number of resources gathered through hand sampling per package', prefix: '', suffix: '% increase to the number of resources gathered through hand sampling' },
      { name: 'Reverse Engineering Efficiency', cost: 5, maxAssignments: 2, effect: 20, description: '+20 increase in Reverse Engineering Efficiency per package.', prefix: '+', suffix: ' increase in Reverse Engineering Efficiency' },
    ],
  },
];

export function cloneEntBuffCategories() {
  return ENT_BUFF_CATEGORIES.map((category) => ({
    ...category,
    buffs: category.buffs.map((buff) => ({ ...buff, assignments: 0 })),
  }));
}

export function flattenEntBuffs(categories) {
  return categories.flatMap((category) => category.buffs);
}

export function calculateAssignedPoints(categories) {
  return flattenEntBuffs(categories).reduce((sum, buff) => sum + buff.cost * buff.assignments, 0);
}

export function canIncreaseBuff(categories, buff, pointsMax = ENT_BUFF_POINTS_MAX) {
  if (!buff) return false;
  if (buff.assignments >= buff.maxAssignments) return false;
  return calculateAssignedPoints(categories) + buff.cost <= pointsMax;
}

export function updateBuffAssignments(categories, buffName, delta, pointsMax = ENT_BUFF_POINTS_MAX) {
  return categories.map((category) => ({
    ...category,
    buffs: category.buffs.map((buff) => {
      if (buff.name !== buffName) return buff;
      if (delta > 0 && !canIncreaseBuff(categories, buff, pointsMax)) return buff;
      const nextAssignments = Math.max(0, Math.min(buff.maxAssignments, buff.assignments + delta));
      return { ...buff, assignments: nextAssignments };
    }),
  }));
}

export function clearEntBuffAssignments(categories) {
  return categories.map((category) => ({
    ...category,
    buffs: category.buffs.map((buff) => ({ ...buff, assignments: 0 })),
  }));
}

export function buildSelectedBuffTexts(categories) {
  return flattenEntBuffs(categories)
    .filter((buff) => buff.assignments > 0)
    .map((buff) => `${buff.name} (${buff.assignments}/${buff.maxAssignments})`);
}

export function buildSelectedBuffEffects(categories) {
  return flattenEntBuffs(categories)
    .filter((buff) => buff.assignments > 0)
    .map((buff) => {
      const total = buff.effect * buff.assignments;
      return `${buff.prefix || ''}${total}${buff.suffix || ''}`;
    });
}

export function buildRequestText(categories, requestTemplate = ENT_BUFF_REQUEST_TEMPLATE_DEFAULT) {
  const buffTexts = buildSelectedBuffTexts(categories);
  if (!buffTexts.length) return '';

  let titleCase = '';
  let lowerCase = '';
  buffTexts.forEach((value, index) => {
    const lc = value.toLowerCase();
    if (index === 0) {
      titleCase += value;
      lowerCase += lc;
    } else if (index === buffTexts.length - 1) {
      titleCase += ` and ${value}`;
      lowerCase += ` and ${lc}`;
    } else {
      titleCase += `, ${value}`;
      lowerCase += `, ${lc}`;
    }
  });

  return requestTemplate.replace('%Buffs%', titleCase).replace('%buffs%', lowerCase);
}

export function serializeAssignments(categories) {
  return flattenEntBuffs(categories).map((buff) => buff.assignments).join('|');
}

export function parseAssignments(serialized, baseCategories = cloneEntBuffCategories()) {
  if (!serialized) return baseCategories;
  const values = String(serialized).split('|');
  let index = 0;
  return baseCategories.map((category) => ({
    ...category,
    buffs: category.buffs.map((buff) => {
      const parsedValue = Number.parseInt(values[index], 10);
      index += 1;
      const assignments = Number.isNaN(parsedValue)
        ? 0
        : Math.max(0, Math.min(buff.maxAssignments, parsedValue));
      return { ...buff, assignments };
    }),
  }));
}
