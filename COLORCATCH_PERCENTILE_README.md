# ColorCatch percentile implementation

This version separates the historical reference distribution from live scoring.

## 1. Build the reference distribution once

Run:

`colorcatch_reference_export.cypher`

against the Neo4j database.

The query applies the agreed reference-population rules and returns only:

```text
score | count
------+------
2     | ...
3     | ...
...
42    | ...
```

No participant IDs are needed by the deployed app.

## 2. Freeze those counts in the app

Paste the exported values into `HISTORICAL_SCORE_COUNTS` in:

`colorcatch_ranker.js`

For example:

```js
const HISTORICAL_SCORE_COUNTS = {
  2: 1,
  3: 2,
  4: 1
  // ...
};
```

The actual values must come from Neo4j. The JS file intentionally contains no
invented production distribution.

## 3. Rank a newly completed score

Create the ranker once:

```js
const rankColorCatchScore =
  makeColorCatchRanker(HISTORICAL_SCORE_COUNTS);
```

Then when ColorCatch returns a new score:

```js
const result = rankColorCatchScore(37);
```

The result contains:

```js
{
  score: 37,
  total: 42,
  percentile: 93.25...,       // example only
  roundedPercentile: 93,
  playersWithLowerScore: ...,
  referencePopulation: ...,
  message: "You performed better than 93% of players."
}
```

## Statistical definition

The participant-facing statement uses the strict empirical percentile:

`100 * (# historical scores strictly below new score) / N`

Ties are not counted as players beaten. This preserves the meaning of:

"You performed better than X% of players."

This is intentionally not the midrank definition suggested in the generic
example. ColorCatch scores are discrete integers from 0 to 42, so ties are
common and the tie policy materially affects the displayed percentage.

## Important limitation

The reference population is a frozen snapshot. New ColorCatch players do not
enter the comparison distribution until the export is run again and the
score-count object is updated.

## Integration

The ranker itself needs no Neo4j connection. The remaining integration task is
obtaining the newly completed participant's ColorCatch score from the existing
game/app and passing that integer to `rankColorCatchScore(score)`.
