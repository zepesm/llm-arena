import React, { useState, useEffect } from "react";
import "./ModelSelector.css";

function ModelSelector({ onStartGame, disabled }) {
  const [models, setModels] = useState([]);
  const [model1, setModel1] = useState("");
  const [model2, setModel2] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch("/api/models");
      const data = await response.json();
      setModels(data);
      if (data.length >= 2) {
        setModel1(data[0].name);
        setModel2(data[1].name);
      }
    } catch (error) {
      setError("Failed to fetch models");
      console.error("Error fetching models:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = () => {
    if (model1 && model2) {
      onStartGame(model1, model2);
    }
  };

  if (loading) return <div>Loading models...</div>;
  if (error) return <div className="error">{error}</div>;
  if (models.length < 2) return <div>Not enough models available</div>;

  return (
    <div className="model-selector">
      <div>
        <span className="player-x">Model 1 (X)</span>:{" "}
        <select value={model1} onChange={(e) => setModel1(e.target.value)}>
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="player-o">Model 2 (O)</span>:{" "}
        <select value={model2} onChange={(e) => setModel2(e.target.value)}>
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleStartGame}
        disabled={disabled || model1 === model2}
      >
        {disabled ? "Game in progress..." : "Start Battle"}
      </button>

      {model1 === model2 && (
        <div className="error-message">Please select different models</div>
      )}
    </div>
  );
}

export default ModelSelector;
