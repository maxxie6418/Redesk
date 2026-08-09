# R2 文件名兼容性修复 Spec

## Why

通过 Cloudflare R2 等 S3 兼容对象存储上传书籍时，中文 EPUB 文件名可能在 multipart 解析阶段变成乱码；当前实现还将该文件名直接作为对象键，导致用户看到的名称、下载名称和对象键同时受影响，并存在同名覆盖及特殊字符 URL 兼容风险。

## What Changes

### 上传文件名

- Fastify multipart 以 UTF-8 解析文件名参数。
- 新上传或替换的书籍文件将原始文件名保存到 `book_files.original_filename`。
- `original_filename` 是用户可见文件名的唯一来源，用于文件列表、详情和下载。

### 对象存储键

- 书籍文件的内部存储键不再使用用户文件名。
- 已关联书籍文件使用由书籍 ID、随机存储令牌和原扩展名构成的 ASCII 键。
- 未关联文件使用由所有者 ID、随机存储令牌和原扩展名构成的 ASCII 键。
- 文件替换沿用临时键写入、数据库更新和移动到正式键的既有原子流程。

### 下载文件名

- Web 下载与 OPDS 下载共用安全的 Content-Disposition 文件名构造规则。
- 响应同时提供 ASCII fallback `filename` 与 UTF-8 百分号编码的 `filename*`。
- 响应头构造会移除 CR/LF 等控制字符，避免由上传文件名导致响应头注入。

## Impact

- Affected code:
  - `apps/api/src/server.ts`：multipart 文件名字符集配置。
  - `apps/api/src/routes/files.ts`：书籍文件键、上传、替换与 Web 下载响应头。
  - `apps/api/src/routes/opds.ts`：OPDS 下载响应头。
  - `apps/api/src/routes/*.test.ts` 或适合的现有测试文件：中文展示名、ASCII 对象键、下载响应头回归测试。
- 数据库 schema 和 migration 不变：`book_files.original_filename` 已存在。
- 前端上传保持 `FormData.append('file', file)`，无需额外转码。

## Requirements

### Requirement: 新上传文件显示原始中文名

系统 SHALL 将 multipart 正确解析出的原始 UTF-8 文件名写入 `book_files.original_filename`。

#### Scenario: 上传中文 EPUB

- **WHEN** 用户上传名称为 `三体（全集）.epub` 的 EPUB 文件
- **THEN** 文件列表、详情接口返回的 `original_filename` 为 `三体（全集）.epub`
- **AND** 不出现乱码替代名称

### Requirement: 内部键不包含用户文件名

系统 SHALL 为每一个新上传或替换的书籍文件生成唯一 ASCII 对象键，并保留原扩展名。

#### Scenario: 同名文件重复上传

- **WHEN** 用户对同一本书上传两个名称相同的 EPUB 文件
- **THEN** 两个文件拥有不同的存储键
- **AND** 后上传的文件不会覆盖先前文件

#### Scenario: 中文文件名上传到 R2

- **WHEN** 用户上传中文、空格或 URL 特殊字符组成的文件名
- **THEN** 传入 R2/S3 SDK 的对象键仅含安全 ASCII 路径片段
- **AND** 用户可见名称仍为原文件名

### Requirement: 替换文件保留新展示名

系统 SHALL 在替换书籍文件后更新 `original_filename` 为替换文件的原始文件名，并将记录指向新的唯一 ASCII 键。

#### Scenario: 替换为另一份中文 EPUB

- **WHEN** 用户替换现有书籍文件
- **THEN** 下载与文件列表显示替换文件的中文名称
- **AND** 旧对象在成功切换后按既有逻辑删除

### Requirement: 下载保留中文文件名

系统 SHALL 在 Web 与 OPDS 下载响应中返回安全的 `Content-Disposition`。

#### Scenario: 浏览器下载中文名

- **WHEN** 用户下载原始名称为 `三体.epub` 的文件
- **THEN** 响应包含 ASCII fallback `filename`
- **AND** 响应包含 `filename*=UTF-8''` 的 UTF-8 文件名
- **AND** 支持 RFC 5987 的客户端保存为 `三体.epub`

### Requirement: 历史数据不自动迁移

本次修复 SHALL 仅影响新上传和新替换的文件，不自动猜测或重写已有 `original_filename`、`remote_key` 或本地路径。

#### Scenario: 已有乱码历史记录

- **WHEN** 数据库中存在历史乱码文件名或旧对象键
- **THEN** 系统不修改该记录或移动对应对象
- **AND** 历史修复作为独立、可审计的后续任务处理

## Error Handling

- 不对已解析的文件名执行猜测性 Latin-1/UTF-8 反转码。
- 文件格式校验仍以扩展名为准，沿用现有验证错误格式。
- 存储写入或替换移动失败时，沿用现有回滚与临时对象清理流程。

## Testing

- 覆盖生成的关联与未关联文件键均为 ASCII、唯一且保留扩展名。
- 覆盖中文文件名作为展示名保存。
- 覆盖 Web 与 OPDS 下载响应均包含正确的 UTF-8 `filename*` 和安全 ASCII fallback。
- 覆盖控制字符从下载响应头文件名中被清除。
