const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, Menu, Tray, desktopCapturer, ipcMain, nativeImage, net, powerMonitor, protocol, screen, shell } = require("electron");

const LINUX = process.platform === "linux";
const SHAPED = LINUX;
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

const MAX_UPLOAD = 25_000_000;
const PEEK_EVERY = [20, 35];
const PERCH_SECONDS = 30;

protocol.registerSchemesAsPrivileged([{ scheme: "maomao", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

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
let falling = false;
let size = 140;
let nextPeek = 0;
let peekPausedUntil = 0;
let peeking = false;
let perchTimer;
let climbTimer;
let quitting = false;

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
  quitting = true;
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
    outfit: OUTFITS[place.outfit] ? place.outfit : "servant",
    images,
    wander: settings.wander !== false,
    volume: settings.volume ?? 0.7,
    size,
  };
}

const OUTFITS = {
  servant: { label: "Servant robe", line: "laundry clothes. practical. unlike most of your ideas" },
  jade: { label: "Jade Pavilion lady-in-waiting", line: "lady-in-waiting again. someone competent has to taste the food" },
  garden: { label: "Garden party (with the hairpin)", line: "the hairpin stays. don't ask" },
  verdigris: { label: "Verdigris House dress-up", line: "the madam would charge you for looking. so would i" },
  shop: { label: "Apothecary shop apron", line: "back to real work. don't touch the shelves" },
};

function wear(outfit) {
  place = { ...place, outfit };
  try {
    fs.writeFileSync(PLACE, JSON.stringify(place));
  } catch {}
  send("look", look());
  send("say", { text: OUTFITS[outfit].line, mood: "talk" });
  refreshTray();
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
  win.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on("closed", () => {
    win = null;
    if (!quitting) createWindow();
  });
  win.on("hide", () => send("visible", false));
  win.on("show", () => send("visible", true));
  if (LINUX) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver");
    win.on("blur", () => setTimeout(keepOnTop, 60));
  } else {
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true);
  }
  over = false;
  if (SHAPED) applyShape();
  else win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "index.html"));
}

let hitRects = [];
let holding = false;
let over = false;
let lastCursor = "";

function cursorOverPet(x, y) {
  return hitRects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
}

function pollCursor() {
  if (!alive(win) || !win.isVisible()) return;
  const point = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  const [x, y] = [point.x - wx, point.y - wy];
  const key = `${x},${y}`;
  if (key !== lastCursor) {
    lastCursor = key;
    send("cursor", { x, y });
  }
  const now = holding || cursorOverPet(x, y);
  if (now === over) return;
  over = now;
  if (!SHAPED) win.setIgnoreMouseEvents(!over, { forward: true });
  send("hover", over);
}

function applyShape() {
  if (!alive(win) || typeof win.setShape !== "function") return;
  const [W, H] = win.getSize();
  const rects = hitRects
    .map((r) => {
      const x = Math.max(0, Math.round(r.x - 14));
      const y = Math.max(0, Math.round(r.y - 14));
      return { x, y, width: Math.min(W - x, Math.round(r.width + 28)), height: Math.min(H - y, Math.round(r.height + 28)) };
    })
    .filter((r) => r.width > 0 && r.height > 0);
  win.setShape(rects.length ? rects : [{ x: 0, y: 0, width: 1, height: 1 }]);
}

function setHitRects(rects) {
  hitRects = (Array.isArray(rects) ? rects : [])
    .slice(0, 8)
    .map((r) => ({ x: Number(r.x) || 0, y: Number(r.y) || 0, width: Math.max(0, Number(r.width) || 0), height: Math.max(0, Number(r.height) || 0) }));
  if (SHAPED) applyShape();
}

function keepOnTop() {
  if (!alive(win) || !win.isVisible() || quitting) return;
  if (!win.isAlwaysOnTop()) win.setAlwaysOnTop(true, "screen-saver");
  win.moveTop();
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
  quip(step > 0 ? "bigger" : "smaller", 0.5, 120_000);
  place = { ...place, size };
  savePlace();
}

function fall(vx, vy) {
  clearInterval(walkTimer);
  clearInterval(fallTimer);
  if (!alive(win)) return;
  const cap = (v) => Math.max(-70, Math.min(70, v));
  let [x, y] = win.getPosition();
  vx = cap(vx * 16);
  vy = cap(vy * 16);
  let airborne = false;
  let hardest = 0;
  falling = true;
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
        hardest = Math.max(hardest, impact);
        send("bounce", impact);
      } else {
        clearInterval(fallTimer);
        falling = false;
        win.setPosition(Math.round(x), Math.round(y));
        savePlace();
        send("landed", airborne ? impact : 0);
        if (airborne) quip(hardest > 18 ? "thrown" : "dropped", hardest > 18 ? 1 : 0.35, hardest > 18 ? 20_000 : 60_000);
        return;
      }
    }
    win.setPosition(Math.round(x), Math.round(y));
  }, 16);
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function walk(dx, done = {}) {
  clearInterval(walkTimer);
  if (place.pinned || !alive(win)) return send("walked", done);
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
      send("walked", done);
      return;
    }
    win.setPosition(now + step, y);
  }, 16);
}

