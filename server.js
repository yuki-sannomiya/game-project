<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プレイヤー画面</title>
  <style>
    body {
      font-family: "Segoe UI", sans-serif;
      background: linear-gradient(to bottom, #fff5f5, #ffe6e6);
      color: #333;
      padding: 20px;
      text-align: center;
    }
    input, button {
      padding: 10px;
      margin: 5px;
      font-size: 16px;
    }
    #investmentInputs label {
      display: block;
      margin-top: 10px;
    }
    ul {
      text-align: left;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <h1>プレイヤー画面</h1>
  <div id="nameInput">
    <input type="text" id="name" placeholder="名前を入力">
    <button onclick="join()">参加</button>
  </div>

  <p id="moneyDisplay">現在の資産: 100万円</p>

  <div id="investmentArea" style="display:none;">
    <h2>資産を配分（合計100%）</h2>
    <div id="investmentInputs"></div>
    <button onclick="submitInvestments()" id="submitBtn" disabled>投資完了</button>
  </div>

  <h3>現在の利回り</h3>
  <ul id="returnsList"></ul>

  <h3>発生したイベント</h3>
  <ul id="eventLog"></ul>

  <h3>プレイヤーの資産状況</h3>
  <ul id="playersList"></ul>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();

    const assets = {
      toyota: "トヨタ自動車",
      nintendo: "任天堂",
      tepco: "東京電力HD",
      jr: "JR東日本",
      mufg: "MUFG",
      tokio: "東京海上",
      mcdonalds: "マクドナルド",
      jgb: "日本国債",
      usbond: "米国債",
      bitcoin: "ビットコイン"
    };

    function join() {
      const name = document.getElementById("name").value;
      if (!name) return;
      socket.emit("joinAsPlayer", name);
      document.getElementById("nameInput").style.display = "none";
      document.getElementById("investmentArea").style.display = "block";

      const container = document.getElementById("investmentInputs");
      container.innerHTML = "";
      for (let key in assets) {
        const label = document.createElement("label");
        label.textContent = assets[key] + "：";
        const input = document.createElement("input");
        input.type = "number";
        input.min = 0;
        input.max = 100;
        input.value = 0;
        input.id = key;
        input.oninput = validate;
        container.appendChild(label);
        container.appendChild(input);
      }
    }

    function validate() {
      let total = 0;
      for (let key in assets) {
        total += Number(document.getElementById(key).value);
      }
      document.getElementById("submitBtn").disabled = (total !== 100);
    }

    function submitInvestments() {
      const investments = {};
      for (let key in assets) {
        investments[key] = Number(document.getElementById(key).value);
      }
      socket.emit("submitInvestment", investments);
      document.getElementById("submitBtn").disabled = true;
    }

    socket.on("updatedReturns", (returns) => {
      const list = document.getElementById("returnsList");
      list.innerHTML = "";
      for (let key in returns) {
        const li = document.createElement("li");
        li.textContent = `${assets[key]}：${returns[key]}%`;
        list.appendChild(li);
      }
    });

    socket.on("playerList", (players) => {
      const list = document.getElementById("playersList");
      list.innerHTML = "";
      for (let p of players) {
        const li = document.createElement("li");
        li.textContent = `${p.name}：${p.money.toFixed(2)}万円`;
        list.appendChild(li);

        if (p.name === document.getElementById("name").value) {
          document.getElementById("moneyDisplay").textContent =
            `現在の資産: ${p.money.toFixed(2)}万円`;
        }
      }
    });

    socket.on("activeEvents", (events) => {
      const log = document.getElementById("eventLog");
      log.innerHTML = "";
      for (let e of events) {
        const li = document.createElement("li");
        li.textContent = `${e.name}：${e.details}`;
        log.appendChild(li);
      }
    });
  </script>
</body>
</html>
