// ONE-TIME COLORCATCH REFERENCE DISTRIBUTION EXPORT
//
// Run manually against Neo4j before deployment.
// Export the returned score/count rows and paste them into
// HISTORICAL_SCORE_COUNTS in colorcatch_ranker.js.
//
// IMPORTANT:
// This uses the same deterministic one-game-per-participant rule used in the
// previous analysis: after ordering by participant_id and game_id, take the
// first completed game's score. This is NOT necessarily chronological.

MATCH (r:Response)
WHERE r._gameId STARTS WITH "ColorCatch_"
  AND NOT toLower(r._participantId) CONTAINS "bianka"
  AND NOT toLower(r._participantId) CONTAINS "test"

OPTIONAL MATCH (round:Round)
WHERE round._id = r._roundId

WITH
    r._gameId AS game_id,
    r._participantId AS participant_id,
    round.level AS level,
    r.isCorrect AS is_correct

WHERE level <> "Practice Level 1"

WITH
    game_id,
    participant_id,
    count(*) AS proper_responses,
    sum(CASE WHEN is_correct = true THEN 1 ELSE 0 END) AS correct_responses

WHERE proper_responses = 42

WITH
    participant_id,
    game_id,
    correct_responses
ORDER BY participant_id, game_id

WITH
    participant_id,
    collect(correct_responses)[0] AS score

WITH
    score,
    count(*) AS count

RETURN
    score,
    count
ORDER BY score;
