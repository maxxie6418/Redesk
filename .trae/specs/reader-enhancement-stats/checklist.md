# Checklist

## 数据层

- [ ] reading_sessions 表 schema 定义正确（8 字段 + 3 索引）
- [ ] migration SQL 文件命名遵循规范（0033_reading_sessions.sql）
- [ ] journal.json 末尾 append 新 entry，snapshot 文件 0033_snapshot.json 已生成
- [ ] 空库 `pnpm db:migrate` 无错
- [ ] 含旧数据库升级无错（preflight 通过）

## 后端 API

- [ ] POST /reading-sessions/heartbeat：创建或累加 session，duration 累加上限 60 秒
- [ ] POST /reading-sessions/close：正确设置 ended_at，返回最终 duration
- [ ] GET /reading-sessions/current：返回未关闭 session 或 null
- [ ] GET /reading-stats/summary：total/this_week/this_month/today 四个维度正确聚合
- [ ] GET /books/:id/reading-stats：单书 total_duration/session_count/last_read_at 正确
- [ ] GET /overview 响应体新增 reading_stats 字段
- [ ] POST /reader/fonts：上传字体文件到 data/reader-fonts/
- [ ] GET /reader/fonts：返回字体文件列表
- [ ] 所有新端点含 owner_id 边界校验

## 阅读器增强

- [ ] 物理页码在工具栏正确显示，翻页时同步更新
- [ ] 主题设置面板：配色切换即时生效（Sepia/护眼绿/深夜/默认）
- [ ] 字体/字号/行距调整即时应用到 epub rendition
- [ ] 偏好持久化到 settings 表，重开阅读器自动恢复
- [ ] 自定义字体上传后可选择使用
- [ ] 专注模式：工具栏隐藏、全屏、鼠标静止 3s 隐藏光标、Esc 退出
- [ ] 专注模式下鼠标移到顶部临时显示工具栏
- [ ] 全文搜索：输入关键词后匹配定位、上一个/下一个跳转、匹配计数
- [ ] 快捷键 B/H/T/N/F/S/Esc 在非输入框中正常工作
- [ ] 快捷键在 input/textarea/contenteditable 元素聚焦时禁用
- [ ] TTS 朗读当前页文本，播放/暂停/停止控制正常
- [ ] TTS 语速可调（0.5x–2.0x），语言自动匹配
- [ ] TTS 翻页后自动续读下一页
- [ ] 快捷笔记模板：💡❓⭐📌 四个按钮在气泡工具栏中显示
- [ ] 点击模板创建高亮并自动填入对应 mark_type 和附注前缀

## 阅读计时

- [ ] 阅读器打开后 30 秒心跳正常发送
- [ ] 切标签页（visibilitychange hidden）时心跳暂停
- [ ] 切回标签页时心跳恢复
- [ ] 关闭阅读器/导航离开时调用 close 端点
- [ ] 工具栏实时显示当前 session 时长（mm:ss 或 h:mm:ss）
- [ ] 预估剩余时间在累计阅读 ≥5% 后显示
- [ ] 累计不足 5% 时不显示预估

## 统计展示

- [ ] 概览页显示阅读时长卡片（总计/本周/本月/今日）
- [ ] 单书详情显示累计阅读时长、次数、最近阅读时间
- [ ] 侧边栏显示今日阅读时长
- [ ] 时长格式化正确（不足 1 小时显示"X 分钟"，否则"X 小时 Y 分钟"）

## 代码质量

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm build` 成功
- [ ] 新增代码遵循项目编码规范（camelCase 变量、PascalCase 组件、中文注释仅必要时）
- [ ] 前端中文字符使用字面量，无 \\uXXXX 转义
