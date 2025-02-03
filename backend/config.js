const config = {
  development: {
    port: 3001,
    ollamaUrl: "http://localhost:11434",
    dbPath: "./arena.db",
  },
  production: {
    port: process.env.PORT || 3001,
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    dbPath: process.env.DB_PATH || "./arena.db",
  },
};

const env = process.env.NODE_ENV || "development";
module.exports = config[env];
