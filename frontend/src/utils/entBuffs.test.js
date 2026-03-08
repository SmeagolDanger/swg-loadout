import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENT_BUFF_REQUEST_TEMPLATE_DEFAULT,
  calculateAssignedPoints,
  buildRequestText,
  cloneEntBuffCategories,
  parseAssignments,
  serializeAssignments,
  updateBuffAssignments,
} from './entBuffs.js';

test('request text matches the source-style formatting', () => {
  let categories = cloneEntBuffCategories();
  categories = updateBuffAssignments(categories, 'Agility', 2);
  categories = updateBuffAssignments(categories, 'Critical Hit', 1);
  categories = updateBuffAssignments(categories, 'Go With The Flow', 3);

  assert.equal(
    buildRequestText(categories, ENT_BUFF_REQUEST_TEMPLATE_DEFAULT),
    '/tt Could you buff me with Agility (2/10), Critical Hit (1/1) and Go With The Flow (3/5), please?'
  );
});

test('point totals are calculated from assignments and costs', () => {
  let categories = cloneEntBuffCategories();
  categories = updateBuffAssignments(categories, 'Agility', 4);
  categories = updateBuffAssignments(categories, 'Critical Hit', 1);
  categories = updateBuffAssignments(categories, 'Hand Sampling', 2);

  assert.equal(calculateAssignedPoints(categories), 13);
});

test('cannot exceed the 20 point entertainer limit', () => {
  let categories = cloneEntBuffCategories();
  categories = updateBuffAssignments(categories, 'Action Cost Reduction', 1);
  categories = updateBuffAssignments(categories, 'Critical Hit', 1);
  categories = updateBuffAssignments(categories, 'Critical Hit Defense', 1);
  categories = updateBuffAssignments(categories, 'Glancing Blow', 1);
  categories = updateBuffAssignments(categories, 'Agility', 1);

  assert.equal(calculateAssignedPoints(categories), 20);
  const next = updateBuffAssignments(categories, 'Luck', 1);
  assert.equal(calculateAssignedPoints(next), 20);
});

test('serialized assignment strings round-trip and clamp invalid values', () => {
  const parsed = parseAssignments('2|999|-5|abc');
  const serialized = serializeAssignments(parsed);
  assert.match(serialized, /^2\|10\|0\|0\|/);
});
