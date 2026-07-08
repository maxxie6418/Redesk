# 阅读增强与阅读时长统计 Spec

## Why

阅读器当前仅有基础阅读能力（翻页/高亮/笔记/书签），缺乏个性化设置（主题/字体/快捷键）、沉浸式阅读（专注模式/TTS）和阅读数据追踪（时长统计/剩余时间预估）。这些功能直接影响用户的阅读体验和知识沉淀深度，是 M5 增强层的核心交付。

## What Changes

### 数据层
- 新增 `reading_sessions` 表，记录每次阅读的起止时间、时长、书籍归属
- 新增 migration（在现有 0032 基础上追加）

### 后端 API
- 新增 `POST /reading-sessions/heartbeat` 心跳上报端点
- 新增 `POST /reading-sessions/close` 关闭当前 session 端点
- 新增 `GET /books/:id/reading-stats` 单书阅读统计端点
- 扩展 `GET /overview` 返回阅读时长汇总
- 新增 `GET /reading-stats/summary` 全局阅读时长统计端点（概览/侧边栏共用）
- 新增 `POST /settings/reader-preferences` 保存阅读器偏好端点（或复用现有 settings 表）

### 前端阅读器增强
- 阅读器主题切换（背景色/字体/字号/行距/主题预设）
- 专注模式（全屏沉浸，隐藏所有 UI）
- 单书全文搜索（当前书籍内关键词检索）
- 物理页码显示（基于 epub.js internal pagination）
- TTS 语音朗读（Web Speech API）
- 阅读计时（心跳上报 + 本地实时显示）
- 快捷笔记模板（高亮时选择预设标签）

### 前端统计展示
- 概览页新增阅读时长卡片（总计/本周/本月）
- 单书详情新增该书累计阅读时长
- 侧边栏新增今日阅读时长

## Impact

- Affected specs: M2 阅读器、M5 增强层、概览统计
- Affected code:
  - `packages/db/src/schema/` — 新增 reading_sessions schema
  - `packages/db/drizzle/` — 新增 migration
  - `packages/shared/src/schemas.ts` — 新增/扩展 Zod schema
  - `apps/api/src/routes/` — 新增 reading-sessions 路由，修改 overview 路由
  - `apps/web/src/routes/book-reader/` — 阅读器增强（主题/专注/搜索/TTS/页码/计时/模板）
  - `apps/web/src/routes/book-reader/components.tsx` — 新增 UI 组件
  - `apps/web/src/routes/overview.tsx` — 新增时长卡片
  - `apps/web/src/components/book-detail-sheet/` — 新增时长展示
  - `apps/web/src/hooks/use-sidebar-stats.ts` — 扩展侧边栏统计
  - `apps/web/src/components/highlight-toolbar/` — 快捷笔记模板

---

## ADDED Requirements

### Requirement: 阅读器主题切换（3.21）

阅读器 SHALL 提供主题设置面板，支持用户自定义以下样式属性：
- 背景色（预设 + 自定义色值）
- 字体族（系统默认 + 预置中英文字体）
- 字号（12px–28px，步进 2px）
- 行距（1.2–2.4，步进 0.2）

偏好 SHALL 持久化到 settings 表（key: `reader_preferences`，value: JSON），重开阅读器时自动恢复。

#### Scenario: 切换主题后渲染生效
- **WHEN** 用户在主题面板选择"护眼绿"预设
- **THEN** epub rendition 内容区立即切换为对应背景色和字体，无需重新加载

#### Scenario: 偏好持久化
- **WHEN** 用户关闭阅读器后重新打开任意书籍
- **THEN** 阅读器自动应用上次保存的主题偏好

### Requirement: 阅读器专属配色（3.22）

阅读器 SHALL 提供预设配色方案，独立于全局暗色模式（1.30）：
- 默认（跟随全局）
- Sepia（暖黄纸感）
- 护眼绿
- 深夜（纯黑底白字，区别于全局暗色模式的深灰底）