function canPeek() {
  return pet.config.pet?.peek === true && Date.now() >= peekPausedUntil && Date.now() >= hiddenUntil && !callStarted && !peeking && !falling && !holding && alive(win) && win.isVisible() && pet.brain.client && pet.atComputer() && pet.feel().feeling !== "sleepy";
}

function stroll(x, done) {
  const [now] = win.getPosition();
  const dx = Math.round(x - now);
  if (Math.abs(dx) < 4) return done();
  send("stroll", dx);
  const check = setInterval(() => {
    if (!alive(win)) return clearInterval(check);
    if (Math.abs(win.getPosition()[0] - (now + dx)) <= 3 || falling || holding) {
      clearInterval(check);
      done();
    }
  }, 100);
  walk(dx);
}

function climb(y, done) {
  clearInterval(climbTimer);
  const [, from] = win.getPosition();
  if (Math.abs(y - from) < 4) return done();
  send("climb", true);
  let tick = 0;
  climbTimer = setInterval(() => {
    if (!alive(win) || holding || falling) {
      send("climb", false);
      return clearInterval(climbTimer);
    }
    const [x, now] = win.getPosition();
    tick += 1;
    const pace = 1.5 + Math.abs(Math.sin(tick * 0.115)) * 4;
    if (Math.abs(y - now) <= pace) {
      clearInterval(climbTimer);
      win.setPosition(x, y);
      send("climb", false);
      return done();
    }
    win.setPosition(x, Math.round(now + Math.sign(y - now) * pace));
  }, 16);
}

function hopAcross(xs, done) {
  if (!xs.length || !alive(win) || holding || falling) return done();
  const [from, y] = win.getPosition();
  const to = xs[0];
  send("hop");
  let frame = 0;
  const frames = 22;
  const timer = setInterval(() => {
    if (!alive(win) || holding || falling) return clearInterval(timer);
    frame += 1;
    win.setPosition(Math.round(from + ((to - from) * frame) / frames), y);
    if (frame >= frames) {
      clearInterval(timer);
      setTimeout(() => hopAcross(xs.slice(1), done), 450);
    }
  }, 16);
}

async function peek(force = false) {
  if (!force && (Date.now() < nextPeek || !canPeek())) return;
  if (force && (peeking || !alive(win) || !pet.brain.client)) return;
  nextPeek = Date.now() + (PEEK_EVERY[0] + Math.random() * (PEEK_EVERY[1] - PEEK_EVERY[0])) * 60_000;
  peeking = true;
  try {
    const W = width();
    const H = height();
    const [px, py] = win.getPosition();
    const display = screen.getDisplayNearestPoint({ x: Math.round(px + W / 2), y: Math.round(py + H / 2) });
    const { bounds, workArea } = display;
    const shot = { width: 1280, height: Math.round((1280 * bounds.height) / bounds.width) };
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: shot });
    const source = sources.find((item) => item.display_id === String(display.id)) || sources[0];
    if (!source || source.thumbnail.isEmpty()) return;
    const seen = await pet.brain.look(source.thumbnail.toJPEG(70));
    if (!seen || !alive(win)) return;
    if (place.pinned || seen.x === null || seen.y === null) return pet.announce(seen.text);
    const toX = (fraction) => Math.round(Math.max(workArea.x, Math.min(workArea.x + workArea.width - W, bounds.x + fraction * bounds.width - W / 2)));
    const y = Math.round(Math.max(workArea.y - H * 0.3, Math.min(workArea.y + workArea.height - H, bounds.y + seen.y * bounds.height - H + 8)));
    const perch = () => {
      pet.announce(seen.text);
      clearTimeout(perchTimer);
      perchTimer = setTimeout(() => !holding && !falling && fall(0, 0), PERCH_SECONDS * 1000);
    };
    const there = () => {
      if (seen.move === "walk") return stroll(toX(seen.toX), () => (send("point"), setTimeout(perch, 300)));
      if (seen.move === "tabs") return hopAcross(seen.tabs.slice(1).map(toX), perch);
      perch();
    };
    stroll(toX(seen.x), () => climb(y, there));
  } catch (error) {
    console.warn(`[peek] ${error.message}`);
  } finally {
    peeking = false;
  }
}

