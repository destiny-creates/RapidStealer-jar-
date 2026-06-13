const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  sendMessage: (text) => ipcRenderer.send('send-message', text),
  closeWindow: () => ipcRenderer.send('close-window'),
  onMessage: (cb) => ipcRenderer.on('incoming-message', (_event, msg) => cb(msg)),
  startScreen: () => ipcRenderer.send('start-screen'),
  stopScreen: () => ipcRenderer.send('stop-screen'),
});
