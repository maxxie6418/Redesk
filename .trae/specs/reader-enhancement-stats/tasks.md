# Tasks

## Phase 1: 数据层与后端基础

- [x] Task 1: 新增 reading_sessions 表迁移与 schema
  - [x] 1.1: 在 `packages/db/src/schema/` 新增 `reading-sessions.ts`，定义 readingSessions 表（id, book_id, owner_id, started_at, ended_at, duration_seconds, last_heartbeat_at, created_at），含 3 个索引
  - [x] 1.2: 在 `packages/db/src/schema/index.ts` 导出新 schema
  - [x] 1.3: 生成 migration SQL（在现有 0032 基础上追加，遵循 AGENTS.md 红线规则：新增 `0033_reading_sessions.sql`，journal 末尾 append entry，生成 0033_snapshot.json）
  - [x] 1.4: 在 `packages/shared/src/schemas.ts` 新增心跳上报和关闭 session 的 Zod schema（heartbeatSchema: book_id + timestamp；closeSessionSchema: book_id + duration_seconds）
  - [x] 1.5: 本地 dry-run 验证：`pnpm db:migrate` 在空库上执行无错

- [x] Task 2: 阅读 session 后端 API
  - [x] 2.1: 新增 `apps/api/src/routes/reading-sessions.ts`，注册 prefix `/api/v1`
  - [x] 2.2: 实现 `POST /reading-sessions/heartbeat`：查找或创建 session（book_id + owner_id + 未关闭），累加 duration_seconds（当前心跳与上次心跳差值，上限 60 秒防异常），更新 last_heartbeat_at
  - [x] 2.3: 实现 `POST /reading-sessions/close`：查找未关闭 session，设置 ended_at，返回最终 duration_seconds
  - [x] 2.4: 实现 `GET /reading-sessions/current`：返回当前未关闭 session（阅读器恢复时用）
  - [x] 2.5: 在 `apps/api/src/server.ts` 注册新路由

- [x] Task 3: 阅读统计后端 API
  - [x] 3.1: 实现 `GET /reading-stats/summary`：从 reading_sessions 按时间范围聚合（total/this_week/this_month/today 的 duration_seconds 总和）
  - [x] 3.2: 实现 `GET /books/:id/reading-stats`：单书聚合（total_duration, session_count, last_read_at）
  - [x] 3.3: 扩展 `GET /overview` 响应体，新增 `reading_stats: { total_seconds, today_seconds, week_seconds, month_seconds }`
  - [x] 3.4: 在 shared schemas 中新增对应的响应类型

- [x] Task 4: 阅读器偏好设置后端
  - [x] 4.1: 确认现有 settings 表可复用（key-value 结构），新增 `reader_preferences` 和 `reader_quick_templates` 两个 setting key
  - [x] 4.2: 在 shared schemas 中新增 readerPreferencesSchema（theme, font_family, font_size, line_height, color_scheme, custom_fonts 数组）

## Phase 2: 阅读器 UI 增强（可并行）

- [x] Task 5: 物理页码显示（3.27）
  - [x] 5.1: 在 `use-epub-reader.ts` 中监听 `relocated` 事件，从 `currentLocation()` 提取 `start.displayed.page` 和 `end.displayed.total`（epub.js internal pagination）
  - [x] 5.2: 将页码数据暴露给 BookReaderPage 状态
  - [x] 5.3: 在 ReaderTopBar 标题区域显示"第 X 页 / 共 Y 页"

- [x] Task 6: 阅读器主题切换面板（3.21 + 3.22）
  - [x] 6.1: 新增 `apps/web/src/routes/book-reader/theme-settings-panel.tsx` 组件（已创建 use-reader-preferences.ts hook）
  - [x] 6.2: 实现配色方案选择（默认/Sepia/护眼绿/深夜），含预览色块
  - [x] 6.3: 实现字体选择（系统默认 + 预置 Noto Serif SC / Noto Sans SC / Georgia / Palatino + 用户自定义字体）
  - [x] 6.4: 实现字号滑块（12px–28px）和行距滑块（1.2–2.4）
  - [x] 6.5: 实现偏好读写：通过 `useReaderPreferences` hook 从 settings 表读取/保存，使用 debounced 自动保存
  - [x] 6.6: 将偏好应用到 epub.js rendition（`rendition.themes.override` / `rendition.themes.font` / `rendition.themes.register`）
  - [x] 6.7: 将偏好同步应用到 ReaderTopBar 背景色（配色方案联动工具栏）

