# Checklist

## 阶段 P0 - 收敛重复定义

- [x] `page.tsx` 内不再有 `formatFileSize` / `COVER_TONES` 本地定义，改用 `./types` 导入
- [x] `components.tsx` 内不再有内联 `StorageStatusBadge` / `STORAGE_MODE_LABELS`，改用 `./storage-status-badge` 与 `./types` 导入
- [x] `pnpm typecheck` 通过
- [x] `pnpm lint` 通过
- [x] `pnpm --filter @redesk/web test` 通过（13 个测试）
- [x] `pnpm --filter @redesk/api test` 通过（72 个测试）
- [x] 提交 `chore(book-detail): 收敛重复定义` 并成功推送

## 阶段 P1.1 - 抽出 BookDetailTabs

- [x] 新文件 `book-detail-tabs.tsx` 存在
- [x] `page.tsx` 460-488 行 tab JSX 已被 `<BookDetailTabs />` 替换
- [x] 切换 tab 行为不变（含 `editMode=true` 时自动关闭）
- [x] `pnpm typecheck` / `pnpm lint` 通过
- [x] Web/API 测试通过
- [x] 提交 `refactor(book-detail): 抽出 BookDetailTabs` 并成功推送

## 阶段 P1.2 - 抽出 useDetailMessages

- [x] 新文件 `use-detail-messages.ts` 存在，导出 `useDetailMessages`
- [x] `page.tsx` 中 6+ 处 `setMessage + setTimeout` 被替换为 `info / error` 调用
- [x] 自动 2s 清除行为不变
- [x] `pnpm typecheck` / `pnpm lint` 通过
- [x] Web/API 测试通过
- [ ] 提交 `refactor(book-detail): 抽出 useDetailMessages` 并成功推送

## 阶段 P1.3 - 抽出 useReaderNavigation

- [ ] 新文件 `use-reader-navigation.ts` 存在
- [ ] `page.tsx` 中 `openMarkInReader` / `openTraceInReader` 改为 hook 调用
- [ ] 跳 cfi 行为不变
- [ ] `pnpm typecheck` / `pnpm lint` 通过
- [ ] Web/API 测试通过
- [ ] 提交 `refactor(book-detail): 抽出 useReaderNavigation` 并成功推送

## 阶段 P1.4 - 抽出 useMetadataDialog

- [ ] 新文件 `use-metadata-dialog.ts` 存在
- [ ] 4 个 state 与 2 个 handler 全部内聚
- [ ] 字段预勾选逻辑保留
- [ ] `pnpm typecheck` / `pnpm lint` 通过
- [ ] Web/API 测试通过
- [ ] 提交 `refactor(book-detail): 抽出 useMetadataDialog` 并成功推送

## 阶段 P1.5 - 抽出 useBookActions

- [ ] 新文件 `use-book-actions.ts` 存在
- [ ] 8 个 `useCallback` 全部收敛
- [ ] 收藏/封面/删除/抓取行为不变
- [ ] `pnpm typecheck` / `pnpm lint` 通过
- [ ] Web/API 测试通过
- [ ] 提交 `refactor(book-detail): 抽出 useBookActions` 并成功推送

## 整体验证

- [ ] `wc -l page.tsx` ≤ 400
- [ ] 全部 Web/API 测试通过
- [ ] `pnpm typecheck` / `pnpm lint` 通过
- [ ] 6 个新文件全部存在
- [ ] 6 个提交都已在 `origin/main` 可见
