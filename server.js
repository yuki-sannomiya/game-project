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
  toyota: 0,
  tepco: 0,
  jr: 0,
  mufg: 0,
  mercari: 0,
  bitcoin: 0,
  jgb: 0,
  usbond: 0
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
      yenHigh: {
        name: "円高進行",
        details: "円高により輸出企業が減益 (例: トヨタ -2%)",
        effect: { toyota: -2 }
      },
      heatWave: {
        name: "猛暑・節電要請",
        details: "電力需要増で電力株が上昇 (例: 東京電力 +2%)",
        effect: { tepco: 2 }
      },
      quake: {
        name: "首都圏で大地震",
        details: "株価下落・インフラ混乱 (例: JR -3%)",
        effect: { jr: -3 }
      },
      boom: {
        name: "米国景気回復",
        details: "全体的に上昇傾向 (例: MUFG +2%)",
        effect: { mufg: 2 }
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
      let updatedTotal = 0;

      for (let key in investment) {
        const ratio = investment[key] / 100;
        const returnRate = (returns[key] || 0) / 100;
        updatedTotal += ratio * (1 + returnRate);
      }

      // 💰 資産に反映（全額ベット）
      player.money = player.money * updatedTotal;
      player.investments = null;  // 次のターンのためにリセット
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
