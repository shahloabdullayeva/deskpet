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
  for (const dir of [home, EXAMPLE]) {
    try {
      style = fs.readFileSync(path.join(dir, "style.md"), "utf8");
      break;
    } catch {}
  }
  let knows = "";
  try {
    knows = fs.readFileSync(path.join(home, "knows.md"), "utf8");
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
    knows,
    meTimezone: config.meTimezone || "",
    breaks: config.pet?.breaks !== false,
    peek: config.pet?.peek === true,
    health: config.health !== false,
    timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    start: config.workHours?.start || "09:00",
    end: config.workHours?.end || "18:00",
    days: config.workHours?.days || [1, 2, 3, 4, 5],
    checkins,
    sound: config.pet?.sound !== false,
    wander: config.pet?.wander !== false,
    background: config.pet?.background || "black",
    size: ["small", "medium", "large"].includes(config.pet?.size) ? config.pet.size : "medium",
    chatterMinutes: String([0, 90, 45, 20].reduce((best, option) => (Math.abs(option - (config.pet?.chatterMinutes ?? 45)) < Math.abs(best - (config.pet?.chatterMinutes ?? 45)) ? option : best))),
    anthropicKey: secrets.anthropicKey || "",
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
    meTimezone: String(form.meTimezone || "").trim(),
    health: form.health !== false,
    workHours: { start: form.start || "09:00", end: form.end || "18:00", days: (form.days || []).map(Number) },
    checkins: CHECKINS.filter((kind) => form.checkins?.[kind]?.on).map((kind) => ({ time: form.checkins[kind].time, kind })),
  });
  const { mode, runBot, ...pet } = config.pet || {};
  delete config.telegram;
  delete config.checking;
  config.pet = {
    ...pet,
    character: form.character || "maomao",
    sound: form.sound !== false,
    breaks: form.breaks !== false,
    peek: form.peek === true,
    wander: form.wander !== false,
    background: form.background === "none" ? "none" : "black",
    size: ["small", "large"].includes(form.size) ? form.size : "medium",
    chatterMinutes: Number(form.chatterMinutes) || 0,
  };

  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify(config, null, 2));
  fs.writeFileSync(
    path.join(home, "secrets.json"),
    JSON.stringify({ anthropicKey: String(form.anthropicKey || "").trim() }, null, 2)
  );
  fs.writeFileSync(path.join(home, "style.md"), String(form.style || ""));
  fs.writeFileSync(path.join(home, "knows.md"), String(form.knows || ""));
  if (!fs.existsSync(path.join(home, "phrases.json"))) fs.copyFileSync(path.join(EXAMPLE, "phrases.json"), path.join(home, "phrases.json"));
}

module.exports = { read, write, CHECKINS };
