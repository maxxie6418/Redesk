---
name: "release-version"
description: "修改项目版本号并发布 GitHub Release。当用户说「修改版本号」「发版」「release」「bump version」时触发。自动检测项目中所有版本号位置，Git commit + tag + 通过 GitHub API 创建 Release。可跨项目复用，无需修改。"
---

# 通用发版流程

此 Skill 定义标准的发版流程：修改版本号 → 提交 → 打 Tag → 发布 GitHub Release。
**完全通用，不包含任何项目特定信息，可迁移到任意 Git 仓库使用。**

## 触发词

用户说出以下任一关键词时触发：
- 修改版本号、更新版本号、升级版本
- 发版、发布版本、release
- bump version、new version

---

## 执行流程

### Step 0：发现阶段（自动检测项目结构）

执行前先自动检测以下信息，不做任何假设：

#### 0.1 检测 GitHub 仓库

```bash
git remote get-url origin
```

从输出中提取 `owner/repo`。例如：
- `https://github.com/user/repo.git` → `user/repo`
- `git@github.com:user/repo.git` → `user/repo`

如果失败，提示用户手动提供仓库名，停止流程。

#### 0.2 检测所有需要更新版本号的位置

**做法**：用 Grep 搜索项目中所有出现当前版本号的位置，而非硬编码路径。

先读取根 `package.json` 获取当前版本号：
```bash
node -e "console.log(require('./package.json').version)"
```

然后搜索所有包含当前版本号字符串的文件（排除 `node_modules`、`.git`、lock 文件）：

```bash
# 用 Grep 工具搜索当前版本号
pattern: "当前版本号字符串" (如 "2.1.1")
```

从结果中，只保留以下类型的文件作为"需要同步更新"的目标：
- `**/package.json`（`"version"` 字段）
- `**/docker-compose*.yml` 或 `**/docker-compose*.yaml`（`image:` 行中的版本号）
- `**/Chart.yaml`（Helm chart 版本）
- `**/Cargo.toml`（Rust 项目版本）
- `**/pyproject.toml`（Python 项目版本）

**重要**：只更新找到的这些文件，不创建新文件，不修改未列出的文件。

#### 0.3 检测验证命令

按优先级查找项目可用的验证命令：
1. `pnpm typecheck`（package.json scripts 中存在时）
2. `npm run typecheck` 或 `npm run build`
3. 都没有则跳过验证步骤，口头提醒用户自行验证

#### 0.4 展示检测结果并确认

整理检测到的信息，向用户展示：

```
检测结果：
- 仓库：owner/repo
- 当前版本：x.y.z
- 需要更新的文件（N 个）：
  1. package.json
  2. apps/api/package.json
  ...
- 验证命令：pnpm typecheck
```

然后询问用户目标版本号。

---

### Step 1：确定版本号

如果用户只说了"修改版本号"/"发版"但没给具体版本号，**必须询问用户**要升级到哪个版本号。

版本号格式：`主.次.修订`（如 `2.1.2`）：
- 主版本号：阶段性更新，须用户声明才递增
- 次版本号：向下兼容功能新增
- 修订号：向下兼容问题修正

如果用户不确定，AI 可根据当前版本号建议下一个修订号（如 `2.1.1` → 建议 `2.1.2`），并说明理由。

---

### Step 2：更新版本号

用 SearchReplace 逐个更新 Step 0 中检测到的每个文件。规则：

- **package.json 系列**：只改 `"version"` 字段的值，不修改其他任何内容。匹配模式 `"version": "旧版本号"` → `"version": "新版本号"`
- **docker-compose 系列**：只改 `image: xxx:旧版本号` 中的版本号部分。匹配模式 `:旧版本号` 前有 image 关键字的行
- **其他文件**：仅修改版本号字符串本身，保守匹配

---

### Step 3：运行验证命令

执行 Step 0.3 检测到的验证命令。如果失败，**停止流程并修复问题**，不允许跳过。

---

### Step 4：Git 提交

```bash
# 只添加被修改的文件，不添加其他文件
git add <Step 2 中修改的所有文件路径>
git commit -m "chore: release v{新版本号}"
```

提交信息格式：`chore: release v{版本号}`

---

### Step 5：打 Git Tag

```bash
git tag -a v{新版本号} -m "v{新版本号}"
```

Tag 名称格式：`v{版本号}`（如 `v2.1.2`）。版本号本身不带 `v`，但 Tag 名称带 `v`。

---

### Step 6：推送提交和 Tag

```bash
git push origin HEAD
git push origin v{新版本号}
```

先推送代码，再推送 tag。

---

### Step 7：创建 GitHub Release

使用 GitHub REST API 创建 Release。URL 中的 `{owner}/{repo}` 使用 Step 0.1 检测到的值。

**Windows (PowerShell)**：
```powershell
$body = @{
  tag_name = "v{版本号}"
  name = "v{版本号}"
  body = "v{版本号}`n`n### 变更`n`n- ..."
  draft = $false
  prerelease = $false
} | ConvertTo-Json

$env:GITHUB_TOKEN = "ghp_xxx"  # 用户自行设置

Invoke-RestMethod -Uri "https://api.github.com/repos/{owner}/{repo}/releases" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $env:GITHUB_TOKEN"; Accept = "application/vnd.github+json" } `
  -Body $body
```

**macOS/Linux (bash)**：
```bash
curl -X POST "https://api.github.com/repos/{owner}/{repo}/releases" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{
    "tag_name": "v{版本号}",
    "name": "v{版本号}",
    "body": "v{版本号}\n\n### 变更\n\n- ...",
    "draft": false,
    "prerelease": false
  }'
```

**Token 处理**：
- 先从当前进程环境变量读取 `GITHUB_TOKEN`
- 如果未设置，提示用户在对应终端中执行 `$env:GITHUB_TOKEN="ghp_xxx"`（Win）或 `export GITHUB_TOKEN="ghp_xxx"`（Unix）
- 如果 Token 已设置但 API 返回 401/403，说明 Token 权限不足或过期，提示用户更换
- 如果 API 返回 422，通常是 Tag 已存在，说明错误并停止
- 如果用户没有 Token，跳过此步，提醒用户可手动去 `https://github.com/{owner}/{repo}/releases/new` 发布
- **绝对不要**在对话中显示 Token 值，也不要把 Token 写入任何文件

**Release Body 内容**：
- 如果用户在对话中描述了本次更新的内容，整理后填入 `body`
- 如果没有描述，用简短概括，如 `v{版本号}`

---

### Step 8：完成确认

向用户报告：
```
✅ 发版完成
- 版本：v{x.y.z}
- Tag：已推送
- Release：已发布（链接） / 需手动发布（链接）
```

---

## 迁移指南

将此 Skill 复制到另一个项目时：
1. 将 `.trae/skills/release-version/SKILL.md` 复制到目标项目的同一路径
2. **无需任何修改** — Skill 通过 Step 0 自动检测目标项目的结构

唯一的要求是目标项目必须是一个 Git 仓库且关联了 GitHub remote。

---

## 注意事项

- 版本号不要带 `v` 前缀（某些工具不识别），但 Tag 和 Release 名称必须带 `v`
- 任何步骤失败时，停止后续步骤并报告具体原因
- **绝不在代码或对话日志中暴露 Token 值**
- 推送 tag 会触发 GitHub 通知仓库关注者
- 如果项目有 CI/CD 通过 tag 触发部署，提醒用户确认后再推送
