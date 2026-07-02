# AGENTS.md

> 本文件是给 AI 代理（包括协作编码的 agent）的工作守则。在动手改任何代码前，先读这份文件和它指向的文档。

## 项目概述

Redesk 是自托管的个人阅读管理与 AI 陪读系统。技术路线为全栈 TypeScript（Route A）。当前处于**M1 书架与文件管理已闭环、M2 阅读器尚未开始**阶段。

一句话定位：藏书—阅读—沉淀—思考的数据闭环，数据存本地 SQLite，自托管 Docker，AI 作为增强层分阶段引入。

## 文档体系（动手前必读）

所有文档在 `doc/`。按需查阅，不要凭记忆假设：

| 文档 | 用途 | 何时读 |
| --- | --- | --- |
| [需求总纲](doc/需求总纲.md) | 产品定义、边界 | 判断"该不该做" |
| [功能清单](doc/Redesk-功能清单-v1.1.md) | 全量功能点编号 | 确认功能点编号与范围 |
| [决策记录](doc/决策记录.md) | 已确认决策、暂缓问题 | 遇到架构选择时先查红线 |
| [技术方案](doc/技术方案.md) | 技术路线、技术栈、分项设计、分期 | 理解整体架构 |
| [数据模型](doc/数据模型.md) | 全量 schema、字段、索引、检索结构 | 改表/写 ORM 前读 |
| [API 接口](doc/API接口.md) | 端点契约、通用约定 | 写接口前读 |
| [开发执行计划](doc/开发执行计划.md) | 里程碑、执行项、开发顺序 | 确认当前该做哪一项 |

## 技术栈（不可擅改）

- 后端：Node.js + Fastify + better-sqlite3 + Drizzle ORM
- 前端：Vite + React + TypeScript + shadcn/ui
- 存储：SQLite 单文件（FTS5 全文检索 + sqlite-vec 向量检索）
- 阅读器：epub.js
- 笔记：TipTap（HTML + Markdown 双存）
- 部署：Docker + docker-compose
- AI：外部 LLM API，统一收敛在 `AIService` 接口后

> 技术栈选型已在决策记录确认。如需更换语言/框架/存储引擎，必须先与决策者讨论并更新《决策记录》，不得擅改。

## 项目结构（规划）

```
apps/
  api/        # Fastify 后端
  web/        # Vite + React 前端
packages/
  db/         # Drizzle schema + better-sqlite3 连接
  shared/     # 前后端共享类型（Zod schema + TS 类型）
doc/          # 全部设计文档（勿放代码）
```

- 前后端共享的类型与校验放在 `packages/shared`，通过 Zod 单一来源生成，避免重复维护。
- 文件按职责拆分，单文件保持聚焦；改动频繁的文件放一起。

## 技术红线（必须遵守）

以下决策已在《决策记录》确认，实现时不得违反：

1. **`存档` 是独立状态，不是删除**：状态枚举 `STORED`，与软删除 `deleted_at` 是完全不同的两条路径。不得把"存档"实现为归档/删除。
2. **主题只引用不占有阅读痕迹**：高亮/笔记 `book_id` 归属原书；主题用 `ON DELETE CASCADE` 软引用，删主题不动原始数据，原痕删除时引用自动摘除。
3. **AI 内容与用户内容隔离**：AI 生成内容存 `ai_assets` 独立表，展示层亦区分，绝不与用户笔记/高亮混表。
4. **不默认强依赖云端**：云同步为可选增强；只同步文件层 + 备份副本，不同步在线数据库。优先支持内置 S3/OSS；rclone / Google Drive / Dropbox 作为后置可选同步方案。
5. **数据主权**：导出必须用通用格式（Markdown/JSON/CSV），不依赖 Redesk 专有结构。
6. **一书一分类**：`books.category_id` 单意外键；分类是"对个人的主要用途"，用户自定义，不建多对多关联表。
7. **owner_id 预留多用户**：用户拥有的根实体表带 `owner_id`，当前单账户下恒为同一值；从属关系表通过父表继承归属，查询与写入必须校验 owner 边界。

## 代码规范

- **语言**：TypeScript 严格模式（`strict: true`），前后端统一。
- **命名**：
  - 数据库列、API 字段：`snake_case`（与数据模型一致）。
  - TS 变量/函数/类型：`camelCase`；类型/接口：`PascalCase`；常量：`UPPER_SNAKE`。
  - 文件：组件 `PascalCase.tsx`，其余 `kebab-case.ts`。