- [x] Task 7: 自定义字体上传（3.26）
  - [x] 7.1: 后端新增 `POST /reader/fonts` 上传端点，存储到 `data/reader-fonts/` 目录
  - [x] 7.2: 后端新增 `GET /reader/fonts` 列表端点
  - [x] 7.3: 前端在主题设置面板新增"上传字体"按钮，支持 .ttf/.otf/.woff2
  - [x] 7.4: 上传后动态注入 `@font-face`，添加到字体选择列表
  - [x] 7.5: 将自定义字体列表存入 reader_preferences 的 custom_fonts 字段

- [x] Task 8: 专注模式（3.24）
  - [x] 8.1: 在 BookReaderPage 新增 `focusMode` 状态
  - [x] 8.2: focusMode=true 时隐藏 ReaderTopBar（`transition-opacity` 淡出），viewerRef 容器扩展到 h-screen
  - [x] 8.3: 实现鼠标静止 3 秒后 `cursor: none`（mousemove 重置 timer）
  - [x] 8.4: 鼠标移到顶部 50px 区域时临时显示工具栏（auto-hide after 2s）
  - [x] 8.5: 专注模式下仍保留翻页快捷键和进度保存逻辑

- [x] Task 9: 单书全文搜索面板（3.25）
  - [x] 9.1: 新增 `search-panel.tsx` 组件，包含搜索输入框、结果计数、上一个/下一个按钮
  - [x] 9.2: 实现搜索逻辑：调用 epub.js `book.search(query)` API，收集所有 spine item 的匹配
  - [x] 9.3: 搜索结果按 CFI 排序，点击跳转到 `rendition.display(cfi)`
  - [x] 9.4: 匹配位置通过 `rendition.annotations.highlight` 临时高亮（区分已有高亮颜色）
  - [x] 9.5: 支持 Enter 触发搜索、Escape 关闭面板

- [x] Task 10: 阅读器快捷键扩展（3.23）
  - [x] 10.1: 在 `use-reader-keyboard-navigation.ts` 中扩展快捷键映射
  - [x] 10.2: 新增 B/H/T/N/F/S/Esc 快捷键，每个映射到对应的 UI 交互
  - [x] 10.3: 添加输入框检测：当 `document.activeElement` 为 input/textarea/contenteditable 时禁用快捷键
  - [x] 10.4: 将新增的面板状态（focusMode, searchOpen, themeOpen）提升到 BookReaderPage，通过 props 传递给子组件

- [x] Task 11: TTS 语音朗读（3.28）
  - [x] 11.1: 新增 `use-tts.ts` hook，封装 `window.speechSynthesis` API
  - [x] 11.2: 实现 `speak(text)` / `pause()` / `resume()` / `stop()` 方法
  - [x] 11.3: 实现语言检测：从 epub metadata 的 `dc:language` 获取，选择匹配的 speechSynthesis voice
  - [x] 11.4: 实现当前页文本提取：从 rendition 的 currentLocation 获取 iframe DOM，提取 textContent
  - [x] 11.5: 实现翻页续读：监听 relocated 事件，朗读完当前页后自动提取下一页文本继续
  - [x] 11.6: 新增 TTS 控制条 UI 组件（播放/暂停/停止/语速滑块）
  - [x] 11.7: 在 ReaderTopBar 新增 TTS 按钮，点击展开/收起控制条

- [x] Task 12: 快捷笔记模板（3.31）
  - [x] 12.1: 定义默认模板配置：`[{ key: 'inspiration', icon: '💡', label: '启发', mark_type: 'INSPIRATION' }, ...]`
  - [x] 12.2: 在 BubbleToolbar 新增快捷模板按钮行（与现有高亮/划线/书签按钮平级或下方）
  - [x] 12.3: 点击模板按钮时：创建高亮（使用对应 mark_type），附注自动填入 `[标签]` 前缀
  - [x] 12.4: 模板列表从 settings 表 `reader_quick_templates` 读取，支持自定义

