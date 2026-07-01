# 交接文档：Docker 部署命名卷权限修复

> 交接日期：2026-07-01
> 关联执行项：DEPLOY-11（容器启动测试）
> 关联文档：[M1-上线筹备.md §5 部署准备](../todo/M1-上线筹备.md)、[技术方案.md](../技术方案.md)、[决策记录.md](../决策记录.md)

---

## 0. 一句话状态

修复了 VPS 部署时容器以非 root 启动导致命名卷 `/data` 不可写、`SQLITE_CANTOPEN` 失败的故障。容器现在以 root 启动 → entrypoint 修正卷所有权 → 降权到 `redesk` 跑应用，安全收益（应用进程非 root）保持不变。

---

## 1. 故障背景

VPS 部署 `docker compose up` 后，API 启动失败，日志报错：

```
SqliteError: unable to open database file (SQLITE_CANTOPEN)
```

定位到卷权限问题：

| 项目 | 实际值 |
| --- | --- |
| 命名卷 `redesk-data` 挂载点 | `/data` |
| 卷首次创建后目录所有者 | `root:root` |
| 容器运行用户 | `redesk` (uid 6418) |
| 写入 `/data/redesk.db` | 权限拒绝 |

### 1.1 根因链路

1. `Dockerfile` 创建系统用户 `redesk`（uid/gid 6418），并 `USER redesk`。
2. `docker-compose.yml` 显式 `user: '6418:6418'`，覆盖 Dockerfile 的默认用户。
3. Docker 命名卷在宿主侧由 docker 守护进程创建，目录所有者是 `root`（宿主的 root，不是容器内）。
4. 应用进程以 `redesk` 身份无法在 root 拥有的 `/data` 下创建 `redesk.db` 与 `storage/`。

旧版未加 `user:` / `USER redesk`，进程以 root 运行，无此问题。本次修复在不放弃「应用进程非 root」安全收益的前提下解决权限初始化。

---

## 2. 修复方案

采用**业内标准 entrypoint 模式**（参考 Redis、PostgreSQL 官方镜像）：

```
docker compose up
  → 容器以 root 启动（compose 不再强制 user）
  → ENTRYPOINT 执行 docker-entrypoint.sh
      chown -R redesk:redesk /data   ← 修正卷所有权
      exec gosu redesk "$@"          ← 降权跑 pnpm start
  → 应用进程实际身份 redesk，/data 已可写
```

### 2.1 为什么用 `gosu` 而不是 `su` / `runuser`

- `gosu` 为容器场景设计，不派生 TTY、不吞信号。
- `SIGTERM` 等控制信号可正确转发到 Node 进程，Docker 优雅停机（`docker stop`）可生效。
- 体积小（≈1MB），Debian 主仓库直装，密钥无须额外配置。
- `su` 在 PID 1 场景下信号处理不友好；`runuser` 需调用 PAM，容器中无 systemd 集成。

### 2.2 兼容性

| 场景 | 行为 |
| --- | --- |
| 首次部署（空卷） | `chown -R` 创建 `/data` 后归位 `redesk`，应用建库正常 |
| 既有部署（曾以 root 跑过） | `/data` 已被 root 写满；`chown -R` 一次性归位，不破坏 SQLite 文件内容 |
| 旧镜像升级 | 旧卷里的 `redesk.db` 文件内容不变，仅元数据更新 |
| 多副本部署 | 当前 `docker-compose.yml` 单服务，未涉及；如扩多副本需改卷驱动 |

---

## 3. 改动文件清单

| 文件 | 变更类型 | 关键内容 |
| --- | --- | --- |
| [docker-entrypoint.sh](../../docker-entrypoint.sh) | 新建 | 修正 `/data` 所有权并降权到 `redesk` 运行 CMD |
| [Dockerfile](../../Dockerfile) | 修改 | runtime 阶段 `apt-get install gosu`；复制 entrypoint；`ENTRYPOINT` 接管；移除 `USER redesk` |
| [docker-compose.yml](../../docker-compose.yml) | 修改 | 移除 `user: '6418:6418'`，加注释说明 entrypoint 模式 |
| `doc/handover/HANDOVER-2026-07-01-DOCKER-VOLUME-PERMISSION.md` | 新建 | 本交接文档 |

### 3.1 `docker-entrypoint.sh`

```sh
#!/bin/sh
set -e

# Docker 命名卷在首次挂载时由 root 创建，
# 应用以 redesk (uid 6418) 运行，需要可写权限才能建 SQLite 库与 storage 目录。
chown -R redesk:redesk /data

# 降权到 redesk 运行 CMD；gosu 保证信号正确转发
exec gosu redesk "$@"
```

### 3.2 `Dockerfile` 关键 diff

```dockerfile
# 新增：安装 gosu（容器内降权工具）
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

# 新增：entrypoint 接管启动
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# 移除：USER redesk（与 chown 冲突，权限初始化由 entrypoint 完成）
```

### 3.3 `docker-compose.yml` 关键 diff

```yaml
-     user: '6418:6418'
+     # 容器以 root 启动，entrypoint 会 chown /data 给 redesk 后再降权运行应用。
+     # 若在此处强制 user: '6418:6418'，chown 会失败，命名卷仍归 root 所有。
```

---

## 4. 部署验证

```bash
# 1. 重新构建镜像（gosu 与 entrypoint 已写入）
docker compose build --no-cache

# 2. 启动
docker compose up -d

# 3. 查看日志（不应再出现 SQLITE_CANTOPEN）
docker compose logs -f redesk

# 4. 验证卷所有权已修正
docker exec redesk ls -la /data
# 期望：drwxr-xr-x ... redesk redesk ...

# 5. 验证应用进程身份
docker exec redesk id
# 期望：uid=6418(redesk) gid=6418(redesk) groups=6418(redesk)

# 6. 验证数据库可读写
docker exec redesk ls -la /data/redesk.db
# 期望：-rw-r--r-- ... redesk redesk ... redesk.db
```

---

## 5. 当前项目状态

- **分支**：`main`
- **本地工作区**：`pnpm typecheck` / `pnpm lint` 全部通过（本次仅 Docker 基础设施改动，未触及 TS 代码）
- **文档**：本交接文档落地到 `doc/handover/`，符合既有命名规范
- **回滚方案**：若新镜像在生产侧出问题，回滚到上一个 tag 即可；`docker-entrypoint.sh` 失败时 `set -e` 会让容器直接退出，可被 healthcheck 捕获

---

## 6. 后续可选优化（未做）

- [ ] 加 `tini` 作为 PID 1（当前 `gosu` 转发信号已够用，但 `tini` 还能回收僵尸进程）
- [ ] 命名卷迁移到 bind mount 时同步声明 `uid/gid` 模式（适合 K8s 场景）
- [ ] 镜像加 `HEALTHCHECK` 而非依赖 compose 的 healthcheck（部署形态多时可统一）
- [ ] 启动日志加一行「卷所有权已修正 / 已就绪」便于排障
