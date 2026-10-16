const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pet", {
  ready: () => ipcRenderer.send("ready"),
  tap: () => ipcRenderer.send("tap"),
  openChat: () => ipcRenderer.send("open-chat"),
  hover: (over) => ipcRenderer.send("hover", over),
  drag: (dx, dy) => ipcRenderer.send("drag", { dx, dy }),
  walk: (dx) => ipcRenderer.send("walk", dx),
  menu: () => ipcRenderer.send("menu"),
  on: (channel, callback) => {
    if (["say", "mood", "look", "walked", "flash"].includes(channel)) ipcRenderer.on(channel, (_event, payload) => callback(payload));
  },
});