## Phase 3: 阅读计时前端集成

- [x] Task 13: 阅读心跳机制（3.29 前端）
  - [x] 13.1: 新增 `use-reading-session.ts` hook
  - [x] 13.2: 阅读器挂载时：调用 heartbeat 创建 session（或恢复未关闭 session）
  - [x] 13.3: 实现 30 秒间隔心跳 timer（setInterval），携带 book_id + timestamp
  - [x] 13.4: 实现 visibilitychange 监听：hidden 时暂停心跳，visible 时恢复
  - [x] 13.5: 阅读器卸载/路由变化时调用 close 端点（useEffect cleanup + useBeforeUnload 兜底）
  - [x] 13.6: 本地实时计时器：每秒递增显示当前 session 时长（不依赖网络）

- [x] Task 14: 阅读进度预估剩余时间（3.30）
  - [x] 14.1: 从 reading-stats API 获取累计时长和起始 percentage
  - [x] 14.2: 实现预估计算：`(total_duration / percentage_delta) * (100 - current_percentage)`
  - [x] 14.3: 累计不足 5% 时不显示预估
  - [x] 14.4: 在进度百分比旁显示"还剩约 X 小时 Y 分钟"

## Phase 4: 统计展示

- [x] Task 15: 概览页阅读时长卡片（5.09）
  - [x] 15.1: 在 `use-overview.ts` hook 中调用 `/reading-stats/summary` 或使用 overview 扩展字段
  - [x] 15.2: 新增阅读时长 KPI 卡片组件（总计/本周/本月/今日四格或双行）
  - [x] 15.3: 时长格式化：`Xh Ym`（总计/本周/本月），`Y 分钟`（今日，不足 1h 时）
  - [x] 15.4: 插入概览页布局中（KPI 卡片区或最近阅读区域上方）

- [x] Task 16: 单书详情阅读时长展示
  - [x] 16.1: 在书籍详情 hook 中调用 `/books/:id/reading-stats`
  - [x] 16.2: 在阅读痕迹区域新增时长信息行："累计阅读 X 小时 · 共 N 次 · 最近 X 前"
  - [x] 16.3: 相对时间格式化（"2 小时前""昨天""3 天前"）

- [x] Task 17: 侧边栏今日阅读时长
  - [x] 17.1: 扩展 `use-sidebar-stats.ts` hook，调用 `/reading-stats/summary` 并取 today 字段
  - [x] 17.2: 在侧边栏统计区域新增一行"今日阅读 X 分钟"
  - [x] 17.3: 实时更新：阅读器中时长变化时通过 query invalidation 触发侧边栏刷新

## Phase 5: 验证与收尾

- [x] Task 18: 端到端验证
  - [x] 18.1: 验证 `pnpm typecheck` 无类型错误
  - [x] 18.2: 验证 `pnpm lint` 无 lint 错误
  - [x] 18.3: 验证 `pnpm build` 构建成功
  - [ ] 18.4: 手动验证：打开阅读器 → 切换主题 → 专注模式 → 全文搜索 → TTS → 快捷键 → 关闭阅读器 → 概览页/侧边栏时长显示正确
  - [ ] 18.5: 验证数据库迁移：空库 `pnpm db:migrate` 无错，含旧数据的库升级无错

# Task Dependencies

- Task 1 (数据层) → Task 2 (session API) → Task 3 (统计 API)
- Task 1 (数据层) → Task 4 (偏好 API)
- Task 4 (偏好 API) → Task 6 (主题面板) → Task 7 (自定义字体)
- Task 2 (session API) → Task 13 (心跳前端) → Task 14 (预估剩余时间)
- Task 3 (统计 API) → Task 15 (概览卡片) + Task 16 (详情时长) + Task 17 (侧边栏)
- Task 5 (页码) + Task 8 (专注) + Task 9 (搜索) + Task 10 (快捷键) + Task 11 (TTS) + Task 12 (模板) 可并行，互不依赖
- Task 5-12 依赖 Task 10 中的面板状态提升（统一协调 UI 状态）
- Task 18 (验证) 依赖所有前置任务完成