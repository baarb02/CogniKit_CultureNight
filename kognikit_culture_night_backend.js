// KogniKit Culture Night backend example
// =========================================
//
// Provides:
//   GET  /api/colorcatch/result?game_id=ColorCatch_...
//   POST /api/signup
//
// npm install express neo4j-driver
//
// Environment variables:
//   NEO4J_URI=neo4j+s://...
//   NEO4J_USER=...
//   NEO4J_PASSWORD=...

import express from "express";
import neo4j from "neo4j-driver";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
app.use(express.json());

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Change DATA_DIR if the deployed app has a dedicated persistent data volume.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const SIGNUPS_FILE = path.join(DATA_DIR, "signups.csv");

const COLORCATCH_RESULT_QUERY = `
MATCH (targetResponse:Response)
WHERE targetResponse._gameId = $gameId

OPTIONAL MATCH (targetRound:Round)
WHERE targetRound._id = targetResponse._roundId

WITH
    $gameId AS target_game_id,
    targetResponse._participantId AS target_participant_id,
    targetRound.level AS target_level,
    targetResponse.isCorrect AS target_is_correct

WHERE target_level <> "Practice Level 1"

WITH
    target_game_id,
    target_participant_id,
    count(*) AS target_total,
    sum(CASE WHEN target_is_correct = true THEN 1 ELSE 0 END) AS target_correct

WHERE target_total = 42

CALL {
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

    // One completed game per reference participant.
    // Current deterministic rule: first after ordering by game_id.
    WITH participant_id, game_id, correct_responses
    ORDER BY participant_id, game_id

    WITH participant_id, collect(correct_responses)[0] AS reference_score

    RETURN collect(reference_score) AS reference_scores
}

WITH
    target_game_id,
    target_participant_id,
    target_total,
    target_correct,
    reference_scores,
    size(reference_scores) AS reference_population,
    size([score IN reference_scores WHERE score < target_correct]) AS lower_scores

RETURN
    target_game_id AS gameId,
    target_participant_id AS participantId,
    target_correct AS correct,
    target_total AS total,
    round(100.0 * target_correct / target_total, 1) AS accuracy,
    reference_population AS referencePopulation,
    lower_scores AS playersWithLowerScore,
    round(100.0 * lower_scores / reference_population, 1) AS percentile
`;

function neo4jNumber(value) {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

// ---------------------------------------------------------------------------
// ColorCatch result endpoint
// ---------------------------------------------------------------------------
app.get("/api/colorcatch/result", async (req, res) => {
  const gameId = String(req.query.game_id || "").trim();

  if (!gameId.startsWith("ColorCatch_")) {
    return res.status(400).json({error: "A valid ColorCatch game_id is required."});
  }

  const session = driver.session({defaultAccessMode: neo4j.session.READ});

  try {
    const result = await session.run(COLORCATCH_RESULT_QUERY, {gameId});

    if (result.records.length === 0) {
      return res.status(404).json({
        error: "No completed 42-response ColorCatch game was found for this game_id."
      });
    }

    const record = result.records[0];

    return res.json({
      gameId: record.get("gameId"),
      participantId: record.get("participantId"),
      correct: neo4jNumber(record.get("correct")),
      total: neo4jNumber(record.get("total")),
      accuracy: neo4jNumber(record.get("accuracy")),
      percentile: neo4jNumber(record.get("percentile")),
      referencePopulation: neo4jNumber(record.get("referencePopulation")),
      playersWithLowerScore: neo4jNumber(record.get("playersWithLowerScore"))
    });
  } catch (error) {
    console.error("ColorCatch query failed:", error);
    return res.status(500).json({error: "Could not calculate ColorCatch result."});
  } finally {
    await session.close();
  }
});

// ---------------------------------------------------------------------------
// Email signup endpoint
// ---------------------------------------------------------------------------

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function ensureSignupFile() {
  await fs.mkdir(DATA_DIR, {recursive: true});

  try {
    await fs.access(SIGNUPS_FILE);
  } catch {
    await fs.writeFile(
      SIGNUPS_FILE,
      "email,submitted_at\n",
      {encoding: "utf8", flag: "wx"}
    ).catch(error => {
      // Another request may have created the file at the same moment.
      if (error.code !== "EEXIST") throw error;
    });
  }
}

app.post("/api/signup", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const consent = req.body?.consent === true;

  // Simple server-side validation. Replace/extend according to project needs.
  const emailLooksValid =
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailLooksValid) {
    return res.status(400).json({error: "A valid email address is required."});
  }

  if (!consent) {
    return res.status(400).json({error: "Consent is required."});
  }

  // Use server time, not a timestamp supplied by the browser.
  const submittedAt = new Date().toISOString();
  const row = `${csvCell(email)},${csvCell(submittedAt)}\n`;

  try {
    await ensureSignupFile();
    await fs.appendFile(SIGNUPS_FILE, row, {encoding: "utf8"});

    return res.status(201).json({
      saved: true,
      submittedAt
    });
  } catch (error) {
    console.error("Signup write failed:", error);
    return res.status(500).json({error: "Could not save signup."});
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`KogniKit Culture Night backend listening on port ${PORT}`);
  console.log(`Signup file: ${SIGNUPS_FILE}`);
});

/*
Expected signup file:

email,submitted_at
"person@example.com","2026-09-28T09:46:22.000Z"

IMPORTANT DEPLOYMENT NOTE
-------------------------
If the KogniKit/Culture Night app is deployed in a container, serverless service,
or other environment with ephemeral local storage, writing to ./data/signups.csv
will NOT be durable. Set DATA_DIR to a persistent mounted volume, or replace the
CSV implementation with the project's approved persistent database/storage.

COLORCATCH COMPLETION
---------------------
The remaining integration requirement is obtaining the completed game_id from
the embedded ColorCatch app. Ideally ColorCatch emits a postMessage event such as:

window.parent.postMessage(
  { type: "COLORCATCH_COMPLETE", gameId: completedGameId },
  "https://YOUR-CULTURE-NIGHT-DOMAIN"
);

The parent page should validate event.origin before using gameId, then call:

GET /api/colorcatch/result?game_id=<gameId>

and pass the JSON response to showResult(data).
*/
