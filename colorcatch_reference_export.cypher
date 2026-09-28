// ColorCatch reference score distribution
// Run once in Neo4j and give the resulting score/count table to the developer.

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

WITH participant_id, game_id, correct_responses
ORDER BY participant_id, game_id

// Keep one completed game per participant.
WITH participant_id, collect(correct_responses)[0] AS score

RETURN
    score,
    count(*) AS count
ORDER BY score;
