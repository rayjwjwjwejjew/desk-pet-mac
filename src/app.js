const canvas = document.getElementById('pet');
const ctx = canvas.getContext('2d', { alpha: true });
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');

let CW, CH;
let petImg = new Image();
let customImg = null;
let DPR = window.devicePixelRatio || 1;
let renderStarted = false;

const MotionState = {
  IDLE: 'idle',
  HAPPY: 'happy',
  SLEEPING: 'sleeping',
  WORKING: 'working',
  LOOKING: 'looking'
};
const DialogueState = {
  SILENT: 'silent',
  SPEAKING: 'speaking'
};

let motionState = MotionState.IDLE;
let dialogueState = DialogueState.SILENT;
let motionTimer = null;
let dialogueTimer = null;
let motionStateStartedAt = performance.now();

let floatOffset = 0;
let isMouseDown = false;
let isDragging = false;
let dragOffX = 0;
let dragOffY = 0;
let petOffX = 0;
let petOffY = 0;
let imageFitMode = 'contain';
let bubbleStyle = 'rounded';
let dialogueEnabled = true;
let randomMoveEnabled = true;
let lastPetBounds = null;

// ═══════════════════════════════════════
// 🎭 分层动画系统 - 让桌宠"活起来"
// ═══════════════════════════════════════
const LayerAnim = {
  eyeOpen: 1,
  eyeTarget: 1,
  nextBlinkAt: 0,
  blinkDuration: 120,
  mouthOpen: 0,
  mouthTarget: 0,
  earAngle: 0,
  earTarget: 0,
  lerpSpeed: 0.12,
  
  update(now) {
    if (now >= this.nextBlinkAt && this.eyeOpen >= 0.95) {
      this.eyeTarget = 0;
      setTimeout(() => { this.eyeTarget = 1; }, this.blinkDuration);
      this.nextBlinkAt = now + 2000 + Math.random() * 4000;
    }
    
    if (dialogueState === DialogueState.SPEAKING) {
      this.mouthTarget = 0.3 + Math.sin(now * 0.015) * 0.25;
    } else {
      this.mouthTarget = 0;
    }
    
    if (motionState === MotionState.HAPPY) {
      this.earTarget = Math.sin(now * 0.003) * 8;
    } else if (motionState === MotionState.SLEEPING) {
      this.earTarget = -5;
    } else {
      this.earTarget = Math.sin(now * 0.001) * 3;
    }
    
    this.eyeOpen += (this.eyeTarget - this.eyeOpen) * this.lerpSpeed;
    this.mouthOpen += (this.mouthTarget - this.mouthOpen) * this.lerpSpeed;
    this.earAngle += (this.earTarget - this.earAngle) * this.lerpSpeed;
  },
  
  draw(ctx, x, y, w, h) {
    if (this.eyeOpen < 0.95) {
      const eyeY = y + h * 0.28;
      const eyeH = Math.max(1, h * 0.07 * (1 - this.eyeOpen));
      const eyeW = w * 0.5;
      
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.3, eyeY, eyeW * 0.18, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.7, eyeY, eyeW * 0.18, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    if (this.mouthOpen > 0.05) {
      const mouthY = y + h * 0.42;
      const mouthH = Math.max(2, h * 0.04 * this.mouthOpen);
      const mouthW = w * 0.12 * this.mouthOpen;
      
      ctx.save();
      ctx.fillStyle = 'rgba(40,40,40,0.8)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
};

let activeAppContext = { appName: '', category: 'idle', fetchedAt: 0 };
let companionData = {
  preferredName: '',
  activePersona: 'companion',
  clickCount: 0,
  completedTasks: 0,
  workSessions: 0,
  reminderCount: 0,
  mood: 'calm',
  memoKeywords: {}
};

const Personas = {
  companion: {
    bubbleStyle: 'rounded',
    idle: ['我在这陪你呢', '别着急，我们一点点来', '今天也想当你的后援', '慢慢做也很好'],
    praise: ['你真的很稳', '这一步做得很漂亮', '我就知道你可以', '继续保持这个节奏'],
    clingy: ['理理我嘛', '点你一下我就开心了', '我有在认真陪你哦'],
    focused: ['进入状态了呢', '现在很适合继续推进', '专注的时候好厉害']
  },
  tsundere: {
    bubbleStyle: 'minimal',
    idle: ['我才不是在等你', '只是刚好在这里', '别磨蹭，继续呀', '今天也别偷懒'],
    praise: ['还行吧，算你厉害', '这次做得不错', '勉强夸你一下', '嗯，挺像样的'],
    clingy: ['我才没有想让你点我', '再点一下也不是不行', '只是顺手陪你一下'],
    focused: ['嗯，这种时候还挺像样', '继续，不要停', '保持这个速度']
  },
  sleepy: {
    bubbleStyle: 'cloud',
    idle: ['呼，好想打个盹', '慢一点也没关系', '别忘了休息呀', '我还醒着陪你'],
    praise: ['你做完啦，真好', '我都替你开心', '辛苦啦', '这样就很好'],
    clingy: ['摸一下我就不困了', '我还醒着，在陪你', '再点一下我就精神了'],
    focused: ['静静做事的感觉真好', '先做完这一小段吧', '你现在很专注']
  },
  genki: {
    bubbleStyle: 'rounded',
    idle: ['冲呀冲呀', '今天也元气满满', '我觉得你马上就能搞定', '再推进一点点吧'],
    praise: ['漂亮！这下有感觉了', '这波节奏很对', '厉害厉害，继续冲'],
    clingy: ['快和我互动一下', '点我一下补充元气', '别把我晾在这里嘛'],
    focused: ['现在火力全开', '这就是状态来了', '继续推，不要停']
  },
  cool: {
    bubbleStyle: 'minimal',
    idle: ['嗯，我看着呢', '不用急', '节奏稳一点更好', '先把这一段处理完'],
    praise: ['不错', '处理得很干净', '判断很准确', '这一步做得对'],
    clingy: ['偶尔理我一下也行', '我还在这里', '别忘了我'],
    focused: ['当前很适合继续工作', '保持专注', '这段时间效率不错']
  },
  writer: {
    bubbleStyle: 'handwrite',
    idle: ['像在慢慢写一封信', '今天的空气很适合创作', '字句也会有自己的节奏', '先写下第一句吧'],
    praise: ['这一段很有味道', '写得真顺', '你的表达很漂亮', '这句很好，我记住了'],
    clingy: ['也给我留一句话吧', '我在等你的下一句', '别让我落在段落外面'],
    focused: ['正适合静下来整理思绪', '继续写，这个感觉不错', '字句已经开始连起来了']
  },
  boss: {
    bubbleStyle: 'minimal',
    idle: ['先做最重要的事', '把节奏稳住', '不用多，先完成一块', '继续推进'],
    praise: ['做得很好', '这就是结果导向', '你把关键点拿住了', '保持这种执行力'],
    clingy: ['别只顾着忙，也看看我', '互动一下，继续开工', '你还没下班呢'],
    focused: ['继续，别分心', '这是有效工作时间', '把当前任务收口']
  },
  gremlin: {
    bubbleStyle: 'cloud',
    idle: ['嘿嘿，我闻到 bug 的味道了', '今天想不想偷偷摸个鱼', '别怕，我帮你盯着', '要不先戳我一下再做'],
    praise: ['哟，真被你做成了', '这一手很灵', '不错不错，有点东西', '我承认这次你赢了'],
    clingy: ['快来理我一下', '我已经在这里打滚了', '你再不点我我就闹了'],
    focused: ['现在像是在悄悄通关', '保持这个手感', '再修一个点就更好了']
  }
};

const Dialogue = {
  cooldownMs: 1800,
  dedupeMs: 12000,
  lastShownAt: 0,
  lastText: '',
  recent: [],
  remember(text) {
    this.lastText = text;
    this.lastShownAt = Date.now();
    this.recent.push(text);
    if (this.recent.length > 4) this.recent.shift();
  },
  canSpeak(text, force = false) {
    if (force) return true;
    const now = Date.now();
    if (now - this.lastShownAt < this.cooldownMs) return false;
    if (text && text === this.lastText && now - this.lastShownAt < this.dedupeMs) return false;
    return true;
  },
  pick(list) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const candidates = list.filter((t) => !this.recent.includes(t));
    const pool = candidates.length > 0 ? candidates : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};

const Vision = {
  enabled: true,
  mouseX: 0,
  mouseY: 0,
  screenX: 0,
  screenY: 0,
  screenW: window.screen.width,
  screenH: window.screen.height,
  throttleMs: 80,
  lastProcessAt: 0,
  getLookDirection() {
    const rect = canvas.getBoundingClientRect();
    const petCenterX = rect.left + rect.width / 2;
    const petCenterY = rect.top + rect.height / 2;
    const dx = this.mouseX - petCenterX;
    const dy = this.mouseY - petCenterY;
    return { angle: Math.atan2(dy, dx), distance: Math.hypot(dx, dy), dx, dy };
  },
  getScreenRegion() {
    const x = this.screenX / this.screenW;
    const y = this.screenY / this.screenH;
    let region = '';
    if (y < 0.2) region = '上方';
    else if (y > 0.8) region = '下方';
    else region = '中间';
    if (x < 0.3) region += '左侧';
    else if (x > 0.7) region += '右侧';
    return region;
  }
};

const API = {
  enabled: false,
  endpoint: '',
  apiKey: '',
  lastCall: 0,
  async trigger(event, data = {}) {
    if (!this.enabled || !this.endpoint) return;
    const now = Date.now();
    if (now - this.lastCall < 5000) return;
    this.lastCall = now;
    try {
      const payload = {
        event, timestamp: now,
        screen: { width: Vision.screenW, height: Vision.screenH },
        mouse: { x: Vision.mouseX, y: Vision.mouseY },
        region: Vision.getScreenRegion(),
        state: getVisualState(),
        motionState, dialogueState,
        ...data
      };
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.reply) showBubble(result.reply, { force: true });
        if (result.state) applyIncomingState(result.state);
      }
    } catch (e) {}
  }
};

const Speeches = {
  idle: ['在看什么呢？', '我注意到你了~', '这里好安静', '无聊中...', '今天也要顺顺利利', '我在这陪你呢', '慢慢来，会做完的', '需要我提醒你休息吗？'],
  look: ['你在屏幕那边吗？', '我看到鼠标了！', '你在忙什么呢？', '嘿，看这里~', '这个位置有意思', '你是不是在找什么', '要不要我猜猜你在干嘛'],
  tease: ['你的代码居然跑通了！', '这个 bug 我故意的', '摸我头会变聪明哦~', '点我干嘛~ 嘻嘻！', '今天状态不错呀', '继续继续，我看好你', '你一认真我就开心'],
  daily: ['喝点水吧~', '坐久了，起来活动一下', '眼睛休息 20 秒吧', '深呼吸一下再继续', '进度已经很棒了', '先做最小一步也很好'],
  praise: ['你这个思路很清晰', '这波操作很稳', '干得漂亮', '我宣布你今天超强'],
  click: ['诶，你点到我啦', '轻一点嘛', '我有在认真陪你', '被你发现了', '今天也摸摸我吧'],
  region: {
    上方: ['在看上面呢？', '上面有什么好玩的？'],
    下方: ['在看下面呢？', '下面有什么？'],
    上方左侧: ['左上角有什么？', '在看左边上面？'],
    上方右侧: ['右上角是菜单栏吧？', '在看右边上面？'],
    下方左侧: ['左下角是程序坞？', '在看左下？'],
    下方右侧: ['右下角有什么？', '在看右下？'],
    中间: ['在看屏幕中间？', '中间有什么好玩的？'],
    中间左侧: ['左边有什么？', '往左看呢~'],
    中间右侧: ['右边有什么？', '往右看呢~', '右边好像很忙']
  }
};

function currentPersona() {
  const selected = companionData?.activePersona;
  if (selected === 'random') {
    const keys = Object.keys(Personas);
    const hourSeed = new Date().getHours();
    return Personas[keys[hourSeed % keys.length]] || Personas.companion;
  }
  return Personas[selected] || Personas.companion;
}

function preferredName() {
  return companionData?.preferredName?.trim() || '你';
}

function dominantMemoKeyword() {
  const entries = Object.entries(companionData?.memoKeywords || {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || '';
}

function moodSpeech(kind, fallback) {
  const persona = currentPersona();
  return persona[kind]?.length ? persona[kind] : fallback;
}

function pickContextualLine() {
  const hour = new Date().getHours();
  if (hour >= 23 || hour <= 6) return `${preferredName()}，夜深了，我们该慢一点啦`;
  if (activeAppContext.category === 'coding') return `${preferredName()}在写代码呀，我帮你盯着节奏`;
  if (activeAppContext.category === 'document') return `${preferredName()}在看文档呢，慢慢读也很好`;
  if (activeAppContext.category === 'meeting') return `${preferredName()}在开会，我会安静陪着`;
  if (activeAppContext.category === 'design') return `${preferredName()}在做设计呀，感觉很认真`;
  if (activeAppContext.category === 'fun') return `${preferredName()}现在在放松一下吗`;
  if (companionData?.mood === 'proud') return Dialogue.pick(moodSpeech('praise', Speeches.praise));
  if (companionData?.mood === 'clingy') return Dialogue.pick(moodSpeech('clingy', Speeches.tease));
  if (companionData?.mood === 'focused') return Dialogue.pick(moodSpeech('focused', Speeches.daily));
  const keyword = dominantMemoKeyword();
  if (keyword) return `${preferredName()}最近总在忙"${keyword}"呀`;
  return Dialogue.pick(moodSpeech('idle', Speeches.idle));
}

function getVisualState() {
  return dialogueState === DialogueState.SPEAKING ? 'speaking' : motionState;
}

function persistState() {
  window.electronAPI?.saveState?.(getVisualState());
}

function applyIncomingState(state) {
  if (state === 'speaking') { setDialogueState(DialogueState.SPEAKING, 3000); return; }
  if (Object.values(MotionState).includes(state)) setMotionState(state);
}

function setMotionState(next, durationMs = null) {
  if (motionTimer) { clearTimeout(motionTimer); motionTimer = null; }
  motionState = next;
  motionStateStartedAt = performance.now();
  persistState();
  if (durationMs) {
    motionTimer = setTimeout(() => {
      if (motionState === next) { motionState = MotionState.IDLE; persistState(); }
    }, durationMs);
  }
}

function setDialogueState(next, durationMs = null) {
  if (dialogueTimer) { clearTimeout(dialogueTimer); dialogueTimer = null; }
  dialogueState = next;
  persistState();
  if (durationMs) {
    dialogueTimer = setTimeout(() => {
      if (dialogueState === next) { dialogueState = DialogueState.SILENT; persistState(); }
    }, durationMs);
  }
}

function setState(state) { applyIncomingState(state); }

function initCanvas() {
  DPR = window.devicePixelRatio || 1;
  CW = canvas.width = canvas.offsetWidth * DPR;
  CH = canvas.height = canvas.offsetHeight * DPR;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 初始化位置：窗口中心底部
  if (!petOffX || !petOffY) {
    petOffX = canvas.offsetWidth / 2;
    petOffY = canvas.offsetHeight - 10;
  }
}
window.addEventListener('resize', initCanvas);

let moveTimer = null;
function scheduleRandomMove() {
  const delay = 7000 + Math.random() * 6000;
  moveTimer = setTimeout(() => {
    if (randomMoveEnabled && !isDragging && motionState !== MotionState.SLEEPING) {
      window.electronAPI?.moveWindowRandom?.();
      if (Math.random() < 0.35) showBubble(pickContextualLine());
    }
    scheduleRandomMove();
  }, delay);
}

let lastLookTime = 0;
function initVisionInteraction() {
  document.addEventListener('mousemove', (e) => {
    Vision.mouseX = e.clientX;
    Vision.mouseY = e.clientY;
    Vision.screenX = e.screenX;
    Vision.screenY = e.screenY;
    const now = Date.now();
    if (now - Vision.lastProcessAt < Vision.throttleMs) return;
    Vision.lastProcessAt = now;
    if (!Vision.enabled || motionState === MotionState.SLEEPING) return;
    if (now - lastLookTime < 8000) return;
    const rect = canvas.getBoundingClientRect();
    const petX = rect.left + rect.width / 2;
    const petY = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - petX, e.clientY - petY);
    if (dist < 150) {
      lastLookTime = now;
      setMotionState(MotionState.LOOKING, 3000);
      const region = Vision.getScreenRegion();
      const line = Dialogue.pick(Speeches.region[region] || Speeches.look);
      showBubble(line, { keepMotion: true });
      API.trigger('look', { region, distance: dist });
    }
  });
  setInterval(() => {
    if (!Vision.enabled || motionState === MotionState.SLEEPING) return;
    if (Math.random() > 0.3) return;
    const region = Vision.getScreenRegion();
    const line = Dialogue.pick(Speeches.region[region] || moodSpeech('idle', Speeches.idle));
    showBubble(line);
    API.trigger('observe', { region });
  }, 30000);
}

function syncActiveAppContext() {
  window.electronAPI?.getActiveAppContext?.().then((context) => {
    if (!context) return;
    activeAppContext = context;
    window.electronAPI?.recordPetEvent?.('active-app', { category: context.category, appName: context.appName });
    if (context.category === 'coding') {
      companionData.mood = 'focused';
      if (motionState === MotionState.IDLE) setMotionState(MotionState.WORKING, 2600);
    } else if (context.category === 'meeting') {
      companionData.mood = 'calm';
    } else if (context.category === 'fun') {
      companionData.mood = 'clingy';
    }
  }).catch(() => {});
}

let bubbleTimer = null;
// 对话框尾尖指向：-1=左边，0=中间，1=右边
let bubbleTail = 0;
let bubbleTailX = 0; // 尾巴指向的X坐标（窗口内坐标）

function positionBubble() {
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  
  // 获取立绘的实际位置
  const pet = lastPetBounds || {
    left: petOffX - w * 0.2,
    right: petOffX + w * 0.2,
    top: h * 0.15,
    bottom: petOffY
  };
  
  const bubbleW = Math.min(230, w - 16);
  bubble.style.width = bubbleW + 'px';
  
  // 等待 DOM 更新后获取实际宽高
  requestAnimationFrame(() => {
    const realW = bubble.offsetWidth;
    const realH = bubble.offsetHeight;
    
    // 始终显示在立绘头顶正上方（稍微偏向头部）
    // 以立绘中心为基准，计算气泡位置
    const petCenterX = petOffX; // 窗口内X坐标
    
    // 气泡水平居中在立绘头顶
    let bubbleX = petCenterX - realW / 2;
    
    // 气泡在头顶上方（根据立绘顶部位置）
    const headTop = lastPetBounds ? lastPetBounds.top : h * 0.15;
    let bubbleY = headTop - realH - 15; // 在头顶上方15px
    
    // 限制在窗口内
    bubbleX = Math.max(5, Math.min(w - realW - 5, bubbleX));
    bubbleY = Math.max(5, bubbleY);
    
    // 设置气泡位置
    bubble.style.left = bubbleX + 'px';
    bubble.style.top = bubbleY + 'px';
    
    // 记录尾巴指向（居中指向立绘头顶）
    bubbleTail = 0; // 中间
    bubbleTailX = petCenterX - bubbleX; // 尾巴在气泡内的X位置
  });
}

function showBubble(text, opts = {}) {
  if (!dialogueEnabled) return;
  if (!text) return;
  const force = opts.force === true;
  if (!Dialogue.canSpeak(text, force)) return;

  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleText.textContent = text;
  
  const persona = currentPersona();
  const style = persona.bubbleStyle || bubbleStyle;
  
  bubble.classList.remove('bubble-rounded', 'bubble-cloud', 'bubble-handwrite', 'bubble-minimal', 'bubble-tail');
  bubble.classList.add('bubble-' + style);
  
  bubble.style.display = 'block';
  requestAnimationFrame(() => {
    positionBubble();
    bubble.classList.add('showing');
  });

  Dialogue.remember(text);
  setDialogueState(DialogueState.SPEAKING, 3500);

  bubbleTimer = setTimeout(() => {
    bubble.classList.remove('showing');
    setTimeout(() => { bubble.style.display = 'none'; }, 200);
    if (dialogueState === DialogueState.SPEAKING) setDialogueState(DialogueState.SILENT);
  }, 4000);
}

// ═══════════════════════════════════════
// 🖼️ 立绘绘制 - 自适应，无框限制
// ═══════════════════════════════════════
function drawPetImage(activeImg, w, h) {
  if (!activeImg?.complete || activeImg.naturalWidth <= 0) return false;
  const iw = activeImg.naturalWidth;
  const ih = activeImg.naturalHeight;

  // 自适应缩放：立绘填满窗口高度（留一点边距）
  const maxH = h * 0.95;
  const maxW = w * 0.95;
  
  // 根据模式选择缩放
  let scale;
  if (imageFitMode === 'cover') {
    scale = Math.max(maxW / iw, maxH / ih);
  } else {
    scale = Math.min(maxW / iw, maxH / ih);
  }
  
  const drawW = iw * scale;
  const drawH = ih * scale;
  
  // 立绘底部居中
  const dx = -drawW / 2;
  const dy = -drawH;

  lastPetBounds = {
    left: petOffX + dx,
    right: petOffX + dx + drawW,
    top: petOffY + dy,
    bottom: petOffY + dy + drawH,
    width: drawW,
    height: drawH,
    // 头部位置估算（用于放置按钮）
    headCenterX: petOffX,
    headTopY: petOffY - drawH * 0.85,
    headWidth: drawW * 0.4
  };

  ctx.drawImage(activeImg, dx, dy, drawW, drawH);
  LayerAnim.draw(ctx, dx, dy, drawW, drawH);

  return true;
}

// 更新按钮位置
function updateButtonPositions() {
  const btn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('close-btn');
  
  if (!lastPetBounds) return;
  
  // 按钮放在头部附近
  const headX = lastPetBounds.headCenterX || petOffX;
  const headY = lastPetBounds.headTopY || (petOffY - lastPetBounds.height * 0.85);
  const headW = lastPetBounds.headWidth || (lastPetBounds.width * 0.4);
  
  // 计算按钮在窗口中的位置
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  
  // 头部相对于窗口左上角的位置
  const relX = headX - (petOffX - w / 2); // 从窗口中心转换
  const relY = h - (petOffY - headY); // 从底部转换
  
  // 设置按钮位置：在头部右侧
  btn.style.left = Math.min(w - 35, Math.max(5, relX + headW * 0.3)) + 'px';
  btn.style.top = Math.min(h - 35, Math.max(5, relY - 10)) + 'px';
  
  // 关闭按钮在设置按钮左边
  closeBtn.style.left = (parseInt(btn.style.left) - 32) + 'px';
  closeBtn.style.top = btn.style.top;
}

function render() {
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  floatOffset += 0.065;
  const now = performance.now();
  const motionElapsed = (now - motionStateStartedAt) / 1000;
  
  LayerAnim.update(now);

  let offsetY = 0;
  let rot = 0;
  let scale = 1;
  let scaleX = 1;
  let scaleY = 1;

  if (motionState === MotionState.IDLE) {
    offsetY = Math.sin(floatOffset) * 2;
    scaleY += Math.sin(floatOffset * 0.5) * 0.015;
    scaleX -= Math.sin(floatOffset * 0.5) * 0.01;
  } else if (motionState === MotionState.HAPPY) {
    const bump = Math.max(0, Math.sin(Math.min(motionElapsed, 0.9) * Math.PI));
    offsetY = -12 * bump;
    scale = 1 + 0.035 * bump;
  } else if (motionState === MotionState.SLEEPING) {
    rot = Math.sin(floatOffset * 0.3) * 0.03;
    offsetY = 3;
  } else if (motionState === MotionState.LOOKING) {
    rot = Vision.getLookDirection().angle * 0.08;
    offsetY = Math.sin(floatOffset * 2) * 2;
  } else if (motionState === MotionState.WORKING) {
    rot = Math.sin(floatOffset * 0.8) * 0.018;
    offsetY = Math.sin(floatOffset * 1.4) * 1.3;
    scaleY += Math.sin(floatOffset * 1.2) * 0.01;
  }

  if (dialogueState === DialogueState.SPEAKING) {
    offsetY += Math.sin(floatOffset * 3) * 1.1;
    scaleY += Math.sin(floatOffset * 3) * 0.02;
    scaleX -= Math.sin(floatOffset * 3) * 0.012;
  }

  const drawX = petOffX;
  const drawY = petOffY + offsetY;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(rot);
  ctx.scale(scale * scaleX, scale * scaleY);

  const activeImg = customImg || petImg;
  const drawn = drawPetImage(activeImg, w, h);

  if (!drawn) {
    ctx.beginPath();
    ctx.arc(0, -h * 0.35, h * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 107, 157, 0.6)';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = `${h * 0.12}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('?', 0, -h * 0.32);
  }
  ctx.restore();

  if (motionState === MotionState.SLEEPING) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(120, 120, 255, 0.7)';
    const zz = 'z'.repeat((Math.floor(floatOffset / 20) % 3) + 1);
    ctx.fillText(zz, drawX + 30, drawY - h * 0.5 - Math.sin(floatOffset) * 6);
  }

  // 更新按钮位置
  updateButtonPositions();

  requestAnimationFrame(render);
}

canvas.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  isDragging = false;
  dragOffX = e.offsetX - petOffX;
  dragOffY = e.offsetY - petOffY;
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
  if (!isMouseDown) return;
  if (Math.abs(e.offsetX - dragOffX - petOffX) > 3 || Math.abs(e.offsetY - dragOffY - petOffY) > 3) {
    isDragging = true;
  }
  if (isDragging) {
    window.electronAPI?.updatePosition?.(e.movementX, e.movementY);
  }
});

