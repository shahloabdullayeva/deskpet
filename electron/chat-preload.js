const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chat", {
  info: () => ipcRenderer.invoke("chat:info"),
  send: (text, uploads) => ipcRenderer.invoke("chat:send", text, uploads),
  open: (file) => ipcRenderer.send("chat:open", file),
  lists: () => ipcRenderer.invoke("chat:lists"),
  forget: (id) => ipcRenderer.invoke("chat:forget", id),
  cancel: (id) => ipcRenderer.invoke("chat:cancel", id),
  close: () => ipcRenderer.send("chat:close"),
  onAdd: (callback) => ipcRenderer.on("chat:add", (_event, entry) => callback(entry)),
  onFeeling: (callback) => ipcRenderer.on("chat:feeling", (_event, feeling) => callback(feeling)),
});
