# 交接文档：M1 上线筹备 — 认证系统改造

> 交接日期：2026-06-30
> 交接人：TRAE（前一阶段 AI 代理）
> 接手人：下一阶段 AI 代理 / 用户
> 关联文档：[M1-上线筹备.md](../todo/M1-上线筹备.md)、[技术方案.md](../技术方案.md)、[决策记录.md](../决策记录.md)

---

## 0. 一句话状态

M1 上线筹备的 **新认证系统改造**已全部完成（后端 AUTH-01~09 + 前端 AUTH-10~15），项目可正常运行。下一阶段：R2 存储对接（R2-01~R2-17）与部署准备（DEPLOY-01~DEPLOY-15）。

---

## 1. 上一阶段的工程背景

- 项目：Redesk，自托管个人阅读管理 + AI 陪读系统。
- 技术栈：Node 20 + Fastify + better-sqlite3 + Drizzle ORM（后端）；Vite + React + TS + shadcn/ui（前端）；SQLite 单文件。
- 当前里程碑：**M1 书架 + 文件管理已闭环**，进入上线筹备阶段。
- 上一阶段因 token 限制中断，留下认证系统半成品（schemas.ts 与 _journal.json 残留改动导致项目无法启动）。本次已修复并完成全部 AUTH 项。

---

## 2. 本次完成的工作（v1.4.0）

### 2.1 提交记录（按时间序）

```
e54b484 feat(auth): 前端适配双模式认证系统 (AUTH-10~15)
8237ae0 feat(auth): 实现认证系统后端改造 (AUTH-01~09)
efd9c31 fix: 清理认证系统残留改动，恢复可运行状态
fbe3082 chore: 保存当前工作区状态(含残留认证改动)
```

### 2.2 后端改造（AUTH-01~09）

| 编号 | 内容 | 涉及文件 |
| --- | --- | --- |
| AUTH-01 | users 表新增 `is_active`、`session_expires_days` | `packages/db/drizzle/0007_user_auth_fields.sql`、`packages/db/src/schema/users.ts`、`packages/db/drizzle/meta/_journal.json` |
| AUTH-02 | settings 表新增认证相关配置项（auth_mode、暴力破解参数） | `packages/shared/src/enums.ts`（新增 `AUTH_MODE`）、`packages/shared/src/types.ts`（新增 `SETTINGS_KEY`、`BRUTE_FORCE_DEFAULTS`） |
| AUTH-03 | 实现暴力破解防护模块（内存 Map 存储） | 新建 `apps/api/src/lib/brute-force.ts` |
| AUTH-04 | 改造 `/auth/login` 支持双模式（单/多口令） | `apps/api/src/routes/auth.ts`（重写） |
| AUTH-05 | `/admin/users` 完整 CRUD | `apps/api/src/routes/users.ts`（重写） |
| AUTH-06 | `/users/:id/toggle-active` 启用/禁用 | `apps/api/src/routes/users.ts` |
| AUTH-07 | 新增 `/auth/mode` 接口 | `apps/api/src/routes/auth.ts` |
| AUTH-08 | 自动生成口令函数（12 位随机） | `apps/api/src/lib/auth.ts`（`generatePassword`） |
| AUTH-09 | `/auth/logout` 会话清除（已具备） | — |

辅助新增：
- `apps/api/src/lib/settings-store.ts`（认证模式/暴力破解参数读取）
- `apps/api/src/lib/auth.ts` 新增 `getFirstUser()`、`generatePassword()`
- shared schema 更新：`sessionDaysSchema`、`userSchema`、`loginSchema`（username 可选）、`createUserSchema`、`updateUserSchema`

### 2.3 前端改造（AUTH-10~15）

| 编号 | 内容 | 涉及文件 |
| --- | --- | --- |
| AUTH-10 | 登录页支持双模式（`single_token` 只显示密码，`multi_token` 显示用户名+密码） | `apps/web/src/routes/login.tsx`（重写） |
| AUTH-11 | 设置页「访问控制」Tab：认证模式选择 + 暴力破解参数 | `apps/web/src/routes/settings.tsx`（GeneralTab） |
| AUTH-12 | 设置页「用户管理」Tab：CRUD 弹窗、列表、自动生成口令 | `apps/web/src/routes/settings.tsx`（UsersTab） |
| AUTH-13 | 用户下线/启用交互（`useToggleActive`、`Ban`/`CheckCircle` 视觉指示） | `apps/web/src/routes/settings.tsx`、`apps/web/src/hooks/use-users-admin.ts` |
| AUTH-14 | 会话有效期（7/30 天）— 由后端 `session_expires_days` 字段控制，前端读写已通 | `apps/web/src/hooks/use-users-admin.ts` |
| AUTH-15 | 登录失败提示（显示剩余尝试次数 / 锁定剩余时间） | `apps/api/src/routes/auth.ts` + `apps/web/src/routes/login.tsx` |

辅助改动：
- `apps/web/src/lib/api.ts`：`AuthUser` 扩展 `is_active`、`session_expires_days`
- `apps/web/src/lib/auth-mode.ts`：`LOCAL_AUTH_USER` 补齐新字段
- `apps/web/src/hooks/use-auth.ts`：`useLogin` 签名调整、新增 `useAuthMode`

### 2.4 用户保留的未动文件

- `apps/web/src/components/app-sidebar.tsx` 左下角登录 popover 仍是占位实现（仅本地 token 长度校验，不调 API）。**用户已明确不动**，下一阶段也不要改这里。

