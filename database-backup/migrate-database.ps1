# Database Migration Automation Script
# For Windows PowerShell 5.1+
# Usage: .\migrate-database.ps1 -SourceProjectID "abc123" -TargetProjectID "xyz789" -Password "yourpassword"

param(
    [Parameter(Mandatory = $true, HelpMessage = "Source Supabase Project ID")]
    [string]$SourceProjectID,
    
    [Parameter(Mandatory = $true, HelpMessage = "Target Supabase Project ID")]
    [string]$TargetProjectID,
    
    [Parameter(Mandatory = $true, HelpMessage = "Database password")]
    [string]$Password,
    
    [Parameter(HelpMessage = "Export directory (default: current directory)")]
    [string]$ExportDir = ".",
    
    [Parameter(HelpMessage = "Skip export and use existing files")]
    [switch]$SkipExport,
    
    [Parameter(HelpMessage = "Skip import")]
    [switch]$SkipImport,
    
    [Parameter(HelpMessage = "Verbose output")]
    [switch]$Verbose
)

# ============================================================================
# Configuration
# ============================================================================

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Supabase Database Migration Tool"

$SourceDB = "postgresql://postgres:${Password}@${SourceProjectID}.supabase.co:5432/postgres"
$TargetDB = "postgresql://postgres:${Password}@${TargetProjectID}.supabase.co:5432/postgres"

$ExportFiles = @{
    Schema = "$ExportDir\schema_export.sql"
    Users  = "$ExportDir\users_export.sql"
    Data   = "$ExportDir\data_export.sql"
}

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Title {
    param([string]$Text)
    Write-Host "`n" -ForegroundColor Black
    Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "═════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "[✓] $Text" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "[✗] $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "[ℹ] $Text" -ForegroundColor Yellow
}

function Test-PostgresConnection {
    param([string]$ConnectionString, [string]$Name)
    
    Write-Info "Testing connection to $Name..."
    
    try {
        $result = psql $ConnectionString -c "SELECT 1 as connection_test;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Connected to $Name successfully"
            return $true
        }
        else {
            Write-Error-Custom "Failed to connect to $Name"
            Write-Error-Custom "Error: $result"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Connection test failed: $_"
        return $false
    }
}

function Export-Schema {
    param([string]$Source, [string]$OutputFile)
    
    Write-Info "Exporting schema and policies..."
    
    try {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        psql $Source -f "$scriptDir\export_schema_policies.sql" > $OutputFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $size = (Get-Item $OutputFile).Length / 1KB
            Write-Success "Schema exported successfully ($(${size}.ToString("F2")) KB)"
            return $true
        }
        else {
            Write-Error-Custom "Schema export failed"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Export error: $_"
        return $false
    }
}

function Export-Users {
    param([string]$Source, [string]$OutputFile)
    
    Write-Info "Exporting users and authentication data..."
    
    try {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        psql $Source -f "$scriptDir\export_users_auth.sql" > $OutputFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $size = (Get-Item $OutputFile).Length / 1KB
            Write-Success "Users exported successfully ($(${size}.ToString("F2")) KB)"
            return $true
        }
        else {
            Write-Error-Custom "Users export failed"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Export error: $_"
        return $false
    }
}

function Export-Data {
    param([string]$Source, [string]$OutputFile)
    
    Write-Info "Exporting application data (this may take several minutes)..."
    
    try {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        psql $Source -f "$scriptDir\export_application_data.sql" > $OutputFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $size = (Get-Item $OutputFile).Length / 1MB
            Write-Success "Data exported successfully ($(${size}.ToString("F2")) MB)"
            return $true
        }
        else {
            Write-Error-Custom "Data export failed"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Export error: $_"
        return $false
    }
}

function Import-Schema {
    param([string]$Target, [string]$ExportFile)
    
    Write-Info "Importing schema and policies..."
    
    if (-not (Test-Path $ExportFile)) {
        Write-Error-Custom "Export file not found: $ExportFile"
        return $false
    }
    
    try {
        psql $Target < $ExportFile 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Schema imported successfully"
            
            # Verify import
            $tableCount = psql $Target -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1 | Select-String "^\s*[0-9]+" | ForEach-Object { $_.Matches.Value.Trim() }
            Write-Success "Created $tableCount tables"
            
            return $true
        }
        else {
            Write-Error-Custom "Schema import failed"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Import error: $_"
        return $false
    }
}

