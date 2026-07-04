#!/bin/bash
set -e

# Redesk 更新脚本
# 用法: ./update.sh [--force]
# 说明: 拉取最新代码并重新构建 Docker 镜像

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

echo -e "${YELLOW}📦 Redesk 更新${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 git
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ 未安装 git${NC}"
  exit 1
fi

# 检查 docker compose
if command -v docker compose &> /dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE="docker-compose"
else
  echo -e "${RED}❌ 未安装 docker compose${NC}"
  exit 1
fi

# 拉取最新代码
echo -e "${YELLOW}⬇️  拉取最新代码...${NC}"
git fetch --tags origin 2>/dev/null || git fetch origin 2>/dev/null
CURRENT=$(git rev-parse --short HEAD)
git pull
NEW=$(git rev-parse --short HEAD)

if [ "$CURRENT" = "$NEW" ] && [ "$1" != "--force" ]; then
  echo -e "${GREEN}✅ 已是最新版本 ($CURRENT)${NC}"
  exit 0
fi

echo -e "${YELLOW}📥 代码已更新: $CURRENT → $NEW${NC}"

# 重新构建并重启
echo -e "${YELLOW}🔨 重新构建镜像...${NC}"
$COMPOSE build --no-cache

echo -e "${YELLOW}🚀 重启服务...${NC}"
$COMPOSE up -d

echo ""
echo -e "${GREEN}✅ Redesk 更新完成${NC}"
echo -e "   版本: ${GREEN}$NEW${NC}"
echo -e "   服务将在几秒后就绪"
