/*
ColorCatch empirical percentile ranker
=======================================

Change log: 
- Reference-population definition used when exporting historical scores:
  -  ColorCatch games only
  - participant IDs containing "bianka" or "test" excluded, case-insensitively
  - Practice Level 1 responses excluded
  - completed games must contain exactly 42 proper responses
  - one completed game per participant, selected deterministically after sorting by game_id
- Tie policy:STRICT. A participant "performed better than X% of players" only when the
historical player's score is strictly lower than the participant's score.

USE:
1. Run the companion Neo4j export query once.
2. Replace HISTORICAL_SCORE_COUNTS below with the exported score/count pairs.
3. Call rankColorCatchScore(newScore).
- The function does not query Neo4j and does not require participant-level data.
*/

// Replace this object with the output of the one-time Neo4j export.
// Format: score: numberOfHistoricalParticipants
const HISTORICAL_SCORE_COUNTS = {
  // Example only. Delete these example values before production:
  // 2: 1,
  // 3: 2,
  // 29: 84,
  // 37: 20,
  // 42: 5
};

function makeColorCatchRanker(scoreCounts) {
  const counts = new Array(43).fill(0);

  for (const [rawScore, rawCount] of Object.entries(scoreCounts)) {
    const score = Number(rawScore);
    const count = Number(rawCount);

    if (!Number.isInteger(score) || score < 0 || score > 42) {
      throw new Error(`Invalid historical ColorCatch score: ${rawScore}`);
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid count for score ${rawScore}: ${rawCount}`);
    }

    counts[score] = count;
  }

  const referencePopulation = counts.reduce((sum, count) => sum + count, 0);

  if (referencePopulation === 0) {
    throw new Error(
      "Historical score distribution is empty. Paste the exported score counts into HISTORICAL_SCORE_COUNTS."
    );
  }

  // Precompute number of historical players with a STRICTLY LOWER score.
  const lowerCounts = new Array(43).fill(0);
  let runningTotal = 0;

  for (let score = 0; score <= 42; score++) {
    lowerCounts[score] = runningTotal;
    runningTotal += counts[score];
  }

  return function rankColorCatchScore(rawScore) {
    const score = Number(rawScore);

    if (!Number.isInteger(score) || score < 0 || score > 42) {
      throw new Error("ColorCatch score must be an integer from 0 to 42.");
    }

    const playersWithLowerScore = lowerCounts[score];
    const percentile =
      100 * playersWithLowerScore / referencePopulation;

    return {
      score,
      total: 42,
      percentile,
      roundedPercentile: Math.round(percentile),
      playersWithLowerScore,
      referencePopulation,
      message:
        `You performed better than ${Math.round(percentile)}% of players.`
    };
  };
}

// Create this once when the app starts.
// const rankColorCatchScore = makeColorCatchRanker(HISTORICAL_SCORE_COUNTS);
//
// Example after the reference data has been inserted:
// const result = rankColorCatchScore(37);
// console.log(result);
// console.log(`${result.score}/${result.total}`);
// console.log(result.message);

export {
  HISTORICAL_SCORE_COUNTS,
  makeColorCatchRanker
};
