# Studio V2 · 独立部署审查

日期：2026-09-12。对象：本地 `studio-v2-20260912` 工作区，功能版基线 `7647e03ef46dcb951977fa15136d0d33a49c4fd0`。本报告没有执行推送、发布或线上修改，也不是整站 V2 的浏览器验收结论。

## 结论

根路径 `/` 与项目子路径 `/new-web-leo/` 的独立生产构建均通过，未发现已验证的 BASE_URL 或静态资源阻塞。初次审计列出的分享图、README 和音乐来源文案问题已由主任务在后续更新中处理，见文末复核。发布前仍需明确正式域名与托管方式、配置页面回退与静态资源缓存，并确认素材授权范围。

这些是审计时刻的构建快照；其他成员继续修改共享源码，最终候选版本应重新构建和验收。

## 已执行的检查与证据

两份产物均在独立临时目录生成，没有覆盖项目的共享 `dist`：

| 项目 | 根路径产物 | 子路径产物 |
| --- | --- | --- |
| base | `/` | `/new-web-leo/` |
| 目录 | `<temporary-directory>/leo-deploy-root-UCAMT3` | `<temporary-directory>/leo-deploy-subpath-vT9hgW` |
| 核查的资源文件 | 269 | 269 |
| manifest 条目 | 209 | 209 |
| public 文件逐字节相同 | 56 | 56 |
| 收藏原图逐字节相同 | 45 | 45 |
| 静态资源错误 | 0 | 0 |

新增只读检查脚本 `scripts/smoke-static-build.mjs`，覆盖 manifest 依赖、CSS URL、JS 中具体资源路径、index 资源与 BASE_URL 转换、分享图片、public 复制一致性及收藏原图 SHA256。`import.meta.glob` 留下的 `/src/assets/...` 对象键只是索引身份，不作为网络请求误报。脚本有意硬性核对当前 45 张目录原图，未来若主动改目录需复核预期值。

两份构建均未包含已明确删除的 `daily-1.jpg` 和 `photo-12.jpg`，初始 HTML/CSS 未发现外部资源来源。此结果不表示应用后续的音乐试听等功能没有外部请求。

每份产物均在临时 loopback HTTP 服务检查过：首页、`?app=notes`、旧 `/photos` 路由、入口 JS、CSS、图标、背景 MP3、独立沙盘 HTML、robots.txt，状态均为 200 且 MIME 类型符合预期。MP3 `Range: bytes=0-31` 返回 206 和 32 字节，完整长度 4,711,235 字节。服务测试完成后已关闭，没有进行浏览器脚本执行或线上探测。

负向对照：用 `/` 错误检查子路径产物时，脚本以非零状态退出并报告 195 个路径错误，证明不是无条件通过。

沙盘编译另在内存中重现并比对，没有调用会重写共享 public 文件的构建任务：当前独立 HTML 与来源一致，625,185 字节，SHA256 `5915c49e28f17a59a998e9a9a9184ef04b7a804e1415e4c53d62503855ce6df9`；含 Three.js r160 MIT 声明。后续沙盘修改会改变这些快照值。

## 初次审计的发布前事项（后续状态见文末）

### 1. 域名、分享卡片与文档

- `index.html` 的 `%BASE_URL%` 能正确转换，活动 favicon 是 `desktop/about.png`（256 × 256 PNG），两种路径均可访问。旧 `public/favicon.ico` 不是当前引用。
- `og:image` / `twitter:image` 目前仍是路径，缺少 canonical 与 `og:url`。先明确实际公开 origin，再填写完整 HTTPS 分享地址；本次没有猜测域名。一次无认证的 GitHub 公开仓库信息查询被限流，没有重试认证或读取凭据。
- `public/desktop-preview.jpg` 是 1440 × 900 的旧版 9 月 9 日桌面图，仍含 Arcade 与旧 Notes 图标。应在新版视觉验收后生成新的真实分享截图。
- 根 README 仍写旧版图片数量（49 / 47）、已发布分支、旧 iPod 窗口行为、旧 Profile/Notes 路径与测试数量，以及 Unity-only 的游戏说明。当前收藏目录是 45 项，V2 仅在本地，不应沿用旧发布声明。此报告没有编辑根 README 或 index。

### 2. 托管路由、缓存与发布方式

