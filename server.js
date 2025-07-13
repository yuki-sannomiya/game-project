// ===== server.js =====
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const PORT = 3000;

app.use(express.static("public"));

const assets = {
  toyota: { name: "トヨタ自動車", baseReturn: 5.0, variance: 6.0 },
  tepco: { name: "東京電力HD", baseReturn: 2.0, variance: 2.0 },
  jr: { name: "JR東日本", baseReturn: 3.0, variance: 3.0 },
  mufg: { name: "MUFG", baseReturn: 4.0, variance: 4.0 },
  mercari: { name: "メルカリ", baseReturn: 7.0, variance: 9.0 },
  bitcoin: { name: "ビットコイン", baseReturn: 0.0, variance: 20.0 },
  jgb: { name: "日本国債", baseReturn: 1.0, variance: 1.0 },
  usbond: { name: "米国債", baseReturn: 2.5, variance: 1.5 }
};

const eventEffects = {
  yenHigh: {
    name: "円高",
    effects: {
      toyota: -3.0,
      usbond: -2.0,
      mercari: -1.0
    }
  },
  quake: {
    name: "地震（東日本）",
    effects: {
      jr: -5.0,
      tepco: -3.0,
      jgb: +2.0
    }
  },
  boom: {
    name: "好景気",
    effects: {
      mercari: +5.0,
      toyota: +3.0,
      mufg: +2.0
    }
  }
};

let gameState = {
  players: {},
  gmSocketId: null,
  currentReturns: {},
  eventApplied: false
};

function getAdjustedReturns(eventKey) {
  const result = {};
  const event = eventEffects[eventKey]?.effects || {};
  for (let key in assets) {
    const base = assets[key].baseReturn;
    const variance = assets[key].variance;
    const random = (Math.random() * 2 - 1) * variance;
    const eventBonus = event[key] || 0;
    result[key] = +(base + random + eventBonus).toFixed(1);
  }
  return result;
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("joinAsGM", () => {
    gameState.gmSocketId = socket.id;
    socket.emit("gmJoined");
  });

  socket.on("joinAsPlayer", (name) => {
    gameState.players[socket.id] = {
      name,
      money: 100,
      investments: {},
      hasInvested: false
    };
    io.emit("playerList", Object.values(gameState.players));
  });

  socket.on("submitInvestment", (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].investments = data;
      gameState.players[socket.id].hasInvested = true;

      const allInvested = Object.values(gameState.players).every(p => p.hasInvested);
      if (allInvested && gameState.gmSocketId) {
        io.to(gameState.gmSocketId).emit("allInvested");
      }
    }
  });

  socket.on("applyEvent", (eventKey) => {
    const updated = getAdjustedReturns(eventKey);
    gameState.currentReturns = updated;
    io.emit("updatedReturns", updated);

    // 資産更新
    for (let id in gameState.players) {
      const player = gameState.players[id];
      let total = 0;
      for (let key in player.investments) {
        const percent = player.investments[key];
        const ret = updated[key];
        total += player.money * (percent / 100) * (1 + ret / 100);
      }
      player.money = +total.toFixed(2);
      player.hasInvested = false;
      player.investments = {};
    }
    io.emit("playerList", Object.values(gameState.players));
  });

  socket.on("disconnect", () => {
    delete gameState.players[socket.id];
    io.emit("playerList", Object.values(gameState.players));
  });
});

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
