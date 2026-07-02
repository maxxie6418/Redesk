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
echo [1/4] Stopping node processes...
taskkill /F /IM node.exe >NUL 2>&1
REM Exclude IDE processes (node_repl.exe handles the IDE itself).
timeout /T 2 /NOBREAK >NUL
echo   done.

REM 2. Delete the SQLite database file (and WAL sidecars if any).
echo [2/4] Removing database files...
if exist "data\redesk.db"      del /F /Q "data\redesk.db"
if exist "data\redesk.db-shm"  del /F /Q "data\redesk.db-shm"
if exist "data\redesk.db-wal"  del /F /Q "data\redesk.db-wal"
echo   done.

REM 3. Remove the storage directory (book covers, files, etc.).
echo [3/4] Removing storage directory...
if exist "data\storage" rmdir /S /Q "data\storage"
echo   done.

REM 4. Re-run migrations to recreate an empty schema.
echo [4/4] Running database migrations...
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
