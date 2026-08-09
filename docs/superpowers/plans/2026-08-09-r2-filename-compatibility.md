# R2 文件名兼容性修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新上传或替换的书籍文件在用户界面与下载中保留原始中文名，同时使用唯一、安全的 ASCII 对象键存入 R2/S3。

**Architecture:** 文件名解析由 Fastify multipart 的 UTF-8 参数字符集保证。服务层将用户展示名和对象键分离：`original_filename` 保存原名称，新的文件键使用书籍或所有者范围、UUID 和扩展名。下载端共享响应头构造函数，为不支持 RFC 5987 的客户端提供安全 ASCII 回退名，并以 `filename*` 返回 UTF-8 原名称。

**Tech Stack:** TypeScript、Fastify 5、@fastify/multipart 10、Vitest、Drizzle ORM、AWS SDK S3 兼容存储。

---

### Task 1: 文件名与对象键辅助函数回归测试

**Files:**
- Modify: `apps/api/src/routes/files.ts:79-100`
- Test: `apps/api/src/routes/files.test.ts`

- [ ] **Step 1: 写入失败的文件名辅助函数测试**

```ts
import { describe, expect, it } from 'vitest';
import { bookFileKey, buildContentDisposition, unassociatedFileKey } from './files';

describe('文件名与对象键', () => {
  it('为相同中文文件名生成不同且仅含 ASCII 的关联对象键', () => {
    const first = bookFileKey(42, '三体（全集）.epub');
    const second = bookFileKey(42, '三体（全集）.epub');

    expect(first).toMatch(/^books\/42\/[0-9a-f-]+\.epub$/);
    expect(second).toMatch(/^books\/42\/[0-9a-f-]+\.epub$/);
    expect(first).not.toBe(second);
  });

  it('为未关联文件按所有者隔离对象键', () => {
    expect(unassociatedFileKey(7, '中文书名.epub')).toMatch(/^unassociated\/7\/[0-9a-f-]+\.epub$/);
  });

  it('为中文下载名提供 ASCII 回退与 UTF-8 filename*', () => {
    expect(buildContentDisposition('三体.epub')).toBe(
      "attachment; filename=\"download.epub\"; filename*=UTF-8''%E4%B8%89%E4%BD%93.epub",
    );
  });
});
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `pnpm --filter @redesk/api test -- files.test.ts`

Expected: FAIL，提示辅助函数尚未导出或对象键仍使用文件名。

- [ ] **Step 3: 实现最小对象键与响应头辅助函数**

```ts
function fileStorageKey(prefix: string, filename: string): string {
  const ext = extname(basename(filename)).toLowerCase();
  return `${prefix}/${randomStorageToken()}${ext}`;
}

export function bookFileKey(bookId: number, filename: string): string {
  return fileStorageKey(`books/${bookId}`, filename);
}

export function unassociatedFileKey(ownerId: number, filename: string): string {
  return fileStorageKey(`unassociated/${ownerId}`, filename);
}

export function buildContentDisposition(filename: string): string {
  const safeFilename = basename(filename).replace(/[\r\n]/g, '');
  const ext = extname(safeFilename).replace(/[^a-zA-Z0-9.]/g, '');
  const fallback = `download${ext || '.bin'}`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
}
```

- [ ] **Step 4: 运行定向测试确认通过**

Run: `pnpm --filter @redesk/api test -- files.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交对象键和响应头辅助函数**

```bash
git add apps/api/src/routes/files.ts apps/api/src/routes/files.test.ts
git commit -m "fix(文件存储): 分离展示文件名与对象键"
```

### Task 2: 在上传、替换和下载链路使用新辅助函数

**Files:**
- Modify: `apps/api/src/routes/files.ts:985-1180,1608-1637`
- Modify: `apps/api/src/routes/opds.ts:145-198`

- [ ] **Step 1: 更新上传与替换对象键调用**

```ts
const key = bookId != null ? bookFileKey(bookId, filename) : unassociatedFileKey(ownerId, filename);
```

替换流程使用：

```ts
const newKey = bookFileKey(bookId, filename);
```

保留 `original_filename: basename(filename)`，不将展示名用于存储键。

- [ ] **Step 2: 将 Web 下载响应替换为共享响应头**

```ts
.header('Content-Disposition', buildContentDisposition(file.original_filename ?? `book${extname(readable.key)}`))
```

- [ ] **Step 3: 在 OPDS 路由导入并使用共享响应头**

```ts
import { buildContentDisposition } from './files';

.header('Content-Disposition', buildContentDisposition(row.original_filename ?? `book${extname(candidate.key)}`))
```

- [ ] **Step 4: 运行 API 定向测试**

Run: `pnpm --filter @redesk/api test -- files.test.ts opds.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交上传与下载链路改动**

```bash
git add apps/api/src/routes/files.ts apps/api/src/routes/opds.ts
git commit -m "fix(文件存储): 下载保留中文文件名"
```

### Task 3: 固定 multipart 文件名 UTF-8 解析

**Files:**
- Modify: `apps/api/src/server.ts:61-65`
- Test: `apps/api/src/routes/files.test.ts`

- [ ] **Step 1: 在 multipart 注册配置中声明 UTF-8 参数字符集**

```ts
await app.register(fastifyMultipart, {
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
  defParamCharset: 'utf8',
});
```

- [ ] **Step 2: 运行 API 定向测试和类型检查**

Run: `pnpm --filter @redesk/api test -- files.test.ts opds.test.ts && pnpm --filter @redesk/api typecheck`

Expected: PASS。

- [ ] **Step 3: 提交 multipart 配置**

```bash
git add apps/api/src/server.ts
git commit -m "fix(上传): 按 UTF-8 解析文件名"
```

### Task 4: 全量验证与最终提交

**Files:**
- Verify: `apps/api/src/server.ts`
- Verify: `apps/api/src/routes/files.ts`
- Verify: `apps/api/src/routes/opds.ts`

- [ ] **Step 1: 确认 Node 版本为 22.x**

Run: `node --version`

Expected: `v22.x.x`。

- [ ] **Step 2: 执行项目类型检查、Lint 与构建**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: 全部通过；如既有失败，记录失败命令、文件和与本次改动的关系。

- [ ] **Step 3: 检查变更范围与提交状态**

Run: `git diff --check && git status --short && git log -3 --oneline`

Expected: 无空白错误；仅包含本计划涉及的源文件、测试文件和计划文档。

- [ ] **Step 4: 提交实现计划文档和任何未提交的验证相关改动**

```bash
git add docs/superpowers/plans/2026-08-09-r2-filename-compatibility.md
git commit -m "docs(文件存储): 补充 R2 文件名修复计划"
```