- **注释**：除非必要不写注释；注释用中文（与项目语言一致）。
- **校验**：请求体/响应用 Zod schema，schema 放 `packages/shared`，前后端共用。
- **错误处理**：统一响应包装 + 错误处理中间件，错误码与结构见《API 接口》§1.4。
- **提交信息**：Conventional Commits（`type(scope): 描述`），描述用中文。见《git-commit》规范。
- **风格**：ESLint + Prettier，配置在 M0-01 建立。
- **时间戳**：统一 ISO 8601 UTC 字符串存储。
- **版本号**：三段式「主.次.修订」，规则见《决策记录》版本号规范。主版本号=阶段性更新，须用户声明才递增；次版本号=向下兼容功能新增，AI 自动递增但需向用户说明；修订号=向下兼容问题修正，AI 自动递增无需说明。

## 开发命令

```bash
pnpm install       # 安装依赖
pnpm dev           # 同时启动后端与前端
pnpm dev:api       # 后端开发，默认 http://localhost:8787
pnpm dev:web       # 前端开发，默认 http://localhost:5173
pnpm db:migrate    # 执行数据库迁移
pnpm typecheck     # 类型检查
pnpm lint          # ESLint 检查
pnpm build         # 生产构建
```

Windows 本地可双击 `start-local.bat`，脚本会启动 API/Web 两个窗口并自动打开前端页面。

Docker Compose 运行前必须设置强随机 `SESSION_SECRET`，例如写入本地 `.env`：

```bash
SESSION_SECRET=your-long-random-secret
docker compose up -d
```

完成代码任务后必须运行 `pnpm typecheck` 与 `pnpm lint`；涉及构建或部署时同时运行 `pnpm build`。

本地测试素材放入 `local-tests/`、`test-files/`、`.uploads/` 或 `data/`，这些目录已加入 `.gitignore`，不得强行提交。

本地开发当前临时免登录：`VITE_AUTH_DISABLED=true`。后端鉴权接口仍保留，生产构建默认不免登录；恢复登录时将该值设为 `false`。

### Node.js 版本要求

- 本项目本地开发与依赖安装统一使用 **Node.js 22 LTS**。
- 执行任何 `pnpm install`、`pnpm dev`、`pnpm build`、`pnpm typecheck`、`pnpm lint` 前，先确认当前 `node --version` 属于 22.x。
- 若发现当前 Node 版本不是 22.x，AI 代理必须**暂停当前任务并先向用户确认**，不得继续安装依赖、重编译原生模块或执行启动命令。
- 若原生模块（如 `better-sqlite3`）与当前 Node ABI 不匹配，也应先告知用户当前 Node 版本与修复方式，再继续操作。

## AI 代理工作守则

1. **先读文档再动手**：涉及表结构读《数据模型》，涉及接口读《API 接口》，涉及选择读《决策记录》。不要凭假设实现。
2. **遵循执行顺序**：按《开发执行计划》的里程碑与执行项编号推进；不得跳过依赖项。
3. **不擅改架构**：技术栈、数据模型红线、API 契约的变更须先与决策者讨论并更新文档。
4. **YAGNI**：只实现当前执行项所需；增强层（阅读器 3.21–3.31、统计 5.09–5.17 等"待定位"功能）不提前实现，预留接口即可。
5. **接口隔离**：AI 能力全部藏在 `AIService` 接口后，provider/模型可替换。
6. **不留占位**：实现的代码不留 TODO/TBD；若某项确需后置，在执行计划标注而非代码里留坑。
7. **测试**：遵循 TDD，先写失败测试再实现（功能代码建立测试框架后）。
8. **提交**：不主动提交；提交时用中文 Conventional Commit 信息，不提交密钥/.env。
9. **不创建多余文件**：不主动建文档/README；新增文件前确认必要性。
10. **数据安全**：不暴露或记录密钥；LLM/OSS 配置的 secret 不进日志、不进版本控制。

## 当前阶段注意

- M1 书架与文件管理已闭环；当前下一阶段是 M2 阅读器。
- M2 执行项待细化；M3–M5 为模块级，临近再细化。
- 若发现文档间矛盾或需求有变，先更新文档再改代码，保持文档与实现一致。
