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

    const prompt = `IMPORTANT: This is a Tic-tac-toe game analysis ONLY.
    You are playing Tic-tac-toe as player ${playerSymbol}. 
    
    Current board state (ANALYZE THIS EXACT BOARD):
    ${boardStr}
    
    MOVE HISTORY:
    ${
      gameState.moves && gameState.game.moveCount > 0
        ? gameState.moves
            .map((move, index) => {
              const moveNumber = index + 1;
              const isYourMove =
                (moveNumber % 2 === 1 && playerSymbol === "X") ||
                (moveNumber % 2 === 0 && playerSymbol === "O");
              return `Move #${moveNumber}: ${
                isYourMove ? "YOU" : "OPPONENT"
              } played position ${move.position}`;
            })
            .join("\n   ")
        : "No moves yet"
    }
    
    YOUR PREVIOUS MOVES: ${
      gameState.moves
        ? gameState.moves
            .filter(
              (move, index) =>
                (playerSymbol === "X" && index % 2 === 0) ||
                (playerSymbol === "O" && index % 2 === 1)
            )
            .map((move) => move.position)
            .join(", ")
        : "None"
    }
    
    OPPONENT'S MOVES: ${
      gameState.moves
        ? gameState.moves
            .filter(
              (move, index) =>
                (playerSymbol === "X" && index % 2 === 1) ||
                (playerSymbol === "O" && index % 2 === 0)
            )
            .map((move) => move.position)
            .join(", ")
        : "None"
    }
    
    THIS IS MOVE NUMBER: ${(gameState.moves?.length || 0) + 1}
    
    Available moves (MUST choose from these): ${validMoves.join(", ")}
    
    GAME RULES:
    1. You MUST choose a number from available moves: ${validMoves.join(", ")}
    2. Think using <think> tags
    3. End with ONLY a single digit number
    4. You are playing as ${playerSymbol}, opponent is ${
      playerSymbol === "X" ? "O" : "X"
    }
    5. Goal: Get 3 of your symbols in a line (row, column, or diagonal)

    BOARD POSITIONS (Use these numbers):
    0 | 1 | 2
    ---------
    3 | 4 | 5
    ---------
    6 | 7 | 8

    LINE DEFINITIONS:
    - Rows: [0,1,2], [3,4,5], [6,7,8]
    - Columns: [0,3,6], [1,4,7], [2,5,8]
    - Diagonals: [0,4,8], [2,4,6]

    HOW TO COUNT SYMBOLS IN A LINE:
    1. Pick ONE complete line from definitions above
    2. Count EXACT number of each symbol in that line
    3. List positions using board numbers
    4. MUST have EXACTLY 3 positions in same line

    Example board:
    ${playerSymbol} | ${playerSymbol === "X" ? "O" : "X"} | 2
    ---------
    ${playerSymbol === "X" ? "O" : "X"} | ${playerSymbol} | 5
    ---------
    6 | 7 | ${playerSymbol}

    CORRECT counting examples:
    ✓ Diagonal [0,4,8]: ${playerSymbol}[0] + ${playerSymbol}[4] + ${playerSymbol}[8] = 3 ${playerSymbol} (win)
    ✓ Row 1 [0,1,2]: ${playerSymbol}[0] + ${
      playerSymbol === "X" ? "O" : "X"
    }[1] + empty[2] = 1 ${playerSymbol}, 1 ${playerSymbol === "X" ? "O" : "X"}
    ✓ Column 1 [0,3,6]: ${playerSymbol}[0] + ${
      playerSymbol === "X" ? "O" : "X"
    }[3] + empty[6] = 1 ${playerSymbol}, 1 ${playerSymbol === "X" ? "O" : "X"}

    INCORRECT counting (don't do this):
    ❌ "Two symbols in line" (must list exact positions)
    ❌ Mixing positions from different lines
    ❌ Counting diagonal without center position
    ❌ Counting incomplete lines

    CRITICAL THREAT DEFINITION:
    A line must have ALL of these:
    1. EXACTLY 2 opponent symbols (list positions)
    2. EXACTLY 1 empty space (list position)
    3. ZERO of your symbols
    4. All 3 positions in same line

    Example threats:
    ${playerSymbol === "X" ? "O" : "X"}[0] + ${
      playerSymbol === "X" ? "O" : "X"
    }[1] + empty[2] = THREAT
    ${playerSymbol === "X" ? "O" : "X"}[0] + empty[4] + ${
      playerSymbol === "X" ? "O" : "X"
    }[8] = THREAT

    NOT threats:
    ${
      playerSymbol === "X" ? "O" : "X"
    }[0] + empty[1] + empty[2] = NOT THREAT (only 1 opponent)
    ${playerSymbol === "X" ? "O" : "X"}[0] + ${
      playerSymbol === "X" ? "O" : "X"
    }[1] + ${playerSymbol}[2] = NOT THREAT (blocked)

    WINNING MOVE DEFINITION:
    A line must have ALL of these:
    1. EXACTLY 2 of your symbols (list positions)
    2. EXACTLY 1 empty space (list position)
    3. ZERO opponent symbols
    4. All 3 positions in same line

    PRIORITY RULES:
    1. If there's a winning move (2 of your symbols + 1 empty in a line) -> TAKE IT
    2. If there's a critical threat (2 opponent symbols + 1 empty in a line) -> BLOCK IT
    3. If you can create a fork (two potential winning lines) -> DO IT
    4. If opponent can create a fork -> BLOCK IT
    5. Otherwise -> Analyze opponent's potential next moves:
      a) For each possible move you make
      b) List opponent's best responses
      c) Choose move that limits opponent's opportunities
      d) Prefer moves that create future winning chances
    
    LOOK-AHEAD ANALYSIS:
    For each possible move:
    1. If you play position [X]:
       - What winning lines could YOU create next turn?
       - What winning lines could OPPONENT create next turn?
       - How many future winning possibilities for YOU?
       - How many future winning possibilities for OPPONENT?
    
    STRATEGIC PRIORITIES:
    1. Create TWO potential winning lines (a fork)
    2. Block opponent from creating TWO potential winning lines
    3. Create ONE potential winning line while blocking opponent's line
    4. Take center (position 4) if available
    5. Take corner (0,2,6,8) if available
    6. Take side (1,3,5,7) if it creates future opportunities

    RESPONSE FORMAT:
    <think>
    1. Board state confirmation:
       - Current board: [Show exact board]
       - Available moves: [List from ${validMoves.join(", ")}]
       - Your symbol: ${playerSymbol}

    2. Line-by-line analysis:
       Row 1 [0,1,2]: [List symbols and positions]
       Row 2 [3,4,5]: [List symbols and positions]
       Row 3 [6,7,8]: [List symbols and positions]
       Col 1 [0,3,6]: [List symbols and positions]
       Col 2 [1,4,7]: [List symbols and positions]
       Col 3 [2,5,8]: [List symbols and positions]
       Diag 1 [0,4,8]: [List symbols and positions]
       Diag 2 [2,4,6]: [List symbols and positions]

    3. Findings:
       - Critical threats: [List any lines with EXACTLY 2 opponent + 1 empty]
       - Winning moves: [List any lines with EXACTLY 2 yours + 1 empty]
       - Future opportunities analysis:
          * Position [X]: Creates winning lines [List], Blocks lines [List]
          * Position [Y]: Creates winning lines [List], Blocks lines [List]
          (Analyze each available position)

    4. Move validation:
       - Chosen position: [Number]
       - Confirms line: [Show complete line analysis]
       - Available: [Verify in ${validMoves.join(", ")}]
       - Strategic value:
          * Winning lines created: [List]
          * Opponent lines blocked: [List]
          * Future winning possibilities: [List]

    5. Strategy chosen:
       [Explain which priority rule led to your decision]
       [Explain why this move is better than other options]
       [List specific winning possibilities created]
    </think>
    [Single digit number]`;

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
              : `RETRY ATTEMPT ${attempt}: Previous response was invalid.

You are playing Tic-tac-toe as player ${playerSymbol}. 
Current board state:
${boardStr}

⚠️ PREVIOUS ATTEMPT FAILED - READ CAREFULLY:
1. Your last move was invalid
2. You can ONLY choose from these positions: ${validMoves.join(", ")}
3. Any other number will be rejected

CRITICAL RULES:
1. VALID MOVES: ${validMoves.join(", ")} (ONLY these numbers are allowed)
2. YOUR SYMBOL: ${playerSymbol}
3. FORMAT: Use <think> tags, then end with single number
4. IMPORTANT: The number MUST be one from valid moves list

BOARD POSITIONS:
0 | 1 | 2
---------
3 | 4 | 5
---------
6 | 7 | 8

STEP-BY-STEP INSTRUCTIONS:
1. Look at the current board state above
2. Choose ONE number from valid moves: ${validMoves.join(", ")}
3. Explain your strategy in <think> tags
4. End response with ONLY that number

RESPONSE FORMAT:
<think>
Your strategy here...
</think>
[Type ONE of these numbers: ${validMoves.join(", ")}]`,
          stream: false,
          options: {
            temperature: 0.2,
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
