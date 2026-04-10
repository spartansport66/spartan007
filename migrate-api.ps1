#!/usr/bin/env pwsh
# ============================================================================
# SUPABASE API-BASED AUTO-MIGRATION
# ============================================================================
# Run this script to migrate your entire Supabase database using APIs
# No database passwords required!
#
# Usage:
#   .\migrate-api.ps1 -sourceProjectId <id> -sourceApiKey <key> -targetProjectId <id> -targetApiKey <key>
#
# Or interactive mode (just run the script):
#   .\migrate-api.ps1
# ============================================================================

param(
    [string]$sourceProjectId,
    [string]$sourceApiKey,
    [string]$targetProjectId,
    [string]$targetApiKey,
    [switch]$noUsers,
    [switch]$noStorage,
    [switch]$noFunctions,
    [switch]$apiServer
)

# Colors for output
function Write-Title { Write-Host $args[0] -ForegroundColor Cyan -BackgroundColor Black }
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Error { Write-Host "❌ " + $args[0] -ForegroundColor Red }
function Write-Warning { Write-Host "⚠️  " + $args[0] -ForegroundColor Yellow }
function Write-Info { Write-Host "ℹ️  " + $args[0] -ForegroundColor Blue }
function Write-Step { Write-Host "👉 " + $args[0] -ForegroundColor Magenta }

Write-Title "╔════════════════════════════════════════╗"
Write-Title "║  SUPABASE AUTO-MIGRATION (API-BASED)   ║"
Write-Title "╚════════════════════════════════════════╝"
Write-Host ""

# If parameters not provided, go interactive
if (-not $sourceProjectId) {
    Write-Step "Source Supabase Configuration"
    $sourceProjectId = Read-Host "Enter source project ID"
    
    Write-Info "Paste your source API key and press Enter (leave blank to skip):"
    $sourceApiKey = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
    
    if (-not $sourceApiKey) {
        Write-Error "API key is required"
        exit 1
    }
}

if (-not $targetProjectId) {
    Write-Host ""
    Write-Step "Target Supabase Configuration"
    $targetProjectId = Read-Host "Enter target project ID"
    
    Write-Info "Paste your target API key and press Enter:"
    $targetApiKey = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
    
    if (-not $targetApiKey) {
        Write-Error "API key is required"
        exit 1
    }
}

# Validate inputs
if (-not $sourceProjectId -or -not $targetProjectId -or -not $sourceApiKey -or -not $targetApiKey) {
    Write-Error "Missing required credentials"
    exit 1
}

Write-Host ""
Write-Success "✅ Credentials validated"
Write-Host ""

# Show configuration
Write-Title "📋 Migration Configuration"
Write-Host "  Source Project:   $sourceProjectId"
Write-Host "  Target Project:   $targetProjectId"
Write-Host "  Include Users:    $(if ($noUsers) { 'No' } else { 'Yes' })"
Write-Host "  Include Storage:  $(if ($noStorage) { 'No' } else { 'Yes' })"
Write-Host "  Include Functons: $(if ($noFunctions) { 'No' } else { 'Yes' })"
Write-Host ""

# Confirm
$confirm = Read-Host "Proceed with migration? (yes/no)"
if ($confirm -ne "yes") {
    Write-Warning "Migration cancelled"
    exit 0
}

Write-Host ""

# Set environment variables
$env:SOURCE_API_KEY = $sourceApiKey
$env:TARGET_API_KEY = $targetApiKey

# Build migration command
$migrationArgs = @(
    "--source", $sourceProjectId,
    "--target", $targetProjectId
)

if ($noUsers) { $migrationArgs += "--no-users" }
if ($noStorage) { $migrationArgs += "--no-storage" }
if ($noFunctions) { $migrationArgs += "--no-functions" }

try {
    Write-Info "Starting migration..."
    Write-Host ""
    
    # Run migration
    npm run migrate:auto -- @migrationArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Success "╔═══════════════════════════════════════╗"
        Write-Success "║  ✨ MIGRATION COMPLETED SUCCESSFULLY  ║"
        Write-Success "╚═══════════════════════════════════════╝"
        Write-Host ""
        Write-Info "Your data has been successfully migrated to $targetProjectId"
        Write-Info "Verify the data in your Supabase dashboard"
    } else {
        Write-Error "Migration failed. Check the error messages above."
        exit 1
    }
} catch {
    Write-Error "Failed to run migration: $_"
    exit 1
} finally {
    # Clear sensitive data
    $env:SOURCE_API_KEY = ""
    $env:TARGET_API_KEY = ""
}
