const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

app.get("/gm", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "gm.html"));
});

let players = [];
let returns = {
  toyota: 2.0,
  tepco: 1.0,
  jr: 0.0,
  mufg: 1.5,
  mercari: 3.0,
  bitcoin: 5.0,
  jgb: 0.3,
  usbond: 0.8,
  inpex: 2.5,        // 追加
  nintendo: 1.8      // 追加
};


let activeEvents = [];

io.on("connection", (socket) => {
  console.log("New player connected");

  socket.on("joinAsPlayer", (name) => {
    players.push({ id: socket.id, name, money: 100 });
    io.emit("playerList", players);
    socket.emit("updatedReturns", returns);
    socket.emit("activeEvents", activeEvents);
  });

  socket.on("submitInvestment", (investments) => {
    const player = players.find((p) => p.id === socket.id);
    if (!player) return;
    player.investments = investments;
    io.emit("playerList", players);
  });

  socket.on("applyEvent", (eventKey) => {
    const eventMap = {
  quake: {
    name: "首都圏大地震",
    details: "電車が止まり停電。経済にも大打撃",
    effect: { jr: -5, tepco: -5, jgb: 2 }
  },
  heatWave: {
    name: "猛暑と電力不足",
    details: "電力需要急増。東電は好調だがJRは減便",
    effect: { tepco: 4, jr: -2, inpex: 2 }
  },
  oilShock: {
    name: "世界的な原油高",
    details: "石油価格高騰。エネルギー関連は上昇",
    effect: { inpex: 4, toyota: -3, tepco: -1 }
  },
  yenHigh: {
    name: "円高進行",
    details: "円の価値が上がり、輸出が打撃を受ける",
    effect: { toyota: -4, usbond: -2, mufg: -1 }
  },
  nintendoHit: {
    name: "任天堂の新作が大ヒット",
    details: "世界中で売れて株価急騰！",
    effect: { nintendo: 5, mercari: 2 }
  },
  recession: {
    name: "景気後退ムード",
    details: "投資家が慎重に。債券が注目される",
    effect: { mufg: -2, toyota: -2, jgb: 2 }
  },
  remoteWork: {
    name: "リモートワーク拡大",
    details: "通勤が減って電車が空いてる",
    effect: { jr: -3, mercari: 3 }
  },
  cryptoCrash: {
    name: "仮想通貨が暴落",
    details: "ビットコインが大きく下がった",
    effect: { bitcoin: -5, mufg: -1 }
  },
  usBoom: {
    name: "米国景気回復",
    details: "米国の好景気で株価上昇",
    effect: { usbond: 2, toyota: 1, mufg: 1 }
  },
  noEvent: {
    name: "特になし",
    details: "今日は穏やかな1日でした",
    effect: {}
  }
};


    const event = eventMap[eventKey];
    if (!event) return;

    activeEvents.push(event);
    for (let asset in event.effect) {
      if (returns[asset] !== undefined) {
        returns[asset] += event.effect[asset];
      }
    }

    io.emit("activeEvents", activeEvents);
    io.emit("updatedReturns", returns);
  });

socket.on("finalizeRound", () => {
  for (let player of players) {
    if (!player.investments) continue;

    const investment = player.investments;
    let totalAfterReturn = 0;

    for (let key in investment) {
      const amount = investment[key]; // ← これは金額
      const returnRate = (returns[key] || 0) / 100;
      totalAfterReturn += amount * (1 + returnRate);
    }

    // 💰 新しい資産を代入
    player.money = totalAfterReturn;

    // 投資リセット
    player.investments = null;
  }

  io.emit("playerList", players);
});


  socket.on("disconnect", () => {
    players = players.filter((p) => p.id !== socket.id);
    io.emit("playerList", players);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