function Import-Users {
    param([string]$Target, [string]$ExportFile)
    
    Write-Info "Importing users and authentication data..."
    
    if (-not (Test-Path $ExportFile)) {
        Write-Error-Custom "Export file not found: $ExportFile"
        return $false
    }
    
    try {
        psql $Target < $ExportFile 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Users imported successfully"
            
            # Verify import
            $userCount = psql $Target -c "SELECT COUNT(*) FROM auth.users WHERE email NOT LIKE '%supabase%';" 2>&1 | Select-String "^\s*[0-9]+" | ForEach-Object { $_.Matches.Value.Trim() }
            Write-Success "Imported $userCount users"
            
            return $true
        }
        else {
            Write-Error-Custom "Users import failed"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Import error: $_"
        return $false
    }
}

function Import-Data {
    param([string]$Target, [string]$ExportFile)
    
    Write-Info "Importing application data (this may take several minutes)..."
    
    if (-not (Test-Path $ExportFile)) {
        Write-Error-Custom "Export file not found: $ExportFile"
        return $false
    }
    
    try {
        psql $Target < $ExportFile 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Data imported successfully"
            return $true
        }
        else {
            Write-Error-Custom "Data import failed"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Import error: $_"
        return $false
    }
}

function Validate-Migration {
    param([string]$Target)
    
    Write-Info "Running post-migration validation..."
    
    try {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        psql $Target -f "$scriptDir\post_migration_fixes.sql" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Validation completed"
            return $true
        }
        else {
            Write-Error-Custom "Validation encountered issues (see above)"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Validation error: $_"
        return $false
    }
}

# ============================================================================
# Main Execution
# ============================================================================

Write-Title "SUPABASE DATABASE MIGRATION TOOL"

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Source Project: $SourceProjectID"
Write-Host "  Target Project: $TargetProjectID"
Write-Host "  Export Directory: $ExportDir`n"

# Test connections
if (-not (Test-PostgresConnection $SourceDB "Source Database")) {
    exit 1
}

if (-not (Test-PostgresConnection $TargetDB "Target Database")) {
    exit 1
}

# Export phase
if (-not $SkipExport) {
    Write-Title "PHASE 1: EXPORT"
    
    if (-not (Export-Schema $SourceDB $ExportFiles.Schema)) {
        Write-Error-Custom "Failed to export schema"
        exit 1
    }
    
    if (-not (Export-Users $SourceDB $ExportFiles.Users)) {
        Write-Error-Custom "Failed to export users"
        exit 1
    }
    
    if (-not (Export-Data $SourceDB $ExportFiles.Data)) {
        Write-Error-Custom "Failed to export data"
        exit 1
    }
}
else {
    Write-Title "PHASE 1: SKIPPED (using existing exports)"
    Write-Info "Using cached export files"
}

# Import phase
if (-not $SkipImport) {
    Write-Title "PHASE 2: IMPORT"
    
    if (-not (Import-Schema $TargetDB $ExportFiles.Schema)) {
        Write-Error-Custom "Failed to import schema"
        exit 1
    }
    
    if (-not (Import-Users $TargetDB $ExportFiles.Users)) {
        Write-Error-Custom "Failed to import users"
        exit 1
    }
    
    if (-not (Import-Data $TargetDB $ExportFiles.Data)) {
        Write-Error-Custom "Failed to import data"
        exit 1
    }
}
else {
    Write-Title "PHASE 2: SKIPPED"
    Write-Info "Skipping import"
}

# Validation phase
Write-Title "PHASE 3: VALIDATION"
if (-not (Validate-Migration $TargetDB)) {
    Write-Error-Custom "Validation found issues"
}

# Summary
Write-Title "MIGRATION SUMMARY"

Write-Host "✓ Migration phases completed!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Update .env.local with new Supabase URL and API key"
Write-Host "  2. Restart the application"
Write-Host "  3. Test login and data access"
Write-Host "  4. Verify RLS policies are working`n"

Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  README.md - Full overview"
Write-Host "  migration_checklist.md - Detailed step-by-step guide"
Write-Host "  troubleshooting.md - Common issues and solutions"
Write-Host "  QUICK_REFERENCE.md - Quick command reference`n"

Write-Success "Migration tool completed successfully!"
