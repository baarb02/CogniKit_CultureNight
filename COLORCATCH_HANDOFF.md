# ColorCatch percentile handoff

## Reference data

Run `colorcatch_reference_export.cypher` once in Neo4j.

It returns a frequency table of historical ColorCatch scores after:

- excluding participant IDs containing `bianka` or `test`
- excluding `Practice Level 1`
- keeping only completed games with exactly 42 proper responses
- keeping one completed game per participant

- currently the games are ordered by `game_id` and the first is kept. It is not necessarily chronological.

## Percentile definition

For a new participant score `x`: `percentile = 100 * (number of historical scores < x) / N`

Ties are not counted as players beaten.

This matches the participant-facing wording:

> You performed better than X% of players.

-> implement this calculation in whatever form best fits the existing KogniKit codebase.
