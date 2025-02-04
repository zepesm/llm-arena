import React from "react";
import "./GameBoard.css";
import CostEstimation from "./CostEstimation";

const GameStats = ({ moves, model1, model2 }) => {
  const getModelStats = (modelName) => {
    // Filter moves by the current player's turn
    const modelMoves =
      moves?.filter((m) => m.interaction?.model === modelName) || [];
    if (modelMoves.length === 0) return null;

    console.log(`Stats for ${modelName}:`, modelMoves); // Debug log

    const totalTime = modelMoves.reduce(
      (sum, m) => sum + (m.interaction?.timingMs || 0),
      0
    );
    const avgTime = totalTime / modelMoves.length;

    const totalRequestTokens = modelMoves.reduce(
      (sum, m) => sum + (m.interaction?.promptTokens || 0),
      0
    );
    const totalResponseTokens = modelMoves.reduce(
      (sum, m) => sum + (m.interaction?.responseTokens || 0),
      0
    );

    // Debug logs
    console.log(`${modelName} totals:`, {
      moves: modelMoves.length,
      totalTime: totalTime / 1000,
      avgTime: avgTime / 1000,
      totalRequestTokens,
      totalResponseTokens,
    });

    return {
      model: modelName,
      totalTime: (totalTime / 1000).toFixed(1),
      avgTime: (avgTime / 1000).toFixed(1),
      totalRequestTokens,
      totalResponseTokens,
      avgRequestTokens: (totalRequestTokens / modelMoves.length).toFixed(1),
      avgResponseTokens: (totalResponseTokens / modelMoves.length).toFixed(1),
    };
  };

  const model1Stats = getModelStats(model1);
  const model2Stats = getModelStats(model2);

  return (
    <div className="game-stats">
      {[model1Stats, model2Stats].map((stats, idx) => {
        if (!stats) return null;

        return (
          <div key={stats.model} className="model-stats">
            <div
              className={`model-name ${idx === 0 ? "player-x" : "player-o"}`}
            >
              {stats.model}
            </div>
            <div className="stats-grid">
              <div>Total time:</div>
              <div>{stats.totalTime}s</div>
              <div>Avg time:</div>
              <div>{stats.avgTime}s</div>
              <div>Request tokens:</div>
              <div>{stats.totalRequestTokens}</div>
              <div>Response tokens:</div>
              <div>{stats.totalResponseTokens}</div>
              <div>Avg request:</div>
              <div>{stats.avgRequestTokens}</div>
              <div>Avg response:</div>
              <div>{stats.avgResponseTokens}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function GameBoard({
  board,
  gameStatus,
  currentTurn,
  reason,
  moves,
  model1,
  model2,
}) {
  const getStatus = (status, currentTurn) => {
    switch (status) {
      case "waiting":
        return "Waiting for game to start...";
      case "move":
        return (
          <>
            Current turn:{" "}
            <span
              className={`model-name ${
                currentTurn === model1 ? "player-x" : "player-o"
              }`}
            >
              {currentTurn}
            </span>
          </>
        );
      case "error":
        return "Game ended due to error";
      default:
        return reason || "Game ended";
    }
  };

  const getMoveInfo = (position) => {
    const move = moves?.find((m) => m.position === position);
    if (!move) return null;

    const parts = [];
    // Find the move number (1-based index)
    const moveNumber = moves.findIndex((m) => m.position === position) + 1;
    parts.push(`#${moveNumber}`);

    // Show timing and tokens for every move
    const timing = move.interaction?.timingMs;
    console.log(move.interaction);
    if (timing) {
      parts.push(`${(timing / 1000).toFixed(1)}s`);
    }

    const tokens =
      move.interaction?.promptTokens + move.interaction?.responseTokens;

    if (tokens) {
      parts.push(`${tokens}t`);
    }

    // Extract thinking from response
    const thinking = move.interaction?.response
      ?.match(/<think>(.*?)<\/think>/s)?.[1]
      ?.trim();

    return {
      info: parts.length > 0 ? `(${parts.join(", ")})` : null,
      thinking,
      model: move.model,
    };
  };

  const isRandomMove = (index) => {
    return moves?.some((move) => move.position === index && move.isRandom);
  };

  const getCellClass = (cell, index) => {
    const classes = ["cell"];
    if (isRandomMove(index)) classes.push("random-move");
    if (cell === "X") classes.push("player-x");
    if (cell === "O") classes.push("player-o");

    // Add move number class if this cell has a move
    const move = moves?.find((m) => m.position === index);
    if (move) {
      // Find the move number (1-based index) for this position
      const moveNumber = moves.findIndex((m) => m.position === index) + 1;
      classes.push(`move-${moveNumber}`);
    }

    return classes.join(" ");
  };

  const renderCurrentTurn = () => {
    if (gameStatus === "waiting") return null;
    if (gameStatus === "completed") return null;

    // Check if current turn is model1 (X) or model2 (O)
    const isModel1Turn = currentTurn === model1;

    return (
      <div className="current-turn">
        Current turn:{" "}
        <span className={`player-${isModel1Turn ? "x" : "o"}`}>
          {currentTurn}
        </span>
      </div>
    );
  };

  const renderGameStatus = () => {
    if (gameStatus === "waiting") return null;
    if (gameStatus === "completed") {
      if (reason === "Game ended in a draw") {
        return <div className="game-result">Game ended in a draw</div>;
      } else {
        // Parse the winner's name from the reason text
        const winnerModel = reason.split(" won")[0];
        // Check if winner matches model1 (X) or model2 (O)
        const isWinnerModel1 = model1 === winnerModel;

        return (
          <div className="game-result">
            <span
              className={`winner-name player-${isWinnerModel1 ? "x" : "o"}`}
            >
              {winnerModel}
            </span>
            {" won the game"}
          </div>
        );
      }
    }

    if (gameStatus === "error") {
      return <div className="status">Game ended due to error</div>;
    }
    return null;
  };

  const renderStats = () => {
    if (!moves || moves.length === 0) return null;

    const totalTime = moves.reduce(
      (sum, move) => sum + (move.interaction?.timingMs || 0),
      0
    );
    const totalTokens = moves.reduce(
      (sum, move) =>
        sum +
        ((move.interaction?.promptTokens || 0) +
          (move.interaction?.responseTokens || 0)),
      0
    );
    const randomMoves = moves.filter((move) => move.isRandom).length;

    return (
      <div className="game-stats">
        <div className="stat-item">
          <span className="stat-label">Total Time</span>
          <span className="stat-value">{(totalTime / 1000).toFixed(1)}s</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Moves</span>
          <span className="stat-value">{moves.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Random Moves</span>
          <span className="stat-value">{randomMoves}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Tokens</span>
          <span className="stat-value">{totalTokens.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg Tokens/Move</span>
          <span className="stat-value">
            {(totalTokens / moves.length).toFixed(0)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="game-board">
      {renderCurrentTurn()}
      <div className="board">
        {board.map((cell, i) => (
          <div key={i} className="cell-container">
            <div
              className={getCellClass(cell, i)}
              title={getMoveInfo(i)?.thinking}
            >
              {cell}
              {cell && getMoveInfo(i) && (
                <div className="move-info">{getMoveInfo(i).info}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <GameStats moves={moves} model1={model1} model2={model2} />
      {renderGameStatus()}
      {renderStats()}
      <CostEstimation moves={moves} model1={model1} model2={model2} />
    </div>
  );
}

export default GameBoard;
