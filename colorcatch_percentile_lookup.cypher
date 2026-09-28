// ColorCatch percentile lookup for every possible score (0-42)

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
WITH participant_id, collect(correct_responses)[0] AS historical_score

WITH collect(historical_score) AS historical_scores

// Generate every possible ColorCatch score.
UNWIND range(0, 42) AS score

WITH
    score,
    historical_scores,
    size(historical_scores) AS reference_population,
    size([s IN historical_scores WHERE s < score]) AS players_with_lower_score

WITH
    score,
    reference_population,
    players_with_lower_score,
    round(
        100.0 * players_with_lower_score / reference_population,
        1
    ) AS percentile

RETURN
    score,
    42 AS total,
    percentile,
    reference_population,
    players_with_lower_score,
    "You performed better than " +
        toString(round(percentile)) +
        "% of players." AS feedback_message
ORDER BY score;
