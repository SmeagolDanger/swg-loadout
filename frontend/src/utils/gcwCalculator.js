export const GCW_MAX_RATING = 59999;

export const GCW_DECAY_ESTIMATES = [
  { rank: 7, value: 6001 },
  { rank: 8, value: 6500 },
  { rank: 9, value: 7202 },
  { rank: 10, value: 8150 },
  { rank: 11, value: 9598 },
  { rank: 12, value: 12002 },
];

export const GCW_RANKS = [
  { Rank: 1, MinRating: 0, MaxRating: 4999, ImperialTitle: 'Private', RebelTitle: 'Private', RatingEarningCap: 10000, RatingDecayBalance: 0, MaxRatingDecay: 0, RatingDecayFloor: 0 },
  { Rank: 2, MinRating: 5000, MaxRating: 9999, ImperialTitle: 'Lance Corporal', RebelTitle: 'Trooper', RatingEarningCap: 6750, RatingDecayBalance: 0, MaxRatingDecay: 0, RatingDecayFloor: 0 },
  { Rank: 3, MinRating: 10000, MaxRating: 14999, ImperialTitle: 'Corporal', RebelTitle: 'High Trooper', RatingEarningCap: 6500, RatingDecayBalance: 0, MaxRatingDecay: 0, RatingDecayFloor: 0 },
  { Rank: 4, MinRating: 15000, MaxRating: 19999, ImperialTitle: 'Sergeant', RebelTitle: 'Sergeant', RatingEarningCap: 5750, RatingDecayBalance: 0, MaxRatingDecay: 0, RatingDecayFloor: 0 },
  { Rank: 5, MinRating: 20000, MaxRating: 24999, ImperialTitle: 'Master Sergeant', RebelTitle: 'Senior Sergeant', RatingEarningCap: 5500, RatingDecayBalance: 0, MaxRatingDecay: 0, RatingDecayFloor: 0 },
  { Rank: 6, MinRating: 25000, MaxRating: 29999, ImperialTitle: 'Sergeant Major', RebelTitle: 'Sergeant Major', RatingEarningCap: 5250, RatingDecayBalance: 0, MaxRatingDecay: 0, RatingDecayFloor: 0 },
  { Rank: 7, MinRating: 30000, MaxRating: 34999, ImperialTitle: 'Lieutenant', RebelTitle: 'Lieutenant', RatingEarningCap: 5000, RatingDecayBalance: 2728, MaxRatingDecay: 2000, RatingDecayFloor: 29999 },
  { Rank: 8, MinRating: 35000, MaxRating: 39999, ImperialTitle: 'Captain', RebelTitle: 'Captain', RatingEarningCap: 4750, RatingDecayBalance: 2745, MaxRatingDecay: 2000, RatingDecayFloor: 0 },
  { Rank: 9, MinRating: 40000, MaxRating: 44999, ImperialTitle: 'Major', RebelTitle: 'Major', RatingEarningCap: 4500, RatingDecayBalance: 2770, MaxRatingDecay: 2000, RatingDecayFloor: 0 },
  { Rank: 10, MinRating: 45000, MaxRating: 49999, ImperialTitle: 'Lieutenant Colonel', RebelTitle: 'Commander', RatingEarningCap: 4250, RatingDecayBalance: 2794, MaxRatingDecay: 2000, RatingDecayFloor: 0 },
  { Rank: 11, MinRating: 50000, MaxRating: 54999, ImperialTitle: 'Colonel', RebelTitle: 'Colonel', RatingEarningCap: 4000, RatingDecayBalance: 2824, MaxRatingDecay: 2000, RatingDecayFloor: 0 },
  { Rank: 12, MinRating: 55000, MaxRating: 59999, ImperialTitle: 'General', RebelTitle: 'General', RatingEarningCap: 3750, RatingDecayBalance: 2858, MaxRatingDecay: 2000, RatingDecayFloor: 0 },
];

export function getFactionRankTitle(rank, faction = 'imperial') {
  if (!rank) return '';
  return faction === 'rebel' ? rank.RebelTitle : rank.ImperialTitle;
}

