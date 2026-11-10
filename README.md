# 🦉 多邻国风西班牙语强化口语练习 (HablaEspañol)

一款基于 **React 19 + TypeScript + Vite + Tailwind CSS** 构建的沉浸式多邻国（Duolingo）风格西班牙语口语练习应用。系统配备全中文交互界面、经典红心生命值机制、Web Audio API 原生音效合成、Web Speech API 实时西语语音评测、动态规划逐词发音比对与纠错，以及基于本地持久化的星标难点错题专项攻克库。

---

## 🌟 核心功能特性

### 1. 全中文界面与多邻国游戏化系统
- **全中文自然交互**：所有题目解析、引导用语、操作按键（“核对答案”、“继续下一题”、“跳过这题”、“改用键盘输入”）与通关庆祝卡片均采用地道中文。
- **红心生命值系统（❤️）**：
  - 满额 5 颗红心，朗读错误或跳过题目时扣除 1 颗，伴随心碎震颤视觉反馈。
  - 生命值耗尽时自动激活回血弹窗，提供“快速重整旗鼓（+1 ❤️）”与“立即加满生命值（+5 ❤️）”两种恢复模式。
- **连胜火苗（🔥）与成长收益（💎 / XP）**：
  - 自动打卡记录累计连胜天数。
  - 每通过一道口语练习奖励 15 XP 经验值与 2 颗宝石。
- **立体 3D 拟物触感**：经典多邻国风格厚边框按钮（`border-b-4` 与 `active:translate-y-1`），配备微弹动效与按压触感。
- **多邻国猫头鹰 Duo 矢量动态情绪**：纯 SVG 矢量绘制，根据练习状态实时切换表情（思考中、专注聆听、答对欢呼、扣心流泪、通关派对庆祝）。

### 2. 纯前端零外部依赖音效引擎 (Web Audio API)
无需加载任何外部 MP3 音频文件，利用浏览器底层的 Web Audio API 原生合成多邻国经典音效：
- **答对提示音**：标志性 C5 - E5 - G5 - C6 纯净正弦波四音琶音。
- **答错提示音**：Db3 - B2 柔和低频三角波滤波双音蜂鸣，温和不刺耳。
- **扣除红心音**：指数滑音下潜提示。
- **通关庆祝号角**：五和弦上行大合奏 (Fanfare)。
- **按键触感音**：短促的清脆高频点击回馈。
- **静音控制**：支持右上角一键静音/开启，状态自动保存。

### 3. 实时语音评测与双速原生朗读
- **语音识别 (STT - Speech-to-Text)**：
  - 原生接入 Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)。
  - 目标语言指定为 `es-ES`（西班牙标准卡斯蒂利亚语）。
  - 支持 `interimResults` 实时流式转写与录音动态声波柱状动画。
- **原生语音合成 (TTS - Text-to-Speech)**：
  - 接入浏览器 `window.speechSynthesis` 原生引擎，自动匹配高品质西语发音人。
  - **标准原速（1.0x 喇叭）**：感受地道西语的连读与语调。
  - **乌龟慢速（0.6x 🐢）**：放慢每个音节，清晰展示卷舌音与元音组合。
- **双模备用输入**：麦克风受限或需要拼写辅助时，可一键切换为“键盘输入模式”，自带 `á, é, í, ó, ú, ñ, ü, ¿, ¡` 虚拟快捷西语重音按键。

### 4. 智能文本归一化与逐词比对算法 (Token-level Diff)
针对西班牙语语音识别特点研发的对齐与评分系统：
- **Unicode NFD 智能归一化**：自动剔除重音符号（`á, é, í, ó, ú, ü`）、标点符号（`¿, ?, ¡, !`）及大小写差异，防止机械性误判。
- **动态规划词元对齐 (DP Token Alignment)**：
  - 🟩 **绿色徽章**：读音精准匹配（点击即可单独发音朗读该单词）。
  - 🟥 **红色徽章**：发音偏差或读错（清晰标注“读成：[用户发音]”，附带单字标准音试听）。
  - 🟨 **虚线黄色**：遗漏未读的单词。
- **容错匹配机制**：结合 Levenshtein 编辑距离算法，对长单词提供微弱音节容差判定。

### 5. 星标错题与针对性强化复习 (⭐ 难点复习)
- 练习过程中随时点击右上角 **⭐ 标记难点**，题目即刻加入难点错题本。
- 数据依托浏览器 `localStorage` 实现永久离线保存。
- 点击顶部“难点复习”按键可展开难点生词笔记本，一键进入“**难点专项攻克模式**”，专注于弱项提升。

---

## 📚 内置西班牙语精选题库

题库涵盖 6 大核心日常与旅行场景，共计 30+ 句高频实用西语句式：

