# AGENTS.md — My Car Cost

面向 AI 编码代理的项目说明。包含项目概况、技术栈、目录结构、常用命令、当前进度与已知缺口。修改代码前请先阅读本文件。

## 项目概况

**My Car Cost**（`mycarcost`）— 单用户车辆能耗与费用记录 PWA Web 应用（v0.1.0）。

- 管理多辆汽车（燃油 / 纯电 / 插混），记录加油 / 充电能耗、用车费用（含分摊费用、周期费用、收入），能耗与费用两大总览页提供统计与趋势图（仿小熊油耗）。
- 单用户设计：无注册，采用应用内密码登录（PBKDF2 + HMAC 会话 Cookie）。
- 支持 PWA 安装、离线缓存（SW 自动更新后刷新页面）。
- 响应式：< 768px 单列移动端布局，≥ 768px 桌面布局，交互元素最小 44×44px。

**生产地址**：部署在 Cloudflare Workers 自定义域上（见本地 wrangler.toml / Cloudflare 控制台，出于隐私不入库）。

## 技术栈（固定，勿更换）

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Chart.js (react-chartjs-2) + react-router-dom 6 |
| 后端 | Cloudflare Worker + Hono 4 |
| 数据库 | Cloudflare D1 (SQLite)，迁移在 `worker/migrations/`（0001~0004 均已应用于本地+远程） |
| 对象存储 | Cloudflare R2（**未开通**，`wrangler.toml` 中绑定已注释，代码可无 R2 运行） |
| 离线存储 | IndexedDB (Dexie.js 4) —— `db/localDb.ts` + `sync/syncEngine.ts` 已实现但**页面未接线**（在线直连模式） |
| PWA | vite-plugin-pwa (Workbox)，图标 any + maskable，API 请求 NetworkFirst |
| 测试 | Vitest 2（36 个 shared 包测试）；fast-check 已安装未使用 |
| 共享代码 | `shared/` workspace：类型、枚举、校验、计算工具 |

## 目录结构

```
mycarcost/
├── shared/src/           # @mycarcost/shared：types/enums/validation/validators/calculations/imageValidation + 测试
├── worker/
│   ├── migrations/       # 0001 初始建表; 0002 车显/桩显电量; 0003 导入扩展字段; 0004 incomes
│   ├── wrangler.toml     # database_id 已填; [assets] ASSETS binding + SPA fallback; R2 注释中
│   └── src/
│       ├── index.ts      # Hono 入口：/api 路由 + auth 中间件 + charging-stations + ASSETS 兜底
│       ├── auth.ts       # 密码登录（PBKDF2 10万次迭代）、HMAC 会话、logout/改密轮换密钥
│       └── routes/       # vehicles, consumptions, expenses, periodicExpenses, incomes,
│                         # locations, expenseTypes, reports, imageRecognition, settings, sync
├── frontend/
│   ├── vite.config.ts    # VitePWA manifest(4图标) + /api 代理 localhost:8787
│   ├── public/           # favicon.ico + 16/32/180/192/512 + maskable 图标（2048px 母版降采样）
│   └── src/
│       ├── api.ts        # REST 封装（401 自动跳 /login）
│       ├── App.tsx       # 路由 + RequireAuth 守卫
│       ├── pages/        # VehiclesPage(车辆), ConsumptionOverviewPage(/consumptions),
│       │                 # ConsumptionsPage(list), ConsumptionDetailPage, ConsumptionEditPage,
│       │                 # ExpenseOverviewPage(/expenses), ExpensesPage(list), LoginPage,
│       │                 # LocationsPage, SettingsPage
│       ├── components/   # Layout, NavBar(中央+按钮), VehicleSwitcher, ConsumptionForm, OfflineIndicator
│       ├── db/localDb.ts # Dexie 本地库（离线基础）
│       └── sync/syncEngine.ts # 同步引擎（离线基础，未接线）
├── .kiro/specs/          # 需求/设计/任务规格（重建版，内容可能不全）
└── agent.md
```

