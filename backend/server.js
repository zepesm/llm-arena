const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const http = require("http");
const path = require("path");
const TicTacToe = require("./games/tictactoe");
const OllamaHandler = require("./llm/ollama-handler");
const WebSocketHandler = require("./websocket/ws-handler");
const config = require("./config");

const app = express();
const server = http.createServer(app);
const port = config.port;

// Initialize WebSocket
const wsHandler = new WebSocketHandler(server);

// Initialize Ollama handler
const ollamaHandler = new OllamaHandler();

app.use(cors());
app.use(express.json());

// Get available models endpoint
app.get("/api/models", async (req, res) => {
  try {
    const models = await ollamaHandler.getAvailableModels();
    res.json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get game history endpoint
app.get("/api/games", async (req, res) => {
  try {
    const games = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          id,
          model1,
          model2,
          winner,
          total_time,
          created_at,
          (
            SELECT COUNT(*)
            FROM json_each(json_extract(moves, '$.moves'))
          ) as total_moves,
          (
            SELECT COUNT(*)
            FROM json_each(json_extract(moves, '$.moves'))
            WHERE json_extract(value, '$.isRandom') = 1
          ) as random_moves_count
          FROM games 
          ORDER BY created_at DESC 
          LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get rankings endpoint - calculates rankings from game history
app.get("/api/rankings", async (req, res) => {
  try {
    const games = await new Promise((resolve, reject) => {
      db.all("SELECT model1, model2, winner FROM games", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const rankingsMap = {};

    // Calculate rankings from games
    games.forEach((game) => {
      const { model1, model2, winner } = game;

      // Initialize model entries if they don't exist
      if (!rankingsMap[model1]) {
        rankingsMap[model1] = { model: model1, wins: 0, losses: 0, draws: 0 };
      }
      if (!rankingsMap[model2]) {
        rankingsMap[model2] = { model: model2, wins: 0, losses: 0, draws: 0 };
      }

      // Update stats based on game result
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

    // Convert map to array and sort by wins
    const rankings = Object.values(rankingsMap).sort((a, b) => {
      // Sort by win rate
      const aWinRate = a.wins / (a.wins + a.losses + a.draws) || 0;
      const bWinRate = b.wins / (b.wins + b.losses + b.draws) || 0;
      return bWinRate - aWinRate;
    });

    res.json(rankings);
  } catch (error) {
    console.error("Error calculating rankings:", error);
    res.status(500).json({ error: "Failed to calculate rankings" });
  }
});

// Debug endpoint to check server time
app.get("/api/debug/time", async (req, res) => {
  try {
    const times = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          datetime('now') as utc_time,
          datetime('now', 'localtime') as local_time,
          strftime('%Y-%m-%d %H:%M:%f', 'now') as sqlite_now,
          strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime') as sqlite_local
        `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({
      system_time: new Date().toISOString(),
      node_local: new Date().toString(),
      ...times,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React build directory in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));

  // Handle React routing, return all requests to React app
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  });
}

// Initialize SQLite database
const db = new sqlite3.Database("arena.db");

// Helper function to check and add missing columns
async function ensureDbSchema() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='games'`,
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        // Check if total_time column exists
        if (!result.sql.includes("total_time")) {
          db.run(
            `ALTER TABLE games ADD COLUMN total_time INTEGER DEFAULT 0`,
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            }
          );
        } else {
          resolve();
        }
      }
    );
  });
}

// Create necessary tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model1 TEXT,
    model2 TEXT,
    game_type TEXT,
    winner TEXT,
    moves TEXT,
    total_time INTEGER,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', '+01:00'))
  )`);

  // Run schema migration
  ensureDbSchema().catch((err) => {
    console.error("Error updating database schema:", err);
  });
});

// Helper function to store game results in database
async function storeGameResult(game) {
  const totalTime = game.moves.reduce(
    (sum, move) => sum + (move.interaction?.timingMs || 0),
    0
  );

  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO games (
        model1, model2, game_type, winner, moves,
        total_time, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        game.model1,
        game.model2,
        game.gameType,
        game.winner,
        JSON.stringify({
          moves: game.moves,
          finalBoard: game.game.board,
          reason:
            game.error ||
            (game.winner === "draw"
              ? "Game ended in a draw"
              : `${game.winner} won the game`),
        }),
        totalTime,
        new Date().toLocaleString("pl-PL").replace(/\./g, "-"),
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Game state management
const activeGames = new Map();
const gameQueue = [];

// Helper function to process games
async function processGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  try {
    game.status = "active";

    // First broadcast game start
    wsHandler.broadcastGameUpdate(gameId, {
      type: "gameStart",
      game: {
        currentTurn: game.currentTurn,
        model1: game.model1,
        model2: game.model2,
      },
    });

    // Then immediately broadcast that first model is thinking
    wsHandler.broadcastGameUpdate(gameId, {
      type: "thinking",
      player: game.currentTurn,
      board: game.game.board,
      model1: game.model1,
      model2: game.model2,
    });

    while (!game.game.isGameOver()) {
      const currentModel = game.currentTurn;

      try {
        // Switch model and get move
        await ollamaHandler.switchModel(currentModel);
        const { move, interaction } = await ollamaHandler.getMove({
          board: game.game.board,
          currentTurn: game.currentTurn,
          model1: game.model1,
          moves: game.moves,
          game: game.game,
        });

        // Make move
        if (
          !game.game.makeMove(
            move,
            game.currentTurn === game.model1 ? "X" : "O"
          )
        ) {
          throw new Error(`Invalid move ${move}`);
        }

        // Store move info
        game.moves.push({
          model: currentModel,
          position: move,
          interaction,
          isRandom: interaction.isRandom,
        });

        // Then broadcast the completed move
        wsHandler.broadcastGameUpdate(gameId, {
          type: "move",
          move,
          player: currentModel, // Use currentModel instead of game.currentTurn
          board: game.game.board,
          interaction,
          isRandom: interaction.isRandom,
          model1: game.model1,
          model2: game.model2,
        });

        // Switch turns after broadcasting the move
        game.currentTurn =
          game.currentTurn === game.model1 ? game.model2 : game.model1;

        // Add small delay before next model starts thinking
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Broadcast that next model is thinking (unless game is over)
        if (!game.game.isGameOver()) {
          wsHandler.broadcastGameUpdate(gameId, {
            type: "thinking",
            player: game.currentTurn,
            board: game.game.board,
            model1: game.model1,
            model2: game.model2,
          });
        }
      } catch (moveError) {
        console.error(`Move error for ${currentModel}:`, moveError);
        // End game with the other player as winner
        game.status = "completed";
        game.winner = game.currentTurn === game.model1 ? "O" : "X";
        game.error = `${currentModel} made an invalid move: ${moveError.message}`;
        break;
      }
    }

    // Game finished
    const winner = game.game.checkWinner();
    game.status = "completed";
    if (game.error) {
      // Game ended due to invalid move
      game.winner = game.winner; // Already set in catch block
    } else if (winner === "draw") {
      game.winner = "draw";
    } else {
      game.winner = winner === "X" ? game.model1 : game.model2;
    }

    // Store game result
    await storeGameResult(game);

    // Broadcast game end
    wsHandler.broadcastGameUpdate(gameId, {
      type: "gameEnd",
      winner: game.winner,
      reason:
        game.error ||
        (winner === "draw"
          ? "Game ended in a draw"
          : `${game.winner} won the game`),
      board: game.game.board,
      model1: game.model1,
      model2: game.model2,
    });
  } catch (error) {
    console.error("Error processing game:", error);
    game.status = "error";
    game.error = error.message;
    wsHandler.broadcastGameUpdate(gameId, {
      type: "error",
      error: error.message,
    });
  }
}

// Endpoints
app.post("/api/game/start", (req, res) => {
  const { model1, model2, gameType } = req.body;
  const gameId = Date.now().toString();

  // Create new game instance
  activeGames.set(gameId, {
    id: gameId,
    model1,
    model2,
    gameType,
    currentTurn: model1,
    game: new TicTacToe(),
    moves: [], // This array will store actual moves
    status: "active",
  });

  // Send response first
  res.json({ gameId });

  // Start game processing after a small delay to ensure WebSocket is ready
  setTimeout(() => {
    processGame(gameId);
  }, 100);
});

app.get("/api/game/:gameId", (req, res) => {
  const game = activeGames.get(req.params.gameId);
  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }
  res.json(game);
});

app.get("/api/games/:gameId", async (req, res) => {
  try {
    const game = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          id,
          model1,
          model2,
          game_type,
          winner,
          moves,
          total_time,
          created_at
        FROM games 
        WHERE id = ?`,
        [req.params.gameId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // Parse moves JSON and add stats
    const parsedMoves = JSON.parse(game.moves);
    const movesStats = parsedMoves.moves.reduce(
      (stats, move) => ({
        totalRequestTokens:
          stats.totalRequestTokens + (move.interaction?.promptTokens || 0),
        totalResponseTokens:
          stats.totalResponseTokens + (move.interaction?.responseTokens || 0),
        moveCount: stats.moveCount + 1,
      }),
      { totalRequestTokens: 0, totalResponseTokens: 0, moveCount: 0 }
    );

    res.json({
      ...game,
      stats: {
        avgMoveTime: (game.total_time / movesStats.moveCount / 1000).toFixed(1),
        avgRequestTokens: (
          movesStats.totalRequestTokens / movesStats.moveCount
        ).toFixed(1),
        avgResponseTokens: (
          movesStats.totalResponseTokens / movesStats.moveCount
        ).toFixed(1),
        totalMoves: movesStats.moveCount,
      },
    });
  } catch (error) {
    console.error("Error fetching game:", error);
    res.status(500).json({ error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