| 单元编号 | 单元名称 | 重点句型示例 | 难度 |
| :--- | :--- | :--- | :--- |
| **Unit 1** | 基础问候与礼貌 (Saludos) | `¡Hola! Mucho gusto en conocerte.`<br>`Buenos días, ¿cómo estás hoy?` | 初级基础 |
| **Unit 2** | 餐厅点餐与饮食 (Restaurante) | `Quisiera un café con leche, por favor.`<br>`¿Me trae la cuenta, por favor?` | 初级/进阶 |
| **Unit 3** | 旅行问路与交通 (Viajes) | `¿Dónde está la estación de metro más cercana?`<br>`Siga todo recto y gire a la derecha.` | 进阶口语 |
| **Unit 4** | 购物与日常交流 (Compras) | `¿Puedo pagar con tarjeta de crédito?`<br>`¿Tiene una talla más grande de esta camisa?` | 初级/进阶 |
| **Unit 5** | 酒店入住与服务 (Hotel) | `Tengo una reserva a nombre de Carlos.`<br>`¿A qué hora se sirve el desayuno mañana?` | 进阶口语 |
| **Unit 6** | 应急求助与健康 (Emergencias) | `¿Puede ayudarme? He perdido mi pasaporte.`<br>`Me duele mucho la cabeza y tengo fiebre.` | 高阶地道 |

每道题目均提供：
- 🗣️ **发音拼读指引**：如 `[ki-sye-ra un ka-fe kon le-che]`
- 💡 **西语地道用法与语法小贴士**：如虚拟式委婉表达、自复动词用法、阴阳性单复数一致性
- 🔍 **生词速查卡**：点击关键词即弹词义并单独发音朗读

---

## 🛠️ 技术架构与技术栈

- **前端框架**：React 19 (`react`, `react-dom`)
- **构建工具**：Vite 8
- **样式方案**：Tailwind CSS 4 (`@tailwindcss/vite`，纯类名 + 3D 拟物立体按键工具层)
- **图标系统**：Lucide React (`lucide-react`)
- **语音识别**：Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **语音合成**：SpeechSynthesis API (`window.speechSynthesis`)
- **音效合成**：Web Audio API (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`)
- **数据持久化**：浏览器 `localStorage`

---

## 📁 项目目录结构

```text
├── index.html                  # 页面入口文件（配置 Nunito 字体与西班牙语语言属性）
├── metadata.json               # AI Studio 应用元数据及权限配置
├── package.json                # 项目依赖定义
├── tsconfig.json               # TypeScript 编译配置
├── vite.config.ts              # Vite 构建配置
└── src/
    ├── main.tsx                # 应用启动入口
    ├── App.tsx                 # 核心状态中枢与主流程控制
    ├── index.css               # 全局样式与多邻国 3D 拟物按钮工具类
    ├── types/
    │   └── index.ts            # 题目、评估结果、Diff 词元与用户数据类型定义
    ├── services/
    │   ├── soundEffects.ts     # Web Audio API 原生音效合成引擎
    │   └── speechService.ts    # STT 实时语音识别与 TTS 双速朗读服务
    ├── utils/
    │   └── diffAlgorithm.ts    # 西语 NFD 归一化与动态规划逐词对齐算法
    ├── data/
    │   └── spanishExercises.ts # 6 大单元分级西班牙语口语题库
    └── components/
        ├── DuoOwl.tsx          # 多邻国猫头鹰 Duo 矢量动态情绪组件
        ├── Header.tsx          # 顶部状态栏（进度条、红心、连胜、宝石、难点复习入口）
        ├── QuestionCard.tsx    # 题目气泡卡片（双速朗读、拼读指引、生词卡、星标收藏）
        ├── SpeechRecorder.tsx  # 麦克风录音控制面板、声波动画与虚拟西语键盘
        ├── WordDiffView.tsx    # 逐词对比评测视图（正确/偏差/遗漏标记与单字试听）
        ├── BottomActionBar.tsx # 底部滑动操作栏（跳过、核对、继续下一题，支持 Enter 键）
        ├── DifficultiesModal.tsx # 星标难点生词错题管理抽屉
        ├── HeartRestockModal.tsx # 红心生命值耗尽回血弹窗
        ├── UnitSelectorModal.tsx # 西语主题训练单元切换器
        └── CompletionCelebration.tsx # 通关结算与成就结算界面
```

---

## 🚀 本地运行与开发

### 环境要求
- Node.js >= 18.0.0
- 支持 Web Speech API 的现代浏览器（推荐 Google Chrome, Microsoft Edge）

### 安装与启动
```bash
# 安装项目依赖
npm install

# 启动开发服务器（默认运行在 3000 端口）
npm run dev

# 编译生产版本
npm run build
```

---

## 💡 键盘快捷键支持

- **`Enter` 回车键**：
  - 录入语音或文本后：一键**核对答案**
  - 回答正确或错误展示后：一键**继续下一题**
- **点击单词**：在题目卡片或逐词评测中，点击任意西语单词即可触发该词的原声独立发音。

---

## 📄 授权许可
Apache-2.0 License


## FastAPI / MySQL / 本地语音引擎重构

当前代码已接入账户登录、服务端题库与评分、数据库持久化及 Docker Compose。新架构与启动说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。上文原型的纯前端与 Web Speech Recognition 说明属于历史设计，以新部署文档为准。
