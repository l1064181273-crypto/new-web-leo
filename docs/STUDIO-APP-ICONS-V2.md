# 两个可玩小世界的图标候选

本轮只新增图标候选，没有接入 Desktop，也没有覆盖旧图标或修改游戏。

## 设计取舍

两个图标共用 1:1 圆角底座、轻微立体边缘和向下投影，延续蓝色个人桌面的应用图标语境，但不描摹已有商标。

- **Little Works**：一座黄铜色塔吊加三层雾蓝小楼。主体轮廓取自分享卡的程序绘制工地图景，删去车辆、道路、工人、材料和多余细节，让 66 px 时仍可读出“工地”。
- **牧猫庭院**：真实游戏 `PixelCat` 橘猫加绿色草地。橘猫形状与颜色直接从组件静态渲染，外部只加极细叶绿色轮廓和投影，不另造一只不同的猫。
- 图标不放小字、数字、图表或装饰标签。主视觉承担识别，标签交给桌面原有布局。

色板为黄铜 `#E1B553`、深蓝 `#193D61`、雾蓝 `#ABC4D1`、橘猫 `#D99554`、庭院绿 `#92AF78`、深叶 `#345943`。说明板字体为 Avenir Next 与 Hiragino Sans GB；图标本体不依赖字体。

这是按 frontend-design 的“单一记忆点”原则做的提炼：两个场景均缩为一个大主体，材质只做辅助，不把桌面图标做成难辨认的小截图。

## 文件与检查尺寸

正式候选路径（均为新文件）：

- `public/desktop/studio-little-works.svg`
- `public/desktop/studio-little-works.png`：512 × 512，透明外边缘。
- `public/desktop/studio-cat-garden.svg`
- `public/desktop/studio-cat-garden.png`：512 × 512，透明外边缘。

检查材料在 `artifacts/studio-app-icons/`：

- 每个图标独立的 256 × 256 与 66 × 66 PNG。
- `studio-app-icons-comparison.png`：在原桌面壁纸上并列展示 256 px 与实际 66 px。
- `report.json`：输出尺寸、SHA-256、渲染器版本及全部原桌面素材的只读散列。

## 复现

```sh
node scripts/build-studio-app-icons.mjs
```

脚本使用项目已安装的 esbuild / React / ReactDOM 和已有 Sharp，不安装依赖、不联网。Sharp 优先从 `STUDIO_ICON_SHARP_MODULE` 获取，其次项目包，最后 Codex 的本地捆绑运行时。其他环境可以设置已安装路径：

```sh
STUDIO_ICON_SHARP_MODULE=/absolute/path/to/node_modules/sharp node scripts/build-studio-app-icons.mjs
```

脚本检查所有已有 `public/desktop/` 与 `src/assets/optimized/` 直接文件，以及 PixelCat 源码散列均不变。旧图标、其他 App、Desktop 和元数据都不在生成器输出范围内。是否接入由主任务视觉验收后决定。

## 本轮验证

- 已查看两个 512 px PNG 和原壁纸上的 256 / 66 px 对照图；塔吊、小楼、橘猫在小尺寸仍有清楚轮廓。
- 首轮视觉检查修正了工地基础板的绘制前后顺序，避免遮住底层柱子；没有增加小细节噪声。
- 正式 PNG 均为 512 × 512，带透明外边缘；重复生成得到同样的像素散列。
- Little Works：62,212 字节，SHA-256 `f01eb6097ee369cd4e8cb253b4df923f9caa4ecbc7842e8d985385666269a4a9`。
- 牧猫庭院：44,493 字节，SHA-256 `79bc58890be8efb9c06859d7b21e893e0fda44c303e027c124ffed6ec8c940ee`。
- 生成脚本 scoped ESLint 通过；原桌面素材与游戏源文件未改变。
