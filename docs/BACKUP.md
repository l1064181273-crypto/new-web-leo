# 改动前备份

## 隔离目录

- 旧站及上一轮修改：`<local-workspace>/lhn`
- 本轮新站：`<local-workspace>/new-web-leo`
- 备份目录：`<local-workspace>/site-backups/20260909`
- v3 备份目录：`<local-workspace>/site-backups/20260910`
- v10 备份目录：`<local-workspace>/site-backups/20260911`
- 新站基线 commit：`4232d95`
- 本轮工作分支：`feat/macxfolio-desktop`

`<local-workspace>` 是维护者的本地工作目录占位，不是仓库路径。备份保留在本地，未随源码发布；恢复时使用实际保存位置。

本轮未覆盖旧站，未对任何原始图片做裁剪或内容修改。原图保留在新站 `src/assets/` 中。
备份在安装新站依赖、修改新站源代码之前完成。

## 归档校验

| 文件 | SHA-256 |
| --- | --- |
| `leo-homepage-before-migration.tar.gz` | `10a37e0ca8a7382e613f2d845c0d87c2a4f1319ebea25fb6c486e2a069971f2f` |
| `new-web-leo-original.tar.gz` | `379679e64e111a1878ea2b8900f27321f3f7b404b089aade4cf083ca98e79f95` |
| `new-web-leo-before-interactions-game.tar.gz` | `30005045f3b638c4246d3d352637f72a9ee39a7dcc99ae9b054064c8cb113004` |
| `new-web-leo-before-sandbox-v3.tar.gz` | `e5445ba4938bb39b205193819f20d1d1f999f834c6b3a14fe905861934facde2` |
| `new-web-leo-before-reference-v4.tar.gz` | `97ac54664417268e2c9c8d2c8d002ccd05885f6d863431a935bc9c3ce168eb32` |
| `new-web-leo-before-living-site-v9.tar.gz` | `e71db4c21c275ccefaee1619d877cb4f3a1bbac8d291c8f358ed430794c9c3fd` |
| `new-web-leo-before-worker-posture-v10.tar.gz` | `7719408e1510d58df56866568ad707eb2af77b9d169dec97db7887edca9bcdc8` |
| `new-web-leo-before-site-expansion-v12.tar.gz` | `590789d9d3ce2fc79f7849be774268000bc3b818fbece825320f3fe305ac6980` |
| `new-web-leo-before-vehicle-continuity-v13.tar.gz` | `18f18a61a42a5d49b0a5214e4f15e2e7cb9577338c87df2b687031d1a3e0907a` |
| `new-web-leo-before-final-review-hardening.tar.gz` | `6bae8bebdb6b90c816241add50cc6a31df0d977c0578e516c699eb100290a7a2` |

旧站归档包含 `.git`、原图、源码、未提交修改和 `artifacts`，不包含可重新安装的 `node_modules` 与构建目录 `dist`。
新站归档包含拉取后尚未修改的完整仓库及 `.git`。
两份归档均已通过目录读取验证，哈希见上表。

第三份归档是在“交互对齐、换图标、添加小游戏”开始前创建的快照，
包含当时的新站源码、Git 元数据和上一版两个交付压缩包；
排除 `node_modules`、`dist`、`artifacts` 和解压后的部署暂存目录。
上一轮证据仍原地保留，本轮证据写入 `artifacts/interaction-v2/`，两轮互不覆盖。
恢复上一版桌面时，在下面命令中换用第三份归档即可，仍须解压到新的空目录。

第四份归档在小猫、差异化收藏应用、榜单音乐和建筑沙盘开发前创建。
它包含当时的源码、Git 元数据和未提交修改，排除可重建的 `node_modules`、`dist`、
`artifacts` 与 `deliverables`。v3 证据写入 `artifacts/sandbox-v3/`，不会覆盖旧轮次。

第五份归档在按原版重新制作小猫、Music、游戏并修正车轮旋转前创建。
原版页面和本地对照截图保存在 `artifacts/reference-v4/`。

`new-web-leo-before-living-site-v9.tar.gz` 在施工时间系统、楼体生长、人员角色和
机械协作改造前创建，包含当时源码、Git 元数据和未提交修改；排除可重建的
`node_modules`、`dist`、`artifacts` 与 `deliverables`。v9 证据写入
`artifacts/living-site-v9/`，不会覆盖 v1–v8 的交付包。

`new-web-leo-before-worker-posture-v10.tar.gz` 在修复小人步态和外围岗位前创建，
使用相同排除规则。v10 证据写入 `artifacts/worker-posture-v10/`，不会覆盖
此前备份或 v1–v9 交付包。

v11 穿模修复前的可直接恢复源码为
`deliverables/new-web-leo-source-v10.tar.gz`，SHA-256 为
`5ca055868377e6c425e17dc05661903c8f2357e5064c82586c21a4f53aaeaeee`。

`new-web-leo-before-site-expansion-v12.tar.gz` 在扩大沙盘和增加分区 LOD 前创建，
包含 v11 的完整工作树并使用相同排除规则。

`new-web-leo-before-vehicle-continuity-v13.tar.gz` 在移除车辆硬隐藏逻辑前创建，
包含 v12 的完整工作树并使用相同排除规则。v12 的可交付源码包 SHA-256 为
`ff7878c257a2b7d2b68dfdbec554b3c7f2350ea03872fba796ea0ee09b04c215`。

`new-web-leo-before-final-review-hardening.tar.gz` 在依赖安全升级和最终全站审查前
创建，包含 v13 的完整工作树并使用相同排除规则。

## 恢复方式

不要直接向当前工作目录解压，以免覆盖新工作。先新建一个空目录：

```sh
mkdir -p "../new-web-leo-restore"
tar -xzf "../site-backups/20260909/new-web-leo-original.tar.gz" -C "../new-web-leo-restore"
cd "../new-web-leo-restore"
npm ci
npm run dev -- --port 5175
```

以上命令以本轮新站目录为起点。恢复旧站时同理，换成旧站归档和另一个空目录。
可以用 `shasum -a 256` 重新检查归档。

## 图片清单

`artifacts/media-migration.json` 记录每张旧站图片的相对路径、字节大小、SHA-256 和迁移结果。
49 张图片全部已存在于新仓库且逐字节一致，因此本轮复用现有文件，没有不必要地复制覆盖。
47 张进入相册；`avatar-3d.png` 用于个人资料；`wechat-qr.jpg` 用于联系入口。
