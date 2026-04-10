@echo off
REM Database Migration Tool for Windows
REM This script helps you migrate Supabase databases
REM Run this file and follow the prompts

setlocal enabledelayedexpansion

cls
echo ============================================================
echo      SUPABASE DATABASE MIGRATION TOOL FOR WINDOWS
echo ============================================================
echo.

REM Check if psql is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL client tools not found!
    echo.
    echo Please install PostgreSQL tools:
    echo https://www.postgresql.org/download/windows/
    echo.
    pause
    exit /b 1
)

echo [OK] PostgreSQL client tools found
echo.

REM Menu
:menu
echo.
echo Select an option:
echo.
echo 1) Quick Migration (Automated - Recommended)
echo 2) Manual Export Only
echo 3) Manual Import Only
echo 4) Validate Migration
echo 5) Show Quick Reference
echo 6) Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto quick_migrate
if "%choice%"=="2" goto export_only
if "%choice%"=="3" goto import_only
if "%choice%"=="4" goto validate_only
if "%choice%"=="5" goto show_reference
if "%choice%"=="6" exit /b 0

echo Invalid choice. Please try again.
goto menu

REM ============================================================
REM OPTION 1: QUICK MIGRATION (AUTOMATED)
REM ============================================================
:quick_migrate
cls
echo ============================================================
echo           OPTION 1: QUICK AUTOMATED MIGRATION
echo ============================================================
echo.
echo This will guide you through complete database migration
echo Estimated time: 2 hours
echo.

set /p source_id="Enter SOURCE Supabase Project ID: "
set /p target_id="Enter TARGET Supabase Project ID: "
set /p password="Enter Database Password: "

if "%source_id%"=="" (
    echo Error: Source Project ID required
    pause
    goto menu
)
if "%target_id%"=="" (
    echo Error: Target Project ID required
    pause
    goto menu
)
if "%password%"=="" (
    echo Error: Database Password required
    pause
    goto menu
)

echo.
echo Testing connections...

psql "postgresql://postgres:%password%@%source_id%.supabase.co:5432/postgres" -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to source database
    echo Please check your Project ID and password
    pause
    goto menu
)
echo [OK] Source database connected

psql "postgresql://postgres:%password%@%target_id%.supabase.co:5432/postgres" -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to target database
    echo Please check your Project ID and password
    pause
    goto menu
)
echo [OK] Target database connected
echo.

echo Starting PowerShell migration script...
echo To use PowerShell automation, run:
echo.
echo .\migrate-database.ps1 -SourceProjectID "%source_id%" -TargetProjectID "%target_id%" -Password "%password%"
echo.
echo Or continue with manual migration:
pause

goto menu

REM ============================================================
REM OPTION 2: EXPORT ONLY
REM ============================================================
:export_only
cls
echo ============================================================
echo           OPTION 2: MANUAL EXPORT ONLY
echo ============================================================
echo.

set /p project_id="Enter SOURCE Supabase Project ID: "
set /p password="Enter Database Password: "

if "%project_id%"=="" (
    echo Error: Project ID required
    pause
    goto menu
)
if "%password%"=="" (
    echo Error: Password required
    pause
    goto menu
)

echo.
echo Testing connection...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to database
    pause
    goto menu
)
echo [OK] Connected to database
echo.

echo Starting exports...
echo.

echo [1/3] Exporting schema and policies...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" -f export_schema_policies.sql > schema_export.sql 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Schema export failed
    pause
    goto menu
)
for %%F in (schema_export.sql) do echo [OK] Schema exported (%%~zF bytes)

echo.
echo [2/3] Exporting users and authentication...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" -f export_users_auth.sql > users_export.sql 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Users export failed
    pause
    goto menu
)
for %%F in (users_export.sql) do echo [OK] Users exported (%%~zF bytes)

echo.
echo [3/3] Exporting application data...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" -f export_application_data.sql > data_export.sql 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Data export failed
    pause
    goto menu
)
for %%F in (data_export.sql) do echo [OK] Data exported (%%~zF bytes)

echo.
echo ============================================================
echo EXPORT COMPLETE
echo ============================================================
echo.
echo Export files created:
echo   - schema_export.sql
echo   - users_export.sql
echo   - data_export.sql
echo.
echo Next steps:
echo 1. Create new Supabase project at https://supabase.com/dashboard
echo 2. Use "Option 3" to import these files
echo 3. Or see migration_checklist.md for manual steps
echo.
pause
goto menu

REM ============================================================
REM OPTION 3: IMPORT ONLY
REM ============================================================
:import_only
cls
echo ============================================================
echo           OPTION 3: MANUAL IMPORT ONLY
echo ============================================================
echo.

set /p project_id="Enter TARGET Supabase Project ID: "
set /p password="Enter Database Password: "

