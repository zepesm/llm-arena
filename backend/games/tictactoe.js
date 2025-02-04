class TicTacToe {
  constructor() {
    this.board = Array(9).fill(null);
    this.moveCount = 0;
    this.moveHistory = [];
  }

  makeMove(position, player) {
    if (this.board[position] || position < 0 || position > 8) {
      return false;
    }
    this.board[position] = player;
    this.moveCount++;
    this.moveHistory.push({ position, player });
    if (this.board[position] !== player) {
      throw new Error(
        `Move verification failed: board[${position}] = ${this.board[position]}, expected ${player}`
      );
    }
    return true;
  }

  isGameOver() {
    return this.checkWinner() || this.moveCount === 9;
  }

  checkWinner() {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // columns
      [0, 4, 8],
      [2, 4, 6], // diagonals
    ];

    for (const [a, b, c] of lines) {
      if (
        this.board[a] &&
        this.board[a] === this.board[b] &&
        this.board[a] === this.board[c]
      ) {
        return this.board[a];
      }
    }

    if (this.moveCount === 9) {
      return "draw";
    }

    return null;
  }

  getValidMoves() {
    return this.board
      .map((cell, index) => (cell === null ? index : null))
      .filter((index) => index !== null);
  }
}

module.exports = TicTacToe;
