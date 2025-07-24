const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 静的ファイルのルート設定
app.use(express.static(path.join(__dirname, "public")));

// 明示的に player.html と gm.html のルーティングを指定
app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

app.get("/gm", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "gm.html"));
});

let players = [];
let returns = {
  toyota: 0,
  nintendo: 0,
  tepco: 0,
  jr: 0,
  mufg: 0,
  tokio: 0,
  mcdonalds: 0,
  jgb: 0,
  usbond: 0,
  bitcoin: 0,
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

    let total = 0;
    for (let key in investments) {
      total += (investments[key] / 100) * (1 + (returns[key] || 0) / 100);
    }

    player.money *= total;
    io.emit("playerList", players);
  });

  socket.on("triggerEvent", (event) => {
    activeEvents.push(event);
    for (let asset in event.effect) {
      if (returns[asset] !== undefined) {
        returns[asset] += event.effect[asset];
      }
    }
    io.emit("activeEvents", activeEvents);
    io.emit("updatedReturns", returns);
  });

  socket.on("disconnect", () => {
    players = players.filter((p) => p.id !== socket.id);
    io.emit("playerList", players);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