- 仓库未发现 `.github`、Netlify、Vercel、NGINX、redirect 或 404 托管配置。`BrowserRouter` 已使用 `basename={import.meta.env.BASE_URL}`，但客户端配置不能代替服务器回退。
- 九条旧干净路径需托管端回退到对应 base 的 index：`/photos`、`/friend`、`/daily`、`/study`、`/photography`、`/gaming`、`/music`、`/film`、`/food`。`/?app=...` 根页面查询链接无需此类干净路径回退。
- 建议静态文件优先匹配、缺失的 JS/CSS/媒体真实返回 404，只有页面路径执行 SPA fallback。本次 Vite preview 对缺失 JS 返回了 200 HTML，这是 preview 的行为，不是已选线上平台的证明。
- 建议 index 可重新验证、带内容哈希的资源长期 immutable 缓存，未带哈希的 public 文件采用可更新策略；原子发布并保留上一版哈希资源，减少已打开页面动态加载旧资源失败。AppBoundary 能接住懒加载 APP 错误，但不能修复入口脚本尚未启动的失败。
- preview 响应的 `no-cache` 不是生产缓存配置的验收结果。
- `robots.txt` 允许抓取；部署在子路径时它会复制在项目子路径，爬虫通常读取的是站点根 `/robots.txt`。域名未确定前不生成假 canonical 或 sitemap。
- 同一 origin 的不同路径共享 localStorage。对比旧版与新版最好使用独立预览 origin，避免把路径隔离误认为数据隔离。本次没有重命名存储键或重构同步方式。

### 3. 来源与使用许可

- Studio Source 保留 Macxfolio、现有素材与官方试听来源，并如实说明 V2 尚未发布。音乐来源说明建议覆盖本地片段，例如“音乐包含标明来源的官方试听和原站附带背景音片段”；本报告未自行修改该模块。
- 个人、电影、歌手、游戏、食物图片均保留自用户提供仓库，目前无逐文件作者与许可清单。影片百科链接只证明资料出处，不能证明海报授权。
- 部分桌面图标可从旧 `PortfolioDesk.tsx` / `scripts/prepare-assets.mjs` 追溯到 Framer 或 WebNeko；可追溯来源不等于获得使用许可。
- Apple/iTunes 与 Billboard 来源以 HTTPS 链接说明；本地 MP3 的作者和许可证尚未记录，不能声称拥有完整音乐授权。
- Manrope 依赖附带 SIL OFL 1.1 声明（2019 Manrope Project Authors）；本次未完成字体二进制与全部发布义务的专项审计。独立沙盘的 Three.js r160 MIT 声明已核对。
- 未发现仓库级许可证；没有擅自赋予项目或媒体 MIT 等许可。

### 4. 历史素材迁移脚本

`scripts/prepare-assets.mjs` 会递归导入旧 `../lhn/src/assets` 下的图片。它不属于常规 build，但手工重跑可能重新引入 `daily-1.jpg` / `photo-12.jpg`，随后当前媒体 glob 可将其发到构建产物，即使目录条目未引用。本次两份产物均确认没有恢复这些图片；发布流程不要误调用该历史迁移脚本。是否弃用该脚本留待维护者确认。

## 复现方式

在当前工作区、既有依赖已安装的条件下执行。两个输出目录由 `mktemp` 创建，不覆盖共享 `dist`：

```sh
LEO_ROOT_AUDIT_DIR=$(mktemp -d -t leo-deploy-root)
./node_modules/.bin/vite build --outDir "$LEO_ROOT_AUDIT_DIR" --manifest --base /
node scripts/smoke-static-build.mjs "$LEO_ROOT_AUDIT_DIR" / --preview

LEO_SUBPATH_AUDIT_DIR=$(mktemp -d -t leo-deploy-subpath)
./node_modules/.bin/vite build --outDir "$LEO_SUBPATH_AUDIT_DIR" --manifest --base /new-web-leo/
node scripts/smoke-static-build.mjs "$LEO_SUBPATH_AUDIT_DIR" /new-web-leo/ --preview
```

普通 `npm run build` 会先重新生成 `public/construction-sandbox.html`。上面的独立 Vite 构建直接使用 public 内的既有独立沙盘；本轮已额外证明当时 public 与来源相同。如果沙盘来源后来有更新，应由负责成员生成最新文件后再复现构建，而不是把过期 public 的成功复制当成最新沙盘验收。

