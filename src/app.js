const canvas = document.getElementById('pet');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');

// ─── 画布初始化 ───
let CW, CH;
let petImg = new Image();
petImg.src = './assets/pet.png';
petImg.onload = () => start();
petImg.onerror = () => {
  // 图片加载失败时显示占位符
  ctx.fillStyle = '#FFE0EC';
  ctx.fillRect(0, 0, 300, 300);
  ctx.fillStyle = '#FF6B9D';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('桌宠图片加载失败', 150, 150);
};

// ─── 默认台词库 ───
const DEFAULT_SPEECHES = {
  work: [
    "写代码中，勿扰~", "这个 bug 好难啊…", "需求又改了！",
    "代码跑起来了！🎉", "注释写了吗？还没…"
  ],
  daily: [
    "今天也要加油哦！✨", "休息一下，喝杯水吧~", "想我了就戳戳我！",
    "我在这里陪你~", "好无聊啊，有人来玩~", "☀️ 今天天气真好！"
  ],
  night: [
    "夜深了，还不睡吗？🌙", "该睡觉啦，晚安~", "星星好美啊 ✨",
    "我也困了…哈欠~"
  ],
  tease: [
    "你的代码居然跑通了！😏", "这个 bug 我故意的 😏",
    "摸我头会变聪明哦~", "恭喜你发现了我！", "点我干嘛~ 嘻嘻！"
  ]
};

// ─── 状态机 ───
const State = { IDLE: 'idle', HAPPY: 'happy', SLEEPING: 'sleeping', WORKING: 'working', SPEAKING: 'speaking' };
let currentState = State.IDLE;
let stateTimer = null;
let floatOffset = 0;  // 上下浮动
let walkFrame = 0;    // 行走帧
let idleFrame = 0;    // 待机帧
let blinkTimer = 0;   // 眨眼
let isBlinking = false;
let isMouseDown = false;
let dragOffsetX = 0, dragOffsetY = 0;

// ─── 移动系统 ───
let petX = 0, petY = 0;           // 画布内的偏移
let worldX = 0, worldY = 0;       // 屏幕绝对位置
let velX = 0, velY = 0;
let isDragging = false;
let moveTimer = null;
let moveInterval = 5000 + Math.random() * 3000;

// ─── 气泡系统 ───
let bubbleTimer = null;
let bubbleText = '';
let bubbleVisible = false;

// ─── 初始化位置 ───
function init() {
  CW = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  CH = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  petX = w / 2;
  petY = h - 20;
  worldX = w / 2; worldY = h / 2;
  scheduleRandomMove();
  scheduleRandomSpeech();
  checkAutoSleep();
  loadSettings();
  loadSpeeches();
  loadState();
}

// ─── 随机移动 ───
function scheduleRandomMove() {
  moveInterval = 5000 + Math.random() * 4000;
  moveTimer = setTimeout(() => {
    if (!isDragging) {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      const targetX = 40 + Math.random() * (w - 80);
      const targetY = 20 + Math.random() * (h - 80);
      moveTo(targetX, targetY);
    }
    scheduleRandomMove();
  }, moveInterval);
}

