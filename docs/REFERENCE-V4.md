# 原版交互回归修订

## 对照结果

公开原版 `https://macxfolio.framer.website/` 已重新实测：

- 桌面伙伴使用 WebNeko `lucky` 系列 32×32 像素动画。
- Music 打开后只有一台约 200px 宽的 iPod，不带右侧歌曲列表。
- 游戏入口为 `Herding cats`，打开约 700×560 的 Unity WebGL 游戏。
- 游戏说明为方向键/WASD 移动、Space 互动，把猫送进目标区域。
- 原版游戏 iframe 指向 `https://herding-cats-ten.vercel.app/`。

截图和运行信息位于 `artifacts/reference-v4/`。

## 本轮修改

- 本地化原版使用的 32 个 WebNeko 动画帧，按八方向移动、抓挠、舔爪、打哈欠和睡眠切换。
- Music 恢复单 iPod 构图；上一首/下一首按钮切换 10 首榜单音轨，去掉右侧榜单栏。
- Herding Cats 使用原版同一公开 Unity 游戏地址，窗口尺寸、黑色底栏和键位提示与原版一致。
- 工地车辆轮胎改为独立车轴组：车身转弯负责航向，轮胎只绕横向车轴滚动，停车时停止。
- 桌面图标统一为 76×76、16px 圆角容器；位置可拖动、持久化并从控制中心重置。

## 运行边界

Herding Cats 与原版一样依赖外部 Unity 服务，断网时无法运行；站点不会复制未声明许可的
Unity 构建文件。Music 的榜单试听仍来自 Apple/iTunes 官方试听地址。