配色 SHALL 作为主题切换面板的快捷入口，同时影响阅读器顶部工具栏。

#### Scenario: Sepia 模式
- **WHEN** 用户选择 Sepia 配色
- **THEN** 内容区背景变为 `#f4ecd8`，文字变为深棕，工具栏同步适配

### Requirement: 阅读器快捷键（3.23）

阅读器 SHALL 支持以下键盘快捷键（已实现的翻页保留，新增以下）：
- `B` — 书签 toggle
- `H` — 高亮（需先有选区）
- `T` — 目录面板 toggle
- `N` — 笔记面板 toggle
- `F` — 专注模式 toggle
- `Esc` — 关闭当前面板/退出专注模式
- `S` — 全文搜索面板 toggle

快捷键 SHALL 在文本输入框（附注编辑、搜索框）中禁用，避免冲突。

#### Scenario: 快捷键切换目录
- **WHEN** 用户在阅读器中按 `T`
- **THEN** 目录面板打开/关闭

#### Scenario: 输入框中快捷键禁用
- **WHEN** 用户在搜索框中输入时按 `T`
- **THEN** 输入字符 `T` 而非切换目录面板

### Requirement: 专注模式（3.24）

阅读器 SHALL 提供专注模式，激活后：
- 隐藏顶部工具栏（ReaderTopBar）
- epub 内容区全屏占满
- 鼠标静止 3 秒后自动隐藏光标
- 按 `Esc` 或 `F` 退出专注模式
- 仍保留翻页快捷键和进度保存

#### Scenario: 进入专注模式
- **WHEN** 用户按 `F` 或点击专注模式按钮
- **THEN** 工具栏淡出，内容区扩展到全屏，3 秒后光标隐藏

#### Scenario: 退出专注模式
- **WHEN** 用户按 `Esc` 或鼠标移到顶部区域触发临时工具栏
- **THEN** 工具栏淡入，恢复常规布局

### Requirement: 单书全文搜索（3.25）

阅读器 SHALL 提供当前书籍内的全文搜索功能：
- 搜索面板（可由快捷键 `S` 或工具栏按钮打开）
- 输入关键词后实时高亮匹配位置
- 支持上一个/下一个跳转
- 匹配数量展示（如"第 3/17 个"）

搜索 SHALL 使用 epub.js 的 `book.search(query)` API（遍历 spine items 匹配文本）。

#### Scenario: 搜索并跳转
- **WHEN** 用户输入"认知"并按 Enter
- **THEN** 阅读器定位到第一个匹配位置，高亮显示，面板显示"第 1/N 个"

#### Scenario: 无匹配结果
- **WHEN** 搜索关键词无匹配
- **THEN** 面板显示"无匹配结果"

### Requirement: 自定义字体上传（3.26）

阅读器 SHALL 支持用户上传自定义字体文件（.ttf/.otf/.woff2）：
- 上传后通过 `@font-face` 动态注入
- 字体持久化存储在服务器端
- 在主题切换面板的字体选择中可选

#### Scenario: 上传并应用字体
- **WHEN** 用户上传 `MyFont.woff2`
- **THEN** 字体出现在字体选择列表中，选择后 epub 内容使用该字体渲染

### Requirement: 物理页码显示（3.27）

阅读器 SHALL 基于 epub.js 内部 pagination 显示当前页码：
- 利用 epub.js rendition 的 `currentLocation()` 返回的 `start.displayed` 属性
- 在工具栏标题区域显示"第 X 页 / 共 Y 页"
- 翻页时同步更新

#### Scenario: 翻页时页码更新
- **WHEN** 用户翻到下一页
- **THEN** 工具栏页码从"第 3 页 / 共 245 页"变为"第 4 页 / 共 245 页"

### Requirement: TTS 语音朗读（3.28）

