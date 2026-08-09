# AGENTS.md

> 本文件是给 AI 代理（包括协作编码的 agent）的工作守则。在动手改任何代码前，先读这份文件和它指向的文档。

## 项目概述

Redesk 是自托管的个人阅读管理与 AI 陪读系统。技术路线为全栈 TypeScript（Route A）。当前已完成 **M0 工程地基、M1 书架与文件管理、M2 阅读器与阅读沉淀、M3 主题阅读**；M5 阅读增强与统计已有数据层、API 与部分前端模块，待完成主阅读器集成和端到端验证；M4 AI 与 RAG 尚未启动。

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

## 外部抓取与反爬策略

所有外部 HTTP 请求（元数据抓取、封面下载）统一通过 `apps/api/src/lib/fetch-utils.ts` 封装，提供 `fetchPage` 和 `fetchHtml` 两个入口。**禁止在其他位置直接使用原生 `fetch` 请求外部网站**。

核心策略（详见 `doc/技术方案.md` §4.1 反爬策略）：
- **随机 UA 池**：15 个真实浏览器 UA，每次随机选取，禁止硬编码 `Redesk/x.x` 形式的 UA。
- **请求间隔**：同域名 1.5–3.5 秒随机间隔，避免高频触发反爬。
- **指数退避重试**：失败最多 3 次，退避 2s → 4s → 8s + 随机抖动。
- **429 限流**：识别 HTTP 429，按 `retry-after` 头或默认 5–10 秒等待后重试。
- **完整请求头**：附加 Accept-Language、Accept-Encoding、Connection 等浏览器请求头。
- **Referer**：豆瓣域名自动附加 `https://book.douban.com/`。

如需新增外部抓取功能，必须复用 `fetchPage` / `fetchHtml`，不得绕过。

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

## 数据库迁移红线（Drizzle / SQLite）

本节是过去 3 次数据库升级故障的总结。**任何 AI 代理在改 schema、写新 migration、改 migrate.ts 前必须通读本节**。详细恢复步骤见 [doc/灾难恢复 SOP.md](doc/灾难恢复 SOP.md)。

### 红线 1：已应用的 migration 永远不可修改或删除

Drizzle 的 migrator 通过对比 `__drizzle_migrations` 表的 `hash` 与 `drizzle/meta/_journal.json` / `drizzle/meta/00007_snapshot.json` 的 hash 决定是否重跑。**已被记录为"已应用"的 migration 文件一旦修改，下次启动会判为"未应用"并重跑整张表的 CREATE，导致 `table already exists` 崩溃**。

具体规则：

- 不得修改 `drizzle/0000_*.sql` 之后任何已合并到 main 的 SQL 文件的正文。
- 不得删除任何已合并的 `drizzle/00NN_*.sql` 文件（包括回滚 PR）。
- 修改 schema 必须**新增**一个 `00NN_+1_*.sql`，通过 `ALTER TABLE` / 整表重建模式迁移，不得"改 0005 让其产生新效果"。
- 若发现早期 migration 写错（例如缺了索引），补救方式是新增一个 `00NN_+1_*.sql` 来 ALTER，绝不直接改 00NN。

> 例外：尚未合并、仅在分支上的 migration，可在分支内重命名 / 重写 / 删除，但合并后立刻按上述红线执行。

### 红线 2：禁止 journal 跳跃（gap）

`drizzle/meta/_journal.json` 的 `entries` 是有序数组。**绝不允许在中间删除某条 entry 然后把后面的条目顶上来**（即"压缩 journal"）。这会导致：

- 现有数据库的 `__drizzle_migrations` 表里已有该条 hash；
- 新的 journal 缺少该条 hash；
- 启动时 migrator 看到"应该应用 X 但 Y 已经应用了"，抛 `Found at least one unapplied migration`，且**绝不会自动回退**。

规则：

- 任何时候都不动 `_journal.json` 的已有 entries，只能 append。
- 不做"清理旧 migration""合并 migration"等操作。
- 改 schema 加新表 / 改字段 = 新增 `00NN_+1_*.sql` + 在 `drizzle/meta/_journal.json` 末尾 append 新 entry + 在 `drizzle/meta/` 下生成 `000NN_snapshot.json`。

### 红线 3：升级前的 6 步自检

每次发布版本 / 升级镜像 / 部署新代码前，AI 代理或部署者必须走完以下 6 步；任何一步失败都应停下，先解决再继续。

1. **检查 journal 与 meta 是否完整**：`drizzle/meta/_journal.json` 末尾的 idx 与 `drizzle/` 下 `00NN_*.sql` 文件数量一致；最新 snapshot 是 `000NN_snapshot.json` 而非 `000NM_snapshot.json`。
2. **本地 dry-run 迁移**：用一份空库（`rm data/redesk.db` 或 `docker volume rm`）跑一次 `pnpm db:migrate`，确认无错。
3. **CI 演练通过**：查看 `.github/workflows/ci.yml` 的 `migrate-drill` 任务最近一次跑成功（详见《灾难恢复 SOP》§3）。
4. **已发布版本的旧数据库兼容性**：参考 [doc/数据库兼容性与可锁定数据.html](doc/说明/Redesk-数据库兼容性与可锁定数据.html) 走一遍对照表，确认本次 migration 不触碰"可锁定数据"段。
5. **snapshot 预检**：第一次启动新版本时，`packages/db/src/preflight.ts` 会自动 `VACUUM INTO` 一份 `data/.snapshots/redesk-snapshot-YYYYMMDD-HHMMSS-mmm.db`。若 `__drizzle_migrations` 报异常，自动停服并提示恢复。
6. **回滚预案**：手边有"上一次正常运行的 git tag / Docker image tag"。若新版本启动 5 分钟内观察到反复重启或启动失败，立即 `docker compose down` 后 `docker compose up -d <old-tag>` 回滚。