## 边界

未发布、未推送、未配置域名、未使用生产凭据；没有更换图片、下载外部媒体、设置作品许可或改写根文档。静态分析无法覆盖所有运行时拼接 URL，loopback HTTP 也不等于真实浏览器或 CDN 行为。最终上线仍需所选服务商的实际 HTTPS、页面直达、缓存、音频 Range、资源 404 和分享抓取验证。

## 后续复核 · 2026-09-13 00:14

共享存储防覆盖、收藏焦点与音乐回归完成后，又在独立目录 `<temporary-directory>/leo-reliability-build.1DnNYRW6FD` 生成了一份根路径生产构建：274 个核查资源、209 个 manifest 条目、61 个 public 文件、45 张逐字节相同的收藏原图，静态错误仍为 0。新增 public 文件来自主任务同时进行的新版分享封面等内容。本审计没有覆盖共享 dist。

该新产物的 loopback MIME、首页/query/旧路径和 MP3 Range 检查再次通过。它仍只是本地 preview；缺失静态 JS 的 200 HTML 回退警告、正式 HTTPS origin/canonical/og:url 与生产托管配置待定的边界不变。

已确认主任务完成的初次审计项：

- 根 README 现在介绍 Studio V2、本地分支、未推送/未发布状态、45 张收藏原图与122个缩略图、完整 APP 功能，以及真实的部署前检查；不再沿用旧已发布/旧测试数量陈述。
- 当前 OG/Twitter 图引用 `%BASE_URL%studio-preview-v2.png`，构建后路径正确，声明 1200 × 630 及“设计合成封面”的 alt。旧 `desktop-preview.jpg` 仍是保留的历史文件，但不再是活动分享图。
- Studio Source 现已明确音乐包括官方试听与原站附带背景音片段。
- 本地状态已增加写前原文基线核对和冲突临时模式。它不是自动同步或事务性并发存储，具体边界与测试见 `COLLECTIONS-STUDIO-V2.md` / `FIELD-NOTES-STUDIO-V2.md`。

这些更新由各负责成员实现；部署审计仍未推送、发布、更改线上配置或赋予素材新许可。

## 最终资源复核 · 2026-09-13 00:54

本轮对主任务正在验收的 `artifacts/studio-v2-production` 做只读检查，另直接调用 Vite 创建 `artifacts/studio-v2-subpath-final`。没有运行 `npm run build` 或任何会写入 `public/` 的生成器，没有覆盖根路径快照、共享 `dist`、4189 预览、README 或根级 QA 文档。

### 根路径与子路径

| 检查项 | 根路径 `/` | 子路径 `/new-web-leo/` |
| --- | ---: | ---: |
| 产物目录 | `artifacts/studio-v2-production` | `artifacts/studio-v2-subpath-final` |
| 文件总数（含 index / manifest） | 275 | 275 |
| smoke 核查资源 | 273 | 273 |
| manifest 条目 | 208 | 208 |
| public 文件逐字节一致 | 61 | 61 |
| 45 张收藏原图逐字节一致 | 45 | 45 |
| 静态资源错误 | 0 | 0 |
| 全产物磁盘字节数 | 31,992,618 | 31,995,025 |
| 入口静态 JS + CSS 依赖链字节数 | 554,348 | 555,152 |
| 上述文件分别 gzip 后的字节数合计 | 168,730 | 168,792 |

入口链依据 manifest 的静态 `imports` 与 `css` 递归计算，包含入口 JS、入口 CSS、React 和 motion 四份文件，不包含动态 APP、图片、字体、音频。gzip 使用本机 Node `gzipSync` 默认设置；它不是已经测得的服务器传输量或首屏总下载量。约 32 MB 的整个发布目录也不是每次打开页面必定下载的体积：其中保留的 45 张原图占 14,744,768 字节，122 个缩略图占 7,644,589 字节；原图与缩略图并存是本轮保留原素材的结果。

两份产物再次通过临时 loopback HTTP 检查：首页、query 链接、旧 `/photos` 路径、入口 JS/CSS、图标、背景 MP3、沙盘 HTML、robots.txt 均为 200 且 MIME 类型正确；MP3 `bytes=0-31` 返回 206 和 32 字节。临时服务已关闭，没有占用或修改主任务的 4189 服务。