## 常用命令

```bash
npm run dev:frontend     # Vite 开发服务器（/api 代理到 worker）
npm run dev:worker       # wrangler dev（本地 Worker，端口 8787）
npm run build:frontend   # tsc -b && vite build
npm test                 # vitest --run（shared 包 36 测试）

cd frontend && npx tsc --noEmit   # 各 workspace 类型检查
cd worker   && npx tsc --noEmit
```

注意：仓库在 Windows 网络盘，git 需 `git -c safe.directory="D:/Project/mycarcost/mycarcost" <cmd>`。

## 部署（Cloudflare）

- 资源：D1 `mycarcost-db`（id 见本地 wrangler.toml，未入库）；自定义域通过 Workers Domains API 绑定；R2 未开通。
- 流程：`npm run build:frontend` → `cd worker && npx wrangler deploy`。静态资源经 `[assets]` 托管；`index.ts` 末尾的 `app.get('*')` ASSETS 兜底是 SPA 路由刷新的关键，勿删。
- D1 迁移：`npx wrangler d1 migrations apply mycarcost-db --remote`。
- 本地 Miniflare 在 Windows 上偶发请求挂起：杀 workerd/node 进程重启即可。
- 图片识别：设置页配 llm_api_url / llm_api_key / llm_model（模型必填；任意 OpenAI 兼容多模态服务，如千问VL/星火/Gemini）。

## 领域规则速查

- 车辆：名称 1–30 字符唯一，最多 20 辆；类型变更不兼容能耗记录需确认。
- 能耗：里程 0–9,999,999.9；数量 0.01–99,999.99；单价 0.001–99.999；总价自动算单价（3 位小数）。百公里能耗口径：按里程顺序相邻两条差值。
- 电记录：电量 % 0–100 且后>前；峰谷明细 1–10 组；充电电流 1–256A 选填；相数 single/three 默认单相；充电站名（有→直流）+ 历史下拉；选填：剩余里程、车显能耗、车显消耗、充满表显里程、车显/桩显充电电量（0–99,999.99）；备注 ≤500。
- 地点：名称 1–50 唯一，地址 ≤200；删除时引用置 NULL。
- 费用类型：名称 1–20 唯一；颜色 #RRGGBB；分摊月数 1–60 默认 12（固定车位费、保险和交通规费为 12 个月分摊）。
- 费用：金额 0.01–999,999,999.99；备注 ≤200，历史备注自动补全 10 条。
- 收入：date/amount/typeName(≤20)/note；计入费用报表 totalIncome。
- 周期费用：daily/monthly + 起止日期；⚠️ 目前仅存储展示，报表未计入（已知缺口）。
- 同步：恢复网络 30s 内自动同步；失败 60s 重试最多 3 次；LWW + conflict_archive 存档。
- 图片识别：JPEG/PNG ≤10MB，OpenAI 兼容 API，30s 超时，模型必填。
- 导航：底部 车辆/能耗/＋/费用/设置；"+" 弹出记能耗/记费用（?add=1 自动开表单）。

## 当前状态与已知缺口（2026-09-07 重建后）

1. **项目目录曾误删，本树为重建版**：类型检查、36 测试、生产构建全部通过；线上从未受影响，仍是权威运行版本。旧 git 历史不可考（2026-09-05 之前的提交序列丢失）。**务必尽快配置远程备份（GitHub 私库等）**。
2. 前端未接入本地优先（localDb/syncEngine 未被页面引用），离线记录与同步在 UI 上不可用。
3. 报表未计入周期费用与分摊摊销（spec 9.6/9.7）。
4. R2 未开通；图片识别跳过临时上传。
5. 登录无防爆破限流（单用户风险低）。
6. 可选属性测试（fast-check Property 1–17）未实现。
