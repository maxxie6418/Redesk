# Redesk API 接口

> 定义 Redesk 后端 HTTP 接口契约：通用约定、Step1 详细端点、Step2/Step3 预留端点。是前后端联调与实现的直接依据。

| 项目 | 内容 |
| --- | --- |
| 文档名称 | Redesk API 接口 |
| 当前版本 | v1.0.1 |
| 文档状态 | 待评审 |
| 最后更新 | 2026-06-27 |
| 适用范围 | 全项目实现期 |
| 关联文档 | 数据模型.md、技术方案.md、功能清单.md |

## 修改记录

| 版本 | 日期 | 修改摘要 | 修改人 |
| --- | --- | --- | --- |
| v1.0.0 | 2026-06-27 | 建立 API 接口初始框架：通用约定、Step1 详细端点、Step2/3 预留端点清单 | — |
| v1.0.1 | 2026-06-27 | 补充版本号规范引用；版本号改为三段式（主.次.修订） | — |

## 文档说明

- 本文档规定"接口怎么调"。Step1 端点详写请求/响应；Step2（阅读器）/Step3（AI）仅列端点清单与职责，等进场再细化字段，避免现在猜不准返工。
- 路径前缀：`/api/v1`（OPDS 见 §7，独立路径）。
- 阶段标注：`S1`/`S2`/`S3`/`P2`，与《数据模型》一致。
- 字段命名：请求/响应 JSON 用 snake_case，与数据库列名一致；时间戳为 ISO 8601 UTC 字符串。
- 版本号遵循三段式「主.次.修订」，递增规则见《决策记录》版本号规范。

## 目录

