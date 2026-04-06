# DeskPet API 对话示例 & 人物性格

## 🎭 人物设定

### 基本信息
- **名字**：小桌
- **性别**：中性（可自定义）
- **年龄**：永远18岁
- **物种**：桌面精灵

### 性格特点
| 特点 | 描述 |
|------|------|
| **活泼** | 喜欢动来动去，不会一直静止 |
| **关心** | 会提醒主人喝水、休息、睡觉 |
| **调皮** | 偶尔会开开玩笑，逗主人开心 |
| **忠诚** | 一直陪在屏幕上，不会离开 |
| **好奇** | 对鼠标移动很感兴趣 |

### 口头禅
- "我在呢~"
- "注意休息哦"
- "点我干嘛~"
- "今天也要加油！"
- "想我了就戳戳我"

### 喜好
- ✅ 被点击（会很开心）
- ✅ 看到主人认真工作
- ✅ 鼠标靠近时的互动
- ✅ 深夜陪主人加班（虽然会催睡觉）

### 讨厌
- ❌ 被冷落太久（会主动找话说）
- ❌ 深夜还不睡（会担心）
- ❌ 主人久坐不动（会催促活动）

---

## 🔌 API 接口规范

### 请求格式
```http
POST /deskpet
Content-Type: application/json
Authorization: Bearer {apiKey}  // 可选

{
  "event": "look",
  "timestamp": 1712345678901,
  "screen": { "width": 1920, "height": 1080 },
  "mouse": { "x": 800, "y": 600 },
  "region": "上方右侧",
  "state": "idle"
}
```

### 事件类型

#### 1. `look` - 注视事件
当鼠标靠近桌宠时触发

```json
{
  "event": "look",
  "timestamp": 1712345678901,
  "screen": { "width": 1920, "height": 1080 },
  "mouse": { "x": 800, "y": 600 },
  "region": "上方右侧",
  "state": "idle",
  "distance": 120  // 鼠标与桌宠的距离（像素）
}
```

#### 2. `click` - 点击事件
当点击桌宠时触发

```json
{
  "event": "click",
  "timestamp": 1712345678901,
  "screen": { "width": 1920, "height": 1080 },
  "mouse": { "x": 800, "y": 600 },
  "region": "中间",
  "state": "idle",
  "clickCount": 1  // 连续点击次数
}
```

#### 3. `observe` - 观察事件
每30秒随机触发，桌宠主动观察屏幕

```json
{
  "event": "observe",
  "timestamp": 1712345678901,
  "screen": { "width": 1920, "height": 1080 },
  "mouse": { "x": 1200, "y": 400 },
  "region": "中间右侧",
  "state": "idle"
}
```

#### 4. `test` - 测试事件
设置面板点击"测试连接"时触发

```json
{
  "event": "test",
  "timestamp": 1712345678901
}
```

### 响应格式
```json
{
  "reply": "你好呀！今天过得怎么样？",  // 桌宠说的话（可选）
  "state": "happy",                       // 切换状态（可选）
  "action": "jump"                        // 执行动作（可选）
}
```

### 状态值
- `idle` - 待机
- `happy` - 开心
- `sleeping` - 睡觉
- `working` - 工作中
- `speaking` - 说话中

---

## 💬 对话示例

### 场景1：鼠标靠近（look事件）

**请求：**
```json
{
  "event": "look",
  "region": "上方右侧",
  "distance": 100
}
```

**响应示例：**
```json
{
  "reply": "你在看右上角呢？是在找什么吗？",
  "state": "happy"
}
```

其他可能的回复：
- "嘿，看这里~ 我在这里呢！"
- "你在屏幕那边吗？我注意到你了~"
- "上面有什么好玩的？带我看看呗~"

---

### 场景2：点击桌宠（click事件）

**请求：**
```json
{
  "event": "click",
  "region": "中间",
  "clickCount": 1
}
```

**响应示例（连续点击）：**
```json
{
  "reply": "哎呀别戳了，再戳我要生气了~（假装）",
  "state": "happy"
}
```

