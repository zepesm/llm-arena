import React, { useState, useEffect } from "react";
import "./App.css";
import GameBoard from "./components/GameBoard";
import ModelSelector from "./components/ModelSelector";
import GameLog from "./components/GameLog";
import GameHistory from "./components/GameHistory";

function App() {
  const [rankings, setRankings] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameMoves, setGameMoves] = useState([]);
  const [finalBoard, setFinalBoard] = useState(null);
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    fetchRankings();

    // Setup WebSocket
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

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (ws && activeGame) {
      ws.send(JSON.stringify({ type: "watch", gameId: activeGame }));
    }
  }, [ws, activeGame]);

  const handleGameUpdate = (data) => {
    switch (data.type) {
      case "gameStart":
        setGameState(data);
        setGameMoves([]);
        setFinalBoard(null);
        break;
      case "move":
        setGameState(data);
        if (data.interaction) {
          setGameMoves((moves) => [
            ...moves,
            {
              position: data.move,
              interaction: data.interaction,
            },
          ]);
        }
        break;
      case "gameEnd":
        setGameState(data);
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

  const handleGameSelect = (game) => {
    setSelectedGame({
      ...game,
      moves: JSON.parse(game.moves),
    });
  };

  return (
    <div className="App">
      <h1>LLM Battle Arena</h1>

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

      {selectedGame ? (
        <>
          <button onClick={() => setSelectedGame(null)}>Back to games</button>
          <GameBoard
            board={selectedGame.moves.finalBoard}
            gameStatus="completed"
            reason={selectedGame.moves.reason}
            moves={selectedGame.moves.moves}
            model1={selectedGame.model1}
            model2={selectedGame.model2}
          />
        </>
      ) : (
        <>
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

          {!activeGame && <GameHistory onGameSelect={handleGameSelect} />}
        </>
      )}
    </div>
  );
}

export default App;
