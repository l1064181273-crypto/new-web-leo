# 小猫、收藏应用、榜单音乐与沙盘修订

## Findings

- 原桌面小猫只是固定 GIF，没有移动逻辑。本轮改为 Canvas 像素猫：跟随鼠标、闲置游走、
  点击跳跃；应用打开或页面隐藏时暂停，组件卸载时清理 RAF 和监听器。
- Daybook、Photography、Cinema、Table Stories 原先都复用通用照片网格。
  现在分别采用日记、摄影工作台、电影资料库和菜单式风味收藏交互。
- Music 原先只有一首本地 Lo-fi。现在增加 Billboard 2024 年终 Hot 100 前十，
  使用 Apple/iTunes 官方试听片段与官方页面，不分发完整商业歌曲。
- Little Companion 改为 `Little Works` 体素建筑工地沙盘。

## 沙盘实现

- Three.js r160 通过 npm 别名锁定，由 esbuild 内嵌到单个 HTML；无 CDN、模型、图片或字体请求。
- 2174 个实例化体素，包含基坑、楼体、钢筋棚、板房、物料、渣土、围挡、道路和桌面工具。
- 两台挖掘机、两台塔吊、两辆渣土车、一辆搅拌车、装载机和 28 名工人持续运动。
- 车辆使用封闭折线路径、独立装卸停靠状态和路径切线转向；120 秒全周期采样最小间距 11.8，
  越界样本为 0。
- 自定义 ShaderMaterial 生成扬尘和灯光光晕；暴雨使用 1400 条程序化雨线，并按屋顶高度截断。
- 支持拖拽环视、缩放、闲置环绕、实体旋钮、HTML 控制台、Space 暴雨和父窗口收起暂停。

## 验证

| 检查 | 结果 |
| --- | --- |
| 独立 HTML | 531331 bytes，SHA-256 `c157e9b286e6d3d60a5ec2351b7b919240786baa84027b4d3a137373867b98b8` |
| 外部请求 | 断网 `file://` 启动，请求数 0 |
| Three.js | `window.__sandboxMetrics.revision === "160"` |
| GPU 实测 | macOS / Chromium / ANGLE Metal，桌面与 390×844 均为 59FPS 样本 |
| 渲染规模 | 2174 instances，约 28.9K triangles，日间约 123 draw calls |
| 车辆约束 | 120 秒状态机采样最小间距 11.8，越界 0，运行指标碰撞计数 0 |
| 交互回归 | 桌面/手机 32 通过，2 个按设计跳过，0 失败 |
| 单元测试 | 14 通过 |
| TypeScript / Build | 通过 |
| ESLint | 0 错误，7 条既有 Fast Refresh 警告 |

截图及机器可读指标在 `artifacts/sandbox-v3/screenshots/`。浏览器回归报告在
`artifacts/playwright-report/index.html`。这些数据是当前测试设备的实测值，
不承诺所有设备固定 60FPS，也不把离散采样描述为形式化的全几何碰撞证明。

## 音乐来源

榜单来源为 Billboard 发布的 2024 年终 Hot 100 前十；页面中显示完整年份和来源链接。
十个试听 URL 在交付前均返回 HTTP 206 和音频内容类型。原始 iTunes Search API 返回保存在
`artifacts/sandbox-v3/music/`。`Espresso` 已校正为原版 track ID `1752214923`。

## Safety Cleanup

- v3 开始前归档与 SHA-256 见 `BACKUP.md`；旧站、旧交付包和原始图片均未覆盖。
- 没有 API 密钥、用户数据上传、分析追踪、自动提交、推送或公网发布。
- 独立 HTML 内含 Three.js MIT 许可证；商业歌曲只使用官方试听和外链。
