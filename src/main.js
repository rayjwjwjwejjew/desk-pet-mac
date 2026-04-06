const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, Notification, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const USER_DATA = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
const MEMO_FILE = path.join(USER_DATA, 'memos.json');
const PET_IMAGE_FILE = path.join(USER_DATA, 'pet_custom.png');
const COMPANION_FILE = path.join(USER_DATA, 'companion.json');

let petWindow = null;
let configWindow = null;
let memoWindow = null;
let tray = null;
let reminderTimers = {};

function loadCompanionData() {
  try {
    if (fs.existsSync(COMPANION_FILE)) return JSON.parse(fs.readFileSync(COMPANION_FILE, 'utf8'));
  } catch (e) {}
  return {
    preferredName: '',
    activePersona: 'companion',
    clickCount: 0,
    completedTasks: 0,
    workSessions: 0,
    reminderCount: 0,
    mood: 'calm',
    lastClickAt: 0,
    memoKeywords: {},
    // 分层动画状态
    layerAnimState: {
      eyeOpen: 1,
      mouthOpen: 0,
      earAngle: 0,
      lastBlinkAt: 0
    }
  };
}

function saveCompanionData(data) {
  fs.writeFileSync(COMPANION_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getActiveAppContext() {
  try {
    const raw = execFileSync('osascript', [
      '-e',
      'tell application "System Events" to get name of first application process whose frontmost is true'
    ], { encoding: 'utf8', timeout: 2500 }).trim();

    const appName = raw || 'Unknown';
    const name = appName.toLowerCase();
    let category = 'idle';

    if (/(cursor|vscode|visual studio code|webstorm|xcode|terminal|iterm|trae|zed|sublime)/.test(name)) category = 'coding';
    else if (/(safari|chrome|firefox|edge|arc|obsidian|notion|preview|word|pages|pdf)/.test(name)) category = 'document';
    else if (/(zoom|tencent meeting|meeting|wechat|feishu|slack|discord)/.test(name)) category = 'meeting';
    else if (/(figma|photoshop|illustrator|canva|pixelmator)/.test(name)) category = 'design';
    else if (/(music|spotify|qqmusic|netease|steam|bilibili|tv|vlc)/.test(name)) category = 'fun';

    return { appName, category, fetchedAt: Date.now() };
  } catch (e) {
    return { appName: '', category: 'idle', fetchedAt: Date.now() };
  }
}

// 获取浏览器当前页面标题
async function getBrowserPageInfo() {
  try {
    const script = `
      tell application "System Events"
        tell (first application process whose frontmost is true)
          try
            return name of first window
          on error
            return ""
          end try
        end tell
      end tell
    `;
    const windowTitle = execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 2000 }).trim();
    
    // 分析窗口标题判断网站类型
    const title = windowTitle.toLowerCase();
    let siteType = 'unknown';
    let siteName = '';
    
    // 视频网站
    if (/(youtube|bilibili|哔哩哔哩|netflix|腾讯视频|爱奇艺|优酷|抖音|tiktok)/.test(title)) {
      siteType = 'video';
      siteName = '视频';
    }
    // 社交媒体
    else if (/(twitter|x\.com|微博|weibo|小红书|instagram|facebook|朋友圈)/.test(title)) {
      siteType = 'social';
      siteName = '社交';
    }
    // 购物
    else if (/(淘宝|天猫|京东|amazon|拼多多|购物)/.test(title)) {
      siteType = 'shopping';
      siteName = '购物';
    }
    // 学习/知识
    else if (/(github|stackoverflow|知乎|掘金|csdn|leetcode|牛客|wikipedia|wiki|教程|学习)/.test(title)) {
      siteType = 'learning';
      siteName = '学习';
    }
    // 工作/办公
    else if (/(gmail|outlook|邮件|文档|doc|sheet|飞书|钉钉|腾讯文档|石墨)/.test(title)) {
      siteType = 'work';
      siteName = '工作';
    }
    // 新闻
    else if (/(news|新闻|头条)/.test(title)) {
      siteType = 'news';
      siteName = '新闻';
    }
    // 游戏
    else if (/(game|游戏|steam|epic)/.test(title)) {
      siteType = 'game';
      siteName = '游戏';
    }
    
    return { windowTitle, siteType, siteName, hasContent: siteType !== 'unknown' };
  } catch (e) {
    return { windowTitle: '', siteType: 'unknown', siteName: '', hasContent: false };
  }
}

