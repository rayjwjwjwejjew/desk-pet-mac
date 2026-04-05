const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, Notification, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const USER_DATA = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
const SPEECH_FILE = path.join(USER_DATA, 'speeches.json');

let petWindow = null;
let configWindow = null;
let tray = null;
let reminderTimers = {};

// ─── 简单 JSON 配置 ───
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch(e) {}
  return {};
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function loadSpeeches() {
  try {
    if (fs.existsSync(SPEECH_FILE)) return JSON.parse(fs.readFileSync(SPEECH_FILE, 'utf8'));
  } catch(e) {}
  return null;
}
function saveSpeeches(data) {
  fs.writeFileSync(SPEECH_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── 提醒系统 ───
function clearReminderTimers() {
  Object.values(reminderTimers).forEach(t => clearInterval(t));
  reminderTimers = {};
}

function initReminders() {
  clearReminderTimers();
  const s = loadConfig();
  const {
    enableWater = true, enableStand = true, enableEye = true, enablePomodoro = true,
    waterInterval = 45, standInterval = 60, eyeInterval = 90, pomodoroDuration = 25
  } = s;

  if (enableWater) {
    reminderTimers.water = setInterval(() => triggerReminder('💧 喝水提醒', '该喝一杯水啦~ 保持水分充足！'), waterInterval * 60 * 1000);
  }
  if (enableStand) {
    reminderTimers.stand = setInterval(() => triggerReminder('🚶 久坐提醒', '站起来活动一下吧！伸个懒腰~'), standInterval * 60 * 1000);
  }
  if (enableEye) {
    reminderTimers.eye = setInterval(() => triggerReminder('👀 眼保健操', '看看远处，让眼睛休息一下~'), eyeInterval * 60 * 1000);
  }
  if (enablePomodoro) {
    reminderTimers.pomodoro = setInterval(() => triggerReminder('🍅 番茄钟', '专注时间结束！休息5分钟吧~'), pomodoroDuration * 60 * 1000);
  }
}

function triggerReminder(title, body) {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body });
    n.show();
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('show-bubble', body);
    petWindow.webContents.send('trigger-state', 'speaking');
  }
}

// ─── 窗口 ───
function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const cfg = loadConfig();
  const saved = cfg.petPosition || { x: width - 200, y: 100 };

  petWindow = new BrowserWindow({
    width: 300, height: 300,
    x: saved.x, y: saved.y,
    frame: false, transparent: true,
    alwaysOnTop: true, hasShadow: false,
    resizable: false, skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile(path.join(__dirname, 'index.html'));
  petWindow.setIgnoreMouseEvents(false);

  petWindow.on('moved', () => {
    const [x, y] = petWindow.getPosition();
    const cfg = loadConfig();
    cfg.petPosition = { x, y };
    saveConfig(cfg);
  });
}

function createConfigWindow() {
  if (configWindow) { configWindow.focus(); return; }
  configWindow = new BrowserWindow({
    width: 480, height: 560,
    title: 'DeskPet 设置',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  configWindow.loadFile(path.join(__dirname, 'config.html'));
  configWindow.setMenu(null);
  configWindow.on('closed', () => { configWindow = null; });
}

// ─── 托盘 + 菜单 ───
function createTray() {
  // 纯 SVG 数据 URL 生成图标
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="15" fill="#FF6B9D"/>
    <circle cx="11" cy="13" r="2.5" fill="white"/>
    <circle cx="21" cy="13" r="2.5" fill="white"/>
    <path d="M10 20 Q16 25 22 20" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`;
  const iconDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const trayIcon = nativeImage.createFromDataURL(iconDataUrl);
  tray = new Tray(trayIcon);
  tray.setToolTip('DeskPet');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示桌宠', click: () => petWindow && petWindow.show() },
    { label: '隐藏桌宠', click: () => petWindow && petWindow.hide() },
    { type: 'separator' },
    { label: '😄 开心模式', click: () => petWindow?.webContents.send('trigger-state', 'happy') },
    { label: '💼 工作模式', click: () => petWindow?.webContents.send('trigger-state', 'working') },
    { label: '😴 睡眠模式', click: () => petWindow?.webContents.send('trigger-state', 'sleeping') },
    { type: 'separator' },
    { label: '⚙️ 设置', click: () => createConfigWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => petWindow?.show());
}

// ─── IPC ───
ipcMain.handle('get-settings', () => loadConfig());
ipcMain.handle('save-settings', (event, settings) => {
  const cfg = loadConfig();
  Object.assign(cfg, { settings });
  saveConfig(cfg);
  initReminders();
});
ipcMain.handle('get-state', () => {
  const cfg = loadConfig();
  return cfg.currentState || 'idle';
});
ipcMain.handle('save-state', (event, state) => {
  const cfg = loadConfig();
  cfg.currentState = state;
  saveConfig(cfg);
});
ipcMain.handle('get-speeches', () => loadSpeeches());
ipcMain.handle('save-speeches', (event, speeches) => saveSpeeches(speeches));
ipcMain.on('open-config', () => createConfigWindow());

// ─── 启动 ───
app.whenReady().then(() => {
  createPetWindow();
  createTray();
  initReminders();

  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (petWindow) {
      const [x, y] = petWindow.getPosition();
      petWindow.setPosition(x === 0 ? 100 : 0, y);
    }
  });
});

app.on('window-all-closed', () => { /* 不退出 */ });
app.on('before-quit', () => {
  clearReminderTimers();
  globalShortcut.unregisterAll();
});
