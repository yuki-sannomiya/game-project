const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let players = [];
let baseReturns = {
  toyota: 2,
  tepco: 1,
  jr: 1.5,
  mufg: 1.2,
  mercari: 3,
  bitcoin: 5,
  jgb: 0.5,
  usbond: 1.5,
};
let currentReturns = { ...baseReturns };
let activeEvents = [];

const eventEffects = {
  yenHigh: { name: "円高進行", details: "円高によりトヨタ-2%", impact: { toyota: -2 } },
  heatWave: { name: "猛暑・節電要請", details: "東京電力+2%", impact: { tepco: 2 } },
  quake: { name: "首都圏で大地震", details: "JR-3%", impact: { jr: -3 } },
  boom: { name: "米国景気回復", details: "MUFG+2%", impact: { mufg: 2 } },
};

io.on("connection", (socket) => {
  socket.on("joinAsPlayer", (name) => {
    const player = { id: socket.id, name, money: 100, hasInvested: false, investments: {} };
    players.push(player);
    socket.emit("updatedReturns", currentReturns);
    io.emit("playerList", players);
    socket.emit("activeEvents", activeEvents);
  });

  socket.on("submitInvestment", (investments) => {
    const player = players.find(p => p.id === socket.id);
    if (!player || player.hasInvested) return;

    player.investments = investments;
    player.hasInvested = true;

    const profit = Object.entries(investments).reduce((acc, [key, percent]) => {
      return acc + (player.money * percent / 100) * (currentReturns[key] / 100);
    }, 0);

    player.money += profit;
    io.emit("playerList", players);
  });

  socket.on("joinAsGM", () => {
    socket.emit("gmJoined");
    socket.emit("playerList", players);
    socket.emit("activeEvents", activeEvents);
  });

  socket.on("applyEvent", (key) => {
    const event = eventEffects[key];
    if (!event) return;

    activeEvents.push(event);
    for (let asset in event.impact) {
      currentReturns[asset] += event.impact[asset];
    }

    io.emit("eventApplied", event);
    io.emit("updatedReturns", currentReturns);
    io.emit("activeEvents", activeEvents);
  });
});

http.listen(3000, () => {
  console.log("Server listening on port 3000");
});
