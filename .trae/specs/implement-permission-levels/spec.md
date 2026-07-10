# 用户权限层级体系 Spec

## Why

当前 Redesk 只有管理员/普通用户二元权限模型，无法支持细粒度的访问控制。需要引入五级权限体系（未登录 → 浏览 → 阅读 → 使用 → 管理员），实现：
- 未登录用户可浏览公开书架
- 浏览用户可查看书籍详情和公开高亮，但不能阅读文件
- 阅读用户可阅读书籍并创建自己的留痕
- 使用用户可上传和管理书籍
- 管理员拥有全部权限

## What Changes

### 数据库层
- `users` 表新增 `permission_level` 字段（TEXT，默认 `'use'`）
- 书籍 `visibility` 默认值从 `PRIVATE` 改为 `PUBLIC`

### 后端层
- `auth.ts` 新增 `requirePermission(req, minLevel)` 函数
- `auth.ts` 新增 `getPermissionLevel(userId)` 函数
- 各路由按权限层级添加校验
- 高亮查询逻辑：公开书的高亮所有人可见，私有书仅 owner 可见
- 笔记查询逻辑：永远仅 owner 可见
- 未登录用户可访问公开书籍列表接口

### 前端层
- 用户管理界面添加权限级别下拉选择（浏览/阅读/使用）
- 未登录用户可看到公开书架（但不能进入详情）
- 浏览用户 UI 中隐藏文件相关元素（阅读器、下载、格式）
- 根据权限级别隐藏对应的操作按钮

### 共享类型层
- 新增 `PermissionLevel` 枚举和 Zod schema

---

## Impact

- Affected specs: 用户认证、书籍管理、笔记/高亮管理、阅读器访问
- Affected code:
  - `packages/db/src/schema/users.ts`
  - `packages/db/src/schema/books.ts`
  - `packages/shared/src/enums.ts`
  - `packages/shared/src/schemas.ts`
  - `apps/api/src/lib/auth.ts`
  - `apps/api/src/routes/*.ts`（所有路由文件）
  - `apps/web/src/hooks/use-users-admin.ts`
  - `apps/web/src/components/protected-shell.tsx`
  - `apps/web/src/pages/*`（相关页面）

---

## ADDED Requirements

### Requirement: Permission Level Field
The system SHALL provide a `permission_level` field on users with values `'view'` | `'read'` | `'use'`, defaulting to `'use'`.

#### Scenario: Default permission for new users
- **WHEN** a new user is created
- **THEN** the user's `permission_level` is set to `'use'`

#### Scenario: Admin can modify permission level
- **WHEN** admin updates a user's permission level
- **THEN** the user's permission level is changed accordingly

---

### Requirement: Permission Check Function
The system SHALL provide a `requirePermission(req, minLevel)` function that:
- Returns the user ID if the user has at least the required permission level
- Throws forbidden error if permission insufficient
- Treats admin users as having all permissions

#### Scenario: User with sufficient permission
- **WHEN** user with `permission_level = 'read'` calls an endpoint requiring `'view'`
- **THEN** the request proceeds normally

#### Scenario: User with insufficient permission
- **WHEN** user with `permission_level = 'view'` calls an endpoint requiring `'read'`
- **THEN** the system returns 403 Forbidden

---

### Requirement: Anonymous Book List Access
The system SHALL allow anonymous (unauthenticated) users to:
- View the public book shelf list (cover + title + author only)
- Search public books (list-level only)
- NOT access book detail pages
- NOT access any other features

#### Scenario: Anonymous user views book shelf
- **WHEN** unauthenticated user requests `/books` with `visibility=PUBLIC` filter
- **THEN** the system returns public books with minimal info (no file details)

#### Scenario: Anonymous user attempts book detail
- **WHEN** unauthenticated user requests `/books/:id` detail
- **THEN** the system returns 401 Unauthorized

---

### Requirement: Highlight Visibility by Book Visibility
The system SHALL make highlights visible based on the book's `visibility`:
- Highlights on public books: visible to all logged-in users
- Highlights on private books: visible only to the book's owner

#### Scenario: User views highlights on public book
- **WHEN** any logged-in user requests highlights for a public book
- **THEN** all users' highlights on that book are returned

#### Scenario: User views highlights on private book
- **WHEN** non-owner user requests highlights for a private book
- **THEN** no highlights are returned (or empty list)

---

### Requirement: Note Privacy
The system SHALL enforce that notes are ALWAYS private:
- Notes visible only to the note's owner (by `owner_id`)
- Admin can view all notes
- No other user can view another's notes

#### Scenario: User views own notes
- **WHEN** user requests notes for a book they have access to
- **THEN** only the user's own notes are returned

#### Scenario: User cannot view others' notes
- **WHEN** user requests notes that belong to another user
- **THEN** the system returns empty or 403

---

### Requirement: Book Default Visibility
The system SHALL set new books' `visibility` to `PUBLIC` by default.

#### Scenario: New book created
- **WHEN** user creates or imports a new book
- **THEN** the book's `visibility` is set to `PUBLIC`

---

### Requirement: Frontend Permission UI
The system SHALL provide UI elements based on user permission level:
- Anonymous: show login button, book list only
- View: hide file-related UI (reader, download, format)
- Read: show reader access, highlight/note editing for own content
- Use: show full functionality except admin features

#### Scenario: View-level user sees book detail
- **WHEN** view-level user opens book detail page
- **THEN** file format, download buttons, and "open reader" are hidden

---

## MODIFIED Requirements

### Requirement: User Management (Modified)
The system SHALL allow admin to:
- Create users with password and display_name
- Update user's `permission_level` (view/read/use)
- Enable/disable users
- Reset passwords
- Delete non-admin users

**Change**: Added ability to set/modify `permission_level`.

---

### Requirement: Book List Query (Modified)
The book list query SHALL:
- For anonymous users: return only public books with minimal fields
- For logged-in users: return owner's books + public books
- Apply permission-based filtering on file-related fields

**Change**: Added anonymous access and permission-based field filtering.

---

## REMOVED Requirements

None. All existing functionality preserved, only extended.