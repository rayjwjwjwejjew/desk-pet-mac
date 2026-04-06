# DeskPet 🐾

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos)
[![Electron](https://img.shields.io/badge/Electron-33-blue.svg)](https://www.electronjs.org/)

一个可爱的 macOS 桌面宠物，让你的桌面更有活力！

![DeskPet Preview](docs/preview.png)

## ✨ 特性

### 🎭 分层动画系统
- **眨眼动画** - 2-6秒随机眨眼，让桌宠更生动
- **嘴巴动画** - 说话时嘴巴自然开合
- **耳朵动画** - 不同心情时耳朵有微妙摆动

### 💬 4种对话框样式
| 样式 | 描述 | 适合人设 |
|------|------|---------|
| 经典圆角 | 柔和亲切 | 陪伴系、元气系 |
| 柔和云朵 | 可爱圆润 | 困困系、捣蛋系 |
| 手写风格 | 文艺气息 | 文艺系 |
| 现代极简 | 干净利落 | 嘴硬系、冷淡系、前辈系 |

### 🎭 8种角色人设
- **陪伴系** - 温柔体贴，时刻陪伴
- **嘴硬系** - 傲娇可爱，心口不一
- **困困系** - 慵懒可爱，温柔提醒
- **元气系** - 活力满满，积极向上
- **冷淡系** - 高冷简洁，偶尔关心
- **文艺系** - 温文尔雅，诗意表达
- **前辈系** - 干练稳重，指点迷津
- **捣蛋系** - 调皮可爱，制造惊喜

### ⏰ 健康提醒
- 💧 喝水提醒
- 🚶 久坐提醒
- 👀 眼保健操提醒
- 🍅 番茄钟
- 🌙 智能作息提醒

### 🖼️ 自定义立绘
- 支持自定义 PNG/JPG/WEBP 图片
- 自适应缩放，无框限制
- 设置/X按钮跟随立绘头部位置

### 👁️ 视觉感知
- 感知鼠标位置
- 根据屏幕区域主动对话
- 智能应用检测（编码/文档/会议/设计）

## 📦 安装

### 下载安装
1. 从 [Releases](../../releases) 下载最新版 `.dmg` 文件
2. 打开 DMG，拖动到 Applications 文件夹
3. 双击运行（首次可能需要在系统偏好设置中允许）

### 从源码构建
```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/desk-pet-mac.git
cd desk-pet-mac

# 安装依赖
npm install

# 开发模式运行
npm start

# 构建 DMG
npm run build
```

## 🎮 使用

### 基本操作
- **拖拽移动** - 按住拖动到任意位置
- **点击互动** - 点击触发对话和动画
- **右键菜单** - 显示/隐藏/设置
- **设置按钮** - 鼠标悬停时显示在头部附近

### 快捷键
- `Cmd + ,` - 打开设置
- `Cmd + W` - 隐藏桌宠

## 🔧 配置

### 立绘设置
- **显示大小** - 30%-120% 自由调节
- **立绘适配** - 完整显示/填满裁切
- **对话框样式** - 4种风格可选

### 人设设置
- 选择喜欢的角色人设
- 设置喜欢的称呼
- 开启随机切换模式

### API 扩展
支持自定义 API 接口，实现更智能的对话：
```json
{
  "event": "click|look|observe",
  "timestamp": 1712400000000,
  "screen": { "width": 1920, "height": 1080 },
  "mouse": { "x": 960, "y": 540 },
  "state": "idle|happy|sleeping|working"
}
```

## 📁 项目结构

```
desk-pet-mac/
├── src/
│   ├── main.js          # Electron 主进程
│   ├── preload.js       # 预加载脚本
│   ├── app.js           # 渲染进程（动画、交互）
│   ├── index.html       # 主窗口
│   ├── config.html      # 设置窗口
│   ├── memo.html        # 备忘录窗口
│   └── assets/
│       └── pet.png      # 默认立绘
├── build/
│   └── icon.icns        # 应用图标
├── docs/
│   └── preview.png      # 预览图
├── package.json
└── README.md
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- 灵感来源：shimeji、epeap 等经典桌宠项目

---

Made with ❤️ for macOS users
