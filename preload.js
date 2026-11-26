const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mochi', {
  onKey: (fn) => ipcRenderer.on('key', (_e, code, key) => fn(code, key)),
  onMouse: (fn) => ipcRenderer.on('mouse', (_e, x, y) => fn(x, y)),
  onSet: (fn) => ipcRenderer.on('set', (_e, k, v) => fn(k, v)),
  drag: (dx, dy) => ipcRenderer.send('drag', dx, dy)
});
