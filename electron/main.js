const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, powerMonitor, screen } = require("electron");

const LINUX = process.platform === "linux";
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

if (LINUX) {
  app.commandLine.appendSwitch("enable-transparent-visuals");
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  if (process.env.WAYLAND_DISPLAY && !app.commandLine.hasSwitch("ozone-platform")) {
    app.relaunch({ execPath: process.env.APPIMAGE || process.execPath, args: [...process.argv.slice(1), "--ozone-platform=x11"] });
    app.exit(0);
  }
}

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
const alive = (w) => Boolean(w && !w.isDestroyed());

let saveTimer;
function savePlace() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!alive(win)) return;
    const [x, y] = win.getPosition();
    place = { ...place, x, y };
    fs.writeFileSync(PLACE, JSON.stringify(place));
  }, 500);
}

const width = () => Math.round(Math.max(240, size * 1.1));
const height = () => Math.round(size + 120);

if (!app.requestSingleInstanceLock()) app.quit();

const AUTOSTART = path.join(app.getPath("home"), ".config", "autostart", "maomao.desktop");

function startsWithComputer() {
  if (!LINUX) return app.getLoginItemSettings().openAtLogin;
  return fs.existsSync(AUTOSTART);
}

function setStartup(on) {
  if (!LINUX) return app.setLoginItemSettings({ openAtLogin: on });
  if (!on) return fs.rmSync(AUTOSTART, { force: true });
  const exec = process.env.APPIMAGE || process.execPath;
  const args = app.isPackaged ? "" : ` "${app.getAppPath()}"`;
  fs.mkdirSync(path.dirname(AUTOSTART), { recursive: true });
  fs.writeFileSync(AUTOSTART, `[Desktop Entry]\nType=Application\nName=Maomao\nExec="${exec}"${args}\nIcon=maomao\nX-GNOME-Autostart-enabled=true\nTerminal=false\n`);
}

function stopTimers() {
  clearTimeout(saveTimer);
  clearInterval(walkTimer);
  clearInterval(fallTimer);
}

function restart() {
  stopTimers();
  app.relaunch(process.env.APPIMAGE ? { execPath: process.env.APPIMAGE, args: process.argv.slice(1) } : undefined);
  app.exit(0);
}

let settingsWin;

function openSettings() {
  if (alive(settingsWin)) return settingsWin.focus();
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
  if (app.isPackaged && pet?.isExample) setStartup(true);
  restart();
});
ipcMain.on("settings:close", () => alive(settingsWin) && settingsWin.close());

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
    webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
  });
  win.on("hide", () => send("visible", false));
  win.on("show", () => send("visible", true));
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "index.html"));
  let lastCursor = "";
  setInterval(() => {
    if (!alive(win) || !win.isVisible()) return;
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
  if (!alive(win)) return;
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
    if (!alive(win)) return clearInterval(fallTimer);
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
  if (place.pinned || !alive(win)) return send("walked");
  const WIDTH = width();
  const [x, y] = win.getPosition();
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  const target = Math.max(area.x, Math.min(area.x + area.width - WIDTH, x + dx));
  const step = Math.sign(target - x) * 2;
  walkTimer = setInterval(() => {
    if (!alive(win)) return clearInterval(walkTimer);
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

function stopWalking() {
  clearInterval(walkTimer);
  savePlace();
  send("walked");
}

function placeChat() {
  if (!alive(chatWin)) return;
  if (!alive(win)) return chatWin.center();
  const [WIDTH, HEIGHT] = [width(), height()];
  const [x, y] = win.getPosition();
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  const [chatW, chatH] = chatWin.getSize();
  const left = x - chatW + 30 >= area.x ? x - chatW + 30 : x + WIDTH - 30;
  const top = Math.max(area.y, Math.min(y + HEIGHT - chatH - 40, area.y + area.height - chatH));
  chatWin.setPosition(Math.round(Math.min(left, area.x + area.width - chatW)), Math.round(top));
}

function openChat() {
  if (!alive(chatWin)) {
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
    chatWin.once("ready-to-show", () => alive(chatWin) && chatWin.show());
  } else {
    chatWin.show();
  }
  placeChat();
  chatWin.focus();
}

function toggleChat() {
  if (alive(chatWin) && chatWin.isVisible()) chatWin.hide();
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
  if (pinned) stopWalking();
  savePlace();
  send("pinned", pinned);
  refreshTray();
}

function refreshTray() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(menu());
}

function startCall() {
  callStarted = Date.now();
  hiddenUntil = Infinity;
  send("call", true);
  refreshTray();
}

function endCall() {
  const minutes = Math.round((Date.now() - callStarted) / 60_000);
  callStarted = 0;
  hiddenUntil = 0;
  send("call", false);
  refreshTray();
  if (minutes >= 3 && Math.random() < 0.6) setTimeout(() => pet.afterCall(minutes).catch(() => {}), 20_000);
}

let updateReady = false;

function startUpdates() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR || process.env.DESKPET_NO_UPDATES) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on("error", (error) => console.warn(`[update] ${error.message}`));
  autoUpdater.on("update-downloaded", () => {
    updateReady = true;
    refreshTray();
    const install = setInterval(() => {
      const busy = alive(chatWin) && chatWin.isFocused();
      if (busy || powerMonitor.getSystemIdleTime() < 120) return;
      clearInterval(install);
      send("say", { text: "brb, getting an update", mood: "happy", chime: false });
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 2500);
    }, 30_000);
  });
  const check = () => autoUpdater.checkForUpdates().catch((error) => console.warn(`[update] ${error.message}`));
  setTimeout(check, 30_000);
  setInterval(check, 10 * 60_000);
  return check;
}