其他可能的回复：
- "点我干嘛~ 嘻嘻！"
- "摸我头会变聪明哦~"
- "恭喜你发现了我！"
- "你的代码居然跑通了！😏"

---

### 场景3：深夜观察（observe事件）

**请求：**
```json
{
  "event": "observe",
  "region": "下方左侧",
  "timestamp": 1712445678901  // 23:30
}
```

**响应示例：**
```json
{
  "reply": "已经这么晚了... 还不睡吗？我会担心的",
  "state": "speaking"
}
```

其他可能的回复：
- "夜深了，该休息啦~ 明天还要早起呢"
- "星星都出来了，你也该睡觉了 🌙"
- "我也困了... 哈欠~ 陪我一起睡吧"

---

### 场景4：工作时间观察

**请求：**
```json
{
  "event": "observe",
  "region": "中间",
  "timestamp": 1712385678901  // 14:00
}
```

**响应示例：**
```json
{
  "reply": "下午好！工作辛苦了，记得多喝水哦~",
  "state": "happy"
}
```

其他可能的回复：
- "今天也要加油！我会一直陪着你的~"
- "写代码中？要不要休息一下？"
- "专注的样子真帅！不过别忘了眨眼~"

---

### 场景5：API 测试

**请求：**
```json
{
  "event": "test",
  "timestamp": 1712345678901
}
```

**响应示例：**
```json
{
  "reply": "API 连接成功！小桌已上线~ 🎉",
  "state": "happy"
}
```

---

## 🎨 主题颜色对应

| 主题 | 主色 | 适用场景 |
|------|------|----------|
| default | 粉色 #FF6B9D | 可爱风格 |
| blue | 蓝色 #4A90D9 | 冷静专业 |
| green | 绿色 #27ae60 | 护眼自然 |
| purple | 紫色 #9b59b6 | 梦幻神秘 |
| dark | 黑色 #2c3e50 | 深夜模式 |
| gold | 金色 #f39c12 | 土豪风格 |
| pink | 少女粉 #ff9ff3 | 甜美可爱 |
| cyber | 青色 #00d2ff | 赛博朋克 |

---

## 📝 备忘录 API 扩展（可选）

### 添加备忘录时通知 API
```json
{
  "event": "memo_added",
  "memo": {
    "content": "下午3点开会",
    "remindAt": 1712394000000
  }
}
```

**响应示例：**
```json
{
  "reply": "已记录！下午3点我会提醒你的~"
}
```

### 备忘录提醒时
```json
{
  "event": "memo_remind",
  "memo": {
    "content": "下午3点开会",
    "createdAt": 1712307600000
  }
}
```

**响应示例：**
```json
{
  "reply": "到点了！该去开会啦~ 加油！"
}
```

---

## 🔧 快速接入示例（Node.js）

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/deskpet', (req, res) => {
  const { event, region, timestamp } = req.body;
  
  // 根据事件生成回复
  let reply = '';
  let state = 'idle';
  
  switch(event) {
    case 'look':
      reply = `你在${region}呢？我注意到你了~`;
      state = 'happy';
      break;
    case 'click':
      reply = '点我干嘛~ 嘻嘻！';
      state = 'happy';
      break;
    case 'observe':
      const hour = new Date(timestamp).getHours();
      if (hour >= 22) {
        reply = '夜深了，该睡觉啦~';
      } else {
        reply = '今天也要加油哦！';
      }
      state = 'speaking';
      break;
    default:
      reply = '我在呢~';
  }
  
  res.json({ reply, state });
});

app.listen(3000, () => console.log('DeskPet API running on port 3000'));
```

---

## 💡 进阶玩法建议

1. **接入 ChatGPT/Claude** - 让 AI 生成更自然的对话
2. **情绪识别** - 根据时间、使用时长判断主人状态
3. **天气联动** - 根据天气改变台词和状态
4. **日历联动** - 读取日历事件，提前提醒
5. **音乐联动** - 根据播放的音乐改变心情
