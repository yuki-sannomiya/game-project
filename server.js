<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ゲームマスター画面</title>
  <style>
    body {
      font-family: "Segoe UI", sans-serif;
      background: linear-gradient(to bottom, #f0f8ff, #e6f7ff);
      color: #333;
      text-align: center;
      padding: 20px;
    }
    h1 {
      color: #007acc;
    }
    h2 {
      color: #005580;
      margin-top: 30px;
    }
    button {
      background-color: #4caf50;
      color: white;
      border: none;
      padding: 10px 20px;
      margin: 5px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      background: #ffffffcc;
      margin: 5px auto;
      padding: 10px;
      border-radius: 8px;
      width: 80%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <h1>ゲームマスター画面</h1>
  <div id="eventButtons">
    <h2>イベントを選択</h2>
    <button onclick="applyEvent('yenHigh')">円高</button>
    <button onclick="applyEvent('quake')">地震（東日本）</button>
    <button onclick="applyEvent('boom')">好景気</button>
    <!-- 追加のイベントボタンがあればここに追記 -->
  </div>
  <div>
    <h2>プレイヤー一覧</h2>
    <ul id="playersList"></ul>
  </div>
  <div>
    <h2>現在発生中のイベント</h2>
    <ul id="eventLog"></ul>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const activeEvents = [];

    socket.emit("joinAsGM");

    socket.on("gmJoined", () => {
      console.log("GMとして参加しました。");
    });

    socket.on("playerList", (players) => {
      const list = document.getElementById("playersList");
      list.innerHTML = "";
      for (let p of players) {
        const li = document.createElement("li");
        li.textContent = `${p.name}：${p.hasInvested ? "✅ 投資済み" : "⏳ 未投資"}`;
        list.appendChild(li);
      }
    });

    socket.on("eventApplied", (eventInfo) => {
      activeEvents.push(eventInfo);
      updateEventLog();
    });

    function updateEventLog() {
      const log = document.getElementById("eventLog");
      log.innerHTML = "";
      for (let e of activeEvents) {
        const li = document.createElement("li");
        li.textContent = `${e.name}：${e.details}`;
        log.appendChild(li);
      }
    }

    function applyEvent(key) {
      socket.emit("applyEvent", key);
    }
  </script>
</body>
</html>
