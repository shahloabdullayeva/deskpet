const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chat", {
  info: () => ipcRenderer.invoke("chat:info"),
  send: (text) => ipcRenderer.invoke("chat:send", text),
  lists: () => ipcRenderer.invoke("chat:lists"),
  forget: (id) => ipcRenderer.invoke("chat:forget", id),
  cancel: (id) => ipcRenderer.invoke("chat:cancel", id),
  close: () => ipcRenderer.send("chat:close"),
  onAdd: (callback) => ipcRenderer.on("chat:add", (_event, entry) => callback(entry)),
});
