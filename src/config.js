const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function meDir() {
  for (const dir of [process.env.DESKPET_HOME, path.join(ROOT, "me")]) {
    if (dir && fs.existsSync(path.join(dir, "config.json"))) return dir;
  }
  return path.join(ROOT, "me.example");
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
  const secrets = readJson(path.join(dir, "secrets.json"), {});
  const config = readJson(path.join(dir, "config.json"));
  const phrases = readJson(path.join(dir, "phrases.json"), {});
  const examples = readJson(path.join(dir, "examples.json"), []);
  let style = "";
  try {
    style = fs.readFileSync(path.join(dir, "style.md"), "utf8");
  } catch {}
  return {
    dir,
    isExample: dir === path.join(ROOT, "me.example"),
    config,
    phrases,
    examples,
    style,
    dataDir: process.env.DESKPET_DATA || path.join(ROOT, "data"),
    env: {
      anthropicKey: process.env.ANTHROPIC_API_KEY || secrets.anthropicKey || "",
    },
  };
}

module.exports = { ROOT, load, meDir };
