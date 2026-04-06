const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getState: () => ipcRenderer.invoke('get-state'),
  saveState: (s) => ipcRenderer.invoke('save-state', s),
  openConfig: () => ipcRenderer.send('open-config'),
  openMemo: () => ipcRenderer.send('open-memo'),
  selectPetImage: () => ipcRenderer.invoke('select-pet-image'),
  getPetImagePath: () => ipcRenderer.invoke('get-pet-image-path'),
  updatePosition: (x, y) => ipcRenderer.send('update-position', x, y),
  
  // 备忘录
  getMemos: () => ipcRenderer.invoke('get-memos'),
  addMemo: (content, remindAt) => ipcRenderer.invoke('add-memo', content, remindAt),
  deleteMemo: (id) => ipcRenderer.invoke('delete-memo', id),
  toggleMemo: (id) => ipcRenderer.invoke('toggle-memo', id),
  
  // 桌宠数据
  getCompanionData: () => ipcRenderer.invoke('get-companion-data'),
  saveCompanionData: (updates) => ipcRenderer.invoke('save-companion-data', updates),
  recordPetEvent: (event, payload) => ipcRenderer.invoke('record-pet-event', event, payload),
  getActiveAppContext: () => ipcRenderer.invoke('get-active-app-context'),
  hidePet: () => ipcRenderer.send('hide-pet'),
  snapToEdge: () => ipcRenderer.send('snap-to-edge'),
  moveWindowRandom: () => ipcRenderer.send('move-window-random'),
  petSay: (text) => ipcRenderer.send('pet-say', text),
  
  // 事件监听
  onShowBubble: (cb) => ipcRenderer.on('show-bubble', (_, text) => cb(text)),
  onTriggerState: (cb) => ipcRenderer.on('trigger-state', (_, s) => cb(s)),
  onScaleChanged: (cb) => ipcRenderer.on('scale-changed', (_, scale) => cb(scale)),
  onCompanionUpdated: (cb) => ipcRenderer.on('companion-updated', (_, data) => cb(data)),
});
