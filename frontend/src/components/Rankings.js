import React from "react";
import "./Rankings.css";

function Rankings({ rankings }) {
  return (
    <div className="rankings">
      <h2>Model Rankings</h2>
      <div className="rankings-list">
        {rankings.map((model, index) => (
          <div key={model.model} className="ranking-item">
            <div className="model-name">{model.model}</div>
            <div className="model-stats">
              <span title="Wins">🏆 {model.wins}</span>
              <span title="Losses">❌ {model.losses}</span>
              <span title="Draws">🤝 {model.draws}</span>
              <span title="Win Rate">
                📊{" "}
                {(
                  (model.wins / (model.wins + model.losses + model.draws)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Rankings;
