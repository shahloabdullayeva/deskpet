const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("toy", {
  grab: () => ipcRenderer.send("toy:grab"),
  drag: (dx, dy) => ipcRenderer.send("toy:drag", { dx, dy }),
  drop: () => ipcRenderer.send("toy:drop"),
  close: () => ipcRenderer.send("toy:close"),
});
