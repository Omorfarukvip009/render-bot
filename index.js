// index.js
import { Telegraf } from "telegraf";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

// ================= CONFIG =================
const BOT_TOKEN = process.env.BOT_TOKEN; // From .env or Render environment
const bot = new Telegraf(BOT_TOKEN);

const BATCH_SIZE = 10;
const MAX_NUMBERS = 100;
const API_URL = "https://umnico.com/api/tools/checker?phone=";

const app = express();
const PORT = process.env.PORT || 3000;

// ================= LOG HANDLER =================
let logs = [];

function addLog(message) {
  console.log(message);
  logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (logs.length > 200) logs.shift(); // keep last 200 logs
}

// ================= BOT COMMANDS =================
bot.start((ctx) => {
  const msg =
    "====================================\n" +
    "📱 WhatsApp Number Checker\n" +
    "👨‍💻 Developed by: MD OMOR FARUK\n" +
    "====================================\n\n" +
    "Send me numbers (space or newline separated).";

  ctx.reply(msg);
  addLog(`Bot started by ${ctx.from.username || ctx.from.id}`);
});

bot.on("text", async (ctx) => {
  let inputData = ctx.message.text;

  let numbers = inputData
    .split(/\s+/)
    .map((n) => n.trim())
    .filter((n) => n !== "");

  if (numbers.length === 0) {
    return ctx.reply("❌ No numbers entered.");
  }

  if (numbers.length > MAX_NUMBERS) {
    await ctx.reply(`⚠️ Only first ${MAX_NUMBERS} numbers will be checked.`);
    numbers = numbers.slice(0, MAX_NUMBERS);
  }

  await ctx.reply(`⏳ Checking ${numbers.length} numbers...\n`);
  addLog(`Checking ${numbers.length} numbers for ${ctx.from.username || ctx.from.id}`);

  let notExists = [];

  for (let i = 0; i < numbers.length; i += BATCH_SIZE) {
    const batch = numbers.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (num) => {
        try {
          const res = await fetch(`${API_URL}${encodeURIComponent(num)}`);
          const data = await res.json();

          if (!data.exists) {
            addLog(`✅ ${num} is FRESH`);
            return `✅ ${num} (FRESH)`;
          } else {
            addLog(`❌ ${num} already used`);
            return null;
          }
        } catch {
          addLog(`⚠️ Error checking ${num}`);
          return null;
        }
      })
    );

    results.filter((r) => r !== null).forEach((r) => notExists.push(r));
  }

  if (notExists.length > 0) {
    await ctx.reply(notExists.join("\n"));
  } else {
    await ctx.reply("✅ All numbers Used.");
  }

  await ctx.reply("👨‍💻 Bot Maked by MD OMOR FARUK");
});

// ================= LAUNCH BOT =================
bot.launch();
addLog("🤖 Bot launched successfully!");

// ================= WEBSITE DASHBOARD =================
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Bot Logs</title>
        <style>
          body {
            font-family: monospace;
            background: #111;
            color: #0f0;
            padding: 20px;
          }

          #log-container {
            white-space: pre-line;
            line-height: 1.4;
            max-height: 80vh;
            overflow-y: auto;
            border: 1px solid #0f0;
            padding: 10px;
          }

          .line {
            display: block;
            opacity: 0;
            animation: fadeIn 0.5s forwards;
          }

          @keyframes fadeIn {
            from {opacity: 0;}
            to {opacity: 1;}
          }

          .cursor::after {
            content: "_";
            animation: blink 1s step-end infinite;
          }

          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        </style>
      </head>
      <body>
        <h2>🚀 Node.js Bot Logs</h2>
        <div id="log-container"></div>

        <script>
          let displayedLogs = [];

          async function fetchLogs() {
            try {
              const response = await fetch("/logs");
              const data = await response.text();
              const lines = data.split('\\n');
              const container = document.getElementById("log-container");

              for (let i = displayedLogs.length; i < lines.length; i++) {
                const line = document.createElement('span');
                line.textContent = lines[i];
                line.className = 'line cursor';
                container.appendChild(line);
                container.scrollTop = container.scrollHeight;
              }

              displayedLogs = lines;
            } catch (err) {
              console.error("Error fetching logs:", err);
            }
          }

          fetchLogs();
          setInterval(fetchLogs, 2000);
        </script>
      </body>
    </html>
  `);
});

// ================= LOGS ENDPOINT =================
app.get("/logs", (req, res) => {
  res.send(logs.join("\n"));
});

// ================= START WEB SERVER =================
app.listen(PORT, () => {
  addLog(`🌍 Web server running on port ${PORT}`);
});
