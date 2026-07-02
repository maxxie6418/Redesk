# Redesk API 接口

> 定义 Redesk 后端 HTTP 接口契约：通用约定、Step1 详细端点、Step2/Step3 预留端点。是前后端联调与实现的直接依据。

| 项目 | 内容 |
| --- | --- |
| 文档名称 | Redesk API 接口 |
| 当前版本 | v1.1.1 |
| 文档状态 | 待评审 |
| 最后更新 | 2026-07-02 |
| 适用范围 | 全项目实现期 |
| 关联文档 | 数据模型.md、技术方案.md、功能清单.md |

## 修改记录

| 版本 | 日期 | 修改摘要 | 修改人 |
| --- | --- | --- | --- |
| v1.0.0 | 2026-06-27 | 建立 API 接口初始框架：通用约定、Step1 详细端点、Step2/3 预留端点清单 | — |
| v1.0.1 | 2026-06-27 | 补充版本号规范引用；版本号改为三段式（主.次.修订） | — |
| v1.0.2 | 2026-06-27 | 补充元数据链接预填接口、书籍弹性字段、配置密钥脱敏规则与主题软删除说明 | — |
| v1.0.3 | 2026-06-28 | M1-B 完成：FTS5 搜索、批量操作、状态历史、回收站全部落地；新增设置/用户管理/系统端点；鉴权动态化（多用户开关） | — |
| v1.0.4 | 2026-06-28 | M1-C 完成：分类 CRUD、标签 CRUD、书籍关联管理、规则版重复检测全部落地；彻底删除时同步清理 book_relations | — |
| v1.0.5 | 2026-06-28 | M1-D 完成：multipart 文件上传/替换/下载（Range）/删除全部落地；EPUB 封面自动抽取并挂载 `/books/{id}/cover` 端点；文件元信息增改（设主/改文件名）；非 EPUB 文件全格式支持 | — |
| v1.0.6 | 2026-06-28 | M1-E 完成：元数据导出 JSON/CSV 全部落地；全量备份 ZIP 流式打包（archiver，DB+文件+Markdown）；自动备份 VACUUM（保留7份）含列表/触发端点；笔记/高亮/标记导出预留空实现（S2 激活）；外部笔记导入 Markdown 解析+书名模糊匹配 | — |
| v1.0.7 | 2026-06-28 | M1-F/G/H 闭环：OPDS 1.2（catalog/by-status/by-tag/search/download + HTTP Basic）；概览端点 GET /overview；暗色模式全局开关；回收站保留期；自定义属性 custom_attributes；灰置阅读按钮+阅读痕迹占位 | — |
| v1.0.8 | 2026-06-28 | M1 复查修正：概览端点合并为 GET /overview（含 total/status_counts/recent_added/recent_reading）；OPDS download 说明改为 acquisition 链接复用文件端点；metadata/preview 标注未落地；设置配置项补充 llm_provider/llm_api_key/llm_model/llm_base_url；密钥脱敏新增 llm_api_key | — |
| v1.0.9 | 2026-06-29 | M1 书架数据层与文件管理增强（P1/P2）：POST /books author 改可选，补充 subtitle/translator/original_title/page_count/source_url 等全字段；筛选新增 favorited/has_files/genre_category_id；新增书库文件端点 GET /files、未关联文件池 POST/GET/DELETE /files/unassociated、文件匹配书籍 POST /files/{id}/match | — |
| v1.0.10 | 2026-06-29 | 文件管理风险收口：书库文件与未关联文件池按 owner_id 隔离；checksum 去重范围明确为当前用户书库；彻底删除书籍同步清理关联文件记录与物理文件；匹配接口以 POST /files/{fileId}/match 为准 | AI |
| v1.0.11 | 2026-06-29 | 新增书籍元数据批量导入：提供 CSV 模板下载 GET /books/import/template，支持 multipart CSV 导入 POST /books/import；导入仅创建书籍元数据，不包含文件 | AI |
| v1.1.0 | 2026-07-01 | 存储策略三态改造：book_files/book_covers 增加 storage_mode/local_path/remote_key/primary_location/sync_status；上传接口支持 `storage_mode` 字段；新增默认存储方式设置 `default_storage_mode`；设置页增加批量上传弹窗；云未配置时禁用 `cloud_only`/`dual` | AI |
| v1.1.1 | 2026-07-02 | 鉴权与文件管理修正：会话改为长期保持直至主动退出；封面管理补充 PATCH/DELETE 跨域支持；新封面在无活动封面时自动设为当前封面 | AI |

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
11. [用户管理（S1）](#11-用户管理s1)
12. [系统管理（S1）](#12-系统管理s1)
13. [阅读器与笔记（S2 预留）](#13-阅读器与笔记s2-预留)
14. [AI 能力（S3 预留）](#14-ai-能力s3-预留)
15. [主题阅读（P2 预留）](#15-主题阅读p2-预留)

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
| page_size | int | 20 | 每页条数，上限 500 |
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
| q | 全文关键词（FTS5 全文检索，命中 title/author/isbn） | 1.13 |
| status | 状态，逗号分隔多值 | 1.15 |
| category_id | 个人分类 | 1.16 |
| genre_category_id | 常规分类 | 1.16 |
| tag_id | 标签，逗号分隔（AND 关系） | 1.17 |
| visibility | PUBLIC/PRIVATE | 1.18 |
| favorited | true 仅收藏 | 1.x |
| has_files | true 仅含文件；false 仅无文件 | 2.x |
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
| GET | /auth/status | 查询系统初始化状态（是否需要首次设置） |
| POST | /auth/setup | 首次初始化管理员账户（仅当用户数为 0 时可用） |
| POST | /auth/login | 登录，成功设会话 Cookie |
| POST | /auth/logout | 登出，清除会话 |
| GET | /auth/me | 当前用户信息 |

> 鉴权模式由 settings 表中的 `multi_user` 键动态控制：`"true"` 时需密码登录（多用户模式）；`"false"` 或不存时自动以默认管理员身份免登录（单用户模式）。免登录模式下 `/auth/status` 返回 `needs_setup: false`，`/auth/login` 直接登入。
>
> 单用户模式下默认管理员账户由后端首次启动时自动创建（用户名 `admin`，密码 `redesk`），无需手动 setup。
>
> 当前会话 Cookie 为长期保持策略：登录成功后持续有效，直到用户主动调用 `/auth/logout` 退出；后续版本再开放默认天数与管理员配置。

---

## 3. 书籍管理（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /books | 书籍列表（分页/筛选/排序） | 1.13–1.19 |
| POST | /books | 新建书籍 | 1.01/1.02 |
| GET | /books/{id} | 书籍详情 | 1.06/1.20 |
| PATCH | /books/{id} | 编辑元数据 | 1.05 |
| DELETE | /books/{id} | 移入回收站（软删除） | 1.07 |
| POST | /books/metadata/preview | 通过链接预填元数据（S1 接口预留，M1 后端暂未落地） | 1.03/1.04 |
| POST | /books/batch | 批量操作 | 1.28 |
| GET | /books/duplicates | 重复检测（规则版） | 1.27 |

### POST /books

请求（title 必填，其余全部可选）：
```json
{
  "title": "如何阅读一本书",
  "subtitle": "(...)",
  "author": "艾德勒",
  "translator": "...",
  "original_title": "How to Read a Book",
  "isbn": "9787100040945",
  "publisher": "商务印书馆",
  "publish_year": 2004,
  "description": "...",
  "language": "zh",
  "category_id": 3,
  "genre_category_id": 5,
  "status": "COLLECTED",
  "visibility": "PRIVATE",
  "reading_purpose": "精读",
  "rating": null,
  "page_count": 350,
  "source_url": "https://douban.com/...",
  "tag_ids": [5, 12],
  "custom_attributes": {
    "edition_note": "精装"
  }
}
```
> 支持 `multipart/form-data` 同时上传文件：字段与 JSON 一致，额外附加 `file` 二进制字段；可选附加 `storage_mode`（`local_only`/`cloud_only`/`dual`，缺省使用系统默认）。后端自动识别格式、抽取 EPUB 封面缓存、计算 checksum。

响应 201：`{ "data": { /* book 对象 */ } }`

### PATCH /books/{id}

请求：任意可更新字段子集（含 status、visibility、category_id、rating、tag_ids 等）。
状态变更同步写 status_history（见 §6）。
响应 200：`{ "data": { /* book */ } }`

### POST /books/metadata/preview

请求：
```json
{ "source_url": "https://neodb.social/book/..." }
```

响应 200：
```json
{
  "data": {
    "source": "neodb",
    "confidence": 0.92,
    "metadata": {
      "title": "如何阅读一本书",
      "author": "莫提默·J. 艾德勒",
      "isbn": "9787100040945",
      "publisher": "商务印书馆",
      "publish_year": 2004,
      "description": "..."
    },
    "warnings": []
  }
}
```

说明：该端点只做预填，不创建书籍；自动回填失败时返回可读错误或低置信度结果，前端允许用户手动补齐后再调用 `POST /books` 保存。

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
响应 201：`{ "data": { "id": 1, "name": "工作能力提升", "book_count": 0, ... } }`

### GET /categories
响应：`{ "data": [ { "id": 1, "name": "工作能力提升", "book_count": 3, ... } ] }`
> 每条分类附带 `book_count` 字段表示归属该分类的书籍数。

### POST /tags
```json
{ "name": "方法论" }
```
响应 201：`{ "data": { "id": 1, "name": "方法论", "book_count": 0, ... } }`

### GET /tags
响应：`{ "data": [ { "id": 1, "name": "方法论", "book_count": 5, ... } ] }`
> 每条标签附带 `book_count` 字段表示使用该标签的书籍数。

### GET /books/{id}/relations
响应：
```json
{
  "data": {
    "outgoing": [ { "id": 1, "target_book_id": 5, "target_title": "...", "target_author": "...", "relation_type": "续集", ... } ],
    "incoming": [ { "id": 2, "source_book_id": 3, "source_title": "...", "source_author": "...", "relation_type": "同主题", ... } ]
  }
}
```
> outgoing 是本书记录的主动关联，incoming 是其他书关联到本书的记录。

### POST /books/{id}/relations
```json
{ "target_book_id": 5, "relation_type": "续集", "note": "第二部" }
```
响应 201：`{ "data": { "id": 1, "source_book_id": 1, "target_book_id": 5, ... } }`

### GET /books/duplicates
query：`threshold`（可选，默认 0.6，0–1 之间）
响应：
```json
{ "data": [ { "book_id": 1, "duplicates": [2, 3], "score": 0.92 } ] }
```
> 规则版重复检测：基于作者（权重 0.3）+ 标题（权重 0.7）的最长公共子串相似度。score 为综合置信度。

---

## 5. 文件管理（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /books/{id}/files | 文件列表 | 2.05 |
| POST | /books/{id}/files | 上传文件（multipart），支持 `storage_mode` | 2.01/2.02/2.03 |
| GET | /books/{id}/files/{fileId} | 文件元信息 | 2.05/2.09 |
| GET | /books/{id}/files/{fileId}/download | 下载（支持 Range） | 2.06 |
| PATCH | /books/{id}/files/{fileId} | 编辑（设主阅读文件等） | 2.04 |
| DELETE | /books/{id}/files/{fileId} | 删除关联（可选删物理文件） | 2.07 |
| PUT-REPLACE | POST /books/{id}/files/{fileId}/replace | 替换文件（multipart） | 2.08 |

### 书库文件（全局视图）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /files | 书库文件列表（分页，支持 format/associated 筛选） | 2.x |
| POST | /files/unassociated | 上传未关联文件（进入文件池），支持 `storage_mode` | 2.x |
| GET | /files/unassociated | 未关联文件列表 | 2.x |
| DELETE | /files/unassociated/{fileId} | 删除未关联文件 | 2.x |
| POST | /files/unassociated/{fileId}/associate | 未关联文件关联到指定书籍 | 2.x |
| POST | /files/{fileId}/match | 将文件池中的文件匹配到指定书籍 | 2.x |

> `/files` 与 `/files/unassociated` 均只返回当前用户 `owner_id` 下的文件。checksum 去重范围为当前用户整个书库（已关联与未关联文件池），重复时返回 `DUPLICATE_FILE`。

### POST /books/{id}/files

请求：`multipart/form-data`，字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | 二进制 | 是 | 书籍文件 |
| `is_primary` | 字符串 `true` / `false` | 否 | 主文件切换显式标志 |
| `storage_mode` | `local_only` / `cloud_only` / `dual` | 否 | 缺省系统默认 |

`is_primary` 字段语义（与决策记录 2026-07-02 / WL-002 同步）：

- 严格只接受字符串 `true` / `false`，不接受 `1` / `0` 或其他值。
- 字段未传等价于"未传"，不构成"显式要求"。
- 非法值返回 400 `VALIDATION_ERROR`。
- 收到合法值后按主文件升/降规则处理：
  - 该书还没有任何主文件时，本文件**必须**自动设为主文件。
  - 已存在主文件时，仅在 `is_primary=true` 时切换。
  - `is_primary=false` / 未传：均表示"不切换"，不会把当前主文件降为非主文件。

后端处理：按 `storage_mode` 写入主端，另一端标记为 `pending`（`dual` 模式下），抽取 EPUB 封面缓存、计算 checksum、识别格式。
响应 201：`{ "data": { "id": 9, "file_format": "EPUB", "is_primary": true, "storage_mode": "local_only", "local_path": "...", "remote_key": null, "primary_location": "local", "sync_status": "synced" } }`

### POST /files/unassociated

请求：`multipart/form-data`，字段 `file`（二进制）、`storage_mode`（可选，缺省系统默认）。
未关联文件永远为非主文件（`is_primary=false`）。
响应 201：与 POST /books/{id}/files 结构一致。

### POST /files/unassociated/{fileId}/associate

请求体：`{ "book_id": <number> }`
将未关联文件关联到指定书籍。关联后按主文件升/降规则处理：

- 该书还没有任何主文件时，本文件自动设为主文件。
- 已存在主文件时，不切换主文件。

响应 200：返回更新后的 `bookFiles` 记录。

### POST /files/{fileId}/match

请求体：`{ "book_id": <number> }`
与 `POST /files/unassociated/{fileId}/associate` 语义一致：未关联文件匹配入书。匹配后按主文件升/降规则处理（无主则升、有主不动）。
响应 200：返回更新后的 `bookFiles` 记录。

### POST /books/{id}/files/{fileId}/replace

替换书籍文件内容但**保留记录 ID**。与决策记录 2026-07-02 / WL-003 同步。

请求：`multipart/form-data`，字段 `file`（二进制，必填）。

行为：

- 允许跨格式替换（如 `.epub` → `.pdf`）。
- 不限制只能替换主文件，主文件 / 非主文件均可替换。
- 替换后**保持原身份不变**（`is_primary` 字段不因本接口变化）。
- 替换后 `original_filename`、格式、`file_size`、校验值、存储位置、`updated_at` 同步更新。
- 跨 owner / 不存在 / 已删 全部返回 404，避免泄露资源存在性。
- 本版本替换接口**只处理文件资产**，不主动清理未来阅读留痕数据。

事务语义（"先新后旧"安全替换）：

1. 写新文件到 `books/{bookId}/.tmp/replace-{fileId}-{ts}{ext}` 临时 key。
2. DB 一次更新 metadata + path 指向正式 key。
3. `storage.move` 临时 → 正式（覆盖旧文件）。
4. 删除旧物理文件（best-effort，孤儿文件留给未来清理任务）。

任一步失败回滚到旧 path 并清理临时文件，**不允许出现"DB 已指向新文件但新文件不可用"的半成功状态**。

响应 200：返回替换后的 `bookFiles` 完整记录。

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

> `DELETE /trash/{bookId}` 与 `DELETE /trash` 是彻底删除：除书籍、标签关联、关系、状态历史外，也同步删除该书关联的 `book_files` 记录与物理文件。软删除 `DELETE /books/{id}` 不删除文件。

### GET /books/{id}/status-history
```json
{ "data": [ { "from_status": "PLANNED", "to_status": "READING", "changed_at": "..." } ] }
```

> 删除书籍（§3 DELETE /books/{id}）= 移入回收站（置 deleted_at），与 `存档` 状态完全不同路径。

---

## 7. OPDS（S1）

独立路径，HTTP Basic 认证，输出 Atom XML（OPDS 1.2）。

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /opds/catalog | 根目录 acquisition feed（导航链接 + 搜索描述） | 8.01 |
| GET | /opds/by-status?status=READING | 按状态筛选（READ/PLANNED/READ/STORED/COLLECTED） | 8.02 |
| GET | /opds/by-tag?tag=方法论 | 按标签筛选 | 8.02 |
| GET | /opds/search?q={query} | 搜索接口（无 q 时返回 OpenSearch Description） | 8.03 |

> 下载链接（8.04）不在 OPDS 独立路径下，每个 entry 的 `http://opds-spec.org/acquisition` 链接直接指向已有文件下载端点 `/api/v1/books/{id}/files/{fileId}/download`，由 OPDS 客户端自动获取。封面链接指向 `/api/v1/books/{id}/cover`。OPDS 认证使用 HTTP Basic，复用系统用户账号密码。

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
| GET | /books/import/template | 下载书籍元数据 CSV 导入模板 | 6.12 |
| POST | /books/import | 批量导入书籍元数据（multipart CSV，不含文件） | 6.12 |

### GET /export/books
query：`format`（json/csv）、`ids`（逗号分隔，缺省全书架）。
响应：文件下载。

### GET /books/import/template
响应：`text/csv; charset=utf-8` 文件下载。

模板字段：`title` 必填；`subtitle`、`author`、`translator`、`original_title`、`isbn`、`publisher`、`publish_year`、`page_count`、`language`、`status`、`visibility`、`rating`、`reading_purpose`、`category_name`、`genre_category_name`、`tag_names`、`source_url`、`cover_url`、`description` 可选。

### POST /books/import
请求：`multipart/form-data`，字段 `file` 为 CSV 文件；仅导入书籍元数据，不上传或关联书籍文件。

导入规则：
- `title` 必填；`status` 支持 `COLLECTED/PLANNED/READING/READ/STORED` 或中文别名；`visibility` 支持 `PUBLIC/PRIVATE` 或中文别名。
- `category_name`、`genre_category_name`、`tag_names` 按名称匹配，不存在时自动创建；`tag_names` 支持用 `;`、`；`、`、`、`|`、`/`、`，` 分隔。
- 已存在相同 ISBN 或相同「书名+作者」的书籍时跳过该行；其他校验失败仅影响当前行，不回滚整批。

响应 200：
```json
{
  "data": {
    "dry_run": false,
    "total": 10,
    "created": 8,
    "valid": 8,
    "skipped": 1,
    "failed": 1,
    "rows": [
      { "row": 2, "title": "如何阅读一本书", "success": true, "skipped": false, "book_id": 12, "error": null }
    ]
  }
}
```

### POST /backup/full
响应：`application/zip` 流（DB + 原始文件 + Markdown 副本）。

> 笔记/高亮导出在 S1 接口预留但无数据（笔记 S2 才有），返回空结构；S2 激活。

---

## 9. 概览（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /overview | 书架概览（总数、各状态数量、最近新增、最近在读） | 5.01–5.05 |

### GET /overview
```json
{
  "data": {
    "total": 142,
    "status_counts": {
      "COLLECTED": 30,
      "PLANNED": 20,
      "READING": 5,
      "READ": 80,
      "STORED": 7
    },
    "recent_added": [
      { "id": 1, "title": "...", "author": "...", "status": "COLLECTED", "created_at": "..." }
    ],
    "recent_reading": [
      { "id": 2, "title": "...", "author": "...", "status": "READING", "updated_at": "..." }
    ]
  }
}
```

> 概览端点合并返回全部数据（总数 + 状态分布 + 最近列表），前端一次请求即可渲染概览页。高亮/笔记数量（5.06/5.07）随 S2 激活后在同一端点追加 `reading_stats` 字段。阅读统计增强（5.09–5.17）属待定位，本期不做。

---

## 10. 设置（S1）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET | /settings | 读取全部配置（脱敏） | — |
| PATCH | /settings | 批量更新配置（upsert） | — |

配置项（当前已实现）：

| 键 | 类型 | 说明 |
| --- | --- | --- |
| recycle_retention_days | string | 回收站保留天数，默认 `"30"` |
| theme | string | 界面主题：`"light"` / `"dark"` / `"system"` |
| multi_user | string | 多用户开关：`"true"` 开启、`"false"` 关闭 |
| auth_mode | string | 鉴权模式：`"single_token"` / `"multi_token"` |
| brute_force_window_minutes | string | 暴力尝试统计窗口（分钟） |
| brute_force_max_attempts | string | 暴力尝试窗口内最大失败次数 |
| brute_force_lock_minutes | string | 触发保护后的锁定时长（分钟） |
| default_storage_mode | string | 默认存储方式：`"local_only"` / `"cloud_only"` / `"dual"` |
| storage_driver | string | 保留项，已废弃；新逻辑仅依据云配置可用性判断 |
| llm_provider | string | LLM 提供商：`""` / `"openai"` / `"anthropic"` / `"deepseek"` / `"ollama"` |
| llm_api_key | string | LLM API Key（回读脱敏） |
| llm_model | string | LLM 模型名，如 `"gpt-4o"` / `"claude-3.5-sonnet"` |
| llm_base_url | string | LLM 自定义 API 地址（可选，留空用默认） |
| oss_provider | string | OSS 提供商：`""` / `"aliyun"` / `"s3"` / `"minio"` |
| oss_endpoint | string | OSS Endpoint |
| oss_bucket | string | OSS Bucket |
| oss_access_key | string | OSS Access Key（回读脱敏） |
| oss_secret_key | string | OSS Secret Key（回读脱敏） |

说明：当前不再提供 `session_expires_days` 配置项。登录状态固定为长期保持，直到用户主动退出。

密钥规则：`llm_api_key`、`oss_access_key`、`oss_secret_key` 等敏感字段写入时接收明文，读取时脱敏返回（如 `sk-****abcd`）。日志、错误响应和导出文件不得包含明文 secret。AI 功能（录入辅助、阅读辅助、RAG）在各里程碑激活后读取这些配置；配置可提前保存但不立即生效。

### GET /storage/status

响应：
```json
{
  "data": {
    "defaultStorageMode": "local_only",
    "cloudAvailable": false,
    "configured": false,
    "provider": null,
    "bucket": null,
    "endpoint": null,
    "hasAccessKey": false,
    "hasSecretKey": false,
    "region": null,
    "publicUrl": null,
    "reason": "配置不完整，缺少：oss_endpoint, oss_bucket, oss_access_key, oss_secret_key"
  }
}
```

### PATCH /storage/settings

请求：与 §10 配置项一致；新增 `default_storage_mode` 必填。

---

## 11. 用户管理（S1）

仅多用户模式（`multi_user: "true"`）下可用；单用户模式下返回 422。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /users | 用户列表 |
| POST | /users | 创建用户（用户名唯一） |
| PATCH | /users/{id} | 编辑用户昵称 |
| DELETE | /users/{id} | 删除用户（不能删自己） |
| POST | /users/{id}/reset-password | 重置密码 |

### POST /users
```json
{ "username": "newuser", "password": "123456", "display_name": "新用户" }
```
响应 201：`{ "data": { "id": 2, "username": "newuser", "display_name": "新用户", "created_at": "..." } }`

### POST /users/{id}/reset-password
```json
{ "password": "newpassword" }
```
响应 200：`{ "data": { "id": 2, "reset": true } }`

---

## 12. 系统管理（S1）

权限矩阵（与 [决策记录 2026-07-02](决策记录.md) 同步）：

- 登录用户可读：`GET /system/stats`、`GET /system/storage`。
- 仅管理员可写：`POST /system/backup`、`POST /system/fts-rebuild`、`POST /system/clear-cache`、`POST /system/reset`。
- 错误码：未登录 401；已登录非管理员访问写接口 403。
- 免登录模式（`VITE_AUTH_DISABLED=true` / `AUTH_DISABLED=true`）视为默认管理员会话，鉴权层统一放行。

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | /system/stats | 系统统计（DB 大小/存储/书籍/文件数） | 登录可读 |
| GET | /system/storage | 存储目录分布与 OSS 配置 | 登录可读 |
| POST | /system/backup | 手动备份（VACUUM INTO） | 管理员 |
| POST | /system/fts-rebuild | 重建 FTS5 全文索引 | 管理员 |
| POST | /system/clear-cache | 清理 tmp 缓存 | 管理员 |
| POST | /system/reset | 清库 + 重跑迁移（高破坏性，需二次口令验证） | 管理员 |

### GET /system/stats
```json
{
  "data": {
    "version": "1.0.6",
    "node_env": "production",
    "node_version": "v20.x",
    "sqlite_version": "3.x",
    "uptime_seconds": 3600,
    "db_size_bytes": 2457600,
    "storage_size_bytes": 47185920,
    "book_count": 142,
    "trash_count": 3,
    "file_count": 35,
    "tag_count": 12,
    "category_count": 5,
    "user_count": 1
  }
}
```

> `user_count` 仅对管理员返回，非管理员请求该字段为 `undefined`。
> `db_path` 绝对路径不再返回，避免向登录可读接口暴露全库物理位置。

### GET /system/storage
```json
{
  "data": {
    "db_size_bytes": 2457600,
    "total_files": 142,
    "total_size_bytes": 47185920,
    "breakdown": {
      "books":    { "file_count": 35, "size_bytes": 47185920 },
      "covers":   { "file_count": 140, "size_bytes": 0 },
      "backups":  { "file_count": 1, "size_bytes": 2457600 },
      "tmp":      { "file_count": 0, "size_bytes": 0 },
      "unassociated": { "file_count": 0, "size_bytes": 0 }
    },
    "oss": {
      "configured": false,
      "provider": "",
      "endpoint": "",
      "bucket": ""
    }
  }
}
```

> 不暴露全库绝对路径与全局磁盘细节，仅返回用户范围汇总。

### POST /system/backup
请求体：无需参数。
响应 200：`{ "data": { "path": "<relative-path>", "success": true } }`
未登录 401；非管理员 403。

### POST /system/fts-rebuild
请求体：无需参数。
响应 200：`{ "data": { "success": true } }`
未登录 401；非管理员 403。

### POST /system/clear-cache
请求体：无需参数。
响应 200：`{ "data": { "success": true, "freed_bytes": 0, "removed_files": 0 } }`
未登录 401；非管理员 403。

### POST /system/reset
请求体：
```json
{ "password": "当前管理员口令" }
```
响应 200：`{ "data": { "success": true, "message": "应用已重置，请刷新页面后重新设置管理员账户" } }`
未登录 401；非管理员 403；口令错误 401。

---

## 13. 阅读器与笔记（S2 预留）

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

## 14. AI 能力（S3 预留）

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

## 15. 主题阅读（P2 预留）

| 方法 | 路径 | 说明 | 功能 |
| --- | --- | --- | --- |
| GET / POST | /topics | 主题列表/新建 | 4.01/4.04/4.05/4.06 |
| GET / PATCH / DELETE | /topics/{id} | 主题详情/编辑/软删除 | 4.02/4.03 |
| POST / DELETE | /topics/{id}/books | 关联/移除书籍 | 4.07/4.08 |
| POST / DELETE | /topics/{id}/highlights | 关联/移除高亮（软引用） | 4.10 |
| POST / DELETE | /topics/{id}/notes | 关联/移除笔记 | 4.11 |
| POST / DELETE | /topics/{id}/segments | 关联/移除章节片段 | 4.09 |
| GET / POST / PATCH / DELETE | /topics/{id}/entries | 问题/判断/比较 | 4.12–4.14 |
| GET | /topics/{id}/traces | 主题内痕迹汇总 | 4.15 |
| GET | /topics/{id}/search?q= | 主题内检索 | 4.17 |

> 删除主题为软删除：仅设置 `topics.deleted_at` 并隐藏主题及其引用，不动原始书籍/高亮/笔记，也不物理清空引用表。原始高亮/笔记被物理删除时，对应引用按数据模型自动摘除。

---

> 本文档为 Redesk API 接口 v1.0.2，待评审。S1 端点可直接进入实现；S2/S3/P2 端点清单作为预留，进场时补全字段。
