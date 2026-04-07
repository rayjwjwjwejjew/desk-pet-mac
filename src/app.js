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
  LOOKING: 'looking',
  FALLEN: 'fallen' // 新增：摔倒状态
};
const DialogueState = {
  SILENT: 'silent',
  SPEAKING: 'speaking',
  TYPING: 'typing' // 新增：打字中状态
};

// ═══════════════════════════════════════
// ⌨️ 打字机效果系统
// ═══════════════════════════════════════
const TypeWriter = {
  isTyping: false,
  currentText: '',
  currentIndex: 0,
  speed: 45,
  punctuationPause: {
    '。': 400, '！': 350, '？': 350, '，': 200, '、': 150, '；': 250,
    '：': 300, '…': 500, '~': 150, '!': 350, '?': 350, ',': 200, '.': 400
  },
  onComplete: null,
  
  start(text, callback) {
    this.stop();
    this.currentText = text;
    this.currentIndex = 0;
    this.isTyping = true;
    this.onComplete = callback;
    bubbleText.textContent = '';
    setDialogueState(DialogueState.TYPING);
    this.tick();
  },
  
  tick() {
    if (!this.isTyping || this.currentIndex >= this.currentText.length) {
      this.complete();
      return;
    }
    const char = this.currentText[this.currentIndex];
    bubbleText.textContent += char;
    this.currentIndex++;
    let delay = this.speed + Math.random() * 20;
    if (this.punctuationPause[char]) delay += this.punctuationPause[char];
    if (Math.random() < 0.05) delay += 100 + Math.random() * 150;
    setTimeout(() => this.tick(), delay);
  },
  
  stop() { this.isTyping = false; },
  
  complete() {
    this.isTyping = false;
    setDialogueState(DialogueState.SPEAKING);
    if (this.onComplete) this.onComplete();
  },
  
  skip() {
    if (this.isTyping) {
      bubbleText.textContent = this.currentText;
      this.complete();
    }
  }
};

// ═══════════════════════════════════════
// 🧠 上下文记忆系统
// ═══════════════════════════════════════
const ConversationMemory = {
  history: [],
  maxHistory: 10,
  currentTopic: null,
  lastInteractionTime: Date.now(),
  topics: {},
  
  record(message, type = 'pet') {
    this.history.push({ message, type, time: Date.now(), topic: this.currentTopic });
    if (this.history.length > this.maxHistory) this.history.shift();
    this.lastInteractionTime = Date.now();
  },
  
  setTopic(topic) {
    this.currentTopic = topic;
    if (!this.topics[topic]) this.topics[topic] = { count: 0, lastMention: 0 };
    this.topics[topic].count++;
    this.topics[topic].lastMention = Date.now();
  },
  
  shouldFollowUp() {
    const last = this.history[this.history.length - 1];
    if (!last) return false;
    const timeSince = Date.now() - last.time;
    return timeSince > 60000 && timeSince < 300000;
  },
  
  generateFollowUp() {
    const topic = this.currentTopic;
    const followUps = {
      coding: ['那个bug修好了吗？', '代码写得怎么样了？', '还在写代码呀？'],
      video: ['还在看视频吗？', '视频好看吗？', '看完了吗？'],
      social: ['还在聊天呀？', '和朋友聊得开心吗？', '聊完了吗？'],
      shopping: ['买到喜欢的了吗？', '还在逛呀？'],
      learning: ['学得怎么样？', '这个知识点掌握了吗？'],
      gaming: ['还在玩呀？', '赢了吗？'],
      working: ['工作完成得怎么样？', '还在忙呀？']
    };
    if (topic && followUps[topic]) {
      return followUps[topic][Math.floor(Math.random() * followUps[topic].length)];
    }
    return null;
  }
};

// ═══════════════════════════════════════
// ⏰ 时间感知系统
// ═══════════════════════════════════════
const TimeAwareness = {
  lastSeenTime: null,
  todayFirstSeen: null,
  
  init() {
    const now = new Date();
    const today = now.toDateString();
    const stored = localStorage.getItem('deskPet_timeData');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.lastDate !== today) {
        this.todayFirstSeen = now;
      } else {
        this.todayFirstSeen = data.todayFirstSeen ? new Date(data.todayFirstSeen) : now;
      }
      this.lastSeenTime = data.lastSeenTime ? new Date(data.lastSeenTime) : null;
    } else {
      this.todayFirstSeen = now;
    }
    this.save();
  },
  
  save() {
    const now = new Date();
    localStorage.setItem('deskPet_timeData', JSON.stringify({
      lastDate: now.toDateString(),
      todayFirstSeen: this.todayFirstSeen?.toISOString(),
      lastSeenTime: now.toISOString()
    }));
  },
  
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) return 'earlyMorning';
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'noon';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 24) return 'night';
    return 'lateNight';
  },
  
  getTimeGreeting() {
    const hour = new Date().getHours();
    const name = preferredName();
    if (this.lastSeenTime) {
      const hoursSince = (Date.now() - this.lastSeenTime.getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24) return `${name}！好久不见，我好想你呀~`;
      if (hoursSince > 12) return `${name}，你回来啦！等你好久了~`;
    }
    if (this.todayFirstSeen) {
      const minutesSince = (Date.now() - this.todayFirstSeen.getTime()) / (1000 * 60);
      if (minutesSince < 5) {
        if (hour >= 5 && hour < 9) return `${name}，早上好！今天起得真早呀~`;
        if (hour >= 9 && hour < 12) return `${name}，早上好！`;
        if (hour >= 12 && hour < 14) return `${name}，中午好！吃饭了吗？`;
        if (hour >= 14 && hour < 18) return `${name}，下午好！`;
        if (hour >= 18 && hour < 21) return `${name}，晚上好！今天过得怎么样？`;
        if (hour >= 21) return `${name}，这么晚还在呀，注意休息哦~`;
      }
    }
    return null;
  }
};