阅读器 SHALL 使用浏览器内置 Web Speech API 提供语音朗读：
- 朗读当前可见页面的文本内容
- 播放/暂停/停止控制
- 语速调节（0.5x–2.0x）
- 语言自动检测（中文/英文/日文等，根据 epub 内容语言选择 speechSynthesis voice）
- 翻页时自动更新朗读内容

#### Scenario: 开始朗读
- **WHEN** 用户点击朗读按钮
- **THEN** 从当前可见页面的第一段开始朗读，显示播放控制条

#### Scenario: 翻页自动续读
- **WHEN** 朗读中用户翻到下一页
- **THEN** 当前页读完后自动开始朗读下一页内容

### Requirement: 阅读计时 — 数据采集（3.29 数据层）

前端 SHALL 在阅读器打开期间以 30 秒间隔发送心跳到后端：
- 心跳携带 `{ book_id, started_at, timestamp }`
- 后端维护当前 session（book_id + owner_id），累加有效时长
- 页面可见性变化（`visibilitychange`）时：hidden 暂停心跳，visible 恢复
- 关闭阅读器/切换路由时调用 `POST /reading-sessions/close` 结束 session
- 防抖：同一 session 内心跳间隔不小于 20 秒

#### Scenario: 正常阅读计时
- **WHEN** 用户打开阅读器阅读 5 分钟
- **THEN** 后端记录约 5 分钟的阅读时长（10 次心跳 × 30 秒）

#### Scenario: 切标签页暂停
- **WHEN** 用户切到其他标签页 2 分钟后切回
- **THEN** 后端不记录这 2 分钟的时长

#### Scenario: 关闭阅读器
- **WHEN** 用户关闭阅读器或导航离开
- **THEN** 调用 close 端点，session 结束，时长准确记录

### Requirement: 阅读计时 — 实时显示（3.29 UI）

阅读器工具栏 SHALL 显示当前 session 的累计阅读时长：
- 格式：`mm:ss`（不足 1 小时）或 `h:mm:ss`（1 小时以上）
- 每秒本地递增，心跳同步校准
- 点击可展开今日累计时长

#### Scenario: 实时显示
- **WHEN** 用户阅读了 25 分钟
- **THEN** 工具栏显示"25:00"

### Requirement: 阅读进度预估剩余时间（3.30）

阅读器 SHALL 基于历史阅读速度预估剩余阅读时间：
- 计算方式：累计阅读时长 / 累计阅读百分比增量 → 得到每百分比所需时间 → 乘以剩余百分比
- 在进度条旁显示预估（如"还剩约 2 小时 15 分钟"）
- 首次阅读（累计不足 5%）时不显示预估，避免数据量不足导致误差

#### Scenario: 显示预估
- **WHEN** 用户已阅读 30%，累计阅读 1.5 小时
- **THEN** 显示"还剩约 3 小时 30 分钟"

#### Scenario: 数据不足不显示
- **WHEN** 用户仅阅读了 2%
- **THEN** 不显示预估时间

### Requirement: 快捷笔记模板（3.31）

高亮气泡工具栏 SHALL 增加快捷笔记模板入口：
- 预设标签：💡 启发 / ❓ 疑问 / ⭐ 重要 / 📌 待查
- 选择后自动创建对应 `mark_type` 的高亮，附注中包含标签前缀
- 模板列表可配置（settings 表中 `reader_quick_templates`）
- 后续支持按模板标签筛选

#### Scenario: 使用快捷模板创建高亮
- **WHEN** 用户选中文字后点击💡 启发
- **THEN** 创建 `mark_type=INSPIRATION` 的高亮，附注自动填入"[启发]"

### Requirement: 新增 reading_sessions 表

数据库 SHALL 新增 `reading_sessions` 表：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| book_id | INTEGER | NOT NULL, FK books | 所读书籍 |
| owner_id | INTEGER | NOT NULL, FK users | 阅读者 |
| started_at | TEXT | NOT NULL | session 开始时间 (ISO 8601) |
| ended_at | TEXT | NULL | session 结束时间 |
| duration_seconds | INTEGER | NOT NULL DEFAULT 0 | 累计有效阅读秒数 |
| last_heartbeat_at | TEXT | NOT NULL | 最后心跳时间 |
| created_at | TEXT | NOT NULL | 记录创建时间 |

