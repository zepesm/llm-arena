const WebSocket = require("ws");

class WebSocketHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // gameId -> Set of clients

    this.wss.on("connection", (ws) => {
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === "watch" && data.gameId) {
            this.addClientToGame(ws, data.gameId);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      });

      ws.on("close", () => {
        this.removeClient(ws);
      });
    });
  }

  addClientToGame(ws, gameId) {
    if (!this.clients.has(gameId)) {
      this.clients.set(gameId, new Set());
    }
    this.clients.get(gameId).add(ws);
  }

  removeClient(ws) {
    for (const [gameId, clients] of this.clients.entries()) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.clients.delete(gameId);
      }
    }
  }

  broadcastGameUpdate(gameId, data) {
    const clients = this.clients.get(gameId);
    if (!clients) return;

    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

module.exports = WebSocketHandler;
