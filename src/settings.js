// The in-app Settings window reads and writes the same files the pet runs on, so whoever
// installs the app sets it up right there: no separate setup page or file to pass around.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./config");

const EXAMPLE = path.join(ROOT, "me.example");
const CHECKINS = ["morning", "howsYourDay", "lunch", "water", "goodbye"];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function read(home) {
  const config = readJson(path.join(home, "config.json"), null) || readJson(path.join(EXAMPLE, "config.json"), {});
  const secrets = readJson(path.join(home, "secrets.json"), {});
  let style = "";
  try {
    style = fs.readFileSync(path.join(home, "style.md"), "utf8");
  } catch {}
  const defaults = readJson(path.join(EXAMPLE, "config.json"), {}).checkins || [];
  const checkins = {};
  for (const kind of CHECKINS) {
    const found = (config.checkins || []).find((item) => item.kind === kind);
    const fallback = defaults.find((item) => item.kind === kind);
    checkins[kind] = { on: Boolean(found), time: (found || fallback || { time: "12:00" }).time };
  }
  return {
    name: config.him === "babe" && !fs.existsSync(path.join(home, "config.json")) ? "" : config.him || "",
    talksLike: config.me === "Me" ? "" : config.me || "",
    petName: config.petName || "Maomao",
    character: config.pet?.character || "maomao",
    style: style.startsWith("# How I text") ? "" : style,
    timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    start: config.workHours?.start || "09:00",
    end: config.workHours?.end || "18:00",
    days: config.workHours?.days || [1, 2, 3, 4, 5],
    checkins,
    sound: config.pet?.sound !== false,
    wander: config.pet?.wander !== false,
    background: config.pet?.background || "black",
    chatterMinutes: String([0, 90, 45, 20].reduce((best, option) => (Math.abs(option - (config.pet?.chatterMinutes ?? 45)) < Math.abs(best - (config.pet?.chatterMinutes ?? 45)) ? option : best))),
    anthropicKey: secrets.anthropicKey || "",
    telegramToken: secrets.telegramToken || "",
    pairCode: secrets.pairCode || `maomao${Math.floor(1000 + Math.random() * 9000)}`,
  };
}

function write(home, form) {
  fs.mkdirSync(home, { recursive: true });
  const config = readJson(path.join(home, "config.json"), null) || readJson(path.join(EXAMPLE, "config.json"), {});
  Object.assign(config, {
    him: String(form.name || "").trim() || "you",
    me: String(form.talksLike || "").trim(),
    petName: String(form.petName || "").trim() || "Maomao",
    timezone: String(form.timezone || "").trim(),
    workHours: { start: form.start || "09:00", end: form.end || "18:00", days: (form.days || []).map(Number) },
    checkins: CHECKINS.filter((kind) => form.checkins?.[kind]?.on).map((kind) => ({ time: form.checkins[kind].time, kind })),
  });
  config.pet = {
    ...(config.pet || {}),
    character: form.character || "maomao",
    sound: form.sound !== false,
    wander: form.wander !== false,
    background: form.background === "none" ? "none" : "black",
    chatterMinutes: Number(form.chatterMinutes) || 0,
  };

  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify(config, null, 2));
  fs.writeFileSync(
    path.join(home, "secrets.json"),
    JSON.stringify({ anthropicKey: String(form.anthropicKey || "").trim(), telegramToken: String(form.telegramToken || "").trim(), pairCode: form.pairCode }, null, 2)
  );
  fs.writeFileSync(path.join(home, "style.md"), String(form.style || ""));
  if (!fs.existsSync(path.join(home, "phrases.json"))) fs.copyFileSync(path.join(EXAMPLE, "phrases.json"), path.join(home, "phrases.json"));
}

module.exports = { read, write, CHECKINS };