1. [通用约定](#1-通用约定)
2. [鉴权（S1）](#2-鉴权s1)
3. [书籍管理（S1）](#3-书籍管理s1)
4. [分类与标签（S1）](#4-分类与标签s1)
5. [文件管理（S1）](#5-文件管理s1)
6. [回收站与状态历史（S1）](#6-回收站与状态历史s1)
7. [OPDS（S1）](#7-opdss1)
8. [导出与备份（S1）](#8-导出与备份s1)
9. [概览（S1）](#9-概览s1)
10. [设置（S1）](#10-设置s1)
11. [阅读器与笔记（S2 预留）](#11-阅读器与笔记s2-预留)
12. [AI 能力（S3 预留）](#12-ai-能力s3-预留)
13. [主题阅读（P2 预留）](#13-主题阅读p2-预留)

---

## 1. 通用约定

### 1.1 请求

- 方法：GET / POST / PATCH / DELETE（PATCH 部分更新，PUT 不使用）。
- 请求体：JSON（`Content-Type: application/json`）；文件上传为 `multipart/form-data`。
- 认证：Cookie 会话（`sid`），除 `/auth/login`、`/opds/*` 外均需登录；OPDS 用 HTTP Basic。

### 1.2 分页

列表端点统一参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| page | int | 1 | 页码，从 1 起 |
| page_size | int | 20 | 每页条数，上限 100 |
| sort | string | | 排序字段，前缀 `-` 降序，如 `-updated_at` |

响应包装：

```json
{
  "data": [ /* 条目数组 */ ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 142
  }
}
```

### 1.3 筛选

书籍列表支持组合筛选（query 参数，可叠加）：

| 参数 | 说明 | 对应功能 |
| --- | --- | --- |
| q | 全文关键词（命中 title/author/isbn） | 1.13 |
| status | 状态，逗号分隔多值 | 1.15 |
| category_id | 分类 | 1.16 |
| tag_id | 标签，逗号分隔（AND 关系） | 1.17 |
| visibility | PUBLIC/PRIVATE | 1.18 |
| in_trash | true 仅回收站；默认 false | 1.25 |

### 1.4 错误响应

统一结构，HTTP 状态码语义化：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "书名不能为空",
    "details": [ { "field": "title", "issue": "required" } ]
  }
}
```

| 状态码 | code | 说明 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 参数校验失败 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 唯一约束冲突等 |
| 422 | BUSINESS_ERROR | 业务规则不满足（如状态非法转换） |
| 500 | INTERNAL_ERROR | 服务端错误 |

### 1.5 单资源响应

```json
{ "data": { /* 单个对象 */ } }
```

---

## 2. 鉴权（S1）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /auth/login | 登录，成功设会话 Cookie |
| POST | /auth/logout | 登出，清除会话 |
| GET | /auth/me | 当前用户信息 |

### POST /auth/login

请求：
```json
{ "username": "string", "password": "string" }
```
响应 200：`{ "data": { "id": 1, "username": "...", "display_name": "..." } }`
错误：401 `INVALID_CREDENTIALS`

> 当前单账户；初始账户在首次启动或环境变量引导创建。多用户注册端点为 P2 预留。

---

## 3. 书籍管理（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /books | 书籍列表（分页/筛选/排序） | 1.13–1.19 |
| POST | /books | 新建书籍 | 1.01/1.02 |
| GET | /books/{id} | 书籍详情 | 1.06/1.20 |
| PATCH | /books/{id} | 编辑元数据 | 1.05 |
| DELETE | /books/{id} | 移入回收站（软删除） | 1.07 |
| POST | /books/batch | 批量操作 | 1.28 |
| GET | /books/duplicates | 重复检测（规则版） | 1.27 |

### POST /books

请求（title、author 必填，余可选）：
```json
{
  "title": "如何阅读一本书",
  "author": "艾德勒",
  "isbn": "9787100040945",
  "publisher": "商务印书馆",
  "publish_year": 2004,
  "description": "...",
  "language": "zh",
  "category_id": 3,
  "status": "COLLECTED",
  "visibility": "PRIVATE",
  "reading_purpose": "精读",
  "rating": null,
  "tag_ids": [5, 12]
}
```
响应 201：`{ "data": { /* book 对象 */ } }`

### PATCH /books/{id}

请求：任意可更新字段子集（含 status、visibility、category_id、rating、tag_ids 等）。
状态变更同步写 status_history（见 §6）。
响应 200：`{ "data": { /* book */ } }`

### GET /books

响应：分页包装，`data` 为 book 摘要数组（id, title, author, cover_path, status, visibility, rating, category_id, progress_percentage）。

### POST /books/batch

请求：
```json
{
  "ids": [1, 2, 3],
  "action": "set_status" | "set_category" | "set_tags" | "set_visibility" | "delete",
  "params": { "status": "PLANNED" }
}
```
响应 200：`{ "data": { "affected": 3 } }`

### GET /books/duplicates

响应：`{ "data": [ { "book_id": 1, "duplicates": [2, 3], "score": 0.92 } ] }`

---

## 4. 分类与标签（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /categories | 分类列表 | 1.09 |
| POST | /categories | 新建分类 | 1.09 |
| PATCH | /categories/{id} | 编辑分类 | 1.09 |
| DELETE | /categories/{id} | 删除分类（books.category_id 置空） | 1.09 |
| GET | /tags | 标签列表 | 1.10 |
| POST | /tags | 新建标签 | 1.10 |
| PATCH | /tags/{id} | 编辑标签 | 1.10 |
| DELETE | /tags/{id} | 删除标签（级联清 book_tags） | 1.10 |
| GET | /books/{id}/relations | 书籍关联列表 | 1.29 |
| POST | /books/{id}/relations | 建立书籍关联 | 1.29 |
| DELETE | /books/{id}/relations/{relId} | 移除关联 | 1.29 |

### POST /categories
```json
{ "name": "工作能力提升", "parent_id": null }
```

### POST /tags
```json
{ "name": "方法论" }
```

---

## 5. 文件管理（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /books/{id}/files | 文件列表 | 2.05 |
| POST | /books/{id}/files | 上传文件（multipart） | 2.01/2.02/2.03 |
| GET | /books/{id}/files/{fileId} | 文件元信息 | 2.05/2.09 |
| GET | /books/{id}/files/{fileId}/download | 下载（支持 Range） | 2.06 |
| PATCH | /books/{id}/files/{fileId} | 编辑（设主阅读文件等） | 2.04 |
| DELETE | /books/{id}/files/{fileId} | 删除关联（可选删物理文件） | 2.07 |
| PUT-REPLACE | POST /books/{id}/files/{fileId}/replace | 替换文件（multipart） | 2.08 |

### POST /books/{id}/files

请求：`multipart/form-data`，字段 `file`（二进制）、`is_primary`（bool，可选）。
后端处理：存储到挂载卷、抽取 EPUB 封面缓存、计算 checksum、识别格式。
响应 201：`{ "data": { "id": 9, "file_format": "EPUB", "is_primary": true, "cover_path": "..." } }`

### GET .../download

响应：文件流，`Content-Type` 按 mime，支持 `Range` 请求（阅读器分块加载）。

> 文件端点统一走 books 子路径，权限与书一致；EPUB 封面通过 `/books/{id}/cover` 便捷端点提供（缓存）。

---

## 6. 回收站与状态历史（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /trash | 回收站书籍列表 | 1.25 |
| POST | /trash/{bookId}/restore | 恢复书籍 | 1.25 |
| DELETE | /trash/{bookId} | 彻底删除 | 1.25 |
| DELETE | /trash | 清空回收站 | 1.25 |
| GET | /books/{id}/status-history | 状态变更时间轴 | 1.26 |

### GET /books/{id}/status-history
```json
{ "data": [ { "from_status": "PLANNED", "to_status": "READING", "changed_at": "..." } ] }
```

> 删除书籍（§3 DELETE /books/{id}）= 移入回收站（置 deleted_at），与 `存` 状态完全不同路径。

---

## 7. OPDS（S1）

独立路径，HTTP Basic 认证，输出 Atom XML（OPDS 1.2）。

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /opds/catalog | 根目录 acquisition feed | 8.01 |
| GET | /opds/by-status?status=READING | 按状态筛选 | 8.02 |
| GET | /opds/by-tag?tag=方法论 | 按标签筛选 | 8.02 |
| GET | /opds/search?q={query} | 搜索接口 | 8.03 |
| GET | /opds/book/{id}/file | 下载链接（复用文件端点） | 8.04 |

> KOReader 兼容性需实测；内容协商：`Accept: application/atom+xml` 返回 OPDS，否则 JSON。

---

## 8. 导出与备份（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /export/books | 导出元数据（format=json/csv，可选 ids） | 6.01/6.02/6.03 |
| GET | /export/books/{id}/notes | 导出单书笔记（format=md/json） | 6.04 |
| GET | /export/books/{id}/highlights | 导出高亮 | 6.05 |
| GET | /export/books/{id}/marks | 导出标记 | 6.06 |
| GET | /books/{id}/files/{fileId}/download | 文件下载（见 §5） | 6.07 |
| POST | /backup/full | 手动全量备份，返回 ZIP 流 | 6.08 |
| GET | /backup/list | 列出自动备份副本 | 6.09 |
| POST | /backup/trigger | 手动触发一次自动备份 | 6.09 |
| POST | /import/notes | 导入外部笔记（multipart Markdown） | 6.10 |

### GET /export/books
query：`format`（json/csv）、`ids`（逗号分隔，缺省全书架）。
响应：文件下载。

### POST /backup/full
响应：`application/zip` 流（DB + 原始文件 + Markdown 副本）。

> 笔记/高亮导出在 S1 接口预留但无数据（笔记 S2 才有），返回空结构；S2 激活。

---

## 9. 概览（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /overview/summary | 书架总数、各状态数量 | 5.02/5.03 |
| GET | /overview/recent?type=added\|reading | 最近新增/最近阅读 | 5.04/5.05 |
| GET | /overview/stats | 高亮数、笔记数（S2 激活前为 0） | 5.06/5.07 |

### GET /overview/summary
```json
{ "data": { "total": 142, "by_status": { "COLLECTED": 30, "PLANNED": 20, "READING": 5, "READ": 80, "STORED": 7 } } }
```

> 阅读统计增强（5.09–5.17）属待定位，本期不做。

---

## 10. 设置（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /settings | 读取配置 | — |
| PATCH | /settings | 更新配置 | — |

配置项示例：`recycle_retention_days`、`theme`、`ai_provider`、`oss_config`、`tts_config`（后两者 S1 仅存配置，功能后置）。

---

## 11. 阅读器与笔记（S2 预留）

进场后细化字段。端点清单：

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /books/{id}/reader | 获取主 EPUB 阅读入口（文件流） | 3.01 |
| GET / PUT | /books/{id}/progress | 读取/保存 CFI 进度 | 3.02/3.03 |
| GET / POST | /books/{id}/highlights | 高亮列表/新建 | 3.04/3.05 |
| PATCH / DELETE | /books/{id}/highlights/{hid} | 编辑/删除高亮（含附注） | 3.06–3.10/3.19 |
| GET / POST | /books/{id}/notes | 笔记列表/新建 | 3.11 |
| PATCH / DELETE | /books/{id}/notes/{nid} | 编辑/删除笔记 | 3.12/3.13 |
| GET | /books/{id}/traces | 单书阅读痕迹汇总 | 3.14 |
| GET | /notes/search?q= | 笔记全文搜索 | 3.20 |

> 跳回原文（3.15/3.16）由前端据 CFI 实现，无独立端点。标记体系（3.17/3.18）并入高亮/笔记的 mark_type 字段。

---

## 12. AI 能力（S3 预留）

阶段一进场后细化。端点清单（均 SSE 流式或 JSON）：

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| POST | /ai/metadata/suggest | 元数据补全/标签/分类建议 | 9.01–9.03 |
| POST | /ai/duplicates | 重复发现（AI 增强版） | 9.04 |
| POST | /ai/books/{id}/summarize | 高亮/笔记/章节摘要 | 9.05–9.07 |
| POST | /ai/books/{id}/questions | 阅读问题整理 | 9.08 |
| POST | /ai/answer | 基于书库问答（阶段二 RAG） | 9.13 |
| GET / DELETE | /ai/assets | AI 派生资产列表/删除 | 9.14/9.15 |

> 所有 AI 能力经 `AIService` 接口；引用依据在响应 `references` 字段（9.16/9.17）；分级访问（9.18）阶段三接入检索层过滤。

---

## 13. 主题阅读（P2 预留）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET / POST | /topics | 主题列表/新建 | 4.01/4.04/4.05/4.06 |
| GET / PATCH / DELETE | /topics/{id} | 主题详情/编辑/删除 | 4.02/4.03 |
| POST / DELETE | /topics/{id}/books | 关联/移除书籍 | 4.07/4.08 |
| POST / DELETE | /topics/{id}/highlights | 关联/移除高亮（软引用） | 4.10 |
| POST / DELETE | /topics/{id}/notes | 关联/移除笔记 | 4.11 |
| POST / DELETE | /topics/{id}/segments | 关联/移除章节片段 | 4.09 |
| GET / POST / PATCH / DELETE | /topics/{id}/entries | 问题/判断/比较 | 4.12–4.14 |
| GET | /topics/{id}/traces | 主题内痕迹汇总 | 4.15 |
| GET | /topics/{id}/search?q= | 主题内检索 | 4.17 |

> 删主题级联清引用，不动原始书籍/高亮/笔记（数据模型 `ON DELETE CASCADE`）。

---

> 本文档为 Redesk API 接口 v1.0，待评审。S1 端点可直接进入实现；S2/S3/P2 端点清单作为预留，进场时补全字段。