export function getRankByNumber(rankNumber) {
  return GCW_RANKS.find((rank) => rank.Rank === Number(rankNumber)) || null;
}

export function getRankByRating(rating) {
  return GCW_RANKS.find((rank) => rank.MinRating <= rating && rank.MaxRating >= rating) || GCW_RANKS[GCW_RANKS.length - 1];
}

export function calculatePointsToOffsetDecay(rank) {
  if (!rank || rank.RatingDecayBalance <= 0) return 0;
  return Math.floor(((rank.RatingEarningCap * rank.RatingDecayBalance - 1) / (rank.RatingEarningCap - rank.RatingDecayBalance + 1)) + 1);
}

export function normalizeVisibleProgress(rankPercent) {
  return Math.trunc(Number(rankPercent));
}

export function estimateCurrentRating(rank, rankPercent) {
  const normalizedPercent = normalizeVisibleProgress(rankPercent);
  return Math.floor(rank.MinRating + (normalizedPercent / 100) * (rank.MaxRating - rank.MinRating));
}

export function predictGCWRank({ rankNumber, rankPercent, gcwPoints }) {
  const rank = getRankByNumber(rankNumber);
  if (!rank) {
    throw new Error('Invalid rank');
  }

  const parsedPercent = Number(rankPercent);
  const normalizedPercent = normalizeVisibleProgress(rankPercent);
  const parsedPoints = Number(gcwPoints);

  if (Number.isNaN(parsedPercent) || parsedPercent < 0 || parsedPercent > 99.99) {
    throw new Error('Rank progress must be between 0 and 99.99');
  }

  if (Number.isNaN(parsedPoints) || parsedPoints < 0) {
    throw new Error('GCW points must be zero or higher');
  }

  const currentRating = estimateCurrentRating(rank, parsedPercent);
  const pointsToOffsetDecay = calculatePointsToOffsetDecay(rank);

  let totalEarnedRating = 0;

  if (parsedPoints > 0) {
    const numerator = parsedPoints * rank.RatingEarningCap;
    const denominator = parsedPoints + rank.RatingEarningCap;
    totalEarnedRating = Math.ceil(numerator / denominator);

    if (
      rank.RatingDecayBalance > 0 &&
      totalEarnedRating >= rank.RatingDecayBalance &&
      pointsToOffsetDecay > 0 &&
      parsedPoints > pointsToOffsetDecay
    ) {
      const adjustedNumerator = (parsedPoints - pointsToOffsetDecay) * (rank.RatingEarningCap - rank.RatingDecayBalance + 1000);
      const adjustedDenominator = (parsedPoints - pointsToOffsetDecay) + (rank.RatingEarningCap - rank.RatingDecayBalance + 1000);
      totalEarnedRating = Math.ceil(adjustedNumerator / adjustedDenominator);
      totalEarnedRating += rank.RatingDecayBalance;
    }
  }

  const totalEarnedRatingAfterDecay = totalEarnedRating - rank.RatingDecayBalance;
  const cappedRatingAdjustment = Math.max(-rank.MaxRatingDecay, totalEarnedRatingAfterDecay);

  let finalRatingAdjustment = cappedRatingAdjustment;
  if (
    rank.RatingDecayFloor > 0 &&
    finalRatingAdjustment < 0 &&
    currentRating + finalRatingAdjustment < rank.RatingDecayFloor
  ) {
    finalRatingAdjustment = rank.RatingDecayFloor - currentRating;
  }

  finalRatingAdjustment = Math.floor(finalRatingAdjustment);

  const nextRating = Math.floor(Math.min(currentRating + finalRatingAdjustment, GCW_MAX_RATING));
  const nextRank = getRankByRating(nextRating);
  const nextPercent = Math.round((((nextRating - nextRank.MinRating) / (nextRank.MaxRating - nextRank.MinRating + 1)) * 100) * 100) / 100;

  return {
    currentRank: rank,
    currentRating,
    normalizedPercent,
    gcwPoints: parsedPoints,
    pointsToOffsetDecay,
    totalEarnedRating,
    totalEarnedRatingAfterDecay,
    cappedRatingAdjustment,
    finalRatingAdjustment,
    nextRating,
    nextRank,
    nextPercent,
  };
}
