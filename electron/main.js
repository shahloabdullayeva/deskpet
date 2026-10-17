const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, powerMonitor, screen } = require("electron");

const HOME = path.join(app.getPath("userData"), "me");
process.env.DESKPET_HOME ||= HOME;
process.env.DESKPET_DATA ||= path.join(app.getPath("userData"), "data");

const { Deskpet } = require("../src/deskpet");
const settings = require("../src/settings");

const SIZES = { small: 110, medium: 140, large: 190 };
const ICON = path.join(__dirname, "icon.png");

let win;
let tray;
let pet;
let muted = false;
let hiddenUntil = 0;
let walkTimer;
let chatWin;
let callStarted = 0;
let fallTimer;
let size = 140;

const PLACE = path.join(app.getPath("userData"), "place.json");
let place = {};
try {
  place = JSON.parse(fs.readFileSync(PLACE, "utf8"));
} catch {}
let saveTimer;
function savePlace() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const [x, y] = win.getPosition();
    place = { ...place, x, y };
    fs.writeFileSync(PLACE, JSON.stringify(place));
  }, 500);
}

const width = () => Math.round(Math.max(240, size * 1.1));
const height = () => Math.round(size + 120);

if (!app.requestSingleInstanceLock()) app.quit();

let settingsWin;

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 380,
    frame: false,
    title: "Settings",
    icon: ICON,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, "settings-preload.js") },
  });
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
}

ipcMain.handle("settings:read", () => settings.read(process.env.DESKPET_HOME));
ipcMain.handle("settings:save", (_event, form) => {
  settings.write(process.env.DESKPET_HOME, form);
  delete place.size;
  try {
    fs.writeFileSync(PLACE, JSON.stringify(place));
  } catch {}
  if (app.isPackaged && pet?.isExample) app.setLoginItemSettings({ openAtLogin: true });
  app.relaunch();
  app.exit(0);
});
ipcMain.on("settings:close", () => settingsWin?.close());

