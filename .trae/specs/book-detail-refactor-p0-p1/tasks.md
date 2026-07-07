# Tasks

- [x] Task 1: 阶段 P0 - 收敛重复定义
  - [x] SubTask 1.1: 删除 `page.tsx` 中本地 `formatFileSize` 与 `COVER_TONES`，改用 `./types` 导出
  - [x] SubTask 1.2: 删除 `components.tsx` 中内联 `StorageStatusBadge` 与 `STORAGE_MODE_LABELS`，改用 `./storage-status-badge` 与 `./types` 导出
  - [x] SubTask 1.3: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试 全部通过
  - [x] SubTask 1.4: 提交 `chore(book-detail): 收敛重复定义` 并推送
- [x] Task 2: 阶段 P1.1 - 抽出 `BookDetailTabs` 组件
  - [x] SubTask 2.1: 新增 `book-detail-tabs.tsx`，复用 `types.ts` 中 `DetailTab` / `DetailTabItem`
  - [x] SubTask 2.2: `page.tsx` 460-488 行的 tab JSX 替换为 `<BookDetailTabs />`
  - [x] SubTask 2.3: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试
  - [x] SubTask 2.4: 提交 `refactor(book-detail): 抽出 BookDetailTabs` 并推送
- [x] Task 3: 阶段 P1.2 - 抽出 `useDetailMessages` hook
  - [x] SubTask 3.1: 新增 `use-detail-messages.ts`，包含 `info / error / warning / clear` 自动 2s 清理
  - [x] SubTask 3.2: `page.tsx` 中 6+ 处 `setMessage + setTimeout` 改为调用 hook
  - [x] SubTask 3.3: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试
  - [x] SubTask 3.4: 提交 `refactor(book-detail): 抽出 useDetailMessages` 并推送
- [x] Task 4: 阶段 P1.3 - 抽出 `useReaderNavigation` hook
  - [x] SubTask 4.1: 新增 `use-reader-navigation.ts`
  - [x] SubTask 4.2: `page.tsx` 中 `openMarkInReader` / `openTraceInReader` 改为调用 hook
  - [x] SubTask 4.3: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试
  - [x] SubTask 4.4: 提交 `refactor(book-detail): 抽出 useReaderNavigation` 并推送
- [x] Task 5: 阶段 P1.4 - 抽出 `useMetadataDialog` hook
  - [x] SubTask 5.1: 新增 `use-metadata-dialog.ts`，封装 4 个 state + open/close/apply
  - [x] SubTask 5.2: `page.tsx` 中 `showMetadataDialog / metadataResult / selectedFields / fetchCoverChecked` 与 `handleOpenMetadataDialog` / `handleApplyMetadata` 替换为 hook 调用
  - [x] SubTask 5.3: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试
  - [x] SubTask 5.4: 提交 `refactor(book-detail): 抽出 useMetadataDialog` 并推送
- [ ] Task 6: 阶段 P1.5 - 抽出 `useBookActions` hook
  - [ ] SubTask 6.1: 新增 `use-book-actions.ts`，封装收藏/封面/删除/抓取/上传 8 个回调
  - [ ] SubTask 6.2: `page.tsx` 中对应 `useCallback` 全部删除，替换为 hook 调用
  - [ ] SubTask 6.3: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试
  - [ ] SubTask 6.4: 提交 `refactor(book-detail): 抽出 useBookActions` 并推送
- [ ] Task 7: 验证 - 确认 page.tsx 行数下降 + 整体回归
  - [ ] SubTask 7.1: 用 `wc -l page.tsx` 确认 ≤ 400 行
  - [ ] SubTask 7.2: 跑 `pnpm typecheck` / `pnpm lint` / Web+API 测试
  - [ ] SubTask 7.3: 检查 `pnpm build`（如有）

# Task Dependencies

- Task 1 独立
- Task 2 独立
- Task 3 依赖 Task 1（先收敛重复，否则 message 模式重复清理也含盖同文件）
- Task 4 独立
- Task 5 依赖 Task 3（先有 useDetailMessages，metadata dialog 才能用 showError）
- Task 6 依赖 Task 3 + Task 5（BookActions 内部会调用 useDetailMessages 与 useMetadataDialog 的回调）
- Task 7 依赖 Task 1-6
