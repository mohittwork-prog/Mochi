const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mochiSettings', {
  get: () => ipcRenderer.invoke('get-settings'),
  set: (k, v) => ipcRenderer.send('set', k, v),
  onStatus: (fn) => ipcRenderer.on('status', (_e, s) => fn(s)),
  openAccessibility: () => ipcRenderer.send('open-accessibility'),
  openInputMonitoring: () => ipcRenderer.send('open-input-monitoring'),
  restart: () => ipcRenderer.send('restart'),
  moveCorner: () => ipcRenderer.send('move-corner'),
  quit: () => ipcRenderer.send('quit')
});
