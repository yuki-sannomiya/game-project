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

const events = [
  { name: "円高進行（150→135円）", effects: { toyota: -3, usbond: -2, mercari: -1 } },
  { name: "猛暑・節電要請", effects: { tepco: +3, jgb: +1 } },
  { name: "首都圏で大地震", effects: { jr: -5, tepco: -3, jgb: +2 } },
  { name: "米国金利上昇（1%利上げ）", effects: { usbond: +3, mufg: -2 } },
  { name: "任天堂の大ヒット新作", effects: { mercari: +5 } },
  { name: "金融機関へのサイバー攻撃", effects: { mufg: -4 } },
  { name: "新型感染症流行", effects: { jr: -3, bitcoin: +2, jgb: +1 } },
  { name: "大雨による交通マヒ", effects: { jr: -2, tepco: +1 } },
  { name: "インフレ進行（物価高）", effects: { bitcoin: +3, jgb: -1 } },
  { name: "株式市場の急落", effects: { mercari: -4, mufg: -3 } },
  { name: "世界的EV補助金強化", effects: { toyota: +2 } },
  { name: "半導体供給不足", effects: { mercari: -2, toyota: -2 } },
  { name: "米国景気回復の兆し", effects: { usbond: +2, mufg: +2 } },
  { name: "消費税引き上げ決定", effects: { mercari: -1, bitcoin: +2 } },
  { name: "円安進行（135→150円）", effects: { toyota: +3, mercari: +1 } },
  { name: "大規模通信障害", effects: { mercari: -3 } },
  { name: "健康志向ブーム", effects: { tepco: -1 } },
  { name: "火山噴火による航空混乱", effects: { jr: -3 } },
  { name: "労働問題・ストライキ", effects: { tepco: -2 } },
  { name: "SNSで炎上騒動", effects: { mercari: -2 } }
];

let gameState = {
  players: {},
  gmSocketId: null,
  currentReturns: {},
  eventApplied: false
};

function getAdjustedReturns(selectedEventIndices) {
  const result = {};
  const effects = {};
  selectedEventIndices.forEach(i => {
    const ev = events[i - 1];
    for (let key in ev.effects) {
      effects[key] = (effects[key] || 0) + ev.effects[key];
    }
  });

  for (let key in assets) {
    const base = assets[key].baseReturn;
    const variance = assets[key].variance;
    const random = (Math.random() * 2 - 1) * variance;
    const eventBonus = effects[key] || 0;
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
    socket.emit("baseReturns", Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, v.baseReturn])));
    io.emit("playerList", Object.values(gameState.players));
  });

  socket.on("submitInvestment", (data) => {
    const player = gameState.players[socket.id];
    if (player) {
      player.investments = data;
      player.hasInvested = true;

      const allInvested = Object.values(gameState.players).every(p => p.hasInvested);
      if (allInvested && gameState.gmSocketId) {
        io.to(gameState.gmSocketId).emit("allInvested");
      }
    }
  });

  socket.on("applyEvent", (eventIndices) => {
    const updated = getAdjustedReturns(eventIndices);
    gameState.currentReturns = updated;

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

    const eventNames = eventIndices.map(i => events[i - 1].name);
    io.emit("updatedReturns", { returns: updated, events: eventNames });
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
