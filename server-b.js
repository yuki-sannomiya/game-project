const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// ゲーム名（Renderの環境変数で設定できる）
const GAME_NAME = process.env.GAME_NAME || "local";
console.log(`Starting Investment Game - ${GAME_NAME}`);

// 確認用のエンドポイント
// → https://<URL>/env にアクセスすると現在のゲーム名が見れる
const app = express();
app.get("/env", (_, res) => res.json({ game: GAME_NAME }));

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
  tepco: 1.5,
  jr: 2.0,
  mufg: 1.5,
  mercari: 3.0,
  bitcoin: 0,
  jgb: 1.0,
  usbond: 1.5,
  inpex: 2.5,        // 追加
  nintendo: 2.3      // 追加
};


let activeEvents = [];

io.on("connection", (socket) => {
  console.log("New player connected");

  socket.on("joinAsGM", () => {
  socket.emit("gmJoined");
  socket.emit("playerList", players);
  socket.emit("updatedReturns", returns);
  socket.emit("activeEvents", activeEvents);
});

// これを io.on("connection", ...) の中に入れる
socket.on("joinAsPlayer", (name) => {
  players.push({ id: socket.id, name, money: 100, hasInvested: false });
  io.emit("playerList", players);
  socket.emit("updatedReturns", returns);
  socket.emit("activeEvents", activeEvents);
});


 

  socket.on("submitInvestment", (investments) => {
  const player = players.find((p) => p.id === socket.id);
  if (!player) return;
  if (player.hasInvested) return; // すでに投資済みなら無視（任意）

  const keys = Object.keys(returns);
  const clean = {};
  let total = 0;

 // 1) サニタイズ：NaN/負数は0に
  for (const k of keys) {
    const v = Number(investments?.[k]);
    const num = Number.isFinite(v) && v > 0 ? v : 0;
    clean[k] = num;
    total += num;
  }

  // 2) 合計ズレがあるなら比例配分でスケール + 3) 残差補正
  const EPS = 0.01; // 万円の許容誤差
  if (Math.abs(total - player.money) > EPS && total > 0) {
    const scale = player.money / total;
    let sum = 0, maxKey = keys[0];

    // 比例配分しつつ四捨五入(小数2桁)して合計を集計、最大項目も記録
    for (const k of keys) {
      clean[k] = Number((clean[k] * scale).toFixed(2));
      if (clean[k] > clean[maxKey]) maxKey = k;
      sum += clean[k];
    }

    // 丸めによる残差を最大項目へ寄せて合計をピタリに
    const diff = Number((player.money - sum).toFixed(2));
    clean[maxKey] = Number((clean[maxKey] + diff).toFixed(2));
  }

  // 4) 受理
  player.investments = clean;
  player.hasInvested = true;
  io.emit("playerList", players);
});


socket.on("applyEvent", (eventKey) => {
  const eventMap = {
    heatWave: {
      name: "猛暑と電力不足",
      details: "電力需要↑・外出減",
      effect: { toyota: 0, tepco: 3, jr: -1, mufg: 0, mercari: 0, bitcoin: 0, jgb: 0, usbond: 0, inpex: 3, nintendo: 0 }
    },
    globalOilRise: {
      name: "世界的な原油高",
      details: "資源価格上昇",
      effect: { toyota: -0.5, tepco: -1, jr: 0, mufg: 0, mercari: 0, bitcoin: 0, jgb: 0, usbond: 0, inpex: 2.5, nintendo: 0 }
    },
    fuelPriceDrop: {
      name: "燃料価格下落",
      details: "原油安・コスト低下",
      effect: { toyota: 3, tepco: 2.5, jr: 2, mufg: 0, mercari: 0, bitcoin: 0, jgb: -1, usbond: 0, inpex: -2.5, nintendo: 0 }
    },
    usSlowdown: {
      name: "米国景気減速懸念",
      details: "リスクオフ・利下げ観測",
      effect: { toyota: -1, tepco: 0, jr: 0, mufg: -0.5, mercari: 0, bitcoin: -3, jgb: 1, usbond: 1.5, inpex: 0, nintendo: -1.5 }
    },
    tourismRebound: {
      name: "観光需要回復",
      details: "旅行・娯楽需要↑",
      effect: { toyota: 0, tepco: 0, jr: 3, mufg: 0, mercari: 0, bitcoin: 0, jgb: 0, usbond: 0, inpex: 0, nintendo: 3 }
    },
    domesticAutoBoom: {
      name: "国内自動車販売好調",
      details: "国内販売＆オートローン増",
      effect: { toyota: 3, tepco: 0, jr: 0, mufg: 3, mercari: 0, bitcoin: 0, jgb: 0, usbond: 0, inpex: 1, nintendo: 0 }
    },
    yenHigh: {
      name: "円高進行",
      details: "輸出採算悪化・外債評価↓",
      effect: { toyota: -1, tepco: 0, jr: 0, mufg: -0.5, mercari: 0, bitcoin: 0, jgb: 0, usbond: -1, inpex: 0, nintendo: -1 }
    },
    recession: {
      name: "景気後退ムード",
      details: "需要減速・債券買い",
      effect: { toyota: -1, tepco: 0, jr: 0, mufg: -1.5, mercari: 0, bitcoin: 0, jgb: 1, usbond: 0.5, inpex: -2, nintendo: -1 }
    },
    logisticsCostRise: {
      name: "物流費高騰",
      details: "燃料・人件費↑で配送コスト増",
      effect: { toyota: -0.5, tepco: -0.5, jr: 0, mufg: -2, mercari: 0, bitcoin: 0, jgb: 0, usbond: 0, inpex: 0, nintendo: 0 }
    },
    nintendoHit: {
      name: "任天堂の新作が大ヒット",
      details: "ソフト販売＆IP収益↑",
      effect: { toyota: 0, tepco: 0, jr: 0, mufg: 0, mercari: 2, bitcoin: 0, jgb: 0, usbond: 0, inpex: 0, nintendo: 3 }
    },
    nintendoMovie: {
      name: "任天堂が大型映画公開",
      details: "IP露出拡大・関連消費↑",
      effect: { toyota: 0, tepco: 0, jr: 0, mufg: 1, mercari: 1, bitcoin: 0, jgb: 0, usbond: 0, inpex: 0, nintendo: 1 }
    },
    consumerSpendingSlump: {
      name: "消費者支出減退",
      details: "物価高・実質所得↓で消費抑制",
      effect: { toyota: -0.5, tepco: 0, jr: 0, mufg: -0.5, mercari: -2, bitcoin: 0, jgb: 0, usbond: 0, inpex: 0, nintendo: -1 }
    },
    bigQuake: {
      name: "首都圏大地震",
      details: "インフラ混乱・交通停止",
      effect: { toyota: 0, tepco: -4, jr: -3, mufg: 0, mercari: 0, bitcoin: 0, jgb: 1, usbond: 0, inpex: 0, nintendo: 0 }
    },
    cryptoCrash: {
      name: "仮想通貨が暴落",
      details: "リスクオフ・暗号資産売り",
      effect: { toyota: 0, tepco: 0, jr: 0, mufg: -0.5, mercari: 0, bitcoin: -3, jgb: 0, usbond: 1.5, inpex: 0, nintendo: 0 }
    },
    remoteWork: {
      name: "リモートワーク拡大",
      details: "通勤減・EC活性",
      effect: { toyota: 0, tepco: 0, jr: -1, mufg: 0, mercari: 2, bitcoin: 0, jgb: 0, usbond: 0, inpex: 0, nintendo: 0 }
    },
    cryptoRegTighten: {
      name: "仮想通貨国際規制強化",
      details: "規制強化で資金流出",
      effect: { toyota: 0, tepco: 0, jr: -0.5, mufg: -0.5, mercari: 0, bitcoin: -3, jgb: 0.5, usbond: 0, inpex: 0, nintendo: 0 }
    },
    btcETF: {
      name: "ビットコインETF承認",
      details: "資金流入でBTC急騰",
      effect: { toyota: 0, tepco: 0, jr: 0, mufg: 3, mercari: 0, bitcoin: 10, jgb: 0, usbond: 0, inpex: 0, nintendo: 0 }
    },
    btcLegalTender: {
      name: "ビットコインが法定通貨として採用（複数国）",
      details: "採用拡大で普及加速",
      effect: { toyota: 1, tepco: 0, jr: 0, mufg: 2.5, mercari: 2, bitcoin: 10, jgb: 0, usbond: 0, inpex: 0, nintendo: 0 }
    },
    usInfraAct: {
      name: "米国インフラ投資拡大法成立",
      details: "財政出動・投資拡大",
      effect: { toyota: 2, tepco: 0, jr: 0, mufg: 1, mercari: 0, bitcoin: 0, jgb: -2.5, usbond: 1.5, inpex: 0, nintendo: 0 }
    },
    bojQE: {
      name: "日銀大規模緩和策発表",
      details: "長短金利抑制・円安バイアス",
      effect: { toyota: 2, tepco: 0, jr: 0, mufg: 2, mercari: 0, bitcoin: 0, jgb: -2, usbond: 1, inpex: 0, nintendo: 0 }
    }

  };



    const event = eventMap[eventKey];
    if (!event) return;

    activeEvents.push({ name: event.name, details: event.details });
    for (let asset in event.effect) {
      if (returns[asset] !== undefined) {
        returns[asset] += event.effect[asset];
      }
    }

    io.emit("activeEvents", activeEvents);
    io.emit("updatedReturns", returns);
     io.emit("eventApplied", {
    name: event.name,
    details: event.details,
    effect: event.effect
  });
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

    player.hasInvested = false;
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