function nap() {
  if (!alive(win)) return send("walked", { side: 1 });
  const W = width();
  const [x, y] = win.getPosition();
  const area = screen.getDisplayNearestPoint({ x: Math.round(x + W / 2), y }).workArea;
  const left = area.x;
  const right = area.x + area.width - W;
  const side = x - left <= right - x ? 1 : -1;
  if (place.pinned) return send("walked", { side });
  const dx = (side === 1 ? left : right) - x;
  send("nap", dx);
  walk(dx, { side });
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

const quipped = {};

function quip(kind, chance = 1, gap = 90_000) {
  const now = Date.now();
  if (now < hiddenUntil || pet.feel().feeling === "sleepy" || Math.random() > chance || now - (quipped[kind] || 0) < gap) return;
  quipped[kind] = now;
  pet.line(kind, kind === "thrown" ? "pout" : "talk");
}

function feed(kind) {
  if (pet.feel().feeling === "sleepy") return pet.fed(kind);
  send("feed", kind);
}

let wasAway = false;
function watchArrival() {
  const idle = powerMonitor.getSystemIdleTime();
  if (idle >= 600) wasAway = true;
  else if (wasAway && idle < 5) {
    wasAway = false;
    pet.updateFeeling();
    setTimeout(() => {
      if (Date.now() < hiddenUntil || pet.feel().feeling === "sleepy") return;
      send("welcome");
      pet.line("welcomeBack", "happy");
    }, 2500);
  }
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
  let manual = false;
  const tell = (text) => send("say", { text, mood: "talk", chime: false });
  autoUpdater.on("error", (error) => {
    console.warn(`[update] ${error.message}`);
    send("updating", null);
    updateStatus = "";
    refreshTray();
    if (manual) tell(`couldn't get the update: ${String(error.message).split("\n")[0].slice(0, 120)}`);
    manual = false;
  });
  autoUpdater.on("update-not-available", () => {
    if (manual) tell(`i'm already the newest version (${app.getVersion()})`);
    manual = false;
  });
  autoUpdater.on("update-available", (info) => {
    updateStatus = `Downloading ${info.version}…`;
    refreshTray();
    send("updating", 0);
    if (manual) tell(`found ${info.version}, downloading it now. give me a minute`);
  });
  autoUpdater.on("download-progress", (progress) => {
    const label = `Downloading update… ${Math.round(progress.percent)}%`;
    if (label === updateStatus) return;
    send("updating", progress.percent);
    updateStatus = label;
    refreshTray();
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateReady = true;
    updateStatus = "";
    refreshTray();
    send("updating", 100);
    if (manual) tell(`${info.version} is ready. right-click me and pick restart to update`);
    manual = false;
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
  return () => {
    if (updateStatus) return tell("already downloading it, hold on");
    manual = true;
    tell("checking for updates…");
    check();
  };
}

let checkUpdates;
let updateStatus = "";

function menu() {
  const quietFor = (minutes) => () => (hiddenUntil = Date.now() + minutes * 60_000);
  return Menu.buildFromTemplate([
    { label: pet.config.petName, enabled: false },
    { label: `Feeling ${pet.feeling || pet.feel().feeling}`, enabled: false },
    { type: "separator" },
    { label: `Chat with ${pet.config.petName}`, click: openChat },
    {
      label: "Feed her",
      submenu: [
        { label: "Tea", click: () => feed("tea") },
        { label: "Dumpling", click: () => feed("dumpling") },
        { label: "Fresh herbs", click: () => feed("herb") },
        { label: "Suspicious mushroom", click: () => feed("mushroom") },
      ],
    },
    ...((pet.config.pet?.character || "maomao") === "maomao" && !fs.existsSync(path.join(__dirname, "models", "maomao.vrm"))
      ? [{ label: "Change clothes", submenu: Object.entries(OUTFITS).map(([name, { label }]) => ({ label, type: "radio", checked: (place.outfit || "servant") === name, click: () => wear(name) })) }]
      : []),
    pet.feel().feeling === "sleepy"
      ? { label: "Wake up", click: () => pet.sleepNow(false) }
      : { label: "Go to sleep", click: () => pet.sleepNow(true) },
    { label: "Show / hide", click: () => alive(win) && (win.isVisible() ? win.hide() : win.show()) },
    { label: "Mute chime", type: "checkbox", checked: muted, click: (item) => ((muted = item.checked), refreshTray()) },
    callStarted
      ? { label: "Call's over", click: endCall }
      : { label: "I'm on a call", click: startCall },
    { label: "Quiet for 1 hour (in a meeting)", click: quietFor(60) },
    ...(pet.config.pet?.peek === true
      ? [
          { label: "Look at my screen now", click: () => peek(true) },
          Date.now() < peekPausedUntil
            ? { label: "Start looking at my screen again", click: () => ((peekPausedUntil = 0), refreshTray()) }
            : { label: "Don't look at my screen for 2 hours", click: () => ((peekPausedUntil = Date.now() + 2 * 3600_000), refreshTray()) },
        ]
      : []),
    { label: "Pin her here", type: "checkbox", checked: Boolean(place.pinned), click: (item) => pin(item.checked) },
    { label: "Start with my computer", type: "checkbox", checked: startsWithComputer(), click: (item) => (setStartup(item.checked), refreshTray()) },
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    updateReady
      ? { label: "Restart to update", click: () => require("electron-updater").autoUpdater.quitAndInstall(true, true) }
      : updateStatus
        ? { label: updateStatus, enabled: false }
        : process.env.PORTABLE_EXECUTABLE_DIR
          ? { label: `v${app.getVersion()} (portable: install Maomao-Setup.exe for updates)`, enabled: false }
          : { label: `Check for updates (v${app.getVersion()})`, enabled: Boolean(checkUpdates), click: () => checkUpdates?.() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

app.on("second-instance", () => {
  if (alive(win)) win.show();
  else if (pet) createWindow();
});

process.on("uncaughtException", (error) => console.error("[main]", error));

app.whenReady().then(() => {
  app.dock?.hide();
  pet = new Deskpet();
  pet.idleSeconds = () => powerMonitor.getSystemIdleTime();
  protocol.handle("maomao", (request) => {
    const file = path.basename(decodeURIComponent(new URL(request.url).pathname));
    return net.fetch(pathToFileURL(path.join(pet.filesDir, file)).toString());
  });
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
  pet.events.on("angry", () => send("angry"));
  setInterval(watchArrival, 3000);
  nextPeek = Date.now() + 5 * 60_000;
  setInterval(() => peek().catch(() => {}), 30_000);
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
  ipcMain.handle("chat:send", async (_event, text, uploads = []) => {
    send("flash", "talk");
    const files = (Array.isArray(uploads) ? uploads : []).filter((upload) => upload?.data?.byteLength && upload.data.byteLength <= MAX_UPLOAD);
    const reply = await pet.deskChat(String(text || "").slice(0, 2000), files);
    send("flash", "happy");
    return reply;
  });
  ipcMain.handle("chat:lists", lists);
  ipcMain.on("chat:open", (_event, file) => shell.openPath(path.join(pet.filesDir, path.basename(String(file)))));
  ipcMain.handle("chat:forget", (_event, id) => (pet.memory.forget(id), lists()));
  ipcMain.handle("chat:cancel", (_event, id) => (pet.memory.cancel(id), lists()));
  ipcMain.on("chat:close", () => alive(chatWin) && chatWin.hide());

  ipcMain.on("ready", () => {
    send("look", look());
    send("mood", pet.mood || "idle");
    send("pinned", Boolean(place.pinned));
    if (pet.isExample) setTimeout(openSettings, 800);
    if (app.isPackaged && place.version !== app.getVersion() && (place.version || Number.isFinite(place.x))) {
      setTimeout(() => pet.announce(`i got an update. you can send me pictures and files in chat now, and if you switch it on in settings i'll climb around your screen and look at what you're doing`), 6000);
    }
    if (place.version !== app.getVersion()) {
      place = { ...place, version: app.getVersion() };
      try {
        fs.writeFileSync(PLACE, JSON.stringify(place));
      } catch {}
    }
  });
  ipcMain.on("tap", () => {
    pet.touch();
    send("flash", "happy");
    toggleChat();
  });
  ipcMain.on("spun", () => pet.touch());
  ipcMain.on("ate", (_event, kind) => pet.fed(String(kind)));
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
  ipcMain.on("shape", (_event, rects) => setHitRects(rects));
  ipcMain.on("hold", (_event, on) => {
    holding = Boolean(on);
    pollCursor();
  });
  setInterval(pollCursor, 30);
  if (LINUX) setInterval(keepOnTop, 2000);
  ipcMain.on("walk", (_event, dx) => walk(dx));
  ipcMain.on("stop-walking", stopWalking);
  ipcMain.on("nap", nap);
  ipcMain.on("drag", (_event, { dx, dy }) => {
    clearInterval(walkTimer);
    clearInterval(fallTimer);
    falling = false;
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
  quitting = true;
  stopTimers();
  pet?.stop();
});
app.on("window-all-closed", () => {});
