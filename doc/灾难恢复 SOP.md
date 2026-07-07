# 灾难恢复 SOP（数据库迁移失败时）

> 适用对象：Redesk 自托管部署者、AI 代理。
> 触发条件：升级后容器无法启动、反复重启、日志报 `table already exists` / `Found at least one unapplied migration` / `no such table: __drizzle_migrations` / `database disk image is malformed`。
> 关联文件：[AGENTS.md § 数据库迁移红线](AGENTS.md)、[doc/说明/Redesk-数据库兼容性与可锁定数据.html](说明/Redesk-数据库兼容性与可锁定数据.html)。

---

## 1. 故障分级与决策表

| 级别 | 表现 | 推荐路径 |
| --- | --- | --- |
| **L1 启动期预检失败** | `preflight()` 抛 "missing core tables: ..." | §2.A 走快照回退 |
| **L2 Drizzle migrator 报错** | `Found at least one unapplied migration` / `table already exists` | §2.B 走 hash 对齐 |
| **L3 数据文件损坏** | `database disk image is malformed` / `file is not a database` | §2.C 走文件恢复 |
| **L4 数据被人为改坏** | 误删表、误改 schema | §2.D 走手动 SQL 修复 |

> 决策原则：**能回滚就不修复，能用快照就不重建**。任何"修复"操作前先 §3.A 备份当前文件。

---

## 2. 恢复路径

### 2.A 启动期预检失败（L1）

`packages/db/src/preflight.ts` 在 migrate 之前检查 10 张核心表（users/books/book_files/book_covers/highlights/notes/reading_progress/bookmarks/topics/settings）。若缺失，立即拒绝启动并列出缺失表。

**现象（API 容器日志）**：

```
[preflight] missing core tables: books, notes
[preflight] snapshots available:
  - data/.snapshots/redesk-snapshot-2026-07-06-142233-001.db  (245 KB)
  - data/.snapshots/redesk-snapshot-2026-07-07-091544-307.db  (251 KB)
[preflight] refusing to start. restore from snapshot or set REDESK_FORCE_REBUILD=true (dev only).
```

**恢复步骤**：

1. 停止容器：`docker compose down`。
2. 列出快照：
   ```bash
   docker compose exec redesk ls -la /data/.snapshots/
   ```
3. 选定最近的健康快照（文件大小不为 0，且时间在故障前），复制覆盖：
   ```bash
   # 容器内路径 /data/redesk.db，宿主机对应 ./data/redesk.db
   cp ./data/.snapshots/redesk-snapshot-2026-07-07-142345-936.db ./data/redesk.db
   # 同时清掉 WAL / SHM，避免旧事务污染
   rm -f ./data/redesk.db-wal ./data/redesk.db-shm
   ```
4. 启动旧镜像回退（先验证快照可用，再决定是否继续升级）：
   ```bash
   docker compose down
   # 用上一次确认能启动的 tag，避免再用本次有问题的镜像
   docker compose up -d
   ```
5. **不要**通过 `REDESK_FORCE_REBUILD=true` 绕过——它会删表重建，会**清空数据**。该变量只允许在空库 / 测试环境使用。

### 2.B Drizzle migrator 报错（L2）

**现象**：

```
[migrate] Found at least one unapplied migration: 0009_add_book_cover_url.sql
[migrate] This is the 5th unapplied migration but existing DB has applied migration 0012.
[migrate] Refusing to continue. Ref: doc/灾难恢复 SOP.md §2.B
```

**根因**：通常是 `drizzle/meta/_journal.json` 与 `__drizzle_migrations` 表里的 hash 对不上。常见诱因：

- 在分支上重命名 / 修改了已合并的 `00NN_*.sql`。
- 手工"清理"了 journal（**违反 AGENTS.md 红线 2**）。
- 合并 PR 时把 `drizzle/` 与 `drizzle/meta/` 拆开提交，导致版本错位。

**恢复步骤**：

1. §3.A 备份当前 `redesk.db`。
2. 进入容器 / 宿主机查看 `__drizzle_migrations` 实际记录：
   ```bash
   sqlite3 data/redesk.db 'SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;'
   ```
3. 对照 `drizzle/meta/_journal.json` 的 `entries`，找出"实际应用了但 journal 里没有"的条目。
4. **不要删 `__drizzle_migrations` 表里的记录**——这是已经执行的真实迁移。
5. 把 journal 改回正确状态（确保 `entries` 包含所有已应用 hash）：
   - 推荐：用 `git log -p drizzle/meta/_journal.json` 找上一次正确的 commit，`git checkout <commit> -- drizzle/meta/_journal.json drizzle/meta/00NN_snapshot.json`。
   - 不推荐：手工编辑 JSON 拼回——容易引入空格、键名大小写等错误。
6. 重新 `pnpm db:migrate` 一次，应直接 "No migrations to apply"。

### 2.C 数据文件损坏（L3）

**现象**：

```
SqliteError: database disk image is malformed
SqliteError: file is not a database
```

**恢复步骤**：

1. 立即停止容器，避免 WAL 持续写入覆盖损坏数据。
2. 复制损坏文件留档（仅供事后分析，不再用）：
   ```bash
   cp data/redesk.db data/redesk.db.corrupt-$(date +%Y%m%d-%H%M%S)
   ```
3. 尝试 `sqlite3 .recover`（不一定能 100% 恢复，但能挽救部分数据）：
   ```bash
   sqlite3 data/redesk.db.corrupt-... ".recover" | sqlite3 data/recovered.db
   ```