function look() {
  const dir = path.join(pet.dir, "character");
  const types = { ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
  const images = {};
  for (const mood of ["idle", "talk", "happy", "sleepy", "pout", "walk", "held"]) {
    for (const [ext, mime] of Object.entries(types)) {
      const file = path.join(dir, `${mood}${ext}`);
      if (fs.existsSync(file)) {
        images[mood] = `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
        break;
      }
    }
  }
  const settings = pet.config.pet || {};
  return {
    character: settings.character || "maomao",
    colors: settings.look || {},
    images,
    wander: settings.wander !== false,
    background: settings.background || "black",
    volume: settings.volume ?? 0.7,
    size,
  };
}

function createWindow() {
  const configured = pet.config.pet?.size;
  size = clampSize(place.size || SIZES[configured] || Number(configured) || SIZES.medium);
  const WIDTH = width();
  const HEIGHT = height();
  const area = screen.getPrimaryDisplay().workArea;
  const onScreen = Number.isFinite(place.x) && screen.getAllDisplays().some(({ workArea: a }) => place.x >= a.x - WIDTH / 2 && place.x <= a.x + a.width - WIDTH / 2 && place.y >= a.y - HEIGHT / 2 && place.y <= a.y + a.height - HEIGHT / 2);
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: onScreen ? place.x : area.x + area.width - WIDTH - 24,
    y: onScreen ? place.y : area.y + area.height - HEIGHT,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "index.html"));
  let lastCursor = "";
  setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const point = screen.getCursorScreenPoint();
    const [x, y] = win.getPosition();
    const key = `${point.x - x},${point.y - y}`;
    if (key === lastCursor) return;
    lastCursor = key;
    send("cursor", { x: point.x - x, y: point.y - y });
  }, 40);
}

function clampSize(value) {
  return Math.max(80, Math.min(320, Math.round(value)));
}

function resize(step) {
  const next = clampSize(size * (step > 0 ? 1.1 : 1 / 1.1));
  if (next === size) return;
  const [x, y] = win.getPosition();
  const [oldW, oldH] = [width(), height()];
  size = next;
  win.setBounds({ x: Math.round(x + (oldW - width()) / 2), y: y + oldH - height(), width: width(), height: height() });
  send("size", size);
  place = { ...place, size };
  savePlace();
}

function fall(vx, vy) {
  clearInterval(walkTimer);
  clearInterval(fallTimer);
  const cap = (v) => Math.max(-70, Math.min(70, v));
  let [x, y] = win.getPosition();
  vx = cap(vx * 16);
  vy = cap(vy * 16);
  let airborne = false;
  fallTimer = setInterval(() => {
    const W = width();
    const H = height();
    const displays = screen.getAllDisplays();
    const here = screen.getDisplayNearestPoint({ x: Math.round(x + W / 2), y: Math.round(y + H / 2) }).workArea;
    const floor = here.y + here.height - H;
    if (!airborne && (y < floor - 2 || Math.abs(vy) > 3)) {
      airborne = true;
      send("airborne");
    }
    vy = cap(vy + 1.4);
    vx *= 0.99;
    let nx = x + vx;
    const centre = nx + W / 2;
    const landing = displays.some(({ workArea: a }) => centre >= a.x && centre <= a.x + a.width);
    if (!landing) {
      vx = -vx * 0.5;
      nx = x;
    }
    x = nx;
    y = Math.max(here.y - H / 2, y + vy);
    if (y >= floor) {
      y = floor;
      const impact = vy;
      if (impact > 9) {
        vy = -impact * 0.38;
        vx *= 0.7;
        send("bounce", impact);
      } else {
        clearInterval(fallTimer);
        win.setPosition(Math.round(x), Math.round(y));
        savePlace();
        send("landed", airborne ? impact : 0);
        return;
      }
    }
    win.setPosition(Math.round(x), Math.round(y));
  }, 16);
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function walk(dx) {
  clearInterval(walkTimer);
  const WIDTH = width();
  const [x, y] = win.getPosition();
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  const target = Math.max(area.x, Math.min(area.x + area.width - WIDTH, x + dx));
  const step = Math.sign(target - x) * 2;
  walkTimer = setInterval(() => {
    const [now] = win.getPosition();
    if (!step || Math.abs(target - now) <= Math.abs(step)) {
      clearInterval(walkTimer);
      savePlace();
      send("walked");
      return;
    }
    win.setPosition(now + step, y);
  }, 16);
}

function hop() {
  clearInterval(walkTimer);
  const [WIDTH, HEIGHT] = [width(), height()];
  const [x, y] = win.getPosition();
  const here = screen.getDisplayNearestPoint({ x, y });
  const others = screen.getAllDisplays().filter((display) => display.id !== here.id);
  const target = others.length ? others[Math.floor(Math.random() * others.length)] : here;
  const area = target.workArea;
  const left = area.x + Math.round(Math.random() * Math.max(0, area.width - WIDTH));
  win.setPosition(left, area.y + area.height - HEIGHT);
  if (chatWin && !chatWin.isDestroyed() && chatWin.isVisible()) placeChat();
  savePlace();
  send("hopped");
}

function placeChat() {
  if (!win) return chatWin.center();
  const [WIDTH, HEIGHT] = [width(), height()];
  const [x, y] = win.getPosition();
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  const [chatW, chatH] = chatWin.getSize();
  const left = x - chatW + 30 >= area.x ? x - chatW + 30 : x + WIDTH - 30;
  const top = Math.max(area.y, Math.min(y + HEIGHT - chatH - 40, area.y + area.height - chatH));
  chatWin.setPosition(Math.round(Math.min(left, area.x + area.width - chatW)), Math.round(top));
}

function openChat() {
  if (!chatWin || chatWin.isDestroyed()) {
    chatWin = new BrowserWindow({
      width: 360,
      height: 520,
      minWidth: 300,
      minHeight: 360,
      frame: false,
      show: false,
      alwaysOnTop: true,
      title: pet.config.petName,
      icon: ICON,
      webPreferences: { preload: path.join(__dirname, "chat-preload.js") },
    });
    chatWin.loadFile(path.join(__dirname, "chat.html"));
    chatWin.once("ready-to-show", () => chatWin.show());
  } else {
    chatWin.show();
  }
  placeChat();
  chatWin.focus();
}

function toggleChat() {
  if (chatWin && !chatWin.isDestroyed() && chatWin.isVisible()) chatWin.hide();
  else openChat();
}

function lists() {
  const memory = pet.memory;
  return {
    memories: memory.memories.map((m) => ({ id: m.id, text: m.text })),
    reminders: memory.reminders.map((r) => ({ id: r.id, text: r.text, when: memory.format(r.due) })),
  };
}

function pin(pinned) {
  place = { ...place, pinned };
  savePlace();
  send("pinned", pinned);
}

function startCall() {
  callStarted = Date.now();
  hiddenUntil = Infinity;
  send("call", true);
}

function endCall() {
  const minutes = Math.round((Date.now() - callStarted) / 60_000);
  callStarted = 0;
  hiddenUntil = 0;
  send("call", false);
  if (minutes >= 3 && Math.random() < 0.6) setTimeout(() => pet.afterCall(minutes).catch(() => {}), 20_000);
}

function menu() {
  const quietFor = (minutes) => () => (hiddenUntil = Date.now() + minutes * 60_000);
  return Menu.buildFromTemplate([
    { label: pet.config.petName, enabled: false },
    { type: "separator" },
    { label: `Chat with ${pet.config.petName}`, click: openChat },
    { label: "Show / hide", click: () => (win.isVisible() ? win.hide() : win.show()) },
    { label: "Mute chime", type: "checkbox", checked: muted, click: () => (muted = !muted) },
    callStarted
      ? { label: "Call's over", click: endCall }
      : { label: "I'm on a call", click: startCall },
    { label: "Quiet for 1 hour (in a meeting)", click: quietFor(60) },
    { label: "Pin her here", type: "checkbox", checked: Boolean(place.pinned), click: (item) => pin(item.checked) },
    { label: "Start with my computer", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

app.on("second-instance", () => win?.show());

app.whenReady().then(() => {
  app.dock?.hide();
  pet = new Deskpet();
  pet.idleSeconds = () => powerMonitor.getSystemIdleTime();
  createWindow();

  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip(pet.config.petName);
  tray.setContextMenu(menu());
  tray.on("click", () => win.show());

  pet.events.on("say", ({ text, chime, mood }) => {
    if (Date.now() < hiddenUntil) return;
    send("say", { text, mood, chime: chime && !muted && pet.config.pet?.sound !== false });
  });
  pet.events.on("mood", (mood) => send("mood", mood));
  pet.events.on("feeling", (feeling) => {
    if (chatWin && !chatWin.isDestroyed()) chatWin.webContents.send("chat:feeling", feeling);
  });
  pet.events.on("chat", (entry) => {
    if (chatWin && !chatWin.isDestroyed()) chatWin.webContents.send("chat:add", entry);
  });

  ipcMain.handle("chat:info", () => ({
    me: pet.config.me,
    him: pet.config.him,
    petName: pet.config.petName,
    online: Boolean(pet.brain.client),
    feeling: pet.feeling || pet.feel().feeling,
    history: pet.desk.slice(-100),
  }));
  ipcMain.handle("chat:send", async (_event, text) => {
    send("flash", "talk");
    const reply = await pet.deskChat(String(text).slice(0, 2000));
    send("flash", "happy");
    return reply;
  });
  ipcMain.handle("chat:lists", lists);
  ipcMain.handle("chat:forget", (_event, id) => (pet.memory.forget(id), lists()));
  ipcMain.handle("chat:cancel", (_event, id) => (pet.memory.cancel(id), lists()));
  ipcMain.on("chat:close", () => chatWin?.hide());

  ipcMain.on("ready", () => {
    send("look", look());
    send("mood", pet.mood || "idle");
    send("pinned", Boolean(place.pinned));
    if (pet.isExample) setTimeout(openSettings, 800);
  });
  ipcMain.on("tap", () => {
    pet.touch();
    send("flash", "happy");
    toggleChat();
  });
  ipcMain.on("spun", () => pet.touch());
  ipcMain.on("petted", () => {
    pet.touch();
    send("flash", "happy");
    if (Math.random() < 0.4 && Date.now() >= hiddenUntil) pet.tap().catch(() => {});
  });
  ipcMain.on("resize", (_event, step) => resize(step));
  ipcMain.on("drop", (_event, { vx, vy }) => {
    if (place.pinned) return savePlace();
    fall(Number(vx) || 0, Number(vy) || 0);
  });
  ipcMain.on("open-chat", openChat);
  ipcMain.on("hover", (_event, over) => win.setIgnoreMouseEvents(!over, { forward: true }));
  ipcMain.on("walk", (_event, dx) => walk(dx));
  ipcMain.on("hop", hop);
  ipcMain.on("drag", (_event, { dx, dy }) => {
    clearInterval(walkTimer);
    clearInterval(fallTimer);
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
    if (chatWin && !chatWin.isDestroyed() && chatWin.isVisible()) placeChat();
    savePlace();
  });
  ipcMain.on("menu", () => {
    tray.setContextMenu(menu());
    menu().popup({ window: win });
  });

  pet.start();
});

app.on("before-quit", () => pet?.stop());
app.on("window-all-closed", () => {});
