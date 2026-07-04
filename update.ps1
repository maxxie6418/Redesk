# Redesk 更新脚本 (Windows)
# 用法: .\update.ps1
# 说明: 拉取最新代码并重新构建 Docker 镜像

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "📦 Redesk 更新" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未安装 git" -ForegroundColor Red
    exit 1
}

# 检查 docker compose
$compose = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $compose = "docker"
} else {
    Write-Host "❌ 未安装 Docker" -ForegroundColor Red
    exit 1
}

# 拉取最新代码
Write-Host "⬇️  拉取最新代码..." -ForegroundColor Yellow
$current = git rev-parse --short HEAD
git fetch --tags origin 2>$null
git pull
$new = git rev-parse --short HEAD

if ($current -eq $new) {
    Write-Host "✅ 已是最新版本 ($current)" -ForegroundColor Green
    exit 0
}

Write-Host "📥 代码已更新: $current → $new" -ForegroundColor Yellow

# 重新构建并重启
Write-Host "🔨 重新构建镜像..." -ForegroundColor Yellow
& $compose compose build --no-cache

Write-Host "🚀 重启服务..." -ForegroundColor Yellow
& $compose compose up -d

Write-Host ""
Write-Host "✅ Redesk 更新完成" -ForegroundColor Green
Write-Host "   版本: $new" -ForegroundColor Green
Write-Host "   服务将在几秒后就绪" -ForegroundColor Gray
