#!/bin/sh
set -e

# Docker 命名卷在首次挂载时由 root 创建，
# 应用以 redesk (uid 6418) 运行，需要可写权限才能建 SQLite 库与 storage 目录。
chown -R redesk:redesk /data

# 降权到 redesk 运行 CMD；gosu 保证信号正确转发
exec gosu redesk "$@"