---

## 3. 当前项目状态

- **分支**：`main`
- **工作区**：clean（无未提交改动）
- **代码质量**：
  - `pnpm typecheck`：4/4 workspace 通过
  - `pnpm lint`：0 errors，2 个预存 warning（`theme-provider.tsx`/`button.tsx` 的 `react-refresh/only-export-components`，与本次改动无关）
- **数据库迁移**：`0007_user_auth_fields.sql` 已注册到 `_journal.json`。
- **本地登录**：默认 `VITE_AUTH_DISABLED=true` 临时免登录；后端鉴权接口已就绪。恢复登录：`.env` 设 `VITE_AUTH_DISABLED=false`。

---

## 4. 下一阶段任务清单（M1-上线筹备 续）

### 4.1 R2 对象存储对接（R2-01~R2-17）

详见 [M1-上线筹备.md §4.2](../todo/M1-上线筹备.md)。

**关键执行项**：
- R2-05：安装 `@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`
- R2-06：新建 `apps/api/src/lib/storage.ts`，封装 S3 兼容 API（适配 R2）
- R2-07/08/09：改造文件上传/下载/删除接口读写 R2
- R2-10：`apps/api/src/config.ts` 读取 `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`/`R2_PUBLIC_URL`
- R2-11：封面从 R2 读取
- R2-12~14：迁移脚本（如有本地数据）

**技术提示**：
- Cloudflare R2 是 S3 兼容，endpoint 格式 `https://<account_id>.r2.cloudflarestorage.com`
- 现有本地文件路径位于 `apps/api/src/lib/storage.ts`（**待新建**）— 实际是 `apps/api/src/routes/files.ts` 直接用本地 fs 读写，需把 fs 操作替换为 S3 client
- 配置安全：R2 凭证不写日志、不进版本控制（`.env` 已在 `.gitignore`）

### 4.2 部署准备（DEPLOY-01~DEPLOY-15）

详见 [M1-上线筹备.md §4.3](../todo/M1-上线筹备.md)。大多是 VPS 侧操作（环境、Docker、域名、SSL、Nginx、防火墙、备份），少部分是项目内配置（`docker-compose.yml`、`Dockerfile` 复查、`.env.example` 完善）。

---

## 5. 下一阶段注意事项

1. **不要擅改技术栈**（决策记录红线）。需要换库/换框架先与用户讨论。
2. **不要修改 `app-sidebar.tsx` 登录 popover**，保持占位状态直到用户决定如何处理。
3. **R2 凭证进 `.env`，不要进代码**。`.env` 已在 `.gitignore`。
4. **遵循 TDD**：测试框架已就绪，新功能先写失败测试再实现。
5. **遵循 Conventional Commits + 中文描述**。提交前先 `pnpm typecheck && pnpm lint`。
6. **AGENTS.md 是工作守则**，动手前先读相关文档（数据模型/API/决策记录）。
7. **保留 `pnpm --config.node-linker=hoisted` 习惯**（Windows native 模块兼容）。
8. **M1-上线筹备文档 v1.0.0 状态**为「进行中」，R2 + Deploy 完成后建议升级到 v1.1.0 并标记「已完成」。

---

## 6. 关键文件速查

```
# 后端认证
apps/api/src/routes/auth.ts                # 双模式登录 + /auth/mode
apps/api/src/routes/users.ts               # 用户 CRUD + toggle-active
apps/api/src/lib/auth.ts                   # 密码 hash/verify、generatePassword、getFirstUser
apps/api/src/lib/brute-force.ts            # 暴力破解防护
apps/api/src/lib/settings-store.ts         # 动态配置读取

# 前端认证
apps/web/src/routes/login.tsx              # 双模式登录页
apps/web/src/routes/settings.tsx           # 访问控制 + 用户管理 Tab
apps/web/src/hooks/use-auth.ts             # useLogin、useAuthMode
apps/web/src/hooks/use-users-admin.ts      # 用户管理 hooks
apps/web/src/lib/api.ts                    # AuthUser 类型
apps/web/src/lib/auth-mode.ts              # LOCAL_AUTH_USER 占位

# 共享
packages/shared/src/schemas.ts             # userSchema、loginSchema、sessionDaysSchema
packages/shared/src/enums.ts               # AUTH_MODE
packages/shared/src/types.ts               # SETTINGS_KEY、BRUTE_FORCE_DEFAULTS

# 数据库
packages/db/drizzle/0007_user_auth_fields.sql
packages/db/src/schema/users.ts
packages/db/drizzle/meta/_journal.json
```

---

## 7. 复现与验证步骤

接手后建议先验证当前状态再开工：

```bash
# 1. 安装依赖（Windows 必须加 --config.node-linker=hoisted）
pnpm install --config.node-linker=hoisted

# 2. 跑迁移
pnpm db:migrate

# 3. 类型检查 + lint（应全部通过）
pnpm typecheck
pnpm lint

# 4. 启动后端 + 前端
pnpm dev
# 或 Windows 双击 start-local.bat
```

后端默认端口 8787，前端 5173。访问 `http://localhost:5173` 应能进入应用（默认 `VITE_AUTH_DISABLED=true` 免登录）。

---

> 本文档为 Redesk 上线筹备 v1.4.0 阶段性交接记录，与 [M1-上线筹备.md](../todo/M1-上线筹备.md) 配套使用。
