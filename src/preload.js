const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getState: () => ipcRenderer.invoke('get-state'),
  saveState: (s) => ipcRenderer.invoke('save-state', s),
  getSpeeches: () => ipcRenderer.invoke('get-speeches'),
  saveSpeeches: (s) => ipcRenderer.invoke('save-speeches', s),
  openConfig: () => ipcRenderer.send('open-config'),
  onShowBubble: (cb) => ipcRenderer.on('show-bubble', (_, text) => cb(text)),
  onTriggerState: (cb) => ipcRenderer.on('trigger-state', (_, state) => cb(state))
});
