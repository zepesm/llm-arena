const { default: axios } = require("axios");

class OllamaHandler {
  constructor() {
    this.activeModel = null;
    this.baseUrl = "http://localhost:11434";
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map((model) => ({
        name: model.name,
        size: model.size,
        modified: model.modified,
      }));
    } catch (error) {
      console.error("Error fetching models:", error);
      throw new Error("Failed to fetch available models");
    }
  }

  async switchModel(modelName) {
    try {
      // Check if model exists
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const modelExists = response.data.models.some(
        (model) => model.name === modelName
      );

      if (!modelExists) {
        throw new Error(`Model ${modelName} not found`);
      }

      this.activeModel = modelName;
      return true;
    } catch (error) {
      console.error("Error switching model:", error);
      throw error;
    }
  }

  async getMove(gameState) {
    if (!this.activeModel) {
      throw new Error("No active model");
    }

    const boardStr = this.formatBoard(gameState.board);
    const playerSymbol = gameState.currentTurn === gameState.model1 ? "X" : "O";

    const validMoves = gameState.game.getValidMoves();
    if (validMoves.length === 0) {
      throw new Error("No valid moves available");
    }

    const prompt = `You are playing Tic-tac-toe as player ${playerSymbol}. 
Current board state:
${boardStr}

Available positions: ${validMoves.join(", ")}

RULES:
1. You MUST choose a number from: ${validMoves.join(", ")}
2. Think using <think> tags
3. End with ONLY a single digit number

REQUIRED FORMAT:
<think>
Brief strategy
</think>
Single digit number - proposed position.

responds with:
<think>
Brief strategy
</think>
Single digit number - proposed valid move.
`;

    const getValidMove = async (attempt = 1) => {
      if (attempt > 3) {
        // After 3 attempts, fall back to random move
        console.warn(
          `Failed to get valid move after ${attempt} attempts, selecting random move`
        );
        return {
          move: validMoves[Math.floor(Math.random() * validMoves.length)],
          interaction: {
            model: this.activeModel,
            prompt,
            response: "Failed to get valid move after multiple attempts",
            note: "Falling back to random move",
            isRandom: true,
            promptTokens: prompt.length,
            responseTokens: 0,
            timingMs: 0,
          },
        };
      }

      try {
        const startTime = Date.now();
        const response = await axios.post(`${this.baseUrl}/api/generate`, {
          model: this.activeModel,
          prompt:
            attempt === 1
              ? prompt
              : `Invalid response. Use this format with a number from ${validMoves.join(
                  ", "
                )}:
<think>
Brief strategy
</think>
[DIGIT]

End with ONLY the digit.`,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
          },
        });

        const modelResponse = response.data.response.trim();
        console.log(`Model ${this.activeModel} response:`, modelResponse);

        // Extract move from response, handling both direct numbers and think-block responses
        let moveMatch;
        // Match the exact format with some flexibility
        const formatMatch = modelResponse.match(
          /<think>[\s\S]*?<\/think>\s*(\d+)\s*$/
        );
        if (formatMatch) {
          moveMatch = formatMatch[1].match(/\d+/);
        } else {
          // Fallback: try to find the last number in the response
          const numbers = modelResponse.match(/\d+/g);
          if (numbers) {
            moveMatch = numbers[numbers.length - 1].match(/\d+/);
          }
        }

        if (!moveMatch) {
          console.warn(
            `Invalid response format: ${modelResponse}, attempt ${attempt}`
          );
          return await getValidMove(attempt + 1);
        }

        const move = parseInt(moveMatch[0]);

        // Validate move is in validMoves
        if (!validMoves.includes(move)) {
          console.warn(
            `Invalid move ${move}, not in valid moves: ${validMoves.join(", ")}`
          );
          return await getValidMove(attempt + 1);
        }

        return {
          move,
          interaction: {
            model: this.activeModel,
            prompt,
            response: modelResponse,
            attempts: attempt,
            promptTokens: response.data.prompt_eval_count || prompt.length,
            responseTokens: response.data.eval_count || modelResponse.length,
            timingMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        console.error("Error getting move from model:", error);
        throw error;
      }
    };

    return await getValidMove(1);
  }

  formatBoard(board) {
    return board
      .map((cell, i) => cell || i)
      .reduce((rows, cell, i) => {
        const rowIndex = Math.floor(i / 3);
        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex].push(cell);
        return rows;
      }, [])
      .map((row) => row.join(" | "))
      .join("\n---------\n");
  }
}

module.exports = OllamaHandler;
