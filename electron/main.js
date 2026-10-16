const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");

// The installed app keeps your settings in its own user folder, so nothing needs editing by hand.
const HOME = path.join(app.getPath("userData"), "me");
process.env.DESKPET_HOME ||= HOME;
process.env.DESKPET_DATA ||= path.join(app.getPath("userData"), "data");

const { Deskpet } = require("../src/deskpet");
const settings = require("../src/settings");

const WIDTH = 280;
const HEIGHT = 400;
const ICON = path.join(__dirname, "icon.png");

let win;
let tray;
let pet;
let muted = false;
let hiddenUntil = 0;
let walkTimer;
let chatWin;
let callStarted = 0;

// Where she sits and whether she's pinned there, kept across restarts.
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

if (!app.requestSingleInstanceLock()) app.quit();

// Settings live in a window inside the app; saving restarts her with the new settings.
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
  };
}

function createWindow() {
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
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// Walk sideways along the bottom of the screen, staying on the screen she is on.
function walk(dx) {
  clearInterval(walkTimer);
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

// Jump to another screen (or somewhere else on this one if there is only one), landing on
// the bottom edge like she walked there.
function hop() {
  clearInterval(walkTimer);
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

// The chat opens next to her, on whichever side of the screen has room.
function placeChat() {
  if (!win) return chatWin.center();
  const [x, y] = win.getPosition();
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  const [width, height] = chatWin.getSize();
  const left = x - width + 30 >= area.x ? x - width + 30 : x + WIDTH - 30;
  const top = Math.max(area.y, Math.min(y + HEIGHT - height - 40, area.y + area.height - height));
  chatWin.setPosition(Math.round(Math.min(left, area.x + area.width - width)), Math.round(top));
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

// On a call she keeps quiet; afterwards she sometimes asks how it went.
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

// Phone mode: she lives in his Telegram, this computer just keeps her running.
function phoneMenu() {
  const paired = Boolean(pet.state.him);
  return Menu.buildFromTemplate([
    { label: `${pet.config.petName}: running for Telegram`, enabled: false },
    { label: paired ? `Paired with ${pet.state.him.name || pet.config.him}` : "Waiting for him to pair", enabled: false },
    { type: "separator" },
    { label: "See the chat", click: openChat },
    { label: "Start with my computer", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { label: "Settings…", click: openSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

function menu() {
  if (pet.phone) return phoneMenu();
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
  if (!pet.phone) createWindow();
  else if (!pet.telegram) setTimeout(openSettings, 800);

  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip(pet.config.petName);
  tray.setContextMenu(menu());
  tray.on("click", () => (win ? win.show() : (tray.setContextMenu(menu()), tray.popUpContextMenu())));

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
    forwarded: Boolean(pet.telegram && pet.config.telegram?.forwardHisMessagesToMe && pet.state.me),
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
  ipcMain.on("open-chat", openChat);
  ipcMain.on("hover", (_event, over) => win.setIgnoreMouseEvents(!over, { forward: true }));
  ipcMain.on("walk", (_event, dx) => walk(dx));
  ipcMain.on("hop", hop);
  ipcMain.on("drag", (_event, { dx, dy }) => {
    clearInterval(walkTimer);
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
    if (chatWin && !chatWin.isDestroyed() && chatWin.isVisible()) placeChat();
    savePlace();
  });
  ipcMain.on("menu", () => {
    tray.setContextMenu(menu());
    menu().popup({ window: win });
  });

  pet.start({ bot: pet.config.pet?.runBot !== false && !pet.isExample });
});

app.on("before-quit", () => pet?.stop());
app.on("window-all-closed", () => {});