let checkUpdates;

function menu() {
  const quietFor = (minutes) => () => (hiddenUntil = Date.now() + minutes * 60_000);
  return Menu.buildFromTemplate([
    { label: pet.config.petName, enabled: false },
    { label: `Feeling ${pet.feeling || pet.feel().feeling}`, enabled: false },
    { type: "separator" },
    { label: `Chat with ${pet.config.petName}`, click: openChat },
    { label: "Show / hide", click: () => alive(win) && (win.isVisible() ? win.hide() : win.show()) },
    { label: "Mute chime", type: "checkbox", checked: muted, click: (item) => ((muted = item.checked), refreshTray()) },
    callStarted
      ? { label: "Call's over", click: endCall }
      : { label: "I'm on a call", click: startCall },
    { label: "Quiet for 1 hour (in a meeting)", click: quietFor(60) },
    { label: "Pin her here", type: "checkbox", checked: Boolean(place.pinned), click: (item) => pin(item.checked) },
    { label: "Start with my computer", type: "checkbox", checked: startsWithComputer(), click: (item) => (setStartup(item.checked), refreshTray()) },
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    updateReady
      ? { label: "Restart to update", click: () => require("electron-updater").autoUpdater.quitAndInstall(true, true) }
      : { label: `Check for updates (v${app.getVersion()})`, enabled: Boolean(checkUpdates), click: () => checkUpdates?.() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

app.on("second-instance", () => alive(win) && win.show());

process.on("uncaughtException", (error) => console.error("[main]", error));

app.whenReady().then(() => {
  app.dock?.hide();
  pet = new Deskpet();
  pet.idleSeconds = () => powerMonitor.getSystemIdleTime();
  createWindow();

  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: LINUX ? 24 : 16, height: LINUX ? 24 : 16 }));
  tray.setToolTip(pet.config.petName);
  tray.setContextMenu(menu());
  tray.on("click", () => alive(win) && win.show());

  pet.events.on("say", ({ text, chime, mood }) => {
    if (Date.now() < hiddenUntil) return;
    send("say", { text, mood, chime: chime && !muted && pet.config.pet?.sound !== false });
  });
  pet.events.on("mood", (mood) => send("mood", mood));
  pet.events.on("feeling", refreshTray);
  pet.events.on("feeling", (feeling) => {
    if (alive(chatWin)) chatWin.webContents.send("chat:feeling", feeling);
  });
  pet.events.on("chat", (entry) => {
    if (alive(chatWin)) chatWin.webContents.send("chat:add", entry);
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
  ipcMain.on("chat:close", () => alive(chatWin) && chatWin.hide());

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
  ipcMain.on("hover", (_event, over) => alive(win) && win.setIgnoreMouseEvents(!over, { forward: true }));
  ipcMain.on("walk", (_event, dx) => walk(dx));
  ipcMain.on("stop-walking", stopWalking);
  ipcMain.on("drag", (_event, { dx, dy }) => {
    clearInterval(walkTimer);
    clearInterval(fallTimer);
    if (!alive(win)) return;
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
    if (alive(chatWin) && chatWin.isVisible()) placeChat();
    savePlace();
  });
  ipcMain.on("menu", () => {
    refreshTray();
    if (alive(win)) menu().popup({ window: win });
  });

  pet.start();
  checkUpdates = startUpdates();
  refreshTray();
});

app.on("before-quit", () => {
  stopTimers();
  pet?.stop();
});
app.on("window-all-closed", () => {});
