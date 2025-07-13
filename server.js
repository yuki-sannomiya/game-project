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
  yenHigh: { name: "円高進行（150→135円）", effects: { toyota: -3, usbond: -2, mercari: -1 } },
  heatwave: { name: "猛暑・節電要請", effects: { tepco: +4 } },
  earthquake: { name: "首都圏で大地震", effects: { jr: -5, tepco: -3, jgb: +2 } },
  usRateHike: { name: "米国金利上昇（1%利上げ）", effects: { usbond: +2, bitcoin: -2 } },
  nintendoHit: { name: "任天堂の大ヒット新作", effects: { mercari: +4 } },
  cyberAttack: { name: "金融機関へのサイバー攻撃", effects: { mufg: -3 } },
  pandemic: { name: "新型感染症流行", effects: { jr: -4, mercari: -2, jgb: +2 } },
  heavyRain: { name: "大雨による交通マヒ", effects: { jr: -3 } },
  inflation: { name: "インフレ進行（物価高）", effects: { jgb: -1, bitcoin: +3 } },
  stockCrash: { name: "株式市場の急落", effects: { toyota: -4, mufg: -3, mercari: -5 } },
  evSubsidy: { name: "世界的EV補助金強化", effects: { toyota: +3, mercari: +2 } },
  chipShortage: { name: "半導体供給不足", effects: { toyota: -3, mercari: -2 } },
  usRecovery: { name: "米国景気回復の兆し", effects: { usbond: +2, toyota: +2 } },
  taxHike: { name: "消費税引き上げ決定", effects: { mercari: -3, mufg: -1 } },
  yenLow: { name: "円安進行（135→150円）", effects: { toyota: +3, usbond: +1 } },
  netDown: { name: "大規模通信障害", effects: { mercari: -3 } },
  healthTrend: { name: "健康志向ブーム", effects: { } },
  volcano: { name: "火山噴火による航空混乱", effects: { jr: -2 } },
  laborStrike: { name: "労働問題・ストライキ", effects: { tepco: -2 } },
  snsScandal: { name: "SNSで炎上騒動", effects: { mercari: -2 } }
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