// 屏幕内容识别 - 综合分析当前场景
async function analyzeScreenContext() {
  const appContext = getActiveAppContext();
  const browserInfo = await getBrowserPageInfo();
  
  // 综合分析场景
  let scene = 'idle';
  let detail = '';
  
  if (appContext.category === 'coding') {
    scene = 'coding';
    detail = '写代码';
  } else if (appContext.category === 'design') {
    scene = 'design';
    detail = '设计';
  } else if (browserInfo.siteType === 'video') {
    scene = 'entertainment';
    detail = '看视频';
  } else if (browserInfo.siteType === 'social') {
    scene = 'social';
    detail = '刷社交';
  } else if (browserInfo.siteType === 'shopping') {
    scene = 'shopping';
    detail = '购物';
  } else if (browserInfo.siteType === 'learning') {
    scene = 'learning';
    detail = '学习';
  } else if (browserInfo.siteType === 'work') {
    scene = 'working';
    detail = '办公';
  } else if (browserInfo.siteType === 'game') {
    scene = 'gaming';
    detail = '游戏';
  } else if (appContext.category === 'document') {
    scene = 'reading';
    detail = '阅读';
  }
  
  return {
    app: appContext,
    browser: browserInfo,
    scene,
    detail,
    timestamp: Date.now()
  };
}

function updateCompanionData(mutator) {
  const data = loadCompanionData();
  mutator(data);
  saveCompanionData(data);
  return data;
}

function sendPetEvent(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload);
  }
}

// ─── 配置 ───
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch(e) {}
  return {};
}
function saveConfig(data) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8'); }
function loadPetImage() {
  return fs.existsSync(PET_IMAGE_FILE) ? PET_IMAGE_FILE : path.join(__dirname, 'assets', 'pet.png');
}

// ─── 备忘录 ───
function loadMemos() {
  try {
    if (fs.existsSync(MEMO_FILE)) return JSON.parse(fs.readFileSync(MEMO_FILE, 'utf8'));
  } catch(e) {}
  return [];
}
function saveMemos(memos) { fs.writeFileSync(MEMO_FILE, JSON.stringify(memos, null, 2), 'utf8'); }

// ─── 提醒系统 ───
function clearReminders() {
  Object.values(reminderTimers).forEach(t => clearInterval(t));
  reminderTimers = {};
}

function initReminders() {
  clearReminders();
  const s = loadConfig();
  const { enableWater=true, enableStand=true, enableEye=true, enablePomodoro=true,
    waterInterval=45, standInterval=60, eyeInterval=90, pomodoroDuration=25 } = s;
  
  if (enableWater) reminderTimers.water = setInterval(() => triggerReminder('💧 喝水提醒', '该喝一杯水啦~'), waterInterval * 60000);
  if (enableStand) reminderTimers.stand = setInterval(() => triggerReminder('🚶 久坐提醒', '站起来活动一下吧！'), standInterval * 60000);
  if (enableEye) reminderTimers.eye = setInterval(() => triggerReminder('👀 眼保健操', '看看远处，让眼睛休息一下~'), eyeInterval * 60000);
  if (enablePomodoro) reminderTimers.pomodoro = setInterval(() => {
    const companion = updateCompanionData((data) => {
      data.workSessions += 1;
      data.mood = 'proud';
    });
    triggerReminder('🍅 番茄钟', '专注时间结束！休息5分钟吧~');
    sendPetEvent('show-bubble', '你又完成了一轮专注，真棒');
    sendPetEvent('trigger-state', 'happy');
    sendPetEvent('companion-updated', companion);
  }, pomodoroDuration * 60000);
}

