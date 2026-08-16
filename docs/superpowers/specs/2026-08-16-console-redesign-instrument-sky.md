# NeKiro Console — Instrument Sky Redesign

- Spec ID: console-redesign-instrument-sky
- 日期: 2026-08-16
- 状态: Implemented and verified in the working tree
- 驱动技能: taste-skill (design-taste-frontend v2)

## 1. 目标

在不改变技术栈（React 19 / Vite 6 / Tailwind v4 / motion / lucide-react）
与全部现有功能的前提下，对 Console 前端做一次完整的视觉重设计（Redesign -
Overhaul）。旧视觉（Glass 2.0 靛紫玻璃）作为对比 demo 归档保留在
`#/demo/*` 路由。

## 2. Design Read

> Reading this as: a dark instrument-grade control-plane console for
> platform developers and workspace owners, with a precise technical
> language, leaning toward a bespoke Tailwind token system with a single
> sky-blue accent, grotesque + mono type pairing, hairline structure, and
> restrained motion.

拨盘：`VARIANCE 5 / MOTION 4 / DENSITY 7`。

## 3. 品牌统一

全组织唯一 logo 资产是 `public/favicon.ico`（sky `#38bdf8` "N" 字标 +
`#111827`）。旧 UI 的靛紫与其矛盾。本次重设计以 favicon 为品牌锚点：

- 强调色 = sky，单一强调色（语义色 ok/warn/danger 仅作功能色）
- 侧栏 `Monogram` 逐点复用 favicon 原始矢量（32x32, rx=8）
- 移除全部 AI 紫渐变、发光 mesh blob、渐变截断标题

## 4. 设计系统（src/index.css + src/components/ui.tsx）

| 维度 | 规则 |
| --- | --- |
| 表面 | ink-950..600 冷色近黑中性，发丝分割线 rgba(148,163,184,.14) |
| 强调 | sky `#38bdf8`（文本态 sky-300 `#7dd3fc`，AA 达标）；focus ring 全局统一 |
| 形状锁 | 交互 4px / 面板 6px / 状态徽章 pill（注释内文档化） |
| 字体 | Geist Variable + Geist Mono Variable（@fontsource 自托管，无外链） |
| 背景 | 静态 28px 控制面板网格 + 单一 sky 径向冲刷，零无限动画 |
| 动效 | MOTION 4：tab 切换 140ms、hover 100-120ms、skeleton 1.6s、live 脉冲 2.2s；`prefers-reduced-motion` 全覆盖（含 AnimatePresence via useReducedMotion） |
| 图标 | lucide 全家统一 strokeWidth 1.75（CSS 全局） |
| 原语 | ui.tsx：StatusBadge/StatusDot/ErrorBanner(traceId 可复制)/CopyButton/EmptyState/Skeleton/Fact/PageHeader/SectionLabel/PanelHeader |

响应式：≤900px 侧栏折叠为 64px 图标轨（aria-label 保留）；≤700px 隐藏
workspace 输入与冗余状态片；≤560px 统计卡单列。全部用 Tailwind 任意变体
（`max-[900px]:`），不依赖结构选择器。

## 5. 功能与契约保真

- 所有可见字符串、按钮名、表单 label、占位符、option 值格式
  （`${id}@${version}`）逐字保留（NeKiro-Stack e2e 契约）
- 关键 DOM 结构保留：Fact = `div > div(label) + div(value)`（readFactValue）、
  PublicAgentInstallPanel 根 `<section>` 含 "Public Share"、Trusted 页
  "3. Immutable Release" section、challenge proof 全页唯一 `<code>` 且验证后
  归零、JSON 结果在纯 `<pre>`
- 无障碍修复：label 内嵌 select/按钮会污染 accessible name 导致
  `getByLabel(exact)` 失配 —— 受影响的控件全部显式 `aria-label`（21 个 e2e
  标签经 scripts/probe-labels.mjs 逐一探测 =1）
- 已知类名清理：旧 `font-mono-code`/`font-mono-label`/`font-headline-md`
  为无定义 no-op，生产组件改用真实生效的 `font-mono` + `.mono-label`

## 6. 验证

- `pnpm typecheck` 干净；`pnpm test` 48/48；`pnpm build` 成功
- `scripts/flow.mjs`：16 步全生命周期 UI 走查（注册→发布→Binding→
  Challenge→Release→Preflight→安装→JSON/SSE 调用→Ledger trace→公开分享页）
- `scripts/screens.mjs` / `scripts/narrow.mjs`：全表面 + 768px/1280px 截图
- 视觉桥（modlens）逐屏审查 + 3 轮打磨
- 可见字符串 em-dash 审计 = 0（taste-skill §9.G）

## 7. 开发工具链（scripts/）

| 文件 | 用途 |
| --- | --- |
| mock-gateway.mjs | 零依赖本地网关（127.0.0.1:18080），8 卡/2 workspace/binding/challenge/release/invocation/trace 全链路可动，41 项真实客户端校验通过 |
| flow.mjs | 全生命周期 UI 走查 + 里程碑截图 |
| probe-labels.mjs | e2e 精确标签/标题可访问性探测 |
| screens.mjs / narrow.mjs | 全表面与响应式截图 |

## 8. 非目标

- 不改任何 API 契约、路由、信息架构、导航文案
- 不动 RepoWiki 文档站（仍为 Material indigo，可另开任务统一）
- 不提交 mock 数据或凭据；`.design/` `.research/` 已 gitignore
