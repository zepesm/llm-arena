const express = require("express");
const router = express.Router();
const db = require("../db"); // Adjust this if your db module is elsewhere

// GET /api/rankings - calculates rankings in real time based on games data
router.get("/rankings", async (req, res) => {
  try {
    // Query all games. Adjust the query based on your database/ORM.
    const result = await db.query("SELECT model1, model2, winner FROM games");
    const games = result.rows;

    const rankingsMap = {};

    // Iterate over all game records and update rankings for each involved model.
    games.forEach((game) => {
      const { model1, model2, winner } = game;

      // Ensure an entry exists for each model
      if (!rankingsMap[model1]) {
        rankingsMap[model1] = { model: model1, wins: 0, losses: 0, draws: 0 };
      }
      if (!rankingsMap[model2]) {
        rankingsMap[model2] = { model: model2, wins: 0, losses: 0, draws: 0 };
      }

      if (winner === "draw") {
        rankingsMap[model1].draws++;
        rankingsMap[model2].draws++;
      } else if (winner === model1) {
        rankingsMap[model1].wins++;
        rankingsMap[model2].losses++;
      } else if (winner === model2) {
        rankingsMap[model2].wins++;
        rankingsMap[model1].losses++;
      }
    });

    // Convert the rankings map object to an array.
    const rankings = Object.values(rankingsMap);
    res.json(rankings);
  } catch (error) {
    console.error("Error calculating rankings: ", error);
    res.status(500).json({ error: "Failed to calculate rankings" });
  }
});

module.exports = router;
