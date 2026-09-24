# Haonan Li · Personal Desktop

一张可以打开小世界的私人桌面：摄影、音乐、电影、生活手记，以及工地沙盘和像素猫咪庭院。介绍一个人，也展示用 AI 协助把想法做成可玩作品的过程；不是求职落地页。

沿用[原仓库](https://github.com/l1064181273-crypto/new-web-leo)的内容、蓝色桌面与 [Macxfolio](https://macxfolio.framer.website/) 的桌面隐喻。使用 React、TypeScript、Vite、Three.js 和本地浏览器存储。

## 本地运行

需要 Node.js 22.12+：

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4189
```

打开终端显示的 Local 地址。修改 `sandbox/` 后，重新执行 `npm run build:sandbox` 并刷新沙盘。正式构建使用 `npm run build`，产物在 `dist/`；用 `npm run preview` 通过 HTTP 预览主站。

## 从哪里开始逛

| APP | 内容 |
| --- | --- |
| Profile / Resume | 个人介绍、背景与日常兴趣 |
| Projects | 两件可玩作品、三篇创作手记与四组观察小页 |
| Little Works | 九段工序的建筑工地，最终成为完整的小写字楼 |
| Herding Cats | 本地三关「牧猫庭院」，另保留主动载入的原版 Unity 入口 |
| Personal Atlas | 45 张收藏、六类相簿、搜索、收藏与原图查看 |
| Photography | 主题筛选、底片条与大图浏览 |
| Daybook | 生活手记、月份筛选与书签 |
| Cinema / Table Stories | 影片与风味收藏、分类筛选和本地清单 |
| Music | iPod 试听台、固定榜单与原站 Lofi 背景音 |
| Field Notes | 便签、搜索、置顶、最近删除、文本导出与 JSON 备份/导入 |
| Connect / GitHub | 联系方式、源码与创作说明 |

单击桌面图标打开 APP，Cmd/Ctrl+K 搜索。红色按钮关闭、黄色按钮收起、绿色按钮放大/还原；小房子返回桌面。宽屏支持图标拖动，窄屏自动排列，手机应用全屏显示。搜索、指南和图片查看器有独立键盘焦点管理。

支持 `/?app=games`、`/?app=notes`、`/?app=atlas&collection=photos` 等直接入口。沙盘沿用 `/?app=cats` 这个旧 ID；旧 `/photos`、`/daily`、`/gaming` 等路径保留跳转。

## Little Works · 工地手札

保留机械、车辆、工人与交通约束，扩展到 11 个分区。九段工序从基坑、基础、结构施工推进到封顶、粉刷、门窗、装修和交付。完成后呈现三层小写字楼：立面、落地窗、入口、室内设施与屋面设备逐步就位。

- 自动施工一轮约 270 秒，交付状态停留约 27 秒；也可手动定位工序。
- 调整镜头、光线、天气、扬尘、速度与画质；支持全景、导览和设备图鉴。
- 场景暂停与后台停止推进；可保存观察，恢复时先暂停。
- 导出 PNG，或下载内嵌 Three.js 与许可证、无外部资源依赖的独立 HTML。
- 使用实例化、静态细节与距离分级控制扩建成本，不承诺所有设备达到固定帧率。

拖动旋转，滚轮或双指缩放。聚焦场景后：空格暂停，方向键旋转，`+ / −` 缩放，`0` 全景，`1–9` 工序，`R` 雨天，`H` 手札。

`public/construction-sandbox.html` 由 `sandbox/` 生成，不要直接编辑生成文件。这是压缩工序的视觉创作，**不是工程仿真或施工指导**。技术细节见[写字楼完成阶段](docs/SANDBOX-OFFICE-V4.md)与[工地扩建](docs/SANDBOX-EXPANSION-V3.md)。

## 牧猫庭院

本地 SVG 像素游戏有「阳光门廊」「绣球小径」「雨后花园」三关，包含呼唤、不同性格的猫、钥匙与门。点击格子自动寻路，也支持方向键/WASD和屏幕按钮；Space 呼唤，P/Esc 暂停。

慢慢逛不设失败压力；步数挑战记录成绩、星数与解锁进度。切出应用、隐藏页面或失去焦点后暂停，回来需主动继续。未知版本存档不会被覆盖；相同版本多标签游玩采用最后写入，不提供自动合并。

原版 [Herding Cats](https://herding-cats-ten.vercel.app/) 是独立的第三方 Unity 游戏，需要主动点击后联网载入。本站未修改其内核或关卡；切出后卸载 iframe，进度与可用性由原版决定。

## 数据、网络与素材

收藏、桌面布局、壁纸、便签和本地游戏进度保存在当前浏览器来源内，**没有云同步，也不会发给作者**。换域名、端口或浏览器不会自动迁移；清理站点数据会清除记录。

便签支持软删除恢复，永久清理需确认；导入先校验再合并。检测到其他标签页修改时，会保留当前编辑并提示冲突，但不保证同时写入的事务隔离，重要内容建议只在一个标签页编辑并定期导出。便签及备份均为明文，不适合保存密码、密钥或敏感资料。

Music 不自动播放，榜单是 Billboard 2024 年终 Hot 100 前十的固定收藏，使用 iTunes 试听片段，并非实时榜单或完整歌曲。外部试听和 Unity 会与对应服务通信。主站不是离线 PWA；本地游戏不依赖第三方网络，不代表整站有离线缓存。

45 张原图仍保留，新缩略图与派生图标没有覆盖原素材。已移除的两张个人照片没有恢复。第三方图片、图标、壁纸、背景音、游戏与库遵循各自权利和许可证；本项目不授予额外使用授权。更多见[安全与隐私](docs/SECURITY-PRIVACY-STUDIO-V2.md)。

## 维护与检查

主要入口：

- 个人内容：`src/components/desktop/StudioProfile.tsx`、`StudioAbout.tsx`
- 桌面与窗口：`src/components/desktop/Desktop.tsx`、`window-state.ts`
- 作品：`src/components/desktop/WorkshopApp.tsx`、`src/components/cat-game/`、`sandbox/`
- 收藏目录：`src/data/media.ts`、`collection-stories.ts`
- 便签：`src/components/desktop/StudioNotes.tsx`、`notes-model.ts`

```sh
npm run typecheck
./node_modules/.bin/tsc --noEmit -p e2e/tsconfig.json
npm run lint
npm test
npm run build -- --manifest
node scripts/smoke-static-build.mjs dist / --preview
```

本轮实测结果及未覆盖边界见[发布检查记录](docs/RELEASE-CHECK-2026-09-24.md)。单元测试、浏览器验收与独立 E2E 套件分别记录，不混用通过数字。

`scripts/prepare-assets.mjs` 是依赖旧站目录的历史迁移工具，不属于安装或发布步骤，可能重新拷入已移除的素材。图标生成器也是可选工具，需显式配置 `LEO_ICON_IMAGE_ENDPOINT`；正常安装和构建不调用上述脚本。

## 部署

提交到 GitHub 不等于已部署。正式托管需要单独核实域名、HTTPS、静态资源缓存和 SPA 回退；缺失的 JS/CSS/图片应返回 404，而不是 HTML。确定真实域名后再填写 canonical、`og:url` 和分享图的绝对地址。

若托管在仓库子路径，按该路径重新构建：

```sh
npm run build -- --base=/new-web-leo/ --manifest
node scripts/smoke-static-build.mjs dist /new-web-leo/ --preview
```

独立沙盘的 HTTP 渲染、无外部依赖检查与下载后 `file://` 运行是不同验证项目，详见发布检查记录。原版保留在 Git 历史中，修改前另有本地源码备份；本次更新不重写历史。