canvas.addEventListener('mouseup', () => {
  isMouseDown = false;
  canvas.style.cursor = 'grab';
  if (isDragging) {
    window.electronAPI?.snapToEdge?.();
  } else {
    setMotionState(MotionState.HAPPY, 2600);
    showBubble(Dialogue.pick(Speeches.click.concat(Speeches.tease)), { force: true });
    window.electronAPI?.recordPetEvent?.('click');
    API.trigger('click');
  }
  isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
  isMouseDown = false;
  canvas.style.cursor = 'grab';
});

function initSettingsBtn() {
  const btn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('close-btn');
  const triggerArea = document.getElementById('trigger-area');

  async function checkShowBtn() {
    try {
      const settings = await window.electronAPI?.getSettings?.();
      if (settings?.showSettingsBtn === false) {
        btn.style.display = 'none';
        closeBtn.style.display = 'none';
        triggerArea.style.display = 'none';
      }
    } catch (e) {}
  }

  checkShowBtn();
  triggerArea?.addEventListener('mouseenter', () => {
    btn?.classList.add('visible');
    closeBtn?.classList.add('visible');
  });
  btn?.addEventListener('mouseleave', () => {
    btn?.classList.remove('visible');
    closeBtn?.classList.remove('visible');
  });
  closeBtn?.addEventListener('mouseleave', () => {
    btn?.classList.remove('visible');
    closeBtn?.classList.remove('visible');
  });
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.electronAPI?.openConfig?.();
  });
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.electronAPI?.hidePet?.();
  });
}