### 新图标与分享封面

编译后的 JS / index 中实际引用以下路径，并在两个 base 上分别做 HEAD 检查，均为 200，Content-Type 与 Content-Length 正确；各文件与 `public/` 同名源文件的 SHA-256 一致。

| 资源 | 根路径实际引用 | 子路径实际引用 | 字节数 / MIME |
| --- | --- | --- | --- |
| Little Works SVG | `/desktop/studio-little-works.svg` | `/new-web-leo/desktop/studio-little-works.svg` | 10,462 / `image/svg+xml` |
| 牧猫庭院 SVG | `/desktop/studio-cat-garden.svg` | `/new-web-leo/desktop/studio-cat-garden.svg` | 7,622 / `image/svg+xml` |
| OG / Twitter 分享 PNG | `/studio-preview-v2.png` | `/new-web-leo/studio-preview-v2.png` | 561,773 / `image/png` |

分享 PNG 的真实 IHDR 尺寸为 1200 × 630，SHA-256 `ddd6fb444b00c3f0e441f0f4cc460e3e452f555d26bb2276001dae6ec299ac3b`。元数据 alt 明确是“设计合成封面”，没有将其说成浏览器实机截图。图标目前使用 SVG，512 px PNG 候选也随 public 保留，并非另一次必须加载的桌面图片请求。

### 原素材、交通与模型保护

- 正确功能版基线仍为 `new-web-leo-feature-review` 的 `7647e03ef46dcb951977fa15136d0d33a49c4fd0`；本轮结束时该工作树干净。
- 45 张收藏原图不仅与两份产物匹配，还逐一与功能版基线匹配。两张已移除的 `daily-1.jpg` / `photo-12.jpg` 未回到发布 manifest。
- 基线 `public/desktop/` 下 **49 个文件（含子目录）全部保留且逐字节相同**；两枚新图标没有覆盖旧图标。
- 原版和 V2 的 `sandbox/traffic.js` Git blob 仍同为 `2b62e56395f30f38455c18a5366417d63a52db87`。
- 使用前两轮相同模型边界，排除已记录的矩阵上传缓存和 canvas 聚焦语句后，模型主体仍有 **60,106 字节与基线逐字节一致**，SHA-256 `b534fae6b418c4c81d697e4080a833f597cbf0c4a1c983e1ff538d8a965ed77f`。
- 独立沙盘在内存中按现有构建流程重新编译、验证脚本语法后，与 public HTML 完全相同：**625,990 字节**，SHA-256 `f766726ad36f6d0745278f36856a02330e0da89347d9bd60e1d9b77d3026b7be`，编译器报告外部 imports 为 0。本检查没有将内存结果写回 public。
- 对 `public/`、`sandbox/`、`artifacts/studio-v2-production/` 的完整排序文件路径与内容散列清单再做 SHA-256，审计前后均一致；根路径快照的清单摘要为 `97369724844bd580a8f0e1cae92d7d97042465c741690b670f3aad4d05cfcdd5`。

### 实际外链边界

HTML / CSS 资源检查未发现远程来源；进一步解析两份生产 JS 的字符串后，实际应用相关外链为：

- `audio-ssl.itunes.apple.com`：10 个官方试听音频地址。音乐 APP 声明 `preload="none"`，但会在初始化/选曲时设置 `src` 并调用 `load()`；实际音频获取受浏览器媒体策略影响，试听依赖联网，不能将整站说成“零外链”。
- `herding-cats-ten.vercel.app`：保留的原版 Unity 游戏，只有用户点击“载入原版游戏”才创建该 iframe；本地牧猫庭院不依赖它。
- `music.apple.com` 10 条官方收听页、Billboard 1 条榜单来源、Wikipedia 6 条影片资料、GitHub 2 条个人/仓库链接、Macxfolio 1 条致谢链接，属于用户可打开的外部网页。
- JS 中的 W3C XML 命名空间、React 错误说明地址和 React Router 的 `http://localhost` URL 解析兜底是库字符串，不能仅因字面上是 URL 就计为隐含网络请求。

