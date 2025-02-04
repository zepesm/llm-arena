import React, { useState, useEffect } from "react";
import "./App.css";
import GameBoard from "./components/GameBoard";
import ModelSelector from "./components/ModelSelector";
import GameLog from "./components/GameLog";
import GameHistory from "./components/GameHistory";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";

function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [isReplaying, setIsReplaying] = useState(false);

  const getCurrentBoard = () => {
    if (!game) return Array(9).fill(null);
    if (replayIndex === -1) return Array(9).fill(null);

    const board = Array(9).fill(null);
    for (let i = 0; i <= replayIndex; i++) {
      const move = game.moves.moves[i];
      board[move.position] = i % 2 === 0 ? "X" : "O";
    }
    return board;
  };

  const startReplay = () => {
    setReplayIndex(-1);
    setIsReplaying(true);
  };

  useEffect(() => {
    if (!isReplaying) return;
    if (!game) return;

    if (replayIndex >= game.moves.moves.length - 1) {
      setIsReplaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setReplayIndex((prev) => prev + 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [replayIndex, isReplaying, game]);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/games/${gameId}`
        );
        const data = await response.json();
        const parsedMoves = JSON.parse(data.moves);
        setGame({
          ...data,
          moves: parsedMoves,
        });
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!game) return <div>Game not found</div>;

  return (
    <div>
      <button onClick={() => navigate("/")}>← Back to Games</button>
      <div className="game-details">
        <GameBoard
          board={isReplaying ? getCurrentBoard() : game.moves.finalBoard}
          gameStatus="completed"
          reason={game.moves.reason}
          moves={game.moves.moves}
          model1={game.model1}
          model2={game.model2}
        />
        <div className="game-controls">
          <button
            onClick={startReplay}
            disabled={isReplaying}
            className="replay-button"
          >
            {isReplaying ? "Replaying..." : "▶ Replay Game"}
          </button>
        </div>

        <div className="game-log-container">
          <GameLog moves={game.moves.moves} />
        </div>
        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">Total Time</span>
            <span className="stat-value">
              {(game.total_time / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Move Time</span>
            <span className="stat-value">{game.stats.avgMoveTime}s</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Tokens</span>
            <span className="stat-value">
              {game.stats.avgRequestTokens}/{game.stats.avgResponseTokens}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const [rankings, setRankings] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameMoves, setGameMoves] = useState([]);
  const [finalBoard, setFinalBoard] = useState(null);
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setupWebSocket = () => {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onopen = () => {
      console.log("WebSocket connected");
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "gameStart":
          setGameState({
            type: "move",
            player: data.game.currentTurn,
            model1: data.game.model1,
            model2: data.game.model2,
            thinking: true,
          });
          break;

        case "thinking":
          setGameState({
            type: "move",
            player: data.player,
            board: data.board,
            model1: data.model1,
            model2: data.model2,
            thinking: true,
          });
          break;

        case "move":
          setGameState({
            type: "move",
            player: data.player === data.model1 ? data.model2 : data.model1,
            board: data.board,
            model1: data.model1,
            model2: data.model2,
            thinking: false,
          });
          setGameMoves((prev) => [
            ...prev,
            {
              model: data.player,
              position: data.move,
              interaction: data.interaction,
              isRandom: data.isRandom,
            },
          ]);
          break;
        case "gameEnd":
          setGameState({
            type: "completed",
            reason: data.reason,
            winner: data.winner,
            model1: data.model1,
            model2: data.model2,
          });
          setFinalBoard(data.board);
          setActiveGame(null);
          break;
        case "error":
          console.error("Game error:", data.error);
          setError(data.error);
          break;
        default:
          console.log("Unknown update:", data);
      }
    };

    setWs(socket);
    return socket;
  };

  const fetchRankings = async () => {
    const response = await fetch("http://localhost:3001/api/rankings");
    const data = await response.json();
    setRankings(data);
  };

  const startGame = async (model1, model2) => {
    setLoading(true);
    setError(null);
    // Clear previous game state
    setGameState(null);
    setGameMoves([]);
    setFinalBoard(null);
    try {
      // Ensure WebSocket is connected
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }

      const response = await fetch("http://localhost:3001/api/game/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model1,
          model2,
          gameType: "tictactoe",
        }),
      });
      const data = await response.json();
      setActiveGame(data.gameId);
    } catch (error) {
      setError("Failed to start game: " + error.message);
      console.error("Error starting game:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
    const socket = setupWebSocket();
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (ws && activeGame) {
      ws.send(JSON.stringify({ type: "watch", gameId: activeGame }));
    }
  }, [ws, activeGame]);

  return (
    <>
      {error && <div className="error-message">{error}</div>}

      <div className="rankings">
        <h2>Rankings</h2>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Draws</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((rank) => (
              <tr key={rank.model}>
                <td>{rank.model}</td>
                <td>{rank.wins}</td>
                <td>{rank.losses}</td>
                <td>{rank.draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="game-starter">
        <h2>Start New Game</h2>
        <ModelSelector
          onStartGame={startGame}
          disabled={loading || activeGame !== null}
        />
      </div>

      {(activeGame || finalBoard) && (
        <>
          <GameBoard
            board={finalBoard || gameState?.board || Array(9).fill(null)}
            gameStatus={gameState?.type || "waiting"}
            currentTurn={gameState?.player}
            reason={gameState?.reason}
            moves={gameMoves}
            model1={gameState?.model1}
            model2={gameState?.model2}
          />
          <GameLog moves={gameMoves} />
        </>
      )}

      {!activeGame && <GameHistory />}
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <h1>LLM Battle Arena</h1>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games/:gameId" element={<GamePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