function moveTo(tx, ty) {
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  const dx = tx - petX, dy = ty - petY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;
  const dur = 800 + Math.random() * 600;
  const startX = petX, startY = petY;
  const start = performance.now();
  function step(now) {
    if (isDragging) return;
    const t = Math.min((now - start) / dur, 1);
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    petX = startX + dx * e;
    petY = startY + dy * e;
    // 边界反弹
    if (petX < 20) petX = 20;
    if (petX > w - 20) petX = w - 20;
    if (petY < 20) petY = 20;
    if (petY > h - 20) petY = h - 20;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── 随机台词 ───
function scheduleRandomSpeech() {
  const delay = 600000 + Math.random() * 600000; // 10-20分钟
  bubbleTimer = setTimeout(() => {
    if (currentState === State.SLEEPING) { scheduleRandomSpeech(); return; }
    const hour = new Date().getHours();
    let pool = DEFAULT_SPEECHES.daily;
    if (hour >= 22 || hour < 7) pool = DEFAULT_SPEECHES.night;
    const texts = window.customSpeeches || pool;
    const list = Array.isArray(texts) ? texts : Object.values(texts).flat();
    showBubble(list[Math.floor(Math.random() * list.length)]);
    scheduleRandomSpeech();
  }, delay);
}

// ─── 显示气泡 ───
function showBubble(text) {
  bubbleText = text;
  bubbleVisible = true;
  bubble.textContent = text;
  bubble.style.display = 'block';
  setState(State.SPEAKING);
  setTimeout(() => {
    bubbleVisible = false;
    bubble.style.display = 'none';
    if (currentState === State.SPEAKING) setState(State.IDLE);
  }, 4000);
}

// ─── 状态切换 ───
function setState(s) {
  if (stateTimer) { clearTimeout(stateTimer); stateTimer = null; }
  currentState = s;
  window.electronAPI?.saveState(s);
  if (s !== State.SLEEPING) {
    idleFrame = 0; blinkTimer = 0; isBlinking = false;
  }
  if (s === State.HAPPY) {
    stateTimer = setTimeout(() => setState(State.IDLE), 2000);
  }
  if (s === State.SPEAKING) {
    stateTimer = setTimeout(() => { if (currentState === State.SPEAKING) setState(State.IDLE); }, 3000);
  }
}

function checkAutoSleep() {
  setInterval(() => {
    if (currentState !== State.SLEEPING && currentState !== State.WORKING) {
      const h = new Date().getHours();
      if (h >= 23 || h < 7) setState(State.SLEEPING);
    }
  }, 60000);
}

// ─── 事件 ───
canvas.addEventListener('mousedown', e => {
  isMouseDown = true; isDragging = false;
  dragOffsetX = e.offsetX - petX;
  dragOffsetY = e.offsetY - petY;
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('mousemove', e => {
  if (!isMouseDown) return;
  const dx = e.offsetX - dragOffsetX - petX;
  const dy = e.offsetY - dragOffsetY - petY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
  if (isDragging) {
    petX = e.offsetX - dragOffsetX;
    petY = e.offsetY - dragOffsetY;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    if (petX < 0) petX = 0; if (petX > w) petX = w;
    if (petY < 0) petY = 0; if (petY > h) petY = h;
  }
});
canvas.addEventListener('mouseup', () => {
  isMouseDown = false;
  canvas.style.cursor = 'grab';
  if (!isDragging) {
    setState(State.HAPPY);
    showBubble(DEFAULT_SPEECHES.tease[Math.floor(Math.random() * DEFAULT_SPEECHES.tease.length)]);
  }
  isDragging = false;
});
canvas.addEventListener('mouseleave', () => { isMouseDown = false; canvas.style.cursor = 'grab'; });

// ─── 设置/台词/状态加载 ───
async function loadSettings() {
  try {
    const s = await window.electronAPI?.getSettings();
    if (s && s.scale) {
      // 通知主进程调整窗口大小
    }
  } catch(e) {}
}
async function loadSpeeches() {
  try {
    const t = await window.electronAPI?.getSpeeches();
    if (t) window.customSpeeches = t;
  } catch(e) {}
}
async function loadState() {
  try {
    const s = await window.electronAPI?.getState();
    if (s) setState(s);
  } catch(e) {}
}

// ─── IPC 监听 ───
window.electronAPI?.onShowBubble(text => showBubble(text));
window.electronAPI?.onTriggerState(s => setState(s));

// ─── 绘制 ───
function start() {
  init();
  requestAnimationFrame(loop);
}

let lastTime = 0;
function loop(ts) {
  const dt = ts - lastTime; lastTime = ts;
  render(dt);
  requestAnimationFrame(loop);
}

function render(dt) {
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  floatOffset += 0.04;
  idleFrame++;
  blinkTimer++;

  let offsetY = 0, rot = 0, scale = 1;

  if (currentState === State.IDLE) {
    offsetY = Math.sin(floatOffset) * 4;
    // 眨眼
    if (blinkTimer > 180 && !isBlinking) { isBlinking = true; blinkTimer = 0; }
    if (isBlinking && blinkTimer > 10) { isBlinking = false; blinkTimer = 0; }
  } else if (currentState === State.HAPPY) {
    offsetY = Math.abs(Math.sin(floatOffset * 3)) * -20;
    scale = 1 + Math.abs(Math.sin(floatOffset * 3)) * 0.05;
  } else if (currentState === State.SLEEPING) {
    rot = Math.sin(floatOffset * 0.5) * 0.05;
    offsetY = 15;
  } else if (currentState === State.WORKING) {
    offsetY = Math.sin(floatOffset * 0.5) * 1;
  } else if (currentState === State.SPEAKING) {
    offsetY = Math.sin(floatOffset * 2) * 3;
    scale = 1 + Math.sin(floatOffset * 4) * 0.03;
  }

  ctx.save();
  ctx.translate(petX, petY + offsetY);
  ctx.rotate(rot);
  ctx.scale(scale, scale);

  // 画桌宠图
  if (petImg.complete && petImg.naturalWidth > 0) {
    const iw = petImg.naturalWidth, ih = petImg.naturalHeight;
    const displayH = h * 0.85;
    const displayW = iw * (displayH / ih);
    const drawY = -displayH;
    ctx.drawImage(petImg, -displayW / 2, drawY, displayW, displayH);
  } else {
    // 占位符圆
    ctx.beginPath();
    ctx.arc(0, -50, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B9D';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐾', 0, -35);
  }

  // 睡觉遮罩 & ZZZ
  if (currentState === State.SLEEPING) {
    ctx.restore();
    ctx.save();
    ctx.translate(petX, petY + offsetY);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(100,100,255,0.7)';
    const zz = 'z'.repeat(Math.floor(floatOffset / 20) % 3 + 1);
    ctx.fillText(zz, 30, -70 - Math.sin(floatOffset) * 10);
  }

  ctx.restore();
}
