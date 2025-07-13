// ===== server.js =====
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const PORT = process.env.PORT || 3000;

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
  yenHigh: { name: "円高", effects: { toyota: -3.0, usbond: -2.0, mercari: -1.0 } },
  heatwave: { name: "猛暑・節電要請", effects: { tepco: +3.0 } },
  earthquake: { name: "首都圏で大地震", effects: { jr: -5.0, tepco: -3.0, jgb: +2.0 } },
  usRateHike: { name: "米国金利上昇", effects: { usbond: +2.5, mufg: -1.0 } },
  nintendoHit: { name: "任天堂の大ヒット新作", effects: {} },
  cyberAttack: { name: "金融機関へのサイバー攻撃", effects: { mufg: -3.0 } },
  infection: { name: "新型感染症流行", effects: { bitcoin: +4.0, jr: -2.0 } },
  flood: { name: "大雨による交通マヒ", effects: { jr: -3.0 } },
  inflation: { name: "インフレ進行", effects: { jgb: -1.0 } },
  crash: { name: "株式市場の急落", effects: { mercari: -4.0, toyota: -3.0 } },
  evSubsidy: { name: "EV補助金強化", effects: { toyota: +3.0 } },
  chipShortage: { name: "半導体供給不足", effects: { toyota: -2.0 } },
  usRecovery: { name: "米国景気回復", effects: { usbond: +1.5, mufg: +2.0 } },
  taxHike: { name: "消費税引き上げ", effects: { mercari: -2.0 } },
  yenWeak: { name: "円安", effects: { toyota: +3.0 } },
  telecomOutage: { name: "通信障害", effects: {} },
  healthTrend: { name: "健康志向ブーム", effects: {} },
  volcano: { name: "火山噴火による航空混乱", effects: {} },
  strike: { name: "労働問題・ストライキ", effects: {} },
  snsFlame: { name: "SNS炎上", effects: {} }
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
