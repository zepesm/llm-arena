import GPT3Tokenizer from "gpt3-tokenizer";
import { LlamaTokenizer } from "llama-tokenizer-js";
import { encode as encodeAnthropic } from "@anthropic-ai/tokenizer";
import MistralTokenizer from "mistral-tokenizer-js";
import React from "react";
import "./CostEstimation.css";

// Initialize tokenizers
const gptTokenizer = new GPT3Tokenizer({ type: "gpt3" });
const llamaTokenizer = new LlamaTokenizer();
const mistralTokenizer = MistralTokenizer;

const MODEL_COSTS = {
  "gpt-4o": {
    input: 0.0000025, // $2.50 per million tokens
    output: 0.00001, // $10.00 per million tokens
    name: "GPT-4o",
    tokenizer: "gpt",
  },
  "gpt-4-turbo": {
    input: 0.00001, // $10.00 per million tokens
    output: 0.00003, // $30.00 per million tokens
    name: "GPT-4 Turbo",
    tokenizer: "gpt",
  },
  "gpt-3.5-turbo": {
    input: 0.0000005, // $0.50 per million tokens
    output: 0.0000015, // $1.50 per million tokens
    name: "GPT-3.5 Turbo",
    tokenizer: "gpt",
  },
  "claude-3.5-sonnet": {
    input: 0.000003, // $3.00 per million tokens
    output: 0.000015, // $15.00 per million tokens
    name: "Claude 3.5 Sonnet",
    tokenizer: "claude",
  },
  "claude-3.5-haiku": {
    input: 0.0000008, // $0.80 per million tokens
    output: 0.000004, // $4.00 per million tokens
    name: "Claude 3.5 Haiku",
    tokenizer: "claude",
  },
  "llama-3.2": {
    input: 0.00000035, // $0.35 per million tokens
    output: 0.0000004, // $0.40 per million tokens
    name: "Llama 3.2 (90B Vision)",
    tokenizer: "llama",
  },
  "llama-3.1": {
    input: 0.00000023, // $0.23 per million tokens
    output: 0.0000004, // $0.40 per million tokens
    name: "Llama 3.1 (70B)",
    tokenizer: "llama",
  },
  "gemini-1.5-pro": {
    input: 0.00000125, // $1.25 per million tokens
    output: 0.000005, // $5.00 per million tokens
    name: "Gemini 1.5 Pro",
    tokenizer: "gpt",
  },
  "gemini-1.5-flash": {
    input: 0.000000075, // $0.075 per million tokens
    output: 0.0000003, // $0.30 per million tokens
    name: "Gemini 1.5 Flash",
    tokenizer: "gpt",
  },
  "command-r-plus": {
    input: 0.000003, // $3.00 per million tokens
    output: 0.000015, // $15.00 per million tokens
    name: "Command R+",
    tokenizer: "gpt",
  },
  "mistral-large": {
    input: 0.000002, // $2.00 per million tokens
    output: 0.000006, // $6.00 per million tokens
    name: "Mistral Large",
    tokenizer: "mistral",
  },
};

