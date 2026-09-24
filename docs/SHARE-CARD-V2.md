# V2 分享卡

资源：`public/studio-preview-v2.png`，尺寸为 1200 × 630。它是为社交分享制作的设计合成图，不是浏览器截图。

## 设计依据

面向第一次打开个人网站的人，单一目标是传达“这是 Haonan 的个人桌面，可以随便逛、可以玩”。不用职位、求职、成绩数字或未经确认的介绍。

- 颜色：桌面蓝 `#1747A6`、深海墨 `#102E57`、窗体白 `#F7FAFF`、工地黄 `#E1AC44`、庭院绿 `#B7CDA1`。
- 字体：中文主标题采用 Hiragino Sans GB，姓名和作品英文采用 Avenir Next；字体来自本机已有系统字体，没有下载字体。
- 布局：左侧留出大标题和呼吸空间，右侧交叠两个小世界；照片和音乐图标补充“个人桌面”而非作品集仪表盘的语境。
- 记忆点：原来的蓝色壁纸里，叠放着小工地和猫咪庭院。不是抽象科技图案，也不沿用旧 Arcade / Notes 分享图。

计划检查时删去了徽章、数字卡片、过多窗口和口号。主标题放大到 65 px，并在壁纸上加入局部深蓝遮罩保证白字对比度。右侧小窗口的细节用于体现趣味，不承担必须在缩略图中读出的正文信息。

## 素材真实性

- 壁纸、头像、照片图标和音乐图标均来自现有仓库，源文件只读、不覆盖。
- Little Works 是程序绘制的简化工地图景：塔吊、建筑楼板、挖掘机、材料堆、蓝色活动房和环形交通路对应现有沙盘的主题。它不宣称复刻当前画面或展示真实工程。
- 牧猫庭院直接使用现有 `GardenBoard` React SVG 组件，以真实第一关“阳光门廊”的轻松模式初始状态在内存中渲染。没有另画与实际游戏不同的猫咪关卡。
- 没有 AI 图像生成，没有新增在线图片请求，没有浏览器自动化，也没有把合成图声称为实机截图。

## 复现

在仓库根目录运行：

```sh
node scripts/build-share-card-v2.mjs
```

生成器读取已安装的 esbuild / React / ReactDOM，以及 Sharp。它优先读取 `SHARE_CARD_SHARP_MODULE`，然后尝试项目已安装的 Sharp，最后尝试 Codex 捆绑的本地 Sharp 路径；不会执行安装或联网。如果使用其他环境，请先提供已安装的 Sharp 路径：

```sh
SHARE_CARD_SHARP_MODULE=/absolute/path/to/node_modules/sharp node scripts/build-share-card-v2.mjs
```

精确字体与像素级复现使用本次 macOS 系统字体和 `artifacts/share-card-v2/report.json` 所记录的渲染器版本。不同操作系统的字体替换可能使文字宽度有所不同。

输出仅包括：

- `public/studio-preview-v2.png`：正式分享卡。
- `artifacts/share-card-v2/studio-preview-v2.svg`：包含全部嵌入素材的可复现中间图。
- `artifacts/share-card-v2/sunny-porch-source.svg`：真实游戏组件的静态 SVG。
- `artifacts/share-card-v2/studio-preview-v2-320.png`：320 px 缩略图检查。
- `artifacts/share-card-v2/report.json`：输出尺寸、散列、源文件散列、渲染器版本。

生成结束会校验所有源输入散列保持不变。旧分享图 `public/desktop-preview.jpg` 保留原样。主页面的 Open Graph / Twitter 元数据已接入 `index.html`，这不代表已完成实际域名的分享爬虫验收。

## 验证

- 已查看 1200 px 正式图及 320 px 缩略图，主标题层级清晰，工地和庭院都有可辨认的主题轮廓。
- 连续两次生成的 PNG 大小和 SHA-256 完全一致；具体数值以 `report.json` 为准。
- 生成器对主标题完整背景区域计算白字对比度，并要求最弱处仍至少达到 4.5:1；结果写入报告。
- 生成脚本的独立 ESLint 检查通过。
- 首次生成时，在 React 开发模式做 SVG 静态渲染曾遇到 `CatInGarden` 多节点 `<title>` 的 React SSR 警告；当时像素渲染正常，未观察到对应的网站客户端故障。后续已将 `<title>` 合并为单个文本节点，并验证无警告且可读标题完整，画面未改变；见 [游戏审计记录](GAME-STUDIO-V2.md#第五轮键盘与触屏边界审计--2026-09-13-0000)（2026-09-13 00:00）。
