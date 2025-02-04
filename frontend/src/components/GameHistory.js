import React, { useState, useEffect } from "react";
import GameLog from "./GameLog";
import GameBoard from "./GameBoard";
import "./GameHistory.css";
import { Link } from "react-router-dom";

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

function GameHistory() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      <h2>Recent Games</h2>
      <div className="games-list">
        {games.map((game) => (
          <Link key={game.id} to={`/games/${game.id}`} className="game-item">
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
                  <span>🎮 {game.total_moves}</span>
                  <span title="Request/Response tokens">
                    🎲 {game.random_moves_count} random
                  </span>
                </div>
                <div className="timestamp">{formatTime(game.created_at)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default GameHistory;