function CostEstimation({ moves, model1, model2 }) {
  if (!moves || moves.length === 0) return null;

  // Function to count tokens using GPT tokenizer for all models
  const countTokens = (text, modelKey) => {
    try {
      if (!text) return 0;
      const model = MODEL_COSTS[modelKey];

      switch (model.tokenizer) {
        case "gpt":
          return gptTokenizer.encode(text).bpe.length;
        case "llama":
          return llamaTokenizer.encode(text).length;
        case "claude":
          return encodeAnthropic(text).length;
        case "mistral":
          return mistralTokenizer.encode(text).length;
        default:
          // Fallback to GPT tokenizer
          console.warn(
            `No specific tokenizer for ${modelKey}, using GPT tokenizer`
          );
          return gptTokenizer.encode(text).bpe.length;
      }
    } catch (error) {
      console.warn(
        `Token counting failed for ${modelKey} with text "${text.substring(
          0,
          50
        )}...":`,
        error
      );
      // Fallback to GPT tokenizer on error
      try {
        return gptTokenizer.encode(text).bpe.length;
      } catch {
        return 0;
      }
    }
  };

  // Calculate total tokens from the game
  const totalPromptTokens = moves.reduce((sum, move) => {
    const reportedTokens = move.interaction?.promptTokens || 0;
    const calculatedTokens = countTokens(
      move.interaction?.prompt || "",
      move.interaction?.model.toLowerCase()
    );
    if (Math.abs(reportedTokens - calculatedTokens) > 10) {
      console.warn(
        `Token count mismatch for ${move.interaction?.model}:`,
        `API reported ${reportedTokens}, calculated ${calculatedTokens}`
      );
    }
    return sum + reportedTokens;
  }, 0);
  const totalResponseTokens = moves.reduce((sum, move) => {
    const reportedTokens = move.interaction?.responseTokens || 0;
    const calculatedTokens = countTokens(
      move.interaction?.response || "",
      move.interaction?.model.toLowerCase()
    );
    if (Math.abs(reportedTokens - calculatedTokens) > 10) {
      console.warn(
        `Token count mismatch for ${move.interaction?.model}:`,
        `API reported ${reportedTokens}, calculated ${calculatedTokens}`
      );
    }
    return sum + reportedTokens;
  }, 0);

  // Calculate costs for all models
  const allModelCosts = Object.entries(MODEL_COSTS)
    .map(([key, model]) => {
      // Calculate tokens for each move using model-specific tokenizer
      const modelTokenCounts = moves.reduce(
        (acc, move) => {
          const promptTokens = countTokens(move.interaction?.prompt || "", key);
          const responseTokens = countTokens(
            move.interaction?.response || "",
            key
          );
          // Debug logging
          if (MODEL_COSTS[key].tokenizer === "claude") {
            console.log(`Claude tokenization for ${key}:`, {
              prompt: move.interaction?.prompt?.substring(0, 50),
              promptTokens,
              response: move.interaction?.response?.substring(0, 50),
              responseTokens,
            });
          }
          return {
            promptTokens: acc.promptTokens + promptTokens,
            responseTokens: acc.responseTokens + responseTokens,
          };
        },
        { promptTokens: 0, responseTokens: 0 }
      );

      const inputCost = modelTokenCounts.promptTokens * model.input;
      const outputCost = modelTokenCounts.responseTokens * model.output;

      return {
        name: model.name,
        key: key,
        promptTokens: modelTokenCounts.promptTokens,
        responseTokens: modelTokenCounts.responseTokens,
        totalCost: inputCost + outputCost,
        isCurrentModel:
          key === model1.toLowerCase() || key === model2.toLowerCase(),
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  // Add a note about token counting differences
  const tokenCountNote =
    "* Token counts are calculated using model-specific tokenizers where available";

  return (
    <div className="cost-estimation">
      <h3>Cost Comparison Across Models</h3>
      <div className="cost-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Tokens</th>
              <th>Costs</th>
            </tr>
          </thead>
          <tbody>
            {allModelCosts.map((modelCost, index) => (
              <tr
                key={modelCost.name}
                className={modelCost.isCurrentModel ? "current-model" : ""}
              >
                <td>
                  {modelCost.name}
                  <span className="tokenizer-label">
                    {`${
                      MODEL_COSTS[modelCost.key].tokenizer
                        .charAt(0)
                        .toUpperCase() +
                      MODEL_COSTS[modelCost.key].tokenizer.slice(1)
                    } Tokenizer`}
                  </span>
                  {modelCost.isCurrentModel && (
                    <span className="current-label">Current</span>
                  )}
                </td>
                <td>
                  <div className="token-row">
                    <span>Prompt</span>
                    <span className="token-value">
                      {modelCost.promptTokens.toLocaleString()}
                      {!MODEL_COSTS[modelCost.key].tokenizer && (
                        <span className="approx-label">~</span>
                      )}
                    </span>
                  </div>
                  <div className="token-row">
                    <span>Response</span>
                    <span className="token-value">
                      {modelCost.responseTokens.toLocaleString()}
                      {!MODEL_COSTS[modelCost.key].tokenizer && (
                        <span className="approx-label">~</span>
                      )}
                    </span>
                  </div>
                  <div className="token-row total-tokens-row">
                    <span>Total</span>
                    <span className="token-value">
                      {(
                        modelCost.promptTokens + modelCost.responseTokens
                      ).toLocaleString()}
                      {!MODEL_COSTS[modelCost.key].tokenizer && (
                        <span className="approx-label">~</span>
                      )}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="token-row">
                    <span>Prompt</span>
                    <span className="cost-value">
                      $
                      {(
                        modelCost.promptTokens *
                          MODEL_COSTS[modelCost.key]?.input || 0
                      ).toFixed(4)}
                    </span>
                  </div>
                  <div className="token-row">
                    <span>Response</span>
                    <span className="cost-value">
                      $
                      {(
                        modelCost.responseTokens *
                          MODEL_COSTS[modelCost.key]?.output || 0
                      ).toFixed(4)}
                    </span>
                  </div>
                  <div className="token-row total-cost-row">
                    <span>Total</span>
                    <span className="cost-value">
                      ${modelCost.totalCost.toFixed(4)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cost-projection">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>100 Games</th>
              <th>1,000 Games</th>
              <th>10,000 Games</th>
            </tr>
          </thead>
          <tbody>
            {allModelCosts.map((modelCost) => (
              <tr
                key={modelCost.name}
                className={modelCost.isCurrentModel ? "current-model" : ""}
              >
                <td>
                  {modelCost.name}
                  <span className="tokenizer-label">
                    {`${
                      MODEL_COSTS[modelCost.key].tokenizer
                        .charAt(0)
                        .toUpperCase() +
                      MODEL_COSTS[modelCost.key].tokenizer.slice(1)
                    } Tokenizer`}
                  </span>
                  {modelCost.isCurrentModel && (
                    <span className="current-label">Current</span>
                  )}
                </td>
                <td className="cost-cell">
                  ${(modelCost.totalCost * 100).toFixed(2)}
                </td>
                <td className="cost-cell">
                  ${(modelCost.totalCost * 1000).toFixed(2)}
                </td>
                <td className="cost-cell">
                  ${(modelCost.totalCost * 10000).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cost-disclaimer">
        * Costs are approximate and based on public API pricing
        <br />
        {tokenCountNote}
      </div>
    </div>
  );
}

export default CostEstimation;