function triggerReminder(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
  const companion = updateCompanionData((data) => {
    data.reminderCount += 1;
    data.mood = 'caring';
  });
  sendPetEvent('show-bubble', body);
  sendPetEvent('trigger-state', 'speaking');
  sendPetEvent('companion-updated', companion);
}

// ─── 智能作息 ───
let smartTimer = null;
function initSmartSleep() {
  if (smartTimer) clearInterval(smartTimer);
  const cfg = loadConfig();
  if (cfg.enableSmartSleep === false) return;
  
  smartTimer = setInterval(() => {
    const hour = new Date().getHours();
    const now = Date.now();
    
    // 深夜提醒
    if (hour === 23) {
      const last = cfg.lastNightReminder || 0;
      if (now - last > 3600000) {
        triggerReminder('🌙 夜深了', '已经23点了，该准备休息啦~');
        cfg.lastNightReminder = now;
        saveConfig(cfg);
      }
    }
    
    // 早晨问候
    if (hour === 8) {
      const last = cfg.lastMorningGreeting || 0;
      const today = new Date().toDateString();
      if (new Date(last).toDateString() !== today) {
        setTimeout(() => {
          sendPetEvent('show-bubble', '早安！今天也要加油哦~ ☀️');
          sendPetEvent('trigger-state', 'happy');
        }, 3000);
        cfg.lastMorningGreeting = now;
        saveConfig(cfg);
      }
    }
    
    // 备忘录提醒
    checkMemoReminders();
  }, 60000);
}

function checkMemoReminders() {
  const memos = loadMemos();
  const now = Date.now();
  memos.forEach(memo => {
    if (memo.remindAt && !memo.reminded && now >= memo.remindAt) {
      triggerReminder('📝 备忘录提醒', memo.content);
      memo.reminded = true;
      saveMemos(memos);
    }
  });
}

// ─── 窗口创建 ───
function getPetSize(scale) {
  const base = Math.round(180 * (scale / 100));
  return { width: Math.round(base * 2.6), height: Math.round(base * 1.95) };
}