### 启动期保护（实现位置）

- **预检**：`packages/db/src/preflight.ts` 的 `preflight()` 在 migrate 之前检查 10 张核心表（users/books/book_files/book_covers/highlights/notes/reading_progress/bookmarks/topics/settings）是否齐全。
- **快照**：`snapshotBefore()` 在 migrate 之前用 `VACUUM INTO` 备份当前数据库到 `data/snapshots/`。
- **残留清理**：`cleanupResidualTables()` 清理前缀为 `_redesk_residual_*` 的临时表。
- **强制作弊**：环境变量 `REDESK_FORCE_REBUILD=true` + 调用方显式 `allowForce: true` 才会绕过缺失表预检。CI / 生产绝不允许此环境变量。

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
- **中文字符与编码**（重要，曾出现两类故障）：
  - **源码中文字符一律写字面量**，不要写成 `\uXXXX` 转义。包括字符串字面量、JSX 文本、模板字符串、正则字面量。例：写 `'书架'`、`<div>书籍详情</div>`、`/【([^】]+)】/g`，不要写 `'\u4e66\u67b6'`、`<div>\u4e66\u7c4d\u8be6\u60c5</div>`、`/\u3010([^\u3011]+)\u3011/g`。
  - **JSX 文本不会解释 `\u` 转义**：`<div>\u4e66</div>` 会在页面上字面渲染出 `\u4e66`，是 bug。任何在 `>...</` 之间的中文都必须用字面字符。
  - **唯一例外是 `\uFEFF`（UTF-8 BOM）**：CSV 导出/导入场景保留 `'\uFEFF'` 转义形式，便于在编辑器中识别这个不可见字符。
  - **文件统一 UTF-8（无 BOM）保存**。VS Code / 编辑器不得用 GBK 等编码读写项目文件，否则 UTF-8 字节被当作 GBK 解读后会留下"璞嗙摚"这类永久性 mojibake（"豆瓣"被破坏成"璞嗙摚"）。
  - **提交前自检**：`git diff` 中若出现陌生汉字或大量 `\u` 转义，立即停止并回退；中文字符串若 grep 不到（如 grep "设置" 无结果但页面显示"设置"），说明源码被写成了转义形式。
  - **AI 代理生成代码时**：输出中文一律用字面字符，禁止输出 `'\uXXXX'` 形式的字符串。若工具链或上游模型倾向转义，需在生成后还原为字面量再写入文件。

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

1. 先理解现有实现，再修改代码。
2. 保持修改范围最小。
3. 优先复用已有组件、函数、服务、类型和配置。
4. 不要引入与任务无关的重构。
5. 不要引入与任务无关的格式化修改。
6. 不要复制已有功能。
7. 不要绕过已有架构边界。
8. 不要基于猜测修改数据库、认证、权限、部署或安全相关代码。
9. 发现需求与现有实现冲突时，应明确指出冲突点。
10. 发现更安全、更简单或更符合现有架构的方案时，应主动说明。
11. 不要在验证失败或未验证时声称任务已完成。



## 开发原则与架构边界

- 新增代码应放在职责明确的位置，避免随意新建目录、重复模块或堆积临时逻辑。
- UI 层只处理展示和交互，复杂逻辑应下沉到业务模块、服务层或专用工具函数中。
- 页面级组件负责组织结构、状态衔接和数据流转；通用展示、交互控件和业务片段应按职责拆分到合适位置。
- 组件拆分应保持适度粒度，避免为简单逻辑拆出过多零散组件，也避免将无关逻辑堆砌在单个大型组件中。
- 可复用组件和公共逻辑应围绕稳定职责抽取，保持清晰、直接、可测试，避免为表面复用制造过度抽象。
- 当组件变得难以阅读、测试或复用时，应优先整理职责边界，而不是继续追加条件分支和临时逻辑。
- 数据访问、外部 API 调用、配置读取应集中封装，避免散落在页面、组件或路由中。
- 参数校验、权限检查和错误处理应在边界层完成，不依赖前端隐藏按钮。
- 客户端代码不得读取服务端密钥。
- 数据库层不得依赖 UI 层。
- 路由层不应堆积复杂业务逻辑。
- 修改公共组件、公共类型、API 返回结构或数据模型时，应检查所有调用方。
- 数据模型和迁移应保持稳定，避免因临时需求频繁修改 schema、字段含义或迁移历史；确需调整时，应优先考虑向后兼容、数据迁移路径和旧版本兼容风险。
- 临时文件和代码使用完毕后应及时清理，并确认清理不会影响项目运行。
- 如确需提交样本数据，应使用小型、脱敏、可公开的示例文件。



## 禁止或需谨慎的操作

除非任务明确要求，不要执行以下操作：

- 大范围重构。
- 替换技术栈。
- 新增生产依赖。
- 删除迁移文件。
- 修改认证逻辑。
- 修改权限逻辑。
- 修改部署配置。
- 修改 CI/CD 配置。
- 删除大量代码。
- 改动与任务无关的格式化内容。
- 擅自改变项目运行环境，包括运行时版本、包管理器、系统依赖、部署方式、端口和环境变量约定。
- 擅自修改可能导致数据库不兼容或不可逆变化的内容，包括 schema、迁移、数据删除、字段含义和存储路径。

涉及以下内容时，应先确认影响范围：

- 数据库结构、迁移和数据兼容性。
- 认证、权限和安全策略。
- API 返回结构和错误格式。
- 部署、环境变量、端口和运行时版本。
- 文件存储路径、上传目录和对象存储规则。
- 公共组件、公共类型、公共工具函数和全局配置。



- 若发现文档间矛盾或需求有变，先更新文档再改代码，保持文档与实现一致。
