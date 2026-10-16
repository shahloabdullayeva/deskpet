const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, Menu, screen } = require("electron");
const { Deskpet } = require("../src/deskpet");

const WIDTH = 280;
const HEIGHT = 380;

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let pet;
let muted = false;
let hiddenUntil = 0;

function look() {
  const dir = path.join(pet.dir, "character");
  const images = {};
  for (const mood of ["idle", "talk", "happy", "sleepy"]) {
    const file = path.join(dir, `${mood}.png`);
    if (fs.existsSync(file)) images[mood] = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  }
  return { colors: pet.config.pet?.look || {}, images, name: pet.config.petName, volume: pet.config.pet?.volume ?? 0.7 };
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

app.whenReady().then(() => {
  app.dock?.hide();
  pet = new Deskpet();
  createWindow();

  pet.events.on("say", ({ text, sound, mood }) => {
    if (Date.now() < hiddenUntil) return;
    send("say", { text, mood, sound: sound && !muted ? `data:${sound.mime};base64,${sound.buffer.toString("base64")}` : null });
  });
  pet.events.on("mood", (mood) => send("mood", mood));

  ipcMain.on("ready", () => {
    send("look", look());
    send("mood", pet.mood || "idle");
  });
  ipcMain.on("tap", () => pet.tap().catch((error) => console.error("[tap]", error)));
  ipcMain.on("hover", (_event, over) => win.setIgnoreMouseEvents(!over, { forward: true }));
  ipcMain.on("drag", (_event, { dx, dy }) => {
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
  });
  ipcMain.on("menu", () => {
    const quietFor = (minutes) => () => (hiddenUntil = Date.now() + minutes * 60_000);
    Menu.buildFromTemplate([
      { label: `${pet.config.petName} 🐾`, enabled: false },
      { type: "separator" },
      { label: "Mute sound", type: "checkbox", checked: muted, click: () => (muted = !muted) },
      { label: "Quiet for 1 hour (in a meeting)", click: quietFor(60) },
      { label: "Start with my computer", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]).popup({ window: win });
  });

  pet.start({ bot: pet.config.pet?.runBot !== false });
});

app.on("before-quit", () => pet?.stop());
app.on("window-all-closed", () => app.quit());
