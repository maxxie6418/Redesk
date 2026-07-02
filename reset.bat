@echo off
REM ============================================================
REM Redesk - Dev Tools Menu (ASCII-only)
REM -----------------------------------------------------------
REM Interactive menu for local development maintenance:
REM   1) Wipe database + storage, then re-run migrations.
REM   2) Reset admin password to "admin" (single-admin check).
REM   0) Exit.
REM Pure ASCII to avoid CN-locale GBK parsing issues.
REM Usage:
REM   - Double-click reset.bat (cmd.exe)
REM   - From cmd.exe:    reset.bat
REM   - From PowerShell: cmd /c reset.bat
REM ============================================================

setlocal
chcp 65001 >NUL

:menu
cls
echo ==========================================================
echo   Redesk - Dev Tools Menu
echo ==========================================================
echo   1) Reset database (wipe data + storage + re-migrate)
echo   2) Reset admin password to "admin"
echo   0) Exit
echo ==========================================================
set /p "choice=Choose [0-2]: "

if "%choice%"=="1" goto :option1
if "%choice%"=="2" goto :option2
if "%choice%"=="0" goto :end
echo.
echo Invalid choice: "%choice%". Please enter 0, 1, or 2.
timeout /T 2 /NOBREAK >NUL
goto :menu

:option1
echo.
echo [Option 1] Reset database and storage.
echo.

REM Step 1: stop any running Node dev servers.
echo [1/5] Stopping node processes...
taskkill /F /IM node.exe >NUL 2>&1
timeout /T 2 /NOBREAK >NUL
echo   done.

REM Step 2: ensure dependencies are installed.
echo [2/5] Checking dependencies...
if not exist "node_modules\.modules.yaml" (
  echo   node_modules missing, running pnpm install --frozen-lockfile ...
  call pnpm install --frozen-lockfile
  if errorlevel 1 (
    echo.
    echo [ERROR] pnpm install failed. Aborting.
    goto :option1_end
  )
  echo   install complete.
) else (
  echo   node_modules present, skipping install.
)

REM Step 3: delete the SQLite database file (and WAL sidecars).
echo [3/5] Removing database files...
if exist "data\redesk.db"      del /F /Q "data\redesk.db"
if exist "data\redesk.db-shm"  del /F /Q "data\redesk.db-shm"
if exist "data\redesk.db-wal"  del /F /Q "data\redesk.db-wal"
echo   done.

REM Step 4: remove the storage directory.
echo [4/5] Removing storage directory...
if exist "data\storage" rmdir /S /Q "data\storage"
echo   done.

REM Step 5: re-run migrations to recreate an empty schema.
echo [5/5] Running database migrations...
call pnpm db:migrate
if errorlevel 1 (
  echo.
  echo [ERROR] pnpm db:migrate failed. Aborting.
  goto :option1_end
)

REM Optional: clear .temp test artifacts.
if exist ".temp" (
  echo [bonus] Clearing .temp test artifacts...
  rmdir /S /Q ".temp"
  echo   done.
)

echo.
echo [Option 1] Database reset complete.
:option1_end
echo.
pause
goto :menu

:option2
echo.
echo [Option 2] Reset admin password to "admin".
echo   This will:
echo     - Set password_hash to argon2("admin")
echo     - Set must_change_password = 1
echo     - Leave username, display_name, is_active, created_at, etc. untouched
echo     - Fail if the database does not contain exactly one admin row
echo.
set /p "confirm=Continue? [y/N]: "
if /I not "%confirm%"=="y" (
  echo Aborted.
  goto :option2_end
)
echo.
call pnpm --filter @redesk/api reset-admin-password
if errorlevel 1 (
  echo.
  echo [ERROR] reset-admin-password failed. Aborting.
  goto :option2_end
)
echo.
echo [Option 2] Admin password reset complete.
echo   Login as the admin username (default: admin) with password "admin",
echo   you will be forced to set a new password on first login.
:option2_end
echo.
pause
goto :menu

:end
endlocal
exit /b 0