function createPetWindow() {
  const cfg = loadConfig();
  const scale = cfg.petScale || 40; // 默认改为 40
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const saved = cfg.petPosition || { x: sw - 160, y: 60 };
  const winSize = getPetSize(scale);
  
  petWindow = new BrowserWindow({
    width: winSize.width, height: winSize.height,
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
  
  petWindow.on('moved', () => {
    const [x, y] = petWindow.getPosition();
    const cfg2 = loadConfig();
    cfg2.petPosition = { x, y };
    saveConfig(cfg2);
  });
}

function resizePet(scale) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const { width, height } = getPetSize(scale);
  petWindow.setSize(width, height);
  petWindow.webContents.send('scale-changed', scale);
}

// ─── 配置窗口（可超出屏幕）───
function createConfigWindow() {
  if (configWindow) { configWindow.focus(); return; }
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  
  configWindow = new BrowserWindow({
    width: 480, height: 720,
    x: Math.round((sw - 480) / 2),
    y: Math.round((sh - 720) / 2) - 50, // 稍微往上，可超出屏幕
    title: 'DeskPet 设置',
    resizable: false,
    // 不限制在屏幕内
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  configWindow.loadFile(path.join(__dirname, 'config.html'));
  configWindow.on('closed', () => { configWindow = null; });
}

// ─── 备忘录窗口（可超出屏幕）───
function createMemoWindow() {
  if (memoWindow) { memoWindow.focus(); return; }
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  
  memoWindow = new BrowserWindow({
    width: 400, height: 500,
    x: Math.round((sw - 400) / 2),
    y: Math.round((sh - 500) / 2) - 30,
    title: '📝 备忘录',
    resizable: false,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  memoWindow.loadFile(path.join(__dirname, 'memo.html'));
  memoWindow.on('closed', () => { memoWindow = null; });
}

// ─── 托盘 ───
function createTray() {
  const icon = nativeImage.createFromNamedImage('NSImageNameActionTemplate', [16, 16]);
  tray = new Tray(icon);
  tray.setToolTip('DeskPet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示桌宠', click: () => petWindow?.show() },
    { label: '隐藏桌宠', click: () => petWindow?.hide() },
    { type: 'separator' },
    { label: '📝 备忘录', click: createMemoWindow },
    { label: '⚙️ 设置...', click: createConfigWindow },
    { type: 'separator' },
    { label: '退出', click: () => { clearReminders(); app.quit(); } }
  ]));
}

// ─── IPC ───
ipcMain.handle('get-settings', () => loadConfig());
ipcMain.handle('get-companion-data', () => loadCompanionData());
ipcMain.handle('get-active-app-context', () => getActiveAppContext());
ipcMain.handle('analyze-screen-context', async () => analyzeScreenContext());
ipcMain.handle('save-settings', (e, s) => {
  const prev = loadConfig();
  saveConfig({ ...prev, ...s });
  initReminders();
  initSmartSleep();
  const scale = s.petScale;
  if (scale) resizePet(scale);
});
ipcMain.handle('get-state', () => loadConfig().currentState || 'idle');
ipcMain.handle('save-state', (e, state) => {
  const cfg = loadConfig();
  cfg.currentState = state;
  saveConfig(cfg);
});
ipcMain.handle('save-companion-data', (e, updates) => {
  const next = updateCompanionData((data) => Object.assign(data, updates || {}));
  sendPetEvent('companion-updated', next);
  return next;
});
ipcMain.handle('record-pet-event', (e, event, payload = {}) => {
  const next = updateCompanionData((data) => {
    const now = Date.now();
    if (event === 'click') {
      data.clickCount += 1;
      data.lastClickAt = now;
      data.mood = data.clickCount % 5 === 0 ? 'clingy' : 'happy';
    } else if (event === 'memo-added') {
      const words = String(payload.content || '')
        .split(/[\s,，。.!！?？]/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .slice(0, 6);
      for (const word of words) {
        data.memoKeywords[word] = (data.memoKeywords[word] || 0) + 1;
      }
      data.mood = 'helpful';
    } else if (event === 'memo-completed') {
      data.completedTasks += 1;
      data.mood = 'proud';
    } else if (event === 'focus-session-complete') {
      data.workSessions += 1;
      data.mood = 'proud';
    } else if (event === 'working-hours') {
      data.mood = 'focused';
    } else if (event === 'active-app') {
      const category = payload.category || 'idle';
      if (category === 'coding') data.mood = 'focused';
      else if (category === 'meeting') data.mood = 'calm';
      else if (category === 'fun') data.mood = 'clingy';
      else if (category === 'document' || category === 'design') data.mood = 'helpful';
    }
  });
  sendPetEvent('companion-updated', next);
  return next;
});
ipcMain.on('open-config', createConfigWindow);
ipcMain.on('open-memo', createMemoWindow);
ipcMain.on('hide-pet', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.hide();
});
ipcMain.on('pet-say', (e, text) => {
  if (!text || typeof text !== 'string') return;
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('show-bubble', text);
    petWindow.webContents.send('trigger-state', 'speaking');
  }
});
ipcMain.on('snap-to-edge', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const wa = display.workArea;
  const pad = 12;

  const leftX = wa.x + pad;
  const rightX = wa.x + wa.width - bounds.width - pad;
  const topY = wa.y + pad;
  const bottomY = wa.y + wa.height - bounds.height - pad;

  const distLeft = Math.abs(bounds.x - leftX);
  const distRight = Math.abs(bounds.x - rightX);
  const distTop = Math.abs(bounds.y - topY);
  const distBottom = Math.abs(bounds.y - bottomY);

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);
  let nx = bounds.x;
  let ny = bounds.y;
  if (minDist === distLeft) nx = leftX;
  else if (minDist === distRight) nx = rightX;
  else if (minDist === distTop) ny = topY;
  else ny = bottomY;

  nx = Math.max(wa.x + pad, Math.min(wa.x + wa.width - bounds.width - pad, nx));
  ny = Math.max(wa.y + pad, Math.min(wa.y + wa.height - bounds.height - pad, ny));
  petWindow.setPosition(Math.round(nx), Math.round(ny));

  const cfg = loadConfig();
  cfg.petPosition = { x: Math.round(nx), y: Math.round(ny) };
  saveConfig(cfg);
});

