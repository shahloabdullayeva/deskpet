const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen } = require("electron");

// The installed app keeps your settings in its own user folder, so nothing needs editing by hand.
const HOME = path.join(app.getPath("userData"), "me");
process.env.DESKPET_HOME ||= HOME;
process.env.DESKPET_DATA ||= path.join(app.getPath("userData"), "data");

const { Deskpet } = require("../src/deskpet");
const setupFile = require("../src/setup-file");

const WIDTH = 280;
const HEIGHT = 400;
const ICON = path.join(__dirname, "icon.png");

let win;
let tray;
let pet;
let muted = false;
let hiddenUntil = 0;
let walkTimer;

if (!app.requestSingleInstanceLock()) app.quit();

function setupArg(argv) {
  return argv.slice(1).find((arg) => arg.toLowerCase().endsWith(".maomao") && fs.existsSync(arg));
}

function installSetup(file) {
  try {
    setupFile.install(file, process.env.DESKPET_HOME);
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
    app.relaunch({ args: process.argv.slice(1).filter((arg) => !arg.toLowerCase().endsWith(".maomao")) });
    app.exit(0);
  } catch (error) {
    dialog.showErrorBox("Couldn't load the setup file", error.message);
  }
}

async function chooseSetup() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "Load the setup file from her",
    filters: [{ name: "Maomao setup", extensions: ["maomao", "json"] }],
    properties: ["openFile"],
  });
  if (!canceled && filePaths[0]) installSetup(filePaths[0]);
}

function openSetupPage() {
  const page = new BrowserWindow({ width: 900, height: 900, title: "Maomao setup", autoHideMenuBar: true, icon: ICON });
  page.loadFile(path.join(__dirname, "..", "setup", "index.html"));
}

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
    volume: settings.volume ?? 0.7,
  };
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: area.x + area.width - WIDTH - 24,
    y: area.y + area.height - HEIGHT,
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
      send("walked");
      return;
    }
    win.setPosition(now + step, y);
  }, 16);
}

function menu() {
  const quietFor = (minutes) => () => (hiddenUntil = Date.now() + minutes * 60_000);
  return Menu.buildFromTemplate([
    { label: `${pet.config.petName} 🌿`, enabled: false },
    { type: "separator" },
    { label: "Show / hide", click: () => (win.isVisible() ? win.hide() : win.show()) },
    { label: "Mute chime", type: "checkbox", checked: muted, click: () => (muted = !muted) },
    { label: "Quiet for 1 hour (in a meeting)", click: quietFor(60) },
    { label: "Start with my computer", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: "separator" },
    { label: "Load setup file…", click: chooseSetup },
    { label: "Make a setup file…", click: openSetupPage },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
}

app.on("second-instance", (_event, argv) => {
  const file = setupArg(argv);
  if (file) installSetup(file);
  else win?.show();
});
app.on("open-file", (event, file) => {
  event.preventDefault();
  if (app.isReady()) installSetup(file);
  else process.argv.push(file);
});

app.whenReady().then(() => {
  const file = setupArg(process.argv);
  if (file) return installSetup(file);

  app.dock?.hide();
  pet = new Deskpet();
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

  ipcMain.on("ready", () => {
    send("look", look());
    send("mood", pet.mood || "idle");
    if (pet.isExample) {
      setTimeout(() => send("say", { text: `Hi! I'm ${pet.config.petName} 🌿 Double-click the .maomao file she sent you, or right-click me → Load setup file.`, mood: "happy" }), 1500);
    }
  });
  ipcMain.on("tap", () => pet.tap().catch((error) => console.error("[tap]", error)));
  ipcMain.on("hover", (_event, over) => win.setIgnoreMouseEvents(!over, { forward: true }));
  ipcMain.on("walk", (_event, dx) => walk(dx));
  ipcMain.on("drag", (_event, { dx, dy }) => {
    clearInterval(walkTimer);
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
  });
  ipcMain.on("menu", () => {
    tray.setContextMenu(menu());
    menu().popup({ window: win });
  });

  pet.start({ bot: pet.config.pet?.runBot !== false && !pet.isExample });
});

app.on("before-quit", () => pet?.stop());
app.on("window-all-closed", () => {});
