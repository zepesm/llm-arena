import React from "react";
import "./GameLog.css";

function GameLog({ moves }) {
  if (!moves || moves.length === 0) {
    return <div className="game-log">No moves to display</div>;
  }

  return (
    <div className="game-log">
      <h4>Game Log</h4>
      {moves.map((move, index) => (
        <div key={index} className="move-entry">
          <div className="move-header">
            <div className="move-info">
              <strong>Move {index + 1}</strong>
            </div>
            <span
              className={`model-name ${
                index % 2 === 0 ? "player-x" : "player-o"
              }`}
            >
              {move.interaction?.model || move.model}
            </span>
            <span className="move-position">Position: {move.position}</span>
            {move.isRandom && <span className="random-move">(random)</span>}
          </div>
          {move.interaction && (
            <div className="move-details">
              <div className="move-stats">
                <span className="timing">
                  {(move.interaction.timingMs / 1000).toFixed(1)}s
                </span>
                <span className="tokens">
                  {move.interaction.promptTokens} prompt,{" "}
                  {move.interaction.responseTokens} response tokens
                </span>
                {move.interaction.attempts > 1 && (
                  <span className="attempts">
                    {move.interaction.attempts} attempts
                  </span>
                )}
              </div>
              <div className="prompt">
                <strong>Prompt:</strong>
                <pre>{move.interaction.prompt}</pre>
              </div>
              <div className="response">
                <strong>Response:</strong>
                <pre>{move.interaction.response}</pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default GameLog;
