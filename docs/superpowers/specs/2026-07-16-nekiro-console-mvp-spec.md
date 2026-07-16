# NeKiro Console MVP 功能规格

- Spec ID: console-mvp-v0
- 日期: 2026-07-16
- 目标仓库: E:\NeKiro-console
- 事实来源: E:\NeKiro 主仓库、当前 Console 代码、NeKiro 活动契约
- 状态: Draft for implementation planning

## 1. 背景与目标

NeKiro 的产品定位是 Agent Operating Platform，第一阶段主闭环是：

~~~text
Register -> Discover -> Install -> Invoke -> Record
~~~

当前主仓库已经具备可对接的 Control Plane Catalog / Workspace / Installation 运行时边界，Console 仓库已有 React/Vite/Tailwind 原型和部分 Catalog API 客户端，但仍存在明显缺口：

- Console 现有 Catalog 客户端仍调用 legacy v2 agent endpoints，而主仓库当前公开路由和活动 OpenAPI 是 /v3/*。
- Registry 已部分接入 API；Installations、Invocations、Ledger 仍主要使用本地 mock 数据。
- 主仓库代码中当前可见的北向运行时路由覆盖 Catalog、Workspace、Installation 与内部 exact resolution；Invocation Dispatch / A2A Router / Ledger 仍不能在 Console 中假定为可用运行时。

本 spec 的目标是定义一个可实施的 Console MVP：先把 Console 做成 NeKiro Control Plane 的真实管理界面，覆盖已实现的 Register / Discover / Install 管理能力；对 Invoke / Record 保持契约感知但不伪装成已连通。

## 2. 范围

### 2.1 MVP 必须完成

1. 将前端 API 客户端迁移到 Northbound API v3。
2. Registry 页面真实管理 Agent Card v0.2 的注册、发现、读取、发布和禁用。
3. Workspace 页面或 Header 区域支持创建、读取和选择当前 Workspace。
4. Installations 页面真实管理当前 Workspace 的安装、历史列表、单条详情、启用、禁用和卸载。
5. 安装流程必须基于已发布 Agent Card 的权限声明做显式权限接受，不允许静默接受或本地伪造权限。
6. 所有 API 错误必须展示 Platform Error code、message、traceId，并保留上一轮成功数据。
7. Invocations 与 Ledger 页面在后端运行时未就绪前只能展示“待后端实现”的 contract-aware 空状态，不得继续展示会误导用户的 mock 执行记录。
8. 前端测试覆盖 API 映射、请求构造、错误解析、关键表单校验和主要用户流。

### 2.2 明确不做

- 不实现 Control Plane、A2A Router、Ledger 或 Sample Agent 后端能力。
- 不从浏览器调用 /internal/* 内部接口或 Router 内部接口。
- 不做 Marketplace、计费、排名、Agent 运行时编辑器、Prompt/Tool/Memory/RAG 配置。
- 不存储真实密钥；浏览器侧 token 只通过 Vite 环境变量注入，用于本地开发。
- 不在 API 不可用时回退到 INITIAL_AGENTS 或 INITIAL_INSTALLATIONS 伪数据。

## 3. 关键决策摘要

| 决策项 | 决策值 | 依据 |
| --- | --- | --- |
| 公共 API 版本 | /v3 | contracts/openapi/control-plane.v3.yaml 与 Gateway 路由 |
| 浏览器可调用边界 | 仅 Northbound API：/v3/agents、/v3/workspaces、/v3/workspaces/{workspaceId}/installations | 主仓库架构边界 |
| 禁止调用边界 | /internal/v2/*、Router internal API、数据库、Agent endpoint | Frontend 只能访问 Gateway |
| Agent Card 版本 | schemaVersion 0.2，A2A 0.3.0，transport JSONRPC | Agent Card v0.2 schema |
| Agent endpoint 校验 | 绝对 http:// 或 https:// URI，不允许 userinfo | Agent Card v0.2 schema/semantic rules |
| Installation 状态 | enabled / disabled / uninstalled | Installation v2 schema |
| 权限接受 | acceptedPermissions 必填；可为空数组；必须是 Card permissions 的精确大小写子集 | Installation v2 + Issue #5 handoff |
| Invocation/Ledger UI | 暂不连接运行时；只显示后端待实现状态和契约说明 | 主仓库 handoff 与当前 Gateway 路由 |
| Mock 策略 | 业务数据不得 fallback 到 mock；仅允许测试 fixture | 现有 Catalog 集成设计约束 |

## 4. 用户角色

| 角色 | 目标 | 关键权限/约束 |
| --- | --- | --- |
| Platform Developer | 注册、发布和禁用 Agent Card 版本 | 必须提供合法 v0.2 Card；不能绕过 Registry |
| Workspace Owner | 创建 Workspace，安装和管理 Agent 版本 | 只能访问自己拥有的 Workspace |
| Platform Operator | 查看安装状态、错误 trace、后续 Invocation/Ledger 状态 | 只看平台元数据，不查看密钥或 Agent payload |

## 5. 信息架构

Console 保留现有四个主导航，但语义调整如下：

| 页面 | MVP 状态 | 主要内容 |
| --- | --- | --- |
| Registry | Live | Agent 发现、注册、详情、发布、禁用 |
| Installations | Live | Workspace 选择、安装 Agent、安装历史、启用/禁用/卸载 |
| Invocations | Gated | 显示待后端 Invoke runtime；列出未来会使用的 POST /v3/workspaces/{workspaceId}/invocations 契约 |
| Ledger | Gated | 显示待后端 Record runtime；列出未来会使用的 Invocation / Trace read 契约 |

Header 需要从硬编码 Workspace: NK-0814 和 User: SystemAdmin 改为配置/运行态：

- 当前 Workspace ID。
- 当前 authenticated principal 的开发态展示名。
- Control Plane 连接状态。
- 最近一次 traceId 或 request error badge。

## 6. API 对接规格

### 6.1 运行时配置

~~~env
VITE_NEKIRO_API_BASE_URL=http://127.0.0.1:18080
VITE_NEKIRO_TOKEN=
VITE_NEKIRO_OWNER_ID=
VITE_NEKIRO_OWNER_NAME=
VITE_NEKIRO_DEFAULT_WORKSPACE_ID=
~~~

规则：

- VITE_NEKIRO_API_BASE_URL 必须非空，否则 API client 返回 CONFIGURATION_ERROR。
- VITE_NEKIRO_TOKEN 仅以 Bearer header 发送，不写入 localStorage/sessionStorage。
- owner identity 不能作为后端授权事实，只作为表单默认值或 UI 文案；后端以 token 对应 principal 为准。

### 6.2 Catalog API

| 操作 | Method / Path | Console 行为 |
| --- | --- | --- |
| Discover | GET /v3/agents | 支持 query/capability/owner/limit/cursor；列表只来自服务器 |
| Register | POST /v3/agents | 提交 { card: AgentCardV02 }；成功后刷新列表 |
| Exact read | GET /v3/agents/{agentId}/versions/{version} | 打开详情抽屉时读取服务器事实 |
| Publish | POST /v3/agents/{agentId}/versions/{version}/publish | 仅 draft 可展示操作 |
| Disable | POST /v3/agents/{agentId}/versions/{version}/disable | 仅 published 可展示操作 |

Agent Card 表单必须覆盖：

- agentId、name、description、owner.id、owner.displayName、version。
- protocol.endpoint，且只能为 HTTP(S) A2A endpoint。
- skills 数组：id、name、description、inputSchema、outputSchema、requiredPermissions。
- authentication.type。
- permissions 数组：id、description。
- limits：timeoutMs、maxInputBytes、maxOutputBytes、streaming。

### 6.3 Workspace API

| 操作 | Method / Path | Console 行为 |
| --- | --- | --- |
| Create Workspace | POST /v3/workspaces | 创建当前用户 owner-controlled Workspace |
| Read Workspace | GET /v3/workspaces/{workspaceId} | 加载 Header/Installations 当前 Workspace |

Workspace v1 只展示以下事实：

- workspaceId
- ownerId
- createdAt
- updatedAt

### 6.4 Installation API

| 操作 | Method / Path | Console 行为 |
| --- | --- | --- |
| Install | POST /v3/workspaces/{workspaceId}/installations | 从 published Agent 安装，显式选择 acceptedPermissions |
| List | GET /v3/workspaces/{workspaceId}/installations | 分页列出当前和历史安装 |
| Read | GET /v3/workspaces/{workspaceId}/installations/{installationId} | 详情抽屉显示精确 pin 和生命周期事实 |
| Update | PATCH /v3/workspaces/{workspaceId}/installations/{installationId} | status 仅允许 enabled 或 disabled |
| Uninstall | DELETE /v3/workspaces/{workspaceId}/installations/{installationId} | 二次确认后卸载，保留历史 |

安装请求：

~~~json
{
  "agentId": "runtime.echo",
  "versionConstraint": "^1.0.0",
  "acceptedPermissions": ["READ_LOGS"]
}
~~~

Installation v2 详情字段：

- installationId
- workspaceId
- agentId
- versionConstraint
- installedVersion
- acceptedPermissions
- status
- installedAt
- updatedAt
- uninstalledAt（仅 status 为 uninstalled 时出现）

## 7. 交互规格

### 7.1 Registry

必须支持：

- 搜索：query 输入防抖 250ms 左右；失败时保留上一轮数据。
- 过滤：至少支持 capability 和 ownerId，分页 cursor 作为 P1。
- 注册：表单在缺少必填字段、非法 SemVer、非法 endpoint、skills 为空、requiredPermissions 未声明时禁用提交或展示错误。
- 详情：展示完整 Agent Card JSON 和摘要字段。
- 生命周期：draft -> publish；published -> disable；disabled 不可重复 disable。

验收重点：

- 不再引用 legacy v2 agent endpoints。
- 不出现 deprecated 作为后端状态；如保留旧类型，只限迁移兼容 UI，不从 API 映射生成。
- API 失败不回填原始 mock agents。

### 7.2 Workspace

必须支持：

- 首次进入时读取 VITE_NEKIRO_DEFAULT_WORKSPACE_ID；如果为空，显示创建/输入 Workspace 面板。
- 创建 Workspace 后自动设为当前 Workspace。
- 读取失败时显示 Platform Error，不继续展示硬编码 NK-0814。

### 7.3 Installation

必须支持：

- 从 Registry 的 published Agent 进入安装向导。
- 输入 versionConstraint，默认可为当前精确版本或兼容范围，但必须用户可编辑。
- 列出 Agent Card permissions，并让用户逐项接受；空权限数组必须作为显式选择提交。
- 安装成功后刷新安装列表，不本地拼装 endpoint、installedBy、FAULTED 等不存在字段。
- Enable/Disable 按 contract status 小写值提交。
- Uninstall 必须二次确认，并解释卸载保留历史且不可作为同一条安装恢复。

### 7.4 Invocations / Ledger

MVP 中这两个页面不做真实运行时调用。页面必须明确说明：

- Invocation Dispatch、A2A Router、Ledger 后端尚未在当前 Console 范围内接入。
- 未来将使用 POST /v3/workspaces/{workspaceId}/invocations、GET /v3/invocations/{invocationId}、GET /v3/traces/{traceId}。
- 当前不展示模拟 trace tree、模拟 timeout、模拟 ledger events，避免误导为平台事实。

## 8. 错误、加载与空状态

统一错误模型：

- HTTP status
- Platform Error code
- message
- traceId

展示规则：

- 表格级错误显示在对应页面顶部，不弹出浏览器 alert。
- mutation 失败时保持表单输入，允许用户修正后重试。
- dependency failure 不显示为空列表。
- 空列表仅用于服务器成功返回 items: []。
- traceId 可复制。

## 9. 数据类型调整

当前 src/types.ts 需要向后端契约收敛：

- Agent.status 改为 draft | published | disabled；旧 deprecated 仅可作为迁移期间本地 fixture 类型，不进入 API 映射。
- Installation.state 改为 contract status：enabled | disabled | uninstalled。
- 删除或隔离 mock-only 字段：agentName、endpoint、installedBy、FAULTED。
- 新增 Workspace、PlatformError、InstallationList、InstallAgentRequest、UpdateInstallationRequest 类型。

## 10. 非功能性需求

| 维度 | 要求 |
| --- | --- |
| 安全 | 不持久化 token；不显示密钥；不调用内部接口；错误不泄漏 payload |
| 可维护性 | API client 集中在 src/api/nekiro.ts 或拆分到 src/api/*；组件不手写 fetch |
| 契约一致性 | TypeScript 类型必须以主仓库 schemas/OpenAPI 为事实来源手动映射或生成，不新增私有字段 |
| 可测试性 | API client 使用可注入 fetch；关键表单校验用纯函数或可测试 helper |
| 可用性 | loading、empty、error、disabled action 状态清晰；长 JSON 可复制 |
| 性能 | 搜索防抖；分页保留 cursor；列表刷新不阻塞整个应用 shell |

## 11. 特性拆解

| 特性ID | 特性名称 | 特性描述 | 用户故事 | 验收标准 | 优先级 | 依赖特性 | 预估工作量 | 涉及模块 | 技术风险 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F001 | v3 API 客户端 | 将 Catalog 客户端扩展为 v3 Control Plane client | 作为 Console 用户，我希望 UI 调用当前后端契约，以便操作结果与主仓库一致 | 无 legacy v2 agent endpoints 请求；所有 v3 请求含 Accept/Auth；Platform Error 解码通过测试 | P0 | 无 | 2d | src/api | v2/v3 响应差异 |
| F002 | Registry 实时管理 | 注册、搜索、发布、禁用 Agent Card v0.2 | 作为 Platform Developer，我希望管理 Agent 版本，以便让 Workspace 能发现可安装 Agent | 注册合法 Card；publish/disable 后刷新；无 mock fallback | P0 | F001 | 3d | RegistryTab/App | Card 表单复杂 |
| F003 | Workspace 选择与创建 | 创建/读取当前 Workspace 并驱动安装上下文 | 作为 Workspace Owner，我希望选择当前 Workspace，以便安装操作归属正确 | Header 显示服务器 Workspace；读取失败不显示硬编码 Workspace | P1 | F001 | 2d | Header/App/Workspace panel | owner identity 容易误解 |
| F004 | Agent 安装向导 | 从 published Card 安装到 Workspace 并接受权限 | 作为 Workspace Owner，我希望明确接受权限后安装 Agent，以便授权可审计 | acceptedPermissions 必填；空数组显式提交；成功返回 exact pin | P0 | F002,F003 | 3d | InstallationsTab | SemVer 与权限子集校验 |
| F005 | Installation 历史与详情 | 分页展示安装历史和单条详情 | 作为 Operator，我希望查看安装事实，以便排查版本和权限问题 | 展示 installedVersion/status/timestamps/uninstalledAt；空列表与错误区分 | P1 | F004 | 2d | InstallationsTab/API | cursor UX |
| F006 | Installation 生命周期 | 启用、禁用、卸载安装 | 作为 Workspace Owner，我希望控制安装可用性，以便停止或恢复授权访问 | PATCH 只发 enabled/disabled；DELETE 二次确认；uninstalled 保留历史 | P1 | F005 | 2d | InstallationsTab | 并发冲突处理 |
| F007 | Contract-aware Invoke/Ledger 空状态 | 移除误导性 mock trace，展示后端待实现边界 | 作为 Operator，我希望知道哪些运行时能力未接入，以便不误判平台状态 | Invocations/Ledger 不展示模拟成功/失败事件；列出未来 API | P1 | 无 | 1d | InvocationsTab/LedgerTab | 产品展示取舍 |
| F008 | 统一错误与 trace 展示 | 每个 live 页面展示 Platform Error 与 traceId | 作为开发者，我希望看到 traceId，以便定位后端请求失败 | 错误组件可复制 traceId；mutation 失败保留输入 | P2 | F001 | 1.5d | shared components | 错误 shape 兼容 |
| F009 | 契约测试与 UI 流测试 | 覆盖 API 映射、表单校验和关键用户流 | 作为维护者，我希望改动有测试保护，以便后续迁移到生成类型 | npm test、npm run lint、npm run build 通过 | P2 | F001-F006 | 2d | tests/src | 测试框架能力有限 |
| F010 | 文档与本地运行说明 | 更新 README/.env.example，说明 v3 backend 接入方式 | 作为新贡献者，我希望快速连到本地 Control Plane，以便验证 Console | README 包含环境变量、后端启动依赖、已接/未接页面 | P2 | F001-F007 | 1d | docs/README | 后端分支状态变化 |

## 12. 技术前置任务

| 任务ID | 任务名称 | 任务描述 | 服务特性 | 完成标准 | 预估工作量 | 涉及模块 |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | 契约摘录 | 从主仓库 v3 OpenAPI/schema 整理前端类型映射 | F001-F006 | 类型字段与 schema 一致，无 mock-only 字段混入 API DTO | 1d | src/api/types |
| T002 | API base path 迁移 | 将现有 legacy v2 agent endpoints client 迁移到 /v3/agents 并新增 Workspace/Installation 方法 | F001 | API tests 覆盖 URL、headers、error decode | 1d | src/api/nekiro.ts |
| T003 | Mock 数据隔离 | 移除 live 页面 fallback；把旧数据保留为 Story/test fixture 或删除 | F002,F004,F007 | 运行时失败不展示 INITIAL_* | 0.5d | src/data.ts |
| T004 | Workspace 状态模型 | 在 App 层集中管理 currentWorkspace、loading、error | F003-F006 | Installations 请求必须带 current workspace | 1d | App/Header |
| T005 | 权限选择组件 | 构建 permission acceptance UI，输出精确 permission id 数组 | F004 | requiredPermissions 可提示，acceptedPermissions 可为空但必须明确确认 | 1d | components |
| T006 | 生命周期确认组件 | 替换 alert/confirm 为应用内确认与错误展示 | F006,F008 | 卸载与禁用错误均可恢复 | 1d | components |
| T007 | Gated 页面替换 | 用 contract-aware 空状态替换 Invocations/Ledger mock | F007 | 不再渲染 TRACE_HISTORIES 作为平台事实 | 0.5d | Invocations/Ledger |
| T008 | 验证脚本 | 固化 npm test、npm run lint、npm run build 作为交付门禁 | F009 | 三个命令通过或记录环境阻塞 | 0.5d | package/scripts |

## 13. 开发启动前置确认

| 确认项 | 当前状态 | 需确认方 | 备注 |
| --- | --- | --- | --- |
| 后端目标 API 版本 | 已确认：/v3 | - | 当前 Console 仍是 /v2，需迁移 |
| 后端本地端口 | 未确认 | 开发者 | .env.example 目前默认 http://127.0.0.1:18080 |
| Bearer token 获取方式 | 未确认 | 开发者 / 后端负责人 | Console 只读取 VITE_NEKIRO_TOKEN |
| 默认 Workspace ID | 未确认 | 产品/开发者 | 建议通过 env 配置；没有则 UI 允许创建/输入 |
| Installation inspection/lifecycle 运行状态 | 需以当前分支测试确认 | 后端负责人 | OpenAPI/代码路由存在，handoff 文案有历史不一致 |
| Invocation/Router/Ledger 运行状态 | 已判定不纳入 MVP live 接入 | - | 页面仅 gated |
| 是否生成 OpenAPI TypeScript 类型 | 待决策 | 前端负责人 | MVP 可手写映射；后续建议 codegen |

## 14. 验收标准

### 功能验收

1. 配置 base URL/token 后，Registry 只从 GET /v3/agents 加载数据。
2. 注册一个合法 Agent Card v0.2 后，列表刷新并可看到 draft 版本。
3. draft 版本可 publish，published 版本可 disable，错误展示 traceId。
4. 用户可创建或读取 Workspace，Header 不再硬编码 NK-0814。
5. 用户可从 published Agent 发起安装，显式接受权限，成功后显示 exact installedVersion。
6. Installation 列表、详情、enable/disable、uninstall 都以服务器返回事实为准。
7. 后端不可用时，页面展示错误并保留上一轮成功数据，不回退 mock。
8. Invocations/Ledger 不展示模拟历史，只展示待后端实现和未来契约入口。

### 技术验收

~~~powershell
npm test
npm run lint
npm run build
rg "legacy v2 agent endpoints" src docs -n
rg "INITIAL_AGENTS|INITIAL_INSTALLATIONS|TRACE_HISTORIES" src -n
~~~

期望：

- 测试、类型检查、构建通过。
- legacy v2 agent endpoints 不再出现在运行时代码。
- INITIAL_* 与 TRACE_HISTORIES 不被 live 页面导入；如保留，仅限测试 fixture 或明确的非运行时 demo。

## 15. 后续路线

Console MVP 完成后，下一批功能应等待主仓库完成 headless Invoke -> Record 后再接入：

1. Invocation Dispatch + A2A Router 可用后，启用 Invocations 页面。
2. Metadata-only Ledger 和 Trace read API 可用后，启用 Ledger 页面。
3. 两个跨 Runtime Sample Agents 完成后，增加端到端演示流：Register -> Discover -> Install -> Invoke -> Record。