旧源码里的 Google Fonts、Framer 图片和 WebNeko 等引用不等于当前页面会请求它们。本轮实际检查的生产 JS/CSS 不含 `fonts.googleapis.com` 或 `framerusercontent.com`；初始 HTML/CSS 也没有外链资源。以上是生产产物静态分析及本机 HTTP 资源验证，不是浏览器全时段网络抓包；未对第三方站点发起可用性探测，不能保证外部试听或 Unity 服务永久可用。

### 仍需正式发布环境确认

本轮没有新增阻塞，既有发布边界仍有效：正式 HTTPS origin / canonical / `og:url` 未确定，OG/Twitter 图片目前是正确的 base 路径而非完整 HTTPS URL；9 条旧页面路径需要托管端 SPA fallback；子路径的 robots 文件不代替站点根 robots。Vite preview 对不存在的 JS 仍返回 200 HTML，正式主机应只对页面回退、对缺失静态资源返回真实 404。素材授权、生产缓存、HTTPS 和分享爬虫行为仍不能由本机快照代为验收。

本轮复现命令：

```sh
node scripts/smoke-static-build.mjs artifacts/studio-v2-production / --preview
./node_modules/.bin/vite build --base=/new-web-leo/ --manifest --outDir artifacts/studio-v2-subpath-final
node scripts/smoke-static-build.mjs artifacts/studio-v2-subpath-final /new-web-leo/ --preview
```

子路径目录是本轮新建的独立快照；以后复现如要保留此快照，请选择新的输出目录。没有推送、发布、线上配置变更或生产凭据操作。

## 原版与备份保留复核 · 2026-09-13

本轮只读核对原目录、既有归档和 V2 当前收藏源文件，没有提取或修改备份，没有构建、运行生成器或写入 `public/`。本节是保留性审计，不是当前候选版本的生产构建验收。上文 00:54 的根路径与子路径产物仍只是当时的历史快照，不包含后续徽章、游戏可读性、桌面及下载等修改；主任务将独立生成并验收新的交付产物。

### 原目录

两份原目录执行 `git status --porcelain=v1 --untracked-files=all` 均无输出，工作树干净：

| 原目录 | 当前分支 | HEAD |
| --- | --- | --- |
| `../leo-homepage-review` | `macos-github-migration` | `4232d958b083c1c9be8ef3f98310a5c111d1a2a0` |
| `../new-web-leo-feature-review` | `feat/macxfolio-desktop` | `7647e03ef46dcb951977fa15136d0d33a49c4fd0` |

第一份是计划中的旧 main 来源工作区，实际本地分支名为 `macos-github-migration`；没有为使名称一致而切换或改名。第二份仍是包含现有沙盘和游戏的正确功能版基线。

### 备份归档

以下归档均位于维护者单独保留的 `<local-backup-directory>/`，不随源码发布。重新计算的 SHA-256 与本地备份计划记录逐字一致：

| 归档文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `new-web-leo-original-20260912-1623.tar.gz` | 204,591,438 | `cc522ffdc61ce471622d6e5f266db905740b42892ec70e88671ecdf1713406a8` |
| `new-web-leo-feature-original-20260912-1628.tar.gz` | 50,801,304 | `ff0a3d1484cc182e504c86c0a8bc52003f08b3214b377d6d126d6adaeecfaa10` |

该检查证明当前归档与初始记录相同；没有解压或进行恢复演练，不把哈希一致扩大表述为所有恢复场景已验证。

### 收藏源文件

- 从 V2、功能版原目录与 `git show 7647e03ef46dcb951977fa15136d0d33a49c4fd0:src/data/media.ts` 三处读取目录，均为 **45 个唯一图片路径**，路径集合完全一致。
- 45 张 V2 原图逐张与功能版原目录的文件及上述提交对应的 Git blob 比较，**45 / 45 / 45 全部逐字节相同**，合计 **14,744,768 字节**。
- 按文件名排序的 `相对图片名 + NUL + SHA-256` 清单，以换行连接后再做 SHA-256，摘要为 `33534fbebdd1d6e69c97aa77e8f4a639c4a91dd694a1336a661c88dd5e913465`。
- 当前 `src/assets/`（含缩略图子目录）、`public/` 和收藏目录均没有重新出现 `daily-1.jpg` / `photo-12.jpg` 或对应命名衍生文件；功能版基线的对应路径也不存在。
- 这一轮不检查旧 `dist/` 或历史 `artifacts/` 是否代表当前版本，也未把这些目录重新认定为最终生产产物。
