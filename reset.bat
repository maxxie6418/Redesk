@echo off
REM ============================================================
REM Redesk - Reset Local Dev Environment (ASCII-only)
REM -----------------------------------------------------------
REM Why this script is ASCII-only:
REM   cmd.exe and PowerShell on a CN-locale Windows use code
REM   page 936 (GBK) by default. Non-ASCII bytes are interpreted
REM   as GBK commands, which causes "X is not recognized" errors.
REM   Keeping the script pure ASCII (and switching the console
REM   to UTF-8) avoids that class of bugs entirely.
REM -----------------------------------------------------------
REM Usage:
REM   - Double-click reset.bat (cmd.exe)
REM   - From cmd.exe:    reset.bat
REM   - From PowerShell: cmd /c reset.bat
REM ============================================================

setlocal
chcp 65001 >NUL

echo ==========================================================
echo   Redesk - Reset Local Dev Environment
echo ==========================================================
echo.

REM 1. Stop any running Node dev servers.
echo [1/5] Stopping node processes...
taskkill /F /IM node.exe >NUL 2>&1
REM Exclude IDE processes (node_repl.exe handles the IDE itself).
timeout /T 2 /NOBREAK >NUL
echo   done.

REM 2. Ensure dependencies are installed.
REM    If node_modules is missing (e.g. after a fresh clone or
REM    manual cleanup), pnpm db:migrate will fail because the
REM    `tsx` binary is not on PATH. Auto-install in that case.
echo [2/5] Checking dependencies...
if not exist "node_modules\.modules.yaml" (
  echo   node_modules missing, running pnpm install --frozen-lockfile ...
  call pnpm install --frozen-lockfile
  if errorlevel 1 (
    echo.
    echo [ERROR] pnpm install failed. Aborting.
    pause
    exit /b 1
  )
  echo   install complete.
) else (
  echo   node_modules present, skipping install.
)

REM 3. Delete the SQLite database file (and WAL sidecars if any).
echo [3/5] Removing database files...
if exist "data\redesk.db"      del /F /Q "data\redesk.db"
if exist "data\redesk.db-shm"  del /F /Q "data\redesk.db-shm"
if exist "data\redesk.db-wal"  del /F /Q "data\redesk.db-wal"
echo   done.

REM 4. Remove the storage directory (book covers, files, etc.).
echo [4/5] Removing storage directory...
if exist "data\storage" rmdir /S /Q "data\storage"
echo   done.

REM 5. Re-run migrations to recreate an empty schema.
echo [5/5] Running database migrations...
call pnpm db:migrate
if errorlevel 1 (
  echo.
  echo [ERROR] pnpm db:migrate failed. Aborting.
  pause
  exit /b 1
)
echo.

REM Optional: also clear local .temp test data.
REM Comment out the next block if you want to keep .temp/.
if exist ".temp" (
  echo [bonus] Clearing .temp test artifacts...
  rmdir /S /Q ".temp"
  echo   done.
)

echo ==========================================================
echo   Reset complete. Run 'pnpm dev' to start the services.
echo ==========================================================
endlocal
pause