// 备忘录 IPC
ipcMain.handle('get-memos', () => loadMemos());
ipcMain.handle('add-memo', (e, content, remindAt = null) => {
  const memos = loadMemos();
  memos.push({
    id: Date.now(),
    content,
    createdAt: Date.now(),
    remindAt,
    reminded: false
  });
  saveMemos(memos);
  return memos;
});
ipcMain.handle('delete-memo', (e, id) => {
  let memos = loadMemos();
  memos = memos.filter(m => m.id !== id);
  saveMemos(memos);
  return memos;
});
ipcMain.handle('toggle-memo', (e, id) => {
  const memos = loadMemos();
  const memo = memos.find(m => m.id === id);
  if (memo) memo.done = !memo.done;
  saveMemos(memos);
  if (memo?.done) {
    const companion = updateCompanionData((data) => {
      data.completedTasks += 1;
      data.mood = 'proud';
    });
    sendPetEvent('show-bubble', '完成得漂亮，我给你记一功');
    sendPetEvent('trigger-state', 'happy');
    sendPetEvent('companion-updated', companion);
  }
  return memos;
});

ipcMain.handle('select-pet-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (!result.canceled && result.filePaths[0]) {
    fs.copyFileSync(result.filePaths[0], PET_IMAGE_FILE);
    return PET_IMAGE_FILE;
  }
  return null;
});

ipcMain.handle('get-pet-image-path', () => loadPetImage());

// 允许拖拽到屏幕边缘外一定范围
ipcMain.on('update-position', (e, deltaX, deltaY) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [cx, cy] = petWindow.getPosition();
  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const wa = display.workArea;
  
  // 允许超出边缘 40px
  const overhang = 40;
  const minX = wa.x - overhang;
  const minY = wa.y - overhang;
  const maxX = wa.x + wa.width - bounds.width + overhang;
  const maxY = wa.y + wa.height - bounds.height + overhang;
  
  const nx = Math.max(minX, Math.min(maxX, cx + Math.round(deltaX || 0)));
  const ny = Math.max(minY, Math.min(maxY, cy + Math.round(deltaY || 0)));
  petWindow.setPosition(Math.round(nx), Math.round(ny));
  const cfg = loadConfig();
  cfg.petPosition = { x: Math.round(nx), y: Math.round(ny) };
  saveConfig(cfg);
});

ipcMain.on('move-window-random', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const wa = display.workArea;
  const pad = 8;
  const minX = wa.x + pad;
  const minY = wa.y + pad;
  const maxX = Math.max(minX, wa.x + wa.width - bounds.width - pad);
  const maxY = Math.max(minY, wa.y + wa.height - bounds.height - pad);
  const ringX = Math.max(40, Math.round((maxX - minX) * 0.18));
  const ringY = Math.max(36, Math.round((maxY - minY) * 0.18));
  const side = Math.floor(Math.random() * 4);
  let tx = bounds.x;
  let ty = bounds.y;

  if (side === 0) {
    tx = Math.round(minX + Math.random() * ringX);
    ty = Math.round(minY + Math.random() * (maxY - minY));
  } else if (side === 1) {
    tx = Math.round(maxX - Math.random() * ringX);
    ty = Math.round(minY + Math.random() * (maxY - minY));
  } else if (side === 2) {
    tx = Math.round(minX + Math.random() * (maxX - minX));
    ty = Math.round(minY + Math.random() * ringY);
  } else {
    tx = Math.round(minX + Math.random() * (maxX - minX));
    ty = Math.round(maxY - Math.random() * ringY);
  }
  petWindow.setPosition(tx, ty);
  const cfg = loadConfig();
  cfg.petPosition = { x: tx, y: ty };
  saveConfig(cfg);
});

// ─── 启动 ───
app.whenReady().then(() => {
  createPetWindow();
  createTray();
  initReminders();
  initSmartSleep();
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  clearReminders();
  if (smartTimer) clearInterval(smartTimer);
});
