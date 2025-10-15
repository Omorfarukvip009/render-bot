import express from "express";
import fetch from "node-fetch";
import { Telegraf } from "telegraf";
import { SocksProxyAgent } from "socks-proxy-agent";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const ALLOWED_USER_ID = Number(process.env.ALLOWED_USER_ID);
const API_URL = process.env.API_URL || "https://umnico.com/api/tools/checker?phone=";
const PROXY_LIST = JSON.parse(process.env.PROXY_LIST || "[]");
const PORT = process.env.PORT || 10000;
const MAX_NUMBERS = 100;
const BATCH_SIZE = 10;

// === LOGGING ===
let logs = [];
const addLog = (msg) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  logs.push(line);
  if (logs.length > 200) logs.shift();
};

// === PROXY HANDLING ===
let proxyIndex = 0;
let currentProxy = PROXY_LIST[0] || null;
let checkedCount = 0;

function getProxyAgent() {
  if (!currentProxy) return null;
  const { ip, port, username, password } = currentProxy;
  const proxyUrl = `socks5://${username}:${password}@${ip}:${port}`;
  return new SocksProxyAgent(proxyUrl);
}

function refreshProxy() {
  if (PROXY_LIST.length === 0) {
    addLog("⚠️ No proxies in PROXY_LIST — using direct connection.");
    return;
  }
  proxyIndex = (proxyIndex + 1) % PROXY_LIST.length;
  currentProxy = PROXY_LIST[proxyIndex];
  checkedCount = 0;
  addLog(`🔄 Proxy rotated → ${currentProxy.ip}:${currentProxy.port}`);
}

// === TELEGRAM BOT ===
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  if (ctx.from.id !== ALLOWED_USER_ID) return ctx.reply("⛔ No permission");
  ctx.reply("✅ Bot ready! Send phone numbers.\n\nUse /restart to refresh proxy.");
});

bot.command("restart", (ctx) => {
  if (ctx.from.id !== ALLOWED_USER_ID) return ctx.reply("⛔ No permission");
  refreshProxy();
  ctx.reply(`🔁 Proxy reconnected → ${currentProxy ? `${currentProxy.ip}:${currentProxy.port}` : "Direct connection"}`);
});

// === CHECK FUNCTION ===
async function checkNumberWithRetry(num, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const agent = getProxyAgent();
      const res = await fetch(`${API_URL}${encodeURIComponent(num)}`, { agent });

      if (res.status === 429) {
        addLog(`⚠️ 429 for ${num}, rotating proxy & retrying...`);
        refreshProxy();
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      addLog(`❌ Error checking ${num}: ${err.message}`);
      refreshProxy();
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return null;
}

// === MESSAGE HANDLER ===
bot.on("text", async (ctx) => {
  if (ctx.from.id !== ALLOWED_USER_ID) return ctx.reply("⛔ No permission");

  const input = ctx.message.text.trim();
  const numbers = input
    .split(/\s+/)
    .map((n) => n.replace(/[^\d+]/g, ""))
    .filter((n) => n.length > 5)
    .slice(0, MAX_NUMBERS);

  if (numbers.length === 0) return ctx.reply("⚠️ No valid numbers found.");

  ctx.reply(`📞 Checking ${numbers.length} numbers...`);

  const freshNumbers = [];
  for (let i = 0; i < numbers.length; i += BATCH_SIZE) {
    const batch = numbers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((num) => checkNumberWithRetry(num)));

    results.forEach((data, idx) => {
      const num = batch[idx];
      if (!data) return addLog(`❌ Failed: ${num}`);
      if (data.exists === false) {
        addLog(`✅ FRESH: ${num}`);
        freshNumbers.push(num);
      } else {
        addLog(`⚠️ USED: ${num}`);
      }
    });

    checkedCount += batch.length;
    if (checkedCount >= 100) refreshProxy();
  }

  if (freshNumbers.length > 0) {
    ctx.reply(`✨ Fresh numbers:\n${freshNumbers.join("\n")}`);
  } else {
    ctx.reply("❌ No fresh numbers found.");
  }
});

// === WEB SERVER ===
app.get("/", (req, res) => {
  res.send(`
    <html><head><title>Render Bot Logs</title>
    <style>
      body { background:black; color:#00ff00; font-family:monospace; padding:10px; }
      pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
    <script>
      setInterval(()=>{fetch('/logs').then(r=>r.text()).then(t=>{document.getElementById('log').textContent=t;})},2000);
    </script></head>
    <body><h3>📊 Live Logs</h3><pre id="log">Loading...</pre></body></html>
  `);
});

app.get("/logs", (req, res) => res.send(logs.join("\n")));

bot.launch();
app.listen(PORT, () => addLog(`🌍 Web server running on port ${PORT}`));