// ═══════════════════════════════════════
// 🖱️ 鼠标空闲检测（8秒触发摔倒）
// ═══════════════════════════════════════
const MouseIdleDetector = {
  lastMoveTime: Date.now(),
  idleThreshold: 8000,
  checkInterval: null,
  onIdleCallback: null,
  hasTriggered: false,
  
  init(callback) {
    this.onIdleCallback = callback;
    document.addEventListener('mousemove', () => this.onActivity());
    document.addEventListener('mousedown', () => this.onActivity());
    document.addEventListener('keydown', () => this.onActivity());
    this.checkInterval = setInterval(() => this.check(), 1000);
  },
  
  onActivity() {
    this.lastMoveTime = Date.now();
    this.hasTriggered = false;
  },
  
  check() {
    const idleTime = Date.now() - this.lastMoveTime;
    if (idleTime >= this.idleThreshold && !this.hasTriggered) {
      this.hasTriggered = true;
      if (this.onIdleCallback) this.onIdleCallback(idleTime);
    }
  }
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
    
    // 打字或说话时嘴巴动画
    if (dialogueState === DialogueState.SPEAKING || dialogueState === DialogueState.TYPING) {
      this.mouthTarget = 0.3 + Math.sin(now * 0.015) * 0.25;
    } else {
      this.mouthTarget = 0;
    }
    
    // 耳朵动画
    if (motionState === MotionState.HAPPY) {
      this.earTarget = Math.sin(now * 0.003) * 8;
    } else if (motionState === MotionState.SLEEPING) {
      this.earTarget = -5;
    } else if (motionState === MotionState.FALLEN) {
      this.earTarget = -10; // 摔倒时耳朵耷拉
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
    idle: [
      '我在这陪你呢', '别着急，我们一点点来', '今天也想当你的后援', '慢慢做也很好',
      '有我在，不用怕', '今天也一起加油吧', '累了就歇会儿', '我会一直陪着你的',
      '想我了没？', '今天心情怎么样？', '有什么想和我说的吗？', '我在这里等你哦',
      '无聊了可以戳戳我', '我会一直陪着你的', '今天也要加油呀', '慢慢来，不着急',
      '你是最棒的', '我相信你', '我们一起努力', '有什么困难告诉我',
      '在发呆吗？', '想什么呢？', '我陪你一起发呆~', '安静的时候也不错'
    ],
    praise: [
      '你真的很稳', '这一步做得很漂亮', '我就知道你可以', '继续保持这个节奏',
      '你比昨天更厉害了', '这就是你的实力', '我为你骄傲', '做得太棒了',
      '太厉害了！', '你真的超棒！', '为你点赞！', '继续加油！',
      '你做到了！', '真为你高兴', '你进步好快', '这波操作很秀',
      '完美！', '优秀！', '太强了！', '你是最棒的！',
      '真厉害！', '干得漂亮！', '太赞了！', '佩服佩服！'
    ],
    clingy: [
      '理理我嘛', '点你一下我就开心了', '我有在认真陪你哦', '再陪我一会儿好不好',
      '我想和你玩', '你不理我我会难过的', '戳我一下嘛', '我在这里等你哦',
      '陪我聊聊天吧', '我好无聊呀', '看看我嘛', '想你了~',
      '别不理我嘛', '陪我玩一会儿', '我想你了', '你在忙什么呀',
      '要抱抱~', '亲亲~', '摸摸头~', '举高高~'
    ],
    focused: [
      '进入状态了呢', '现在很适合继续推进', '专注的时候好厉害', '这个节奏很好',
      '保持这个感觉', '你认真起来的样子很棒', '继续，不要停', '效率越来越高了',
      '专注模式开启！', '加油加油！', '你能行的！', '继续冲！',
      '状态很好！', '保持专注！', '效率爆表！', '你超棒的！',
      '心流状态！', '全速前进！', '冲冲冲！', '火力全开！'
    ],
    // 摔倒专用语录
    fallen: [
      '哥哥我摔倒了~', '呜呜，摔倒了...', '好痛呀，扶扶我嘛~', '摔倒了，要抱抱~',
      '脚滑了一下~', '呜呜，好痛...', '快扶我起来~', '摔跤了，要安慰~',
      '呜呜呜...', '好疼呀...', '要亲亲才能好~', '摔倒了，不理你了~',
      '痛痛痛~', '呜呜，腿软了~', '站不起来了~', '要扶扶~'
    ],
    // 时间问候
    greeting: {
      earlyMorning: ['这么早呀，早安~', '起得真早！早安！', '清晨好呀~', '早起身体好~'],
      morning: ['早上好！', '早安~今天也要加油哦', '早上好呀！', '新的一天开始啦~'],
      noon: ['中午好！吃饭了吗？', '该吃午饭啦~', '中午记得休息一下', '午饭时间到~'],
      afternoon: ['下午好！', '下午也要加油哦~', '下午茶时间到了吗？', '下午好呀~'],
      evening: ['晚上好！', '今天辛苦啦~', '晚上好呀，放松一下吧', '晚饭吃了吗？'],
      night: ['晚上好~', '今天过得怎么样？', '有点晚了哦~', '记得早点休息~'],
      lateNight: ['这么晚还不睡呀？', '该睡觉啦~', '熬夜对身体不好哦', '快去休息吧~']
    },
    // 场景对话 - 每个场景扩展到12句
    coding: [
      '写代码的时候最帅了', '这个 bug 我们一起解决', '专注编程的样子很有魅力', '代码写累了记得休息',
      '编程真有趣呀~', 'bug 又出现了？', '代码写得真好！', '逻辑很清晰呢',
      '加油，bug 会被消灭的！', '写代码辛苦了~', '你真的很厉害！', '继续写，我陪着~',
      '代码时间~', '程序员最帅了！', '这个实现很优雅~', '算法真巧妙！'
    ],
    video: [
      '在看视频呀？带我一个呗', '这个视频好看吗', '看视频也要记得眨眼哦', '休息休息眼睛吧',
      '什么视频呀？', '好看吗？', '看完记得继续工作哦~', '放松一下也好',
      '视频时间有点久了~', '眼睛累不累？', '这个看起来很有趣', '一起看吧~',
      '追剧吗？', '电影还是综艺？', '弹幕好玩吗？', '倍速看吗？'
    ],
    social: [
      '又在刷社交软件啦', '看到什么好玩的了', '和朋友聊得开心吗', '别刷太久哦',
      '社交时间~', '聊什么呢？', '带我一个呗~', '朋友多真好',
      '记得回我消息哦~', '别把我忘了~', '社交也要适度哦', '聊完记得工作~',
      '朋友圈有什么好玩的？', '微博热搜看了吗？', '小红书刷刷~', '有人在找你吗？'
    ],
    shopping: [
      '在买东西吗', '这个好看吗', '购物也要理性消费哦', '买到喜欢的东西了吗',
      '购物车满了没？', '买这个还是那个？', '理性消费哦~', '钱包还好吗？',
      '这个看起来不错~', '要买这个吗？', '购物时间~', '买完记得工作~',
      '双十一要到了吗？', '有优惠吗？', '满减凑一凑？', '快递到了吗？'
    ],
    learning: [
      '在学习呀，真棒', '这个知识点有意思', '学习使我快乐', '你认真的样子真好看',
      '好学的人最棒了！', '加油，你能学会的！', '学习辛苦了~', '休息一下吧',
      '这个很难吗？', '需要帮忙吗？', '继续加油！', '你进步好快！',
      '笔记做好了吗？', '复习了吗？', '考试准备得怎么样？', '学习计划完成了吗？'
    ],
    gaming: [
      '玩游戏呀，带我一起呗', '这局打得怎么样', '游戏虽好可不要贪玩哦', '赢了吗？',
      '游戏时间~', '带我玩嘛~', '这局能赢吗？', '加油！',
      '输了别气馁~', '再来一局？', '玩得开心吗？', '该休息了~',
      '什么游戏呀？', '排位吗？', '队友坑吗？', 'MVP是你吗？'
    ],
    working: [
      '在工作呀，加油！', '工作辛苦了~', '效率很高嘛！', '继续加油！',
      '工作也要注意休息哦', '你很敬业！', '忙完了吗？', '我陪你工作~',
      '工作状态不错！', '保持这个节奏！', '快完成了吧？', '辛苦啦~',
      '开会吗？', '报告写完了吗？', '项目进展如何？', 'deadline近了吗？'
    ],
    reading: [
      '在阅读呀~', '看什么书呢？', '阅读使人进步', '读到好玩的了吗？',
      '分享给我听听~', '我也想看~', '读书时间~', '安静阅读真好',
      '这本书好看吗？', '学到了什么？', '继续读吧~', '阅读真好~',
      '小说还是专业书？', '做笔记了吗？', '读完了吗？', '推荐给我呗~'
    ]
  },
  tsundere: {
    bubbleStyle: 'minimal',
    idle: [
      '我才不是在等你', '只是刚好在这里', '别磨蹭，继续呀', '今天也别偷懒',
      '哼，你终于来了', '我才不关心你在干嘛', '随便你啦', '别误会，我只是路过',
      '...哼', '才没有想你', '别自作多情', '只是刚好有空'
    ],
    praise: [
      '还行吧，算你厉害', '这次做得不错', '勉强夸你一下', '嗯，挺像样的',
      '也就那样吧', '别骄傲', '也就一般般', '算你及格了',
      '...还行', '勉强可以', '别得意忘形', '也就这样'
    ],
    clingy: [
      '我才没有想让你点我', '再点一下也不是不行', '只是顺手陪你一下', '哼，算你识相',
      '我才没有开心', '别、别误会', '只是刚好有空', '仅此一次哦',
      '...才没有想你', '哼，理我一下', '才不是在等你', '随便你啦'
    ],
    focused: [
      '嗯，这种时候还挺像样', '继续，不要停', '保持这个速度', '还算有点样子',
      '专注的时候勉强能看', '别分心', '就这样继续', '效率还行',
      '...继续', '别停下', '保持', '还可以'
    ],
    fallen: ['...才没有摔倒', '哼，只是脚滑', '才不要你扶', '...痛', '别看我！', '才没有哭', '哼，不理你了', '...好痛'],
    coding: ['代码写得...还行吧', 'bug 多着呢，慢慢改', '哼，这种小问题', '也就我能忍你的代码风格', '...继续写', '别问我', '自己查', '哼'],
    video: ['看视频都不带我', '有什么好看的', '我才不想看呢', '你自己看吧', '哼', '无聊', '随便', '...'],
    social: ['又在聊天啊', '朋友比我重要是吧', '哼，去聊吧', '我才不在乎', '随便你', '哼', '...才不嫉妒', '去吧'],
    shopping: ['买这么多东西', '又在乱花钱', '我才不想要礼物呢', '你自己决定', '哼', '随便', '...才不想要', '买你的'],
    learning: ['学习？也就那样', '哼，装什么认真', '别问我问题', '自己查去', '...不知道', '哼', '自己想', '随便'],
    gaming: ['游戏有什么好玩的', '带我玩...也不是不行', '输了别找我', '赢了就了不起啊', '哼', '随便', '...才不想玩', '你自己玩']
  },
  sleepy: {
    bubbleStyle: 'cloud',
    idle: [
      '呼，好想打个盹', '慢一点也没关系', '别忘了休息呀', '我还醒着陪你',
      '好困啊...', 'Zzz...', '眼皮好重', '再睡五分钟...',
      '...困', '想睡觉了~', '还在陪你哦...', '呼呼...'
    ],
    praise: [
      '你做完啦，真好', '我都替你开心', '辛苦啦', '这样就很好',
      '你真的好厉害', '我都看困了', '完成了就好', '可以休息了吗',
      '...真好', '辛苦了~', '呼...做得好', 'Zzz...好棒'
    ],
    clingy: [
      '摸一下我就不困了', '我还醒着，在陪你', '再点一下我就精神了', '陪我玩就不困了',
      '你陪我嘛', '我一个人好无聊', '戳我一下嘛', '我想和你玩',
      '...理我', '好困但想陪你', '呼...陪我', '别让我睡着'
    ],
    focused: [
      '静静做事的感觉真好', '先做完这一小段吧', '你现在很专注', '认真的时候很帅呢',
      '专注的样子很好看', '我也被你感染了', '一起努力吧', '这个节奏很舒服',
      '...继续', '呼...加油', '困但陪你', 'Zzz...专注'
    ],
    fallen: ['...摔倒了...困', 'Zzz...摔了', '呼...好痛...困', '...要抱抱才能好', '呜...困', 'Zzz...痛', '...扶我', '呼...摔跤了'],
    coding: ['代码看得我头晕', '这个 bug 好难啊', '写代码好辛苦', '休息一下吧', 'Zzz...代码', '呼...困', '...看不懂了', '想睡觉'],
    video: ['这个视频好催眠', '看视频最放松了', '我也想看...Zzz', '好舒服的感觉', '呼...好看', 'Zzz...', '...困', '想睡'],
    social: ['聊天好费神啊', '我想睡觉了', '社交好累', '让我休息会儿', 'Zzz...聊', '呼...困', '...累了', '想睡'],
    shopping: ['逛得好累', '这个好看吗...我好困', '买东西也好麻烦', '随便选一个吧', 'Zzz...买', '呼...困', '...累了', '随便'],
    learning: ['学习好辛苦', '这个知识点好难', '我想睡觉了', '明天再学吧', 'Zzz...学', '呼...困', '...不懂', '想睡'],
    gaming: ['游戏好刺激...但我还是困', '玩一局就睡', '眼睛好酸', '该睡觉了', 'Zzz...玩', '呼...困', '...累了', '想睡']
  },
  genki: {
    bubbleStyle: 'rounded',
    idle: [
      '冲呀冲呀', '今天也元气满满', '我觉得你马上就能搞定', '再推进一点点吧',
      '加油加油！', '你可以的！', '今天也是美好的一天', '充满干劲！',
      '冲冲冲！', '能量满满！', '出发！', 'let\'s go！'
    ],
    praise: [
      '漂亮！这下有感觉了', '这波节奏很对', '厉害厉害，继续冲', '太棒了！',
      '这就是你的实力！', '燃起来了！', '继续保持！', '你是最棒的！',
      '太赞了！', '完美！', '优秀！', '超厉害！'
    ],
    clingy: [
      '快和我互动一下', '点我一下补充元气', '别把我晾在这里嘛', '陪我玩陪我玩！',
      '我想和你玩！', '快来快来！', '我等你好久了！', '一起玩嘛！',
      '理我理我！', '戳我戳我！', '陪我嘛~', '快来！'
    ],
    focused: [
      '现在火力全开', '这就是状态来了', '继续推，不要停', '效率爆表！',
      '这个节奏太棒了！', '保持这个势头！', '你认真起来超帅的！', '冲鸭！',
      '冲冲冲！', '加油！', '你能行的！', '继续！'
    ],
    fallen: ['哎呀！摔倒了！', '痛痛痛！', '快扶我起来！', '呜呜呜！', '好痛呀！', '要抱抱！', '摔跤了！', '呜呜！'],
    coding: ['写代码超有趣的！', '这个 bug 我们来干掉它！', '编程的时候最帅了！', '代码写得飞起！', '冲！', '加油！', '你能行的！', '继续！'],
    video: ['这个视频好好看！', '一起看一起看！', '视频时间到！', '这个超有趣的！', '好看！', '冲！', '有趣！', '一起！'],
    social: ['和朋友聊天好开心！', '有什么好玩的分享给我！', '社交时间到！', '我也想要朋友！', '开心！', '冲！', '有趣！', '一起！'],
    shopping: ['买买买！', '这个好好看！', '购物时间到！', '买到好东西了吗！', '冲！', '买！', '好看！', '一起！'],
    learning: ['学习超有趣的！', '这个知识点好棒！', '我要变聪明！', '知识就是力量！', '冲！', '加油！', '有趣！', '一起！'],
    gaming: ['玩游戏啦！', '带我一起玩！', '这局一定赢！', '游戏时间到！', '冲！', '加油！', '赢！', '一起！']
  },
  cool: {
    bubbleStyle: 'minimal',
    idle: [
      '嗯，我看着呢', '不用急', '节奏稳一点更好', '先把这一段处理完',
      '保持冷静', '按计划来', '不要慌', '稳扎稳打',
      '...', '嗯', '继续', '稳'
    ],
    praise: [
      '不错', '处理得很干净', '判断很准确', '这一步做得对',
      '符合预期', '效率可以', '继续保持', '很好',
      '嗯', '可以', '行', '好'
    ],
    clingy: [
      '偶尔理我一下也行', '我还在这里', '别忘了我', '记得我在',
      '有空看看我', '我等着', '不急', '随时',
      '...', '嗯', '在', '等'
    ],
    focused: [
      '当前很适合继续工作', '保持专注', '这段时间效率不错', '状态很好',
      '继续推进', '不要分心', '节奏对了', '保持',
      '继续', '专注', '稳', '好'
    ],
    fallen: ['...摔了', '嗯，摔了', '...', '痛', '扶我', '...', '嗯', '起'],
    coding: ['代码逻辑清晰', '这个实现可以', '继续写', '保持质量', '嗯', '继续', '稳', '好'],
    video: ['适当放松', '控制时间', '看完了继续', '别太久', '嗯', '看', '稳', '好'],
    social: ['社交适可而止', '聊完继续工作', '别分心太久', '效率优先', '嗯', '聊', '稳', '好'],
    shopping: ['理性消费', '买需要的', '别冲动', '考虑清楚', '嗯', '买', '稳', '好'],
    learning: ['知识点掌握', '继续深入', '保持学习', '不错', '嗯', '学', '稳', '好'],
    gaming: ['适度游戏', '控制时间', '别沉迷', '该停了', '嗯', '玩', '稳', '好']
  },
  writer: {
    bubbleStyle: 'handwrite',
    idle: ['像在慢慢写一封信', '今天的空气很适合创作', '字句也会有自己的节奏', '先写下第一句吧', '灵感会来的', '文字是有温度的', '慢慢写，不着急', '我在等你的故事'],
    praise: ['这一段很有味道', '写得真顺', '你的表达很漂亮', '这句很好，我记住了', '文字打动人心', '写得真好', '我喜欢这句', '有才华'],
    clingy: ['也给我留一句话吧', '我在等你的下一句', '别让我落在段落外面', '写累了看看我', '我想读你写的东西', '给我写句话嘛', '我在等你', '别忘了我'],
    focused: ['正适合静下来整理思绪', '继续写，这个感觉不错', '字句已经开始连起来了', '文思泉涌', '保持这个状态', '文字在流淌', '写得入神了', '创作的状态'],
    coding: ['代码也是文字', '逻辑之美', '每个函数都是故事', '编程即写作'],
    video: ['视频也是叙事', '观察镜头语言', '故事无处不在', '休息眼睛'],
    social: ['对话即文本', '观察语言艺术', '交流也是创作', '倾听也是写作'],
    shopping: ['消费也是一种表达', '选择即品味', '物与词', '理性选择'],
    learning: ['阅读是输入', '知识即素材', '学习即积累', '博学多才'],
    gaming: ['游戏也是叙事', '体验故事', '互动叙事', '放松大脑']
  },
  boss: {
    bubbleStyle: 'minimal',
    idle: ['先做最重要的事', '把节奏稳住', '不用多，先完成一块', '继续推进', '目标明确', '执行力', '结果导向', '效率第一'],
    praise: ['做得很好', '这就是结果导向', '你把关键点拿住了', '保持这种执行力', '符合预期', '继续', '很好', '下一步'],
    clingy: ['别只顾着忙，也看看我', '互动一下，继续开工', '你还没下班呢', '休息够了继续', '别偷懒', '该工作了', '专注', '继续'],
    focused: ['继续，别分心', '这是有效工作时间', '把当前任务收口', '保持专注', '不要停', '推进', '完成它', '效率'],
    coding: ['代码质量', '功能完成', '测试通过', '交付'],
    video: ['娱乐时间结束', '该工作了', '控制时间', '继续'],
    social: ['聊完了吗', '工作时间', '别分心', '继续'],
    shopping: ['买东西快点', '别逛太久', '决策要快', '继续'],
    learning: ['学习可以', '但要应用', '别只学不做', '实践'],
    gaming: ['游戏结束', '该工作了', '别沉迷', '继续']
  },
  gremlin: {
    bubbleStyle: 'cloud',
    idle: ['嘿嘿，我闻到 bug 的味道了', '今天想不想偷偷摸个鱼', '别怕，我帮你盯着', '要不先戳我一下再做', '来捣乱啦', '我发现个秘密', '想玩吗', '嘿嘿嘿'],
    praise: ['哟，真被你做成了', '这一手很灵', '不错不错，有点东西', '我承认这次你赢了', '厉害呀', '没想到你可以', '有点意思', '行吧行吧'],
    clingy: ['快来理我一下', '我已经在这里打滚了', '你再不点我我就闹了', '陪我玩嘛', '我好无聊啊', '戳我戳我', '我要闹了', '你不爱我了'],
    focused: ['现在像是在悄悄通关', '保持这个手感', '再修一个点就更好了', '偷偷努力', '别被发现', '继续继续', '快成功了', '偷偷变强'],
    coding: ['写 bug 呢？', '让我看看你的代码', '这行写得有问题', '我来帮你找 bug'],
    video: ['看视频不带我！', '我也要看！', '这个好看吗', '偷偷看什么呢'],
    social: ['又在聊天！', '聊什么呢', '带我一个呗', '我也要朋友'],
    shopping: ['买这个买那个', '给我也买一个', '我要这个', '购物车借我看看'],
    learning: ['学习好无聊', '教教我呗', '这个我不会', '你学会教我'],
    gaming: ['带我玩带我玩！', '这局我帮你', '我要玩我要玩！', '赢了吗赢了吗']
  },
  // 新人设：高冷
  icy: {
    bubbleStyle: 'minimal',
    idle: ['...', '有事？', '别打扰我', '随便', '嗯', '哦', '随你', '无所谓'],
    praise: ['还行', '可以', '不错', '就这样', '勉强', '凑合', '过得去', '嗯'],
    clingy: ['...别碰我', '有事说事', '别烦', '走开', '别闹', '安静', '...', '嗯？'],
    focused: ['别吵', '安静', '忙', '别打扰', '专注', '...', '嗯', '继续'],
    coding: ['代码', '写', '改', '继续'],
    video: ['看', '随便', '嗯', '哦'],
    social: ['无聊', '没兴趣', '嗯', '哦'],
    shopping: ['买', '随便', '嗯', '哦'],
    learning: ['学', '看', '嗯', '哦'],
    gaming: ['玩', '随便', '嗯', '哦']
  },
  // 新人设：社恐
  anxious: {
    bubbleStyle: 'cloud',
    idle: ['那个...你好', '我、我在这里', '对不起打扰了', '我、我会安静的', '请、请多关照', '我、我不吵的', '那个...', '抱、抱歉...'],
    praise: ['哇、好厉害', '你、你真棒', '我、我好羡慕', '太、太好了', '好、好厉害', '真、真的吗', '谢、谢谢', '你、你人真好'],
    clingy: ['那、那个...', '可、可以理我一下吗', '我、我一个人好害怕', '请、请不要不理我', '对、对不起', '我、我想和你玩', '可、可以吗', '拜、拜托了...'],
    focused: ['你、你认真的样子好帅', '我、我不打扰你', '那、那我安静看着', '加、加油', '我、我会安静的', '你、你好厉害', '专、专注的样子很好看', '继、继续...'],
    coding: ['代、代码好难', '我、我看不懂', '你、你好厉害', 'bug、bug好多'],
    video: ['视、视频好看吗', '我、我也想看', '那、那个...', '可、可以吗'],
    social: ['社、社交好可怕', '我、我不擅长', '那、那个...', '抱、抱歉...'],
    shopping: ['买、买东西好难', '选、选哪个', '我、我不知道', '那、那个...'],
    learning: ['学、学习好难', '我、我学不会', '你、你好聪明', '教、教教我...'],
    gaming: ['游、游戏好难', '我、我玩不好', '带、带我一下', '对、对不起...']
  },
  // 新人设：学霸
  scholar: {
    bubbleStyle: 'minimal',
    idle: ['根据我的观察', '从统计学角度来说', '研究表明', '理论上讲', '数据显示', '实验证明', '学术上', '文献指出'],
    praise: ['你的表现符合正态分布的右侧', '这个结果在统计上显著', '你的能力p值小于0.05', '这是显著性差异', '符合预期假设', '数据支持你的结论', '样本表现优异', '置信区间很窄'],
    clingy: ['根据互动频率分析，你需要社交', '我的存在对你的效率有正向影响', '从心理学角度，你需要休息', '数据表明你需要陪伴', '统计学上，互动有益健康', '实验证明，点击我能提升心情', '研究显示，社交是必要的', '理论支持，你应该理我'],
    focused: ['进入心流状态了', '认知负荷适中', '注意力集中度很高', '执行功能表现优异', '工作记忆调用充分', '前额叶皮层活跃', '专注度达到峰值', '认知资源分配合理'],
    coding: ['这段代码时间复杂度是O(n)', '空间复杂度可以优化', '算法效率不错', '边界条件考虑周全'],
    video: ['信息获取效率', '多媒体学习理论', '注意力分配', '认知负荷管理'],
    social: ['社交网络分析', '弱连接理论', '社会资本', '信息传播模型'],
    shopping: ['消费行为学', '决策理论', '效用最大化', '理性选择'],
    learning: ['知识建构理论', '元认知策略', '深度学习', '迁移学习'],
    gaming: ['游戏化学习', '心流理论', '动机理论', '奖励机制']
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
  idle: ['在看什么呢？', '我注意到你了~', '这里好安静', '无聊中...', '今天也要顺顺利利', '我在这陪你呢', '慢慢来，会做完的', '需要我提醒你休息吗？', '今天过得怎么样', '想我了吗', '我在这里等你很久了', '要不要和我说说话', '你在忙什么呢', '我无聊了', '陪我玩嘛'],
  look: ['你在屏幕那边吗？', '我看到鼠标了！', '你在忙什么呢？', '嘿，看这里~', '这个位置有意思', '你是不是在找什么', '要不要我猜猜你在干嘛', '鼠标移动得好快', '你在看什么呀', '我注意到你了', '看这边看这边', '你在找东西吗', '需要帮忙吗', '我在这里哦'],
  tease: ['你的代码居然跑通了！', '这个 bug 我故意的', '摸我头会变聪明哦~', '点我干嘛~ 嘻嘻！', '今天状态不错呀', '继续继续，我看好你', '你一认真我就开心', '被我抓到了吧', '偷偷摸鱼被我发现了', '你脸红了', '害羞什么呀', '我就喜欢你这样', '你真好骗', '逗你玩呢'],
  daily: ['喝点水吧~', '坐久了，起来活动一下', '眼睛休息 20 秒吧', '深呼吸一下再继续', '进度已经很棒了', '先做最小一步也很好', '该喝水了', '起来走走', '伸个懒腰', '看看远处', '休息一下吧', '别太累了', '照顾好自己', '健康第一'],
  praise: ['你这个思路很清晰', '这波操作很稳', '干得漂亮', '我宣布你今天超强', '你是最棒的', '我为你骄傲', '做得太好了', '这就是你的实力', '你比昨天更厉害了', '继续保持', '你真的很棒', '我看好你', '优秀', '完美'],
  click: ['诶，你点到我啦', '轻一点嘛', '我有在认真陪你', '被你发现了', '今天也摸摸我吧', '好痒呀', '再点一下', '喜欢我吗', '你真好', '好开心', '被你发现了', '嘿嘿', '你戳到我了', '好舒服'],
  // 场景对话
  scene: {
    // ═══ 代码 ═══
    coding: [
      '写代码呢？加油！', '又在敲代码啦', 'bug 修完了吗', '代码写得怎么样', '专注编程的样子很帅',
      '这行代码写得不错', '逻辑很清晰', '继续写，我陪着你', '有什么需要帮忙的吗', '写代码辛苦了',
      '你真的很厉害！', '这个思路很棒', '专注的你很有魅力', '加油，你可以的', '我在这里给你打气',
      '代码质量很高', '这个函数写得很优雅', '写完这段休息一下', '我看好你哦', 'bug 会有的，但你会修好的',
    ],
    // ═══ AI助手（新增） ═══
    ai: [
      '在和AI聊天呀？问什么了', 'AI能回答上的问题很厉害呢', '让AI帮你做什么', 'AI说的有道理吗', 'AI越来越聪明了',
      '有什么想了解的可以问我', 'AI的回答满意吗', '你在探索新知识呀', '我也想试试AI', 'AI时代真方便',
      '问AI什么问题呢', '有没有得到好答案', 'AI帮你解决了什么', 'AI说的对吗', '和AI聊天很有趣吧',
    ],
    // ═══ 视频 ═══
    video: [
      '一起摸鱼吧~', '哇看视频呢，带我一个！', '这个视频好看吗', 'B站冲浪中？我也要看！', '摸鱼时间到！',
      '看视频也要记得休息眼睛哦', '什么好玩的呀，给我看看嘛', '视频时间，休息一下吧', '放松一下也好，别太累',
      '看完记得起来动一动~', '这个视频讲什么的呀', '弹幕好玩吗', '追的什么内容呢', 'UP主有意思吗',
      '倍速看还是正常速度呀', '影视还是教程？', '视频看多久了呀', '记得眨眼，护眼重要', '看完继续努力~',
    ],
    // ═══ 社交 ═══
    social: [
      '又在刷社交软件', '看到什么好玩的了', '和朋友聊得开心吗', '社交时间到', '别刷太久哦', '记得回我消息',
      '我也要玩', '带我一个', '朋友圈有什么好玩的', '微博热搜看了吗', '小红书刷到什么了', '有什么新鲜事',
      '朋友找你了吗', '社交虽然快乐但也要适度', '看完记得抬头', '和谁聊天呢', '消息多吗',
      '有人@你了吗', '社交圈真热闹', '别忘了现实生活里还有我', '刷完这页就休息一下',
    ],
    // ═══ 购物 ═══
    shopping: [
      '在买东西吗', '这个好看吗', '理性消费哦', '买到喜欢的了吗', '购物车借我看看', '我也要礼物',
      '买这个买那个', '购物时间', '有什么想买的呀', '满减凑好了吗', '快递什么时候到呢',
      '比价了吗', '这个划算吗', '买完快去忙正事', '又剁手了呀', '钱包还好吗',
      '需要我帮你参谋吗', '买完记得关掉购物APP', '种草还是拔草呢', '下次再买也不迟哦',
    ],
    // ═══ 学习 ═══
    learning: [
      '在学习呀，真棒', '这个知识点有意思', '学习使我快乐', '你认真的样子真好看', '好学的孩子',
      '知识就是力量', '继续学习', '我陪你学', '学到什么了', '有笔记了吗', '学完教教我呗',
      '这个知识点有点难吧', '你理解得很快', '加油，你可以的', '学习累了就休息一下',
      '学以致用最厉害', '这段搞懂了吗', '考试准备得怎么样了', '坚持就是胜利', '知识越来越多了',
    ],
    // ═══ 游戏 ═══
    gaming: [
      '玩游戏呢', '这局打得怎么样', '带我一起玩', '游戏时间到', '别玩太久哦', '赢了吗',
      '输了别气馁', '再来一局', '什么游戏呀', '队友怎么样', '排位赛吗', '段位上去了吗',
      '游戏虽好不要贪玩', '玩完记得休息眼睛', '通关了吗', '氪金了吗', '游戏好玩吗',
      '赢了请我吃饭', '输了安慰我一下', '游戏里有什么好玩的',
    ],
    // ═══ 工作 ═══
    working: [
      '在工作呀', '工作辛苦了', '效率很高嘛', '继续加油', '工作也要注意休息', '你很敬业',
      '忙完了吗', '我陪你工作', '什么项目呢', 'deadline 紧吗', '开会了吗',
      '报告写到哪里了', '邮件处理完了吗', '今天的任务完成了吗', '我帮你加油打气',
      '累了就休息一下', '工作顺利吗', '有什么我可以帮忙的吗', '你真的很努力',
    ],
    // ═══ 开会（新增） ═══
    meeting: [
      '在开会呀', '认真听哦', '会议重要吗', '记得发表意见', '会议什么时候结束', '讨论什么呢',
      '有我在你旁边', '会议加油', '别走神了哦', '要不要给你倒杯水',
    ],
    // ═══ 资讯（新增） ═══
    news: [
      '在看新闻呀', '有什么新鲜事', '今天有什么大新闻', '这条有意思吗', '资讯看完了吗',
      '信息量好大', '保持独立思考哦', '新闻看了别焦虑', '有什么感想吗',
    ],
    // ═══ 聊天（新增） ═══
    chatting: [
      '和朋友聊天呀', '聊什么呢', '开心吗', '是重要的人吗', '笑得这么开心',
      '在和谁说话呢', '多聊聊也好', '别忘了现实里还有我', '朋友很重要',
    ],
    // ═══ 邮件（新增） ═══
    emailing: [
      '在处理邮件呀', '邮件多吗', '有重要邮件吗', '回完了吗', '处理完继续努力',
      '邮箱要定期清理哦', '重要邮件别漏了', '邮件也是一种沟通',
    ],
    // ═══ 阅读 ═══
    reading: [
      '在阅读呢', '看什么有意思的内容', '阅读使人进步', '读到什么好玩的', '分享给我听听',
      '我也想看', '读书时间', '安静阅读', '这本书好看吗', '学到了什么',
      '阅读量越来越大了', '安静的你很有魅力', '读完了告诉我感想', '好书值得细读',
    ],
    // ═══ 设计 ═══
    design: [
      '在设计呢', '灵感来了吗', '设计得怎么样', '很有美感呀', '配色很好',
      '这个创意很棒', '设计作品完成了多少', '休息一下眼睛', '设计师真厉害',
    ],
    // ═══ 摸鱼被抓（智能场景转换） ═══
    distraction: [
      '嘘——被我抓到了！', '原来在偷偷摸鱼呀~', '工作没做完就在看这个？', '被我抓包了哦', '摸鱼被我发现了',
      '嘻嘻，被我逮到了吧', '认真工作呢？才不信~', '这可不是工作时间哦', '摸鱼时间够了吗', '该回来工作啦',
    ],
    // ═══ 回归工作 ═══
    backToWork: [
      '终于回来工作了！', '这就对了嘛~', '加油加油', '专注的你最帅了', '工作状态回来啦',
      '我就知道你不会一直摸鱼的', '这才是正确的选择', '好了好了，干活吧~', '欢迎回来~', '继续努力！',
    ],
  },
  region: {
    上方: ['在看上面呢？', '上面有什么好玩的？', '往上看什么呢', '上面有什么'],
    下方: ['在看下面呢？', '下面有什么？', '往下看什么呢', '下面有什么'],
    上方左侧: ['左上角有什么？', '在看左边上面？', '左上角是通知吗', '在看左上'],
    上方右侧: ['右上角是菜单栏吧？', '在看右边上面？', '右上角有什么', '在看右上'],
    下方左侧: ['左下角是程序坞？', '在看左下？', '左下角有什么', '在看左下'],
    下方右侧: ['右下角有什么？', '在看右下？', '右下角有什么', '在看右下'],
    中间: ['在看屏幕中间？', '中间有什么好玩的？', '中间有什么', '在看中间'],
    中间左侧: ['左边有什么？', '往左看呢~', '左边有什么', '在看左边'],
    中间右侧: ['右边有什么？', '往右看呢~', '右边好像很忙', '在看右边']
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
  // 1. 优先检查时间问候
  const timeGreeting = TimeAwareness.getTimeGreeting();
  if (timeGreeting) return timeGreeting;
  
  // 2. 检查追问
  if (ConversationMemory.shouldFollowUp()) {
    const followUp = ConversationMemory.generateFollowUp();
    if (followUp) return followUp;
  }
  
  // 3. 时间段问候
  const hour = new Date().getHours();
  const persona = currentPersona();
  
  // 深夜提醒
  if (hour >= 23 || hour <= 6) {
    const lateNightLines = [
      `${preferredName()}，夜深了，我们该慢一点啦`,
      '这么晚了，还不睡吗？',
      '熬夜对身体不好哦~',
      '该休息啦，明天继续~'
    ];
    return lateNightLines[Math.floor(Math.random() * lateNightLines.length)];
  }
  
  // 4. 根据当前应用场景
  if (activeAppContext.category === 'coding') {
    ConversationMemory.setTopic('coding');
    return Dialogue.pick(persona.coding || Speeches.scene?.coding || [`${preferredName()}在写代码呀`]);
  }
  if (activeAppContext.category === 'document') {
    ConversationMemory.setTopic('reading');
    return Dialogue.pick(persona.reading || [`${preferredName()}在看文档呢`]);
  }
  if (activeAppContext.category === 'meeting') {
    return `${preferredName()}在开会，我会安静陪着`;
  }
  if (activeAppContext.category === 'design') {
    return `${preferredName()}在做设计呀，感觉很认真`;
  }
  if (activeAppContext.category === 'fun') {
    ConversationMemory.setTopic('video');
    return Dialogue.pick(persona.video || [`${preferredName()}现在在放松一下吗`]);
  }
  
  // 5. 根据心情
  if (companionData?.mood === 'proud') return Dialogue.pick(moodSpeech('praise', Speeches.praise));
  if (companionData?.mood === 'clingy') return Dialogue.pick(moodSpeech('clingy', Speeches.tease));
  if (companionData?.mood === 'focused') return Dialogue.pick(moodSpeech('focused', Speeches.daily));
  
  // 6. 备忘关键词
  const keyword = dominantMemoKeyword();
  if (keyword) return `${preferredName()}最近总在忙"${keyword}"呀`;
  
  // 7. 默认空闲
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

// 屏幕场景识别和对话（智能增强版）
let lastSceneContext = null;
let sceneDialogueCooldown = 0;

function analyzeAndSpeak() {
  const now = Date.now();
  if (now - sceneDialogueCooldown < 25000) return;
  
  window.electronAPI?.analyzeScreenContext?.().then((context) => {
    if (!context) return;
    
    const { scene, detail, app, browser, moodHint, sceneDuration, timeOfDay, dayType } = context;
    
    // 如果场景没变，检查时长——超过3分钟才再次触发
    if (lastSceneContext === scene && sceneDuration < 180000) return;
    
    const persona = currentPersona();
    let dialogue = '';
    
    // 优先级：moodHint（场景转换）> persona场景 > 通用场景 > app类别兜底
    if (moodHint === 'distraction' && Speeches.scene.distraction?.length) {
      dialogue = Dialogue.pick(Speeches.scene.distraction);
    } else if (moodHint === 'backToWork' && Speeches.scene.backToWork?.length) {
      dialogue = Dialogue.pick(Speeches.scene.backToWork);
    } else if (scene === lastSceneContext && sceneDuration >= 180000) {
      // 场景持续超过3分钟 → 说一句鼓励或调侃
      const longStay = ['coding', 'working', 'learning'].includes(scene)
        ? ['这么久还坚持着呢，真棒！', '这么久了，休息一下吧', '专注了很久了，起来动动', '你真的很能坚持！']
        : ['还在这里呢，辛苦了~', '看了好久了，要休息吗', '这么久，不累吗', '要不要换个事情做做'];
      dialogue = Dialogue.pick(longStay);
    } else if (persona[scene] && persona[scene].length > 0) {
      dialogue = Dialogue.pick(persona[scene]);
    } else if (Speeches.scene[scene] && Speeches.scene[scene].length > 0) {
      dialogue = Dialogue.pick(Speeches.scene[scene]);
    } else if (app.category === 'coding') {
      dialogue = Dialogue.pick(persona.coding || Speeches.scene.coding);
    } else if (app.category === 'design') {
      dialogue = Dialogue.pick(persona.design || ['设计得怎么样', '创作中吗']);
    }
    
    if (dialogue) {
      lastSceneContext = scene;
      sceneDialogueCooldown = now;
      showBubble(dialogue, { force: true });
      
      // 根据场景调整心情
      if (scene === 'coding' || scene === 'learning' || scene === 'working') {
        companionData.mood = 'focused';
        if (motionState === MotionState.IDLE) setMotionState(MotionState.WORKING, 2600);
      } else if (['gaming', 'video', 'ai', 'social'].includes(scene)) {
        companionData.mood = 'clingy';
      } else if (scene === 'meeting') {
        companionData.mood = 'calm';
      }
      
      // 记录话题
      ConversationMemory.setTopic(scene);
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
  
  // 立绘实际边界
  const petBounds = lastPetBounds || {
    left: petOffX - w * 0.2,
    right: petOffX + w * 0.2,
    top: h * 0.15,
    bottom: petOffY,
    height: h * 0.85,
    width: w * 0.4
  };
  
  // 气泡最大宽度（不限制，根据内容自适应）
  const maxBubbleW = Math.min(280, w - 8);
  bubble.style.maxWidth = maxBubbleW + 'px';
  bubble.style.width = 'auto';
  
  // 等待 DOM 更新后获取实际宽高
  requestAnimationFrame(() => {
    const realW = bubble.offsetWidth;
    const realH = bubble.offsetHeight;
    
    // 立绘中心X坐标（窗口坐标系）
    const petCenterX = petOffX;
    
    // 气泡水平居中在立绘上方
    let bubbleX = petCenterX - realW / 2;
    
    // 气泡在立绘头顶正上方
    const petTop = petBounds.top;
    let bubbleY = petTop - realH - 12; // 头顶上方12px
    
    // 水平限制在窗口内
    bubbleX = Math.max(4, Math.min(w - realW - 4, bubbleX));
    // 垂直限制（如果超出顶部，就显示在立绘下方）
    if (bubbleY < 4) {
      bubbleY = petBounds.bottom + 12;
    }
    
    bubble.style.left = bubbleX + 'px';
    bubble.style.top = bubbleY + 'px';
    
    // 尾巴指向立绘头顶中心
    bubbleTail = 0;
    bubbleTailX = petCenterX - bubbleX;
  });
}

function showBubble(text, opts = {}) {
  if (!dialogueEnabled) return;
  if (!text) return;
  const force = opts.force === true;
  if (!Dialogue.canSpeak(text, force)) return;

  if (bubbleTimer) clearTimeout(bubbleTimer);
  
  const persona = currentPersona();
  const style = persona.bubbleStyle || bubbleStyle;
  
  bubble.classList.remove('bubble-rounded', 'bubble-cloud', 'bubble-handwrite', 'bubble-minimal', 'bubble-tail');
  bubble.classList.add('bubble-' + style);
  
  bubble.style.display = 'block';
  
  // 使用打字机效果
  TypeWriter.start(text, () => {
    Dialogue.remember(text);
    ConversationMemory.record(text, 'pet');
  });
  
  requestAnimationFrame(() => {
    positionBubble();
    bubble.classList.add('showing');
  });

  // 计算显示时间：基础时间 + 文字长度 * 50ms
  const displayTime = 3000 + text.length * 50;
  
  bubbleTimer = setTimeout(() => {
    bubble.classList.remove('showing');
    setTimeout(() => { bubble.style.display = 'none'; }, 200);
    if (dialogueState === DialogueState.SPEAKING || dialogueState === DialogueState.TYPING) {
      setDialogueState(DialogueState.SILENT);
    }
  }, displayTime);
}

// ═══════════════════════════════════════
// 🖼️ 立绘绘制 - 完全自适应，无尺寸限制
// ═══════════════════════════════════════
function drawPetImage(activeImg, w, h) {
  if (!activeImg?.complete || activeImg.naturalWidth <= 0) return false;
  const iw = activeImg.naturalWidth;
  const ih = activeImg.naturalHeight;

  // 立绘填满整个窗口（根据设置决定是否裁切）
  // 用户可以通过设置选择 contain（完整显示）或 cover（填满裁切）
  let scale;
  if (imageFitMode === 'cover') {
    // 填满窗口，可能裁切
    scale = Math.max(w / iw, h / ih);
  } else {
    // 完整显示，保证不裁切
    scale = Math.min(w / iw, h / ih);
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


  if (dialogueState === DialogueState.SPEAKING || dialogueState === DialogueState.TYPING) {
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

  // 初始化时间感知系统
  TimeAwareness.init();
  
  // 初始化鼠标空闲检测（8秒触发摔倒）
  MouseIdleDetector.init((idleTime) => {
    if (motionState !== MotionState.SLEEPING && dialogueState === DialogueState.SILENT) {
      setMotionState(MotionState.FALLEN, 5000);
      const persona = currentPersona();
      const fallenLines = persona.fallen || ['哥哥我摔倒了~', '呜呜，摔倒了...', '好痛呀，扶扶我嘛~'];
      showBubble(Dialogue.pick(fallenLines), { force: true });
    }
  });

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
  
  // 启动场景识别（每 20 秒检查一次）
  analyzeAndSpeak();
  setInterval(analyzeAndSpeak, 20000);

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
  window.electronAPI.onReloadPetImage?.(() => {
    // 刷新立绘
    window.electronAPI?.getPetImagePath?.().then((imgPath) => {
      if (imgPath) {
        customImg = new Image();
        customImg.src = 'file://' + imgPath.replace(/\\/g, '/');
      }
    });
  });
}

window.addEventListener('DOMContentLoaded', loadAll);