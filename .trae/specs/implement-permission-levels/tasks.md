# Tasks

## Phase 1: 数据库与共享类型

- [x] Task 1: 数据库 schema 更新
  - [x] SubTask 1.1: `users.ts` 新增 `permission_level` 字段，默认 `'use'`
  - [x] SubTask 1.2: `books.ts` 将 `visibility` 默认值改为 `PUBLIC`
  - [x] SubTask 1.3: 创建新的 migration 文件（`drizzle/0035_add_permission_level.sql`）
  - [x] SubTask 1.4: 更新 `drizzle/meta/_journal.json` 和 snapshot

- [x] Task 2: 共享类型更新
  - [x] SubTask 2.1: `enums.ts` 新增 `PERMISSION_LEVEL` 枚举（VIEW/READ/USE）
  - [x] SubTask 2.2: `schemas.ts` 新增 `permissionLevelSchema`
  - [x] SubTask 2.3: `schemas.ts` 更新 `updateUserSchema` 支持 `permission_level` 字段
  - [x] SubTask 2.4: `schemas.ts` 更新书籍创建 schema，默认 visibility 为 PUBLIC

---

## Phase 2: 后端权限校验基础设施

- [x] Task 3: auth.ts 权限函数
  - [x] SubTask 3.1: 新增 `PermissionLevel` 类型定义
  - [x] SubTask 3.2: 新增 `getPermissionLevel(userId)` 函数
  - [x] SubTask 3.3: 新增 `requirePermission(req, minLevel)` 函数
  - [x] SubTask 3.4: 确认 `getOptionalUserId(req)` 已支持匿名访问

- [x] Task 4: 书籍路由权限改造（`books.ts`）
  - [x] SubTask 4.1: 书籍列表接口支持匿名访问（仅返回 public 书籍）
  - [x] SubTask 4.2: 书籍详情接口要求登录（`requireUserId`）
  - [x] SubTask 4.3: 书籍写操作要求 `use` 权限（上传、编辑、删除）
  - [x] SubTask 4.4: 书籍列表查询逻辑：匿名看 public，登录用户看 own + public

- [x] Task 5: 高亮路由权限改造（`notes.ts` 中的 highlights 接口）
  - [x] SubTask 5.1: 高亮查询：公开书返回所有用户高亮，私有书仅返回 owner 高亮
  - [x] SubTask 5.2: 高亮写操作要求 `read` 权限
  - [x] SubTask 5.3: 高亮删除/更新校验 `owner_id` 匹配

- [x] Task 6: 笔记路由权限改造（`notes.ts`）
  - [x] SubTask 6.1: 笔记查询永远按 `owner_id` 隔离（管理员例外）
  - [x] SubTask 6.2: 笔记写操作要求 `read` 权限
  - [x] SubTask 6.3: 笔记删除/更新校验 `owner_id` 匹配

- [x] Task 7: 其他路由权限改造
  - [x] SubTask 7.1: `files.ts`：读取 `read`，写入 `use`
  - [x] SubTask 7.2: `reading-progress.ts`：要求 `read` 权限
  - [x] SubTask 7.3: `categories.ts`、`tags.ts`、`topics.ts`：查询 `view`，写操作 `read`
  - [x] SubTask 7.4: `export.ts`：要求 `use` 权限
  - [x] SubTask 7.5: `cloud-connections.ts`：要求 `use` 权限
  - [x] SubTask 7.6: `settings.ts`：要求 `use` 权限

- [x] Task 8: 用户管理路由更新（`users.ts`）
  - [x] SubTask 8.1: 创建用户时设置默认 `permission_level = 'use'`
  - [x] SubTask 8.2: 更新用户接口支持修改 `permission_level`
  - [x] SubTask 8.3: 用户列表返回包含 `permission_level` 字段

---

## Phase 3: 前端改造

- [x] Task 9: 用户管理界面
  - [x] SubTask 9.1: 用户列表显示权限级别
  - [x] SubTask 9.2: 创建用户表单添加权限级别选择（默认 `use`）
  - [x] SubTask 9.3: 更新用户支持修改权限级别

- [x] Task 10: ProtectedShell 改造
  - [x] SubTask 10.1: 支持匿名访问公开书架（通过 OptionalAuth 组件）
  - [x] SubTask 10.2: 根据权限级别控制页面访问（RequirePermission 组件）

- [x] Task 11: 书籍详情页 UI 改造
  - [x] SubTask 11.1: 根据权限级别隐藏/显示文件相关元素
  - [x] SubTask 11.2: 浏览用户不显示「打开阅读器」「下载」按钮
  - [x] SubTask 11.3: 高亮列表区分「我的」和「其他人」

- [x] Task 12: 书架页面改造
  - [x] SubTask 12.1: 未登录用户可看到公开书籍列表
  - [x] SubTask 12.2: 未登录用户点击书籍跳转登录页

---

## Phase 4: 测试与验证

- [x] Task 13: 权限校验验证
  - [x] SubTask 13.1: 验证匿名用户只能看公开书架列表（代码验证通过）
  - [x] SubTask 13.2: 验证浏览用户不能打开阅读器（代码验证通过）
  - [x] SubTask 13.3: 验证阅读用户可写高亮但不能上传书籍（代码验证通过）
  - [x] SubTask 13.4: 验证使用用户完整功能（代码验证通过）
  - [x] SubTask 13.5: 验证管理员不受权限限制（代码验证通过）

---

# Task Dependencies

- Task 1 依赖：无（可独立开始）
- Task 2 依赖：Task 1（需要枚举值）
- Task 3 依赖：Task 2（需要类型定义）
- Task 4-8 依赖：Task 3（需要权限函数）
- Task 9-12 依赖：Task 8（需要后端接口支持）
- Task 13 依赖：Task 1-12 全部完成

---

# Parallelization Opportunities

- Task 1 和 Task 2 可并行（共享类型和数据库 schema 不互相依赖）
- Task 4-8 可并行（各路由改造独立）
- Task 9-12 可并行（前端各组件改造独立）