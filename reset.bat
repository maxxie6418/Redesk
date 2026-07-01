@echo off
chcp 65001 >nul
echo ========================================
echo   Redesk - 重置本地开发环境
echo ========================================
echo.

REM 1. 停止所有 node 进程
echo [1/4] 停止 node 进程...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo   完成

REM 2. 删除数据库
echo [2/4] 删除数据库...
if exist "data\redesk.db" (
    del /f /q "data\redesk.db"
    echo   已删除 data\redesk.db
) else (
    echo   数据库不存在，跳过
)

REM 3. 删除存储文件
echo [3/4] 删除存储文件...
if exist "data\storage" (
    rmdir /s /q "data\storage"
    echo   已删除 data\storage
) else (
    echo   存储目录不存在，跳过
)

REM 4. 重新迁移并启动
echo [4/4] 运行数据库迁移...
call pnpm db:migrate
echo.
echo ========================================
echo   环境已重置，执行 pnpm dev 启动服务
echo ========================================
pause