async function loadAll() {
  initCanvas();
  petImg.src = 'assets/pet.png';

  const imgPath = await window.electronAPI?.getPetImagePath?.();
  if (imgPath) {
    customImg = new Image();
    customImg.src = 'file://' + imgPath.replace(/\\/g, '/');
  }

  try {
    const companion = await window.electronAPI?.getCompanionData?.();
    if (companion) companionData = companion;
    const settings = await window.electronAPI?.getSettings?.();
    if (settings) {
      API.enabled = settings.apiEnabled === true;
      API.endpoint = settings.apiEndpoint || '';
      API.apiKey = settings.apiKey || '';
      Vision.enabled = settings.visionEnabled !== false;
      imageFitMode = settings.imageFitMode || 'contain';
      bubbleStyle = settings.bubbleStyle || 'rounded';
      dialogueEnabled = settings.dialogueEnabled !== false;
      randomMoveEnabled = settings.randomMoveEnabled !== false;
    }
  } catch (e) {}

  setInterval(() => {
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 18) {
      window.electronAPI?.recordPetEvent?.('working-hours');
      if (motionState === MotionState.IDLE && Math.random() < 0.35) {
        setMotionState(MotionState.WORKING, 2400);
      }
    }
  }, 600000);

  syncActiveAppContext();
  setInterval(syncActiveAppContext, 15000);

  initSettingsBtn();
  initVisionInteraction();
  scheduleRandomMove();

  if (!renderStarted) {
    renderStarted = true;
    requestAnimationFrame(render);
  }
}

if (window.electronAPI) {
  window.electronAPI.onShowBubble?.((text) => showBubble(text, { force: true }));
  window.electronAPI.onTriggerState?.((state) => setState(state));
  window.electronAPI.onScaleChanged?.(() => initCanvas());
  window.electronAPI.onCompanionUpdated?.((data) => { companionData = data; });
}

window.addEventListener('DOMContentLoaded', loadAll);