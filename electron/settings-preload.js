const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settings", {
  read: () => ipcRenderer.invoke("settings:read"),
  save: (form) => ipcRenderer.invoke("settings:save", form),
  close: () => ipcRenderer.send("settings:close"),
});
