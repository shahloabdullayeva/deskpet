const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = ["say", "mood", "look", "walked", "flash", "visible", "hover", "pinned", "call", "cursor", "size", "airborne", "bounce", "landed"];

contextBridge.exposeInMainWorld("pet", {
  ready: () => ipcRenderer.send("ready"),
  tap: () => ipcRenderer.send("tap"),
  spun: () => ipcRenderer.send("spun"),
  petted: () => ipcRenderer.send("petted"),
  openChat: () => ipcRenderer.send("open-chat"),
  shape: (rects) => ipcRenderer.send("shape", rects),
  hold: (on) => ipcRenderer.send("hold", on),
  drag: (dx, dy) => ipcRenderer.send("drag", { dx, dy }),
  drop: (vx, vy) => ipcRenderer.send("drop", { vx, vy }),
  resize: (step) => ipcRenderer.send("resize", step),
  walk: (dx) => ipcRenderer.send("walk", dx),
  stopWalking: () => ipcRenderer.send("stop-walking"),
  menu: () => ipcRenderer.send("menu"),
  on: (channel, callback) => {
    if (CHANNELS.includes(channel)) ipcRenderer.on(channel, (_event, payload) => callback(payload));
  },
});
