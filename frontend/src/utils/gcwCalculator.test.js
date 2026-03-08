import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GCW_DECAY_ESTIMATES,
  GCW_RANKS,
  calculatePointsToOffsetDecay,
  getFactionRankTitle,
  predictGCWRank,
  normalizeVisibleProgress,
} from './gcwCalculator.js';

test('decay estimates match the source breakpoints', () => {
  const officerRanks = GCW_RANKS.filter((rank) => rank.Rank >= 7);
  const actual = officerRanks.map((rank) => ({ rank: rank.Rank, value: calculatePointsToOffsetDecay(rank) }));
  assert.deepEqual(actual, GCW_DECAY_ESTIMATES);
});

test('rank 1 with 50 percent progress and 10k points predicts the expected next rating', () => {
  const result = predictGCWRank({ rankNumber: 1, rankPercent: 50, gcwPoints: 10000 });
  assert.equal(result.currentRating, 2499);
  assert.equal(result.totalEarnedRating, 5000);
  assert.equal(result.finalRatingAdjustment, 5000);
  assert.equal(result.nextRating, 7499);
  assert.equal(result.nextRank.Rank, 2);
  assert.equal(result.nextPercent, 49.98);
});

test('lieutenant at 50 percent with 6001 points barely gains after decay', () => {
  const result = predictGCWRank({ rankNumber: 7, rankPercent: 50, gcwPoints: 6001 });
  assert.equal(result.pointsToOffsetDecay, 6001);
  assert.equal(result.totalEarnedRating, 2728);
  assert.equal(result.totalEarnedRatingAfterDecay, 0);
  assert.equal(result.finalRatingAdjustment, 0);
  assert.equal(result.nextRating, 32499);
  assert.equal(result.nextRank.Rank, 7);
  assert.equal(result.nextPercent, 49.98);
});

test('lieutenant at 50 percent with zero points is capped by max weekly decay', () => {
  const result = predictGCWRank({ rankNumber: 7, rankPercent: 50, gcwPoints: 0 });
  assert.equal(result.totalEarnedRating, 0);
  assert.equal(result.totalEarnedRatingAfterDecay, -2728);
  assert.equal(result.cappedRatingAdjustment, -2000);
  assert.equal(result.finalRatingAdjustment, -2000);
  assert.equal(result.nextRating, 30499);
  assert.equal(result.nextRank.Rank, 7);
});

test('faction titles switch correctly for asymmetrical ranks', () => {
  const imperialRank = GCW_RANKS.find((rank) => rank.Rank === 10);
  assert.equal(getFactionRankTitle(imperialRank, 'imperial'), 'Lieutenant Colonel');
  assert.equal(getFactionRankTitle(imperialRank, 'rebel'), 'Commander');
});


test('visible progress is truncated to match the original calculator behavior', () => {
  assert.equal(normalizeVisibleProgress(48.94), 48);
  const result = predictGCWRank({ rankNumber: 10, rankPercent: 48.94, gcwPoints: 20200 });
  assert.equal(result.normalizedPercent, 48);
  assert.equal(result.currentRating, 47399);
  assert.equal(result.finalRatingAdjustment, 2041);
  assert.equal(result.nextRating, 49440);
  assert.equal(result.nextPercent, 88.8);
});
