const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function meDir() {
  const own = path.join(ROOT, "me");
  return fs.existsSync(path.join(own, "config.json")) ? own : path.join(ROOT, "me.example");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw new Error(`Could not read ${file}: ${error.message}`);
  }
}

function load() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {}
  const dir = meDir();
  const config = readJson(path.join(dir, "config.json"));
  const phrases = readJson(path.join(dir, "phrases.json"), {});
  const examples = readJson(path.join(dir, "examples.json"), []);
  let style = "";
  try {
    style = fs.readFileSync(path.join(dir, "style.md"), "utf8");
  } catch {}
  return {
    dir,
    config,
    phrases,
    examples,
    style,
    dataDir: process.env.DESKPET_DATA || path.join(ROOT, "data"),
    env: {
      telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
      pairCode: process.env.PAIR_CODE || "",
      anthropicKey: process.env.ANTHROPIC_API_KEY || "",
      elevenlabsKey: process.env.ELEVENLABS_API_KEY || "",
    },
  };
}

module.exports = { ROOT, load };