4. 若 `recover` 失败，按时间倒序回退到 `data/.snapshots/` 中最新的健康快照，过程同 §2.A 第 3-4 步。
5. 若连快照都不可用，从外部备份恢复（详见《备份系统设计说明》[待补] / 云同步）。

### 2.D 数据被人为改坏（L4）

**现象**：误 `DROP TABLE` / 误 `DELETE FROM users` / 误改 schema 后无法访问。

**恢复步骤**：

1. §3.A 备份。
2. 若是 schema 损坏（表结构错乱），走 §2.A 的快照回退。
3. 若是数据丢失（行级删除）：
   - 首选 §2.A 回退到操作前快照。
   - 次选：仍可启动，从 `__drizzle_migrations` 之外的位置（备份、导出 JSON）拉回。

---

## 3. 工具与流程

### 3.A 标准操作：备份当前数据库

**任何修复动作前必做。**

```bash
# 容器内路径 /app/data/redesk.db
docker compose run --rm api sqlite3 /app/data/redesk.db ".backup '/app/data/manual-backup-$(date +%Y%m%d-%H%M%S).db'"
```

或宿主机直接：

```bash
sqlite3 data/redesk.db ".backup 'data/manual-backup-$(date +%Y%m%d-%H%M%S).db'"
```

### 3.B 列出并选择快照

`packages/db/src/preflight.ts` 会在每次启动 migrate 前自动 `VACUUM INTO` 一份到 `data/.snapshots/`，命名格式 `redesk-snapshot-YYYYMMDD-HHMMSS-mmm.db`。列出：

```bash
ls -la data/.snapshots/
```

选择规则：

1. **优先选最近的**：migrate 之前的快照包含所有旧数据。
2. **确认 size > 0**：0 字节文件是失败产物，跳过。
3. **确认 created 早于故障时间**：用 `stat` 看 mtime。
4. **避免选升级中途的快照**：如果故障是发生在新版本启动 1 分钟内，回退到**上一个稳定版本对应的旧 tag** 而不是新版自身产生的快照。

### 3.C 本地 dry-run 迁移

修改了 schema / migration 后，必须先在**空库**上跑一次：

```bash
rm -f data/redesk.db data/redesk.db-wal data/redesk.db-shm
pnpm db:migrate
ls -la data/redesk.db
sqlite3 data/redesk.db '.tables'
sqlite3 data/redesk.db 'SELECT * FROM __drizzle_migrations;'
```

确认：

- 文件非 0 字节。
- 业务表都在。
- `__drizzle_migrations` 包含本次新增的 hash。

### 3.D 校验 Drizzle journal 完整性

新增脚本 `scripts/check-journal.ts`（CI 中也跑）：

```bash
# 校验 drizzle/meta/_journal.json 顺序与 drizzle/*.sql 文件一一对应
pnpm tsx scripts/check-journal.ts
```

通过条件：

- `entries[i].idx === i`（无跳跃）。
- `entries.length === drizzle/*.sql 文件数`。
- 每个 `entries[i].when` 是合法时间戳（递增）。
- 每个 entry 引用的 `tag` 在 `drizzle/meta/00NN_snapshot.json` 存在。

### 3.E 启动容器验证预检

```bash
docker compose up -d
docker compose logs -f api | head -50
```

期望日志（无故障）：

```
[preflight] ok, all 10 core tables present
[snapshot] saved 251 KB to data/snapshots/2026-07-07-105812-421.db
[migrate] no pending migrations
[api] listening on http://0.0.0.0:8787
```

如果 `preflight` 或 `migrate` 失败，**不要让容器继续重启**——先 `docker compose down`，按 §2 走恢复。

---

## 4. 预防：迁移演练 CI

在 `.github/workflows/ci.yml` 中加入 `migrate-drill` 任务（详见 [开发执行计划](开发执行计划.md) §M0+ 维护期）：

- 每次 PR：跑一次"空库 + 已有库双跑"演练。
- 已有库用一个固定 fixture（`dataLab/fixtures/old-shape.db`，由维护者定期更新）。
- 演练失败直接卡 PR 合入。

---

## 5. 何时升级《决策记录》/《数据模型》

恢复操作完成后，必须复盘：

- 哪些红线被突破？写入 [决策记录](决策记录.md) 对应条目。
- 是否需要新增代码层防御（如 `preflight` 缺一张新核心表时报警）？
- 用户在这次事故中丢了什么？写入 [审计/](../审计/)。

---

## 附录 A：常用命令速查

```bash
# 备份
sqlite3 data/redesk.db ".backup 'data/manual-backup.db'"

# 恢复
cp data/snapshots/2026-07-07-091544-307.db data/redesk.db
rm -f data/redesk.db-wal data/redesk.db-shm

# 查看已应用 migrations
sqlite3 data/redesk.db 'SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;'

# 查看所有表
sqlite3 data/redesk.db '.tables'

# 启动 / 停止
docker compose up -d
docker compose down
docker compose logs -f api

# CI 演练
pnpm tsx scripts/check-journal.ts
```

## 附录 B：联系与升级路径

- 严重事故请同时在 [决策记录](决策记录.md) 末尾追加 "事故复盘" 段。
- 涉及用户数据丢失必须 24h 内完成恢复 + 通报。
- 任何"非常规恢复"手段（手工 SQL 改 journal 等）执行后必须做一次 §3.C 验证。
