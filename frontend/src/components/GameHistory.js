import React, { useState, useEffect } from "react";
import GameLog from "./GameLog";
import GameBoard from "./GameBoard";
import "./GameHistory.css";

const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.round((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes === 1) return "1m ago";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return "1h ago";
  if (diffInHours < 24) return `${diffInHours}h ago`;

  // If more than 24h ago, show date in format: "DD/MM HH:mm"
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

function GameHistory({ onGameSelect }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);

  // Parse moves once when selecting a game
  const handleGameSelect = (game) => {
    const parsedMoves = JSON.parse(game.moves);
    setSelectedGame({
      ...game,
      parsedMoves: {
        moves: parsedMoves.moves,
        finalBoard: parsedMoves.finalBoard,
        reason: parsedMoves.reason,
      },
    });
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch("/api/games");
      const data = await response.json();
      setGames(data);
    } catch (error) {
      setError("Failed to fetch game history");
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading game history...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="game-history">
      {selectedGame ? (
        <>
          <button className="back-button" onClick={() => setSelectedGame(null)}>
            Back to games
          </button>
          <div className="selected-game">
            <div className="game-details">
              <div className="game-info">
                <div className="game-summary">
                  <div className="models">
                    <span className="model model-x">{selectedGame.model1}</span>
                    <span className="vs">vs</span>
                    <span className="model model-o">{selectedGame.model2}</span>
                  </div>
                  <div className="stats-row">
                    <div className="stat-item">
                      <span className="stat-label">Winner</span>
                      <span className="stat-value">
                        {selectedGame.winner === "draw"
                          ? "Draw"
                          : selectedGame.winner}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Total Time</span>
                      <span className="stat-value">
                        {(selectedGame.total_time / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Played</span>
                      <span className="stat-value">
                        {new Date(selectedGame.created_at).toLocaleString(
                          "pl-PL",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }
                        )}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Total Moves</span>
                      <span className="stat-value">
                        {selectedGame.stats.totalMoves}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="game-state">
                <GameBoard
                  board={selectedGame.parsedMoves.finalBoard}
                  gameStatus="completed"
                  reason={selectedGame.parsedMoves.reason}
                  moves={selectedGame.parsedMoves.moves}
                  model1={selectedGame.model1}
                  model2={selectedGame.model2}
                />
              </div>
              <div className="game-log-container">
                <h4>Game Log</h4>
                <GameLog moves={selectedGame.parsedMoves.moves} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2>Recent Games</h2>
          <div className="games-list">
            {games.map((game) => (
              <div
                key={game.id}
                className={`game-item ${
                  selectedGame?.id === game.id ? "selected" : ""
                }`}
                onClick={() => handleGameSelect(game)}
              >
                <div className="game-summary">
                  <div className="game-players">
                    <span
                      className={`model model-x ${
                        game.winner === game.model1 ? "winner" : ""
                      }`}
                    >
                      {game.model1}
                      {game.winner === game.model1 && (
                        <span className="trophy">🏆</span>
                      )}
                    </span>
                    <span className="vs">vs</span>
                    <span
                      className={`model model-o ${
                        game.winner === game.model2 ? "winner" : ""
                      }`}
                    >
                      {game.model2}
                      {game.winner === game.model2 && (
                        <span className="trophy">🏆</span>
                      )}
                    </span>
                  </div>
                  <div className="game-meta">
                    <div className="game-quick-stats">
                      <span>⏱️ {(game.total_time / 1000).toFixed(1)}s</span>
                      <span>🎮 {game.stats.totalMoves}</span>
                      <span title="Request/Response tokens">
                        🔤 {game.stats.avgRequestTokens}/
                        {game.stats.avgResponseTokens}
                      </span>
                      {game.stats.randomMoves > 0 && (
                        <span className="random-moves">
                          🎲 {game.stats.randomMoves}
                        </span>
                      )}
                    </div>
                    <div className="timestamp">
                      {formatTime(game.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default GameHistory;
