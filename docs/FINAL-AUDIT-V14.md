# Final Audit v14

## 审查结论

本轮审查覆盖当前工作区相对 `4232d95` 的完整改版，包括桌面应用、媒体数据、
本地状态、路由、Three.js 沙盘、构建脚本、自动化测试和发布配置。

```mermaid
flowchart LR
  A[桌面入口] --> B[单应用窗口]
  B --> C[内容应用]
  B --> D[Little Works]
  D --> E[施工阶段状态机]
  E --> F[人员与机械协作]
  F --> G[车辆作业 / 回场 / 待命]
  G --> H[碰撞与性能指标]
  style A fill:#bbdefb,color:#0d47a1
  style D fill:#fff3e0,color:#e65100
  style G fill:#c8e6c9,color:#1a5e20
  style H fill:#f3e5f5,color:#7b1fa2
```

## 已修复发现

1. 车辆可见性曾直接受工序强度控制，导致行驶中消失并在后续阶段重新出现。
   现改为持续可见的 `working`、`returning`、`standby` 状态机；装载机平滑回场。
2. 依赖树包含 React Router、Vite、Vitest 和 PostCSS 的已修复安全公告。
   已升级到 React Router 7.18.3、Vite 7.3.6、Vitest 4.1.11 和 PostCSS 8.5.28，
   并完成对应类型兼容调整。
3. 微信号复制成功后状态不会复位。现于 1.8 秒后恢复按钮，并在组件卸载时清理计时器。
4. 首次升级过程中生成的锁文件缺少 peer 条目，`npm ci` 无法复现。
   已重新生成锁文件，并从空依赖目录验证 `npm ci` 成功。

## 最终证据

- `npm audit`：0 vulnerabilities。
- TypeScript：通过。
- ESLint：0 errors；7 条既有 shadcn Fast Refresh warnings。
- Vitest：11/11 通过。
- Playwright：37 通过、3 个按设计跳过、0 失败。
- 生产构建：通过。
- 沙盘：三辆环线车与装载机持续可见，碰撞违规 0。
- 敏感信息扫描：无命中。
- GitHub Pages：仓库未启用 Pages；本次只推送源码功能分支。

完整日志保存在本地忽略目录 `artifacts/final-audit/` 与
`artifacts/vehicle-continuity-v13/`。
