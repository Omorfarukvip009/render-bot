// index.js
import { Telegraf } from "telegraf";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

// ================= CONFIG =================
const BOT_TOKEN = process.env.BOT_TOKEN; // Taken from .env / Render environment
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

// ================= WEBSITE =================
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Bot Logs</title>
        <style>
          body { font-family: monospace; background:#111; color:#0f0; padding:20px; }
          pre { white-space: pre-line; }
          button { background:#0f0; color:#111; padding:10px 20px; border:none; cursor:pointer; font-size:16px; }
          button:hover { background:#9f9; }
        </style>
      </head>
      <body>
        <h2>🚀 Node.js Bot Logs</h2>
        <button onclick="location.reload()">🔄 Refresh</button>
        <pre>${logs.join("\n")}</pre>
      </body>
    </html>
  `);
});

// ================= START WEB SERVER =================
app.listen(PORT, () => {
  addLog(`🌍 Web server running on port ${PORT}`);
});