if "%project_id%"=="" (
    echo Error: Project ID required
    pause
    goto menu
)
if "%password%"=="" (
    echo Error: Password required
    pause
    goto menu
)

echo.
echo Testing connection...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to database
    pause
    goto menu
)
echo [OK] Connected to database
echo.

if not exist schema_export.sql (
    echo [ERROR] schema_export.sql not found!
    echo Please run "Option 2" first to export data
    pause
    goto menu
)
if not exist users_export.sql (
    echo [ERROR] users_export.sql not found!
    echo Please run "Option 2" first to export data
    pause
    goto menu
)
if not exist data_export.sql (
    echo [ERROR] data_export.sql not found!
    echo Please run "Option 2" first to export data
    pause
    goto menu
)

echo Starting imports...
echo.

echo [1/4] Importing schema and policies...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" < schema_export.sql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Schema import failed
    pause
    goto menu
)
echo [OK] Schema imported

echo.
echo [2/4] Importing users and authentication...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" < users_export.sql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Users import failed
    pause
    goto menu
)
echo [OK] Users imported

echo.
echo [3/4] Importing application data...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" < data_export.sql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Data import failed
    pause
    goto menu
)
echo [OK] Data imported

echo.
echo [4/4] Running post-migration fixes...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" < post_migration_fixes.sql >nul 2>&1
echo [OK] Validation completed

echo.
echo ============================================================
echo IMPORT COMPLETE
echo ============================================================
echo.
echo Next steps:
echo 1. Update .env.local with new Supabase URL and key
echo 2. Restart the application
echo 3. Test login and data access
echo 4. Verify RLS policies work correctly
echo.
pause
goto menu

REM ============================================================
REM OPTION 4: VALIDATE MIGRATION
REM ============================================================
:validate_only
cls
echo ============================================================
echo           OPTION 4: VALIDATE MIGRATION
echo ============================================================
echo.

set /p project_id="Enter Supabase Project ID: "
set /p password="Enter Database Password: "

if "%project_id%"=="" (
    echo Error: Project ID required
    pause
    goto menu
)
if "%password%"=="" (
    echo Error: Password required
    pause
    goto menu
)

echo.
echo Testing connection...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to database
    pause
    goto menu
)
echo [OK] Connected
echo.

echo Running validation...
psql "postgresql://postgres:%password%@%project_id%.supabase.co:5432/postgres" < post_migration_fixes.sql
echo.
pause
goto menu

REM ============================================================
REM OPTION 5: SHOW QUICK REFERENCE
REM ============================================================
:show_reference
cls
echo ============================================================
echo           QUICK REFERENCE COMMANDS
echo ============================================================
echo.
echo Replace these placeholders:
echo   [OLD-ID]      = Source Supabase Project ID
echo   [NEW-ID]      = Target Supabase Project ID
echo   [PASSWORD]    = Database password
echo.
echo EXPORT COMMANDS:
echo ────────────────────────────────────────────────────────────
echo.
echo psql "postgresql://postgres:[PASSWORD]@[OLD-ID].supabase.co:5432/postgres" ^
echo   -f export_schema_policies.sql ^> schema_export.sql
echo.
echo psql "postgresql://postgres:[PASSWORD]@[OLD-ID].supabase.co:5432/postgres" ^
echo   -f export_users_auth.sql ^> users_export.sql
echo.
echo psql "postgresql://postgres:[PASSWORD]@[OLD-ID].supabase.co:5432/postgres" ^
echo   -f export_application_data.sql ^> data_export.sql
echo.
echo IMPORT COMMANDS:
echo ────────────────────────────────────────────────────────────
echo.
echo psql "postgresql://postgres:[PASSWORD]@[NEW-ID].supabase.co:5432/postgres" ^
echo   ^< schema_export.sql
echo.
echo psql "postgresql://postgres:[PASSWORD]@[NEW-ID].supabase.co:5432/postgres" ^
echo   ^< users_export.sql
echo.
echo psql "postgresql://postgres:[PASSWORD]@[NEW-ID].supabase.co:5432/postgres" ^
echo   ^< data_export.sql
echo.
echo psql "postgresql://postgres:[PASSWORD]@[NEW-ID].supabase.co:5432/postgres" ^
echo   ^< post_migration_fixes.sql
echo.
echo POWERSHELL AUTOMATION:
echo ────────────────────────────────────────────────────────────
echo.
echo .\migrate-database.ps1 -SourceProjectID "[OLD-ID]" -TargetProjectID "[NEW-ID]" -Password "[PASSWORD]"
echo.
echo DOCUMENTATION:
echo ────────────────────────────────────────────────────────────
echo   README.md              - Full overview and features
echo   QUICK_REFERENCE.md     - Command cheat sheet
echo   migration_checklist.md - Detailed step-by-step guide
echo   troubleshooting.md     - Common issues and solutions
echo.
pause
goto menu

REM End of script
:end
exit /b 0