索引：
- `idx_reading_sessions_book_owner` (book_id, owner_id)
- `idx_reading_sessions_owner_started` (owner_id, started_at)
- `idx_reading_sessions_started_at` (started_at)

### Requirement: 阅读时长统计 — 概览页（5.09 概览）

概览页 SHALL 新增阅读时长统计卡片：
- 总阅读时长（所有书籍累计）
- 本周阅读时长
- 本月阅读时长
- 今日阅读时长

数据来源：`GET /reading-stats/summary` 端点，从 `reading_sessions` 表按时间范围聚合。

#### Scenario: 概览页展示时长
- **WHEN** 用户打开概览页
- **THEN** 显示"总计 42 小时 · 本周 3.5 小时 · 本月 12 小时 · 今日 45 分钟"

### Requirement: 阅读时长统计 — 单书详情

书籍详情页 SHALL 展示该书的阅读时长：
- 累计阅读时长
- 最近一次阅读时间
- 阅读次数（session 数量）

数据来源：`GET /books/:id/reading-stats` 端点。

#### Scenario: 单书详情展示
- **WHEN** 用户打开某本书的详情页
- **THEN** 阅读痕迹区域显示"累计阅读 8 小时 · 共 12 次 · 最近 2 小时前"

### Requirement: 阅读时长统计 — 侧边栏

侧边栏 SHALL 展示今日阅读时长：
- 在现有统计数字区域新增一行"今日阅读"
- 格式：`X 小时 Y 分钟`（不足 1 小时显示 `Y 分钟`）

数据来源：复用 `/reading-stats/summary` 端点的 `today` 字段。

#### Scenario: 侧边栏今日时长
- **WHEN** 用户今天已阅读 1 小时 20 分钟
- **THEN** 侧边栏显示"今日阅读 1 小时 20 分钟"

### Requirement: 全文搜索端点

后端 SHALL 提供 `GET /books/:id/search?q=xxx` 端点，用于搜索当前书籍的高亮和笔记内容：
- 搜索范围：highlights.content + notes.content_markdown（使用已有 FTS5 索引）
- 返回匹配的高亮/笔记列表及 CFI 定位
- 此端点供阅读笔记汇总页和后续扩展使用，阅读器内全文搜索走 epub.js 前端搜索

---

## MODIFIED Requirements

### Requirement: 阅读器 ReaderTopBar 扩展

`ReaderTopBar` 组件 SHALL 新增以下按钮/信息：
- 物理页码显示（"第 X 页 / 共 Y 页"）
- 当前 session 时长显示
- 全文搜索按钮（`S` 快捷键）
- 主题设置按钮
- 专注模式按钮
- TTS 朗读按钮

#### Scenario: 工具栏完整展示
- **WHEN** 用户打开阅读器
- **THEN** 顶部工具栏显示返回、目录、笔记、搜索、主题、专注、TTS、页码、时长、翻页按钮

### Requirement: 高亮气泡工具栏扩展

`BubbleToolbar` 组件 SHALL 新增快捷笔记模板按钮行：
- 在现有高亮/下划线/波浪线/书签/附注下方新增一行快捷模板按钮
- 模板图标 + 标签文字

#### Scenario: 展示快捷模板
- **WHEN** 用户选中文字触发气泡工具栏
- **THEN** 工具栏底部显示💡❓⭐📌四个快捷模板按钮

### Requirement: 概览页统计卡片扩展

概览页 SHALL 在现有 KPI 卡片区新增阅读时长相关卡片，布局调整以容纳新信息。

### Requirement: 侧边栏统计扩展

`use-sidebar-stats` hook SHALL 扩展返回数据，包含今日阅读时长。

---

## REMOVED Requirements

无。本次改动不移除任何已有功能。
