# Haonan Li · Personal Desktop

基于 `new-web-leo` 的个人桌面网站。视觉参考 [Macxfolio 公开演示](https://macxfolio.framer.website/)；
以原仓库的内容和技术栈继续开发，旧站 `leo-homepage` 的全部 49 张图片均已核验接入。

## 新手使用说明

推荐 Node.js 22.12+ 或 24，使用 npm：

```sh
npm ci
npm run dev -- --port 5174
```

打开终端中的 Local 地址。默认只监听本机 `127.0.0.1`。
修改源码后自动刷新；在终端按 Ctrl+C 停止。已有服务占用端口时换成其他空闲端口。
本次完整改版位于 GitHub 的 `feat/macxfolio-desktop` 分支。

## 桌面应用

| 入口 | 实际功能 |
| --- | --- |
| Profile / Resume | 个人简介、能力和经历；Profile 可直接打开 Connect |
| Projects | 六个专业内容模块：Signal Lab、City Lens、Market Flow、Field Notes、Build Log、Source |
| Personal Atlas | 全部 47 张收藏图片，六类相簿，搜索、网格/列表、收藏、原图预览与下载 |
| Daybook | 日记时间线与逐篇阅读，不再使用通用照片网格 |
| Photography | 深色摄影工作台、大图浏览、底片条、键盘切换、收藏与下载 |
| Cinema | 影片详情、导演/时长/标签和本地待看清单 |
| Table Stories | 菜单式风味浏览和本地想吃清单 |
| Herding Cats | 与原版相同的 Unity 像素牧猫游戏；方向键/WASD 移动，Space 互动 |
| Music | iPod 播放器与 Billboard 2024 年终 Hot 100 前十官方试听；切歌、进度、音量及来源链接 |
| Field Notes | 本地备忘录；新建、编辑、搜索、导出、确认后删除 |
| Connect | 现有微信二维码与微信号复制；失败时明确提示；没有假发送的表单 |
| GitHub | 查看新站源码入口 |
| Little Companion | `Little Works` 体素建筑工地沙盘；机械、车辆、工人、昼夜、扬尘、暴雨及相机控制 |

- 单击桌面或 Dock 图标打开应用。
- 桌面图标可直接拖到任意位置，刷新后仍会保留；控制中心可重置默认布局。
- 所有桌面入口统一使用 76×76、16px 圆角图标框；Resume 与 Field Notes 使用不同图标。
- 参考版使用单个当前应用浮层：红色关闭；黄色、绿色及右上角主页按钮收起应用回到桌面。
- 点击桌面空白或按 Escape 也可收起当前应用；Dock 切换时不再堆叠多个窗口。
- 桌面支持标题栏拖动，不再提供与参考不一致的窗口缩放/最大化。收起保留应用状态，红色关闭则结束该实例。
- iPod 从显示屏拖动，关闭按钮位于机身下方；不会自动播放。
- 手机应用全屏显示，隐藏桌面菜单栏与 Dock；右上角主页按钮返回桌面。项目页底部左右按钮切换项目。
- 相册大图支持左右方向键、上一张/下一张、Escape 关闭，关闭后焦点返回原缩略图。
- 菜单栏可打开应用搜索、日历、控制中心；Cmd/Ctrl+K 也可打开应用搜索。
- 收藏、壁纸设置、备忘录只存于当前浏览器，**没有云同步**。笔记导出后可独立备份。
- Music 默认从榜单第一名开始且不自动播放。十首曲目使用 Apple/iTunes 官方试听片段和官方收听链接，
  不下载或打包未授权完整歌曲；榜单明确为 **Billboard 2024 年终 Hot 100 前十**，不是实时榜。

## Little Works 沙盘

在桌面打开 **Little Companion**。拖拽环视，滚轮或双指缩放；闲置 8 秒后镜头自动缓慢环绕。
底部控制台可调设备速度、暂停、昼夜、时刻、施工工序、镜头和扬尘，
Space 或“暴雨”按钮切换雨天。工序保持“自动”时，会循环播放约 210 秒的完整施工过程。
桌面模型前缘的三个实体旋钮也可点击，分别控制速度、昼夜循环和扬尘。

- Three.js r160、场景代码和许可证均内嵌在 `public/construction-sandbox.html`。
- HTML 不加载外部模型、图片、纹理、字体或脚本，可单独下载后在 Chrome 中离线打开。
- 工地几何、木纹和蓝图贴图均由代码生成；批量体素使用 `InstancedMesh`。
- 工地基座由 `22.5×16.5` 扩展到 `27.5×20.25`，总面积精确扩大 1.5 倍。
- 西侧后勤、北侧管线和东侧预制区按不同进度施工；远景使用 11 个低模实例，
  近景按距离切换至对应高模，并通过滞回区间避免反复闪烁。
- 楼体按基坑、基础、主体、封闭、验收逐层生成，脚手架会在收尾阶段拆除；
  完工后所有人员和设备退场，在扬尘遮罩下进入下一工期。
- 23 名黄帽普工和 5 名白帽监理按工序出现。巡检与搬运采用“行走、到位作业、
  返回、取料”的停靠节拍；腿和鞋围绕髋部前后摆动，停靠时回正，不会罗圈腿或原地自转。
- 外围 8 人不是装饰：分别负责门岗巡检、车辆引导、东西交通口、围挡维护、
  水电检查、南侧材料运输和道路巡查，并按对应工序上岗。
- 挖机、渣土车、搅拌车、塔吊和装载机只在所需阶段运行；装载机负责前期整平和后期清障。
- 三辆环线车辆和装载机始终保留在场景中；非作业车辆会空载回场或停靠，
  不会随工序切换突然消失。装载机使用阻尼平滑返回停车位。
- 装载机只让铲斗接触土堆边缘，卡车与照明杆经过完整交通周期净距扫描，
  板房人员路线也有占地侵入检测。
- 黎明、正午、黄昏、夜晚具有独立天空、主光、环境光、曝光和工地灯参数。
- 全景、街道、人员、塔吊四组镜头平滑切换；“人员”镜头用于近距离检查岗位和步态。
- 沙盘包含基坑、楼体、钢筋棚、物料区、板房、渣土区、道路、围挡、工人、机械和桌面工具。
- 运行检测入口 `window.__sandboxMetrics` 只读，用于记录版本、FPS、draw calls、实例和车辆间距。
- 目标是稳定 60FPS，但实际帧率取决于设备与浏览器；本轮 Metal/Chromium
  离线截图采样为桌面 59–60FPS、手机 59FPS。

## Herding Cats

桌面游戏已按 Macxfolio 原版替换为相同的 `Herding Cats` Unity WebGL 游戏。
使用方向键或 WASD 移动，Space 与猫和场景物品互动，把猫送进目标区域。

- 桌面窗口保持原版约 700×560 的黑色圆角容器和底部键位栏。
- 音效默认关闭，可在游戏左下角开启；旁边按钮进入全屏。
- 游戏来自原版使用的 `https://herding-cats-ten.vercel.app/`，因此运行时需要联网。
- 收起或切换应用会卸载游戏 iframe，避免 Unity 在后台持续占用 CPU；重新打开会重新开始。

## 图片与内容维护

| 内容 | 位置 |
| --- | --- |
| 六类收藏的标题、分类、图片 | `src/data/media.ts` |
| 原始图片，不改原文件 | `src/assets/` |
| 桌面图标、应用入口和默认位置 | `src/components/desktop/Desktop.tsx` |
| 桌面和窗口视觉样式 | `src/styles/desktop.css` |
| Profile | `src/components/desktop/ProfileApp.tsx` |
| 简历、项目、联系内容 | `src/components/PortfolioDesk.tsx` 中的内容组件 |
| 差异化收藏应用 | `src/components/desktop/CollectionApps.tsx`、`src/styles/collections.css` |
| 播放器与榜单数据 | `src/components/desktop/MusicApp.tsx`、`src/data/chart-music.json` |
| 工地沙盘源码与构建 | `sandbox/`、`scripts/build-sandbox.mjs` |
| 小猫桌面伙伴 | `src/components/desktop/CompanionCat.tsx` |
| 通用相册、笔记 | `src/components/desktop/GalleryApp.tsx`、`NotesApp.tsx` |
| 原版游戏接入 | `src/components/desktop/HerdingCatsApp.tsx`、`src/styles/herding-cats.css` |
| 原版小猫动画 | `src/components/desktop/CompanionCat.tsx`、`public/desktop/neko/` |
| 本地化壁纸和图标 | `public/desktop/` |
| 标题、分享卡片、favicon | `index.html`、`public/desktop-preview.jpg` |

旧 `/photos`、`/daily`、`/friend` 等路径会跳到相应桌面应用。
也可用 `/?app=atlas&collection=photos` 等查询参数直接打开应用。
旧页面源码保留以便回溯，但不再是当前路由的显示入口。

## 验证与构建

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

浏览器测试自动构建并启动 `127.0.0.1:4176`，结束后关闭测试服务。
覆盖桌面、手机、320px 小屏、768px 平板，以及小猫移动、差异化应用、榜单播放器、
沙盘渲染与控制、相册资源、窗口、保存和复制失败等交互。
日志、截图、Trace 和 HTML 报告保留在 `artifacts/`，不进入 Git。
最终审查使用 React Router 7.18.3、Vite 7.3.6 和 Vitest 4.1.11；
`npm audit` 为 0，Vitest 11 项和 Playwright 37 项通过。

```sh
npm run build
npm run preview -- --port 4174
```

生产产物在 `dist/`，不能直接用 `file://` 打开。
例外是 `dist/construction-sandbox.html`，它是专门生成的独立离线 HTML，可以直接双击打开。
部署到域名根路径时，在静态托管平台设置 SPA 回退：
存在的图片、字体、JS、CSS、音频照常提供；其他路径回退到 `index.html`。
根页面查询参数入口不依赖多级路由回退；旧路径刷新则需要平台配置。
如部署到 GitHub Pages 子目录，需要同时设置 Vite `base` 和平台回退后重新构建。

分享图片已随包提供；正式域名确定后，建议把 OG 图片设置为该域名下的绝对 URL。
本次完整改版提交到 `feat/macxfolio-desktop`，不直接改写远端 `main`。

## 备份与授权

开始前已把新旧仓库分别归档，包含 Git 历史；旧站还包含上一轮未提交改动和证据。
详见 `docs/BACKUP.md` 与 `docs/DELIVERY.md`。

桌面图标现已全部使用非个人照片的原生风格素材；49 张个人与收藏图片仍保留在应用内容中。
壁纸和原生图标来自用户提供仓库中已有素材与 Macxfolio 资源引用。
原始照片、游戏/电影/歌手图片和音轨均来自用户提供仓库。
源码交付不授予第三方商标、图片、字体或模板的额外权利，公开发布前应确认所持授权。
