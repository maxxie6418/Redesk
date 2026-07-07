# 书籍详情页 P0-P1 重构 Spec

## Why

`apps/web/src/components/book-detail-sheet/page.tsx` 在前面几轮拆分后仍承载 615 行胶水、12 个 useState、16 个 useCallback，内部多处重复定义已经存在于 `types.ts` 的常量/格式化函数；`components.tsx` 也仍内联了一份与独立文件重复的 `StorageStatusBadge`。这些重复让详情页维护成本偏高、且单位/容量格式在两处不一致。`page.tsx` 内的 tabs 导航和 message 模式也都可以收敛。

## What Changes

- 移除 `page.tsx` 中本地 `formatFileSize` / `COVER_TONES`，统一使用 `types.ts` 中的导出。
- 移除 `components.tsx` 中内联的 `StorageStatusBadge`，改用 `./storage-status-badge` 独立文件版本。
- 抽出 `BookDetailTabs` 组件，承担竖排 tab 导航逻辑。
- 抽出 `useDetailMessages` hook，收敛 6+ 处 `setMessage + setTimeout` 重复模式。
- 抽出 `useBookActions` hook（收藏 / 封面 / 删除 / 抓取元数据）。
- 抽出 `useMetadataDialog` hook（4 个 state + 2 个 handler + 字段勾选初始化逻辑）。
- 抽出 `useReaderNavigation` hook（跳转阅读器 / 跳 cfi）。

**BREAKING** 无：所有改动是内部重构，组件对外 API 不变，业务行为不变。

## Impact

- Affected specs:
  - `book-detail-sheet` 模块的 UI/状态层
- Affected code:
  - `apps/web/src/components/book-detail-sheet/page.tsx`
  - `apps/web/src/components/book-detail-sheet/components.tsx`
  - `apps/web/src/components/book-detail-sheet/storage-status-badge.tsx`
  - `apps/web/src/components/book-detail-sheet/types.ts`
  - 新增 `apps/web/src/components/book-detail-sheet/book-detail-tabs.tsx`
  - 新增 `apps/web/src/components/book-detail-sheet/use-detail-messages.ts`
  - 新增 `apps/web/src/components/book-detail-sheet/use-book-actions.ts`
  - 新增 `apps/web/src/components/book-detail-sheet/use-metadata-dialog.ts`
  - 新增 `apps/web/src/components/book-detail-sheet/use-reader-navigation.ts`

## ADDED Requirements

### Requirement: 重复定义收敛

`page.tsx` 中本地 `formatFileSize` / `COVER_TONES` 必须删除，并使用 `./types` 中的同名导出。

`components.tsx` 中内联的 `StorageStatusBadge` 必须删除，改为从 `./storage-status-badge` 导入。

#### Scenario: 单位格式统一

- **WHEN** 渲染文件大小或缺省封面占位
- **THEN** 全站仅有一份格式化实现，输出与 `types.ts` 保持一致

#### Scenario: 存储徽章复用

- **WHEN** 渲染文件行
- **THEN** 渲染的徽章是 `./storage-status-badge` 的实现

### Requirement: BookDetailTabs 组件

`BookDetailTabs` 组件必须封装竖排 tab 列表，包含激活样式、tint、icon、点击切换逻辑。

#### Scenario: 切换 tab

- **WHEN** 用户点击某个 tab
- **THEN** 调用 `onChange(tabId)`，并如果 `editMode=true` 时同时关闭

### Requirement: useDetailMessages hook

`useDetailMessages` hook 必须暴露：

- `message: StatusMessage`
- `info(text: string)`
- `error(text: string)`
- `warning(text: string)`
- `clear()`

#### Scenario: 调用 info

- **WHEN** 调用 `info('封面已上传')`
- **THEN** 2 秒后自动清除

#### Scenario: 失败报错

- **WHEN** 业务调用抛出 `ApiError`
- **THEN** `error(err.message)` 被调用

### Requirement: useBookActions hook

`useBookActions(bookId, book, callbacks)` 必须封装：

- `handleFavorite`
- `handleFetchCover`
- `handleActivateCover`
- `handleDeleteCover`
- `handleCoverUpload`
- `handleRequestBookDelete` + `handleConfirmBookDelete`
- `handleRequestFileDelete` + `handleConfirmFileDelete`
- `handleOpenMetadataDialog` + `handleApplyMetadata`

并通过参数注入 `showInfo / showError / setPendingBookDelete / setPendingFileDelete / setShowCoverPanel / onClose`。

#### Scenario: 收藏切换

- **WHEN** 用户点击收藏按钮
- **THEN** 根据当前 `favorited_at` 调 `favoriteBook` 或 `unfavoriteBook`

#### Scenario: 抓取封面失败

- **WHEN** 抓取封面 mutation 抛错
- **THEN** 调用 `showError('封面下载失败' | err.message)`

### Requirement: useMetadataDialog hook

`useMetadataDialog({ book })` 必须返回：

- `showDialog: boolean`
- `metadataResult: LinkMetadata | null`
- `selectedFields: Record<string, boolean>`
- `fetchCoverChecked: boolean`
- `openDialog()`
- `closeDialog()`
- `applyDialog()`

#### Scenario: 打开弹窗

- **WHEN** `openDialog()` 被调用且 `book.source_url` 为空
- **THEN** 调用方 `showError('请先填写介绍页链接')` 并不打开弹窗

#### Scenario: 字段预勾选

- **WHEN** 抓取结果中有字段且当前为空
- **THEN** 该字段在 `selectedFields` 中为 `true`

### Requirement: useReaderNavigation hook

`useReaderNavigation(bookId)` 必须返回：

- `openMarkInReader(mark)`
- `openTraceInReader(trace)`
- `openReader()`

#### Scenario: 跳 cfi

- **WHEN** `mark.cfi` 存在
- **THEN** 跳转 `/books/${bookId}/read?cfi=...`

## MODIFIED Requirements

### Requirement: page.tsx 状态机收敛

`page.tsx` 必须把以下状态/回调下移到上述 hook：

- 8 个 message 模式重复
- 8 个 useCallback
- 4 个 metadata dialog state
- tabs 导航 JSX

#### Scenario: page.tsx 行数下降

- **WHEN** 全部 hook 与组件替换完成
- **THEN** `page.tsx` 总行数从 615 行下降到 400 行以下

## REMOVED Requirements

### Requirement: page.tsx 内联 formatFileSize

**Reason**: 与 `types.ts` 重复，且两处容量单位不一致。

**Migration**: 全部改用 `import { formatFileSize } from './types'`。

### Requirement: page.tsx 内联 COVER_TONES

**Reason**: 与 `types.ts` 完全重复。

**Migration**: 全部改用 `import { COVER_TONES } from './types'`。

### Requirement: components.tsx 内联 StorageStatusBadge

**Reason**: 与独立文件 `storage-status-badge.tsx` 重复。

**Migration**: 改用 `import { StorageStatusBadge } from './storage-status-badge'`。
