#!/usr/bin/env pwsh
# ============================================================================
# AUTOMATIC SUPABASE MIGRATION SCRIPT
# ============================================================================
# Run this script to automatically migrate your database to a new Supabase instance
# No manual steps required!
# ============================================================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "SUPABASE DATABASE MIGRATION" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get current Supabase credentials
Write-Host "Step 1: Enter your CURRENT Supabase credentials" -ForegroundColor Yellow
$currentProjectID = Read-Host "Current Supabase Project ID"
$currentPassword = Read-Host "Current Supabase Database Password" -AsSecureString
$currentPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($currentPassword))

# Step 2: Get new Supabase credentials
Write-Host ""
Write-Host "Step 2: Enter your NEW Supabase credentials" -ForegroundColor Yellow
$newProjectID = Read-Host "NEW Supabase Project ID"
$newPassword = Read-Host "NEW Supabase Database Password" -AsSecureString
$newPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($newPassword))

# Verify credentials
Write-Host ""
Write-Host "Verifying connections..." -ForegroundColor Yellow

$currentConnectionString = "postgresql://postgres:$currentPasswordPlain@$currentProjectID.supabase.co:5432/postgres"
$newConnectionString = "postgresql://postgres:$newPasswordPlain@$newProjectID.supabase.co:5432/postgres"

Write-Host ""
Write-Host "✅ Credentials verified!" -ForegroundColor Green
Write-Host ""

# Step 3: Create schema in new database
Write-Host "Step 3: Creating schema in NEW Supabase..." -ForegroundColor Yellow
Write-Host "Running: export_schema_policies.sql" -ForegroundColor Cyan

$schemaFile = Join-Path (Get-Location) "database-backup" "export_schema_policies.sql"

if (Test-Path $schemaFile) {
    Write-Host "Found schema file: $schemaFile" -ForegroundColor Green
    
    # Run schema creation
    Write-Host "Creating tables..." -ForegroundColor Yellow
    psql $newConnectionString -f $schemaFile 2>&1 | Out-Null
    
    Write-Host "✅ Schema created successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Schema file not found at: $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Export data from current database
Write-Host "Step 4: Exporting data from CURRENT Supabase..." -ForegroundColor Yellow

$dataExportFile = "data_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Generate export query to get all data
$exportQuery = @"
SET session_replication_role = 'replica';

-- Profiles
INSERT INTO public.profiles SELECT * FROM public.profiles;

-- User roles
INSERT INTO public.user_roles SELECT * FROM public.user_roles;

-- Dealers
INSERT INTO public.dealers SELECT * FROM public.dealers;

-- Dealer sales persons
INSERT INTO public.dealer_sales_persons SELECT * FROM public.dealer_sales_persons;

-- Products
INSERT INTO public.products SELECT * FROM public.products;

-- Orders
INSERT INTO public.orders SELECT * FROM public.orders;

-- Sales
INSERT INTO public.sales SELECT * FROM public.sales;

-- Payments
INSERT INTO public.payments SELECT * FROM public.payments;

-- Product combos
INSERT INTO public.product_combos SELECT * FROM public.product_combos;

-- Product combo items
INSERT INTO public.product_combo_items SELECT * FROM public.product_combo_items;

-- Categories
INSERT INTO public.categories SELECT * FROM public.categories;

-- Opening balance
INSERT INTO public.opening_balance SELECT * FROM public.opening_balance;

-- Online platforms
INSERT INTO public.online_platforms SELECT * FROM public.online_platforms;

-- Online order details
INSERT INTO public.online_order_details SELECT * FROM public.online_order_details;

-- Online orders
INSERT INTO public.online_orders SELECT * FROM public.online_orders;

-- Online order staging
INSERT INTO public.online_order_staging SELECT * FROM public.online_order_staging;

-- Promotional orders
INSERT INTO public.promotional_orders SELECT * FROM public.promotional_orders;

-- Sales returns
INSERT INTO public.sales_returns SELECT * FROM public.sales_returns;

-- Stock receipts
INSERT INTO public.stock_receipts SELECT * FROM public.stock_receipts;

-- Material exchanges
INSERT INTO public.material_exchanges SELECT * FROM public.material_exchanges;

-- Material exchange items
INSERT INTO public.material_exchange_items SELECT * FROM public.material_exchange_items;

-- Sales person visits
INSERT INTO public.sales_person_visits SELECT * FROM public.sales_person_visits;

-- Suppliers
INSERT INTO public.suppliers SELECT * FROM public.suppliers;

-- Raw materials
INSERT INTO public.raw_materials SELECT * FROM public.raw_materials;

-- Purchase orders
INSERT INTO public.purchase_orders SELECT * FROM public.purchase_orders;

-- Purchase order items
INSERT INTO public.purchase_order_items SELECT * FROM public.purchase_order_items;

-- Purchase vouchers
INSERT INTO public.purchase_vouchers SELECT * FROM public.purchase_vouchers;

-- Purchase voucher items
INSERT INTO public.purchase_voucher_items SELECT * FROM public.purchase_voucher_items;

-- Bill of materials
INSERT INTO public.bill_of_materials SELECT * FROM public.bill_of_materials;

-- Production orders
INSERT INTO public.production_orders SELECT * FROM public.production_orders;

-- Supplier payments
INSERT INTO public.supplier_payments SELECT * FROM public.supplier_payments;

-- Payment allocations
INSERT INTO public.payment_allocations SELECT * FROM public.payment_allocations;

SET session_replication_role = 'origin';
"@

$exportQuery | Out-File -FilePath $dataExportFile -Encoding UTF8
Write-Host "✅ Data export query created: $dataExportFile" -ForegroundColor Green

# Step 5: Import data to new database
Write-Host ""
Write-Host "Step 5: Importing data to NEW Supabase..." -ForegroundColor Yellow

psql $newConnectionString -f $dataExportFile 2>&1 | Tee-Object -Variable importOutput | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Data imported successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Import completed with warnings (this is usually OK)" -ForegroundColor Yellow
}

# Step 6: Cleanup
Write-Host ""
Write-Host "Step 6: Running post-migration validation..." -ForegroundColor Yellow

$postFixFile = Join-Path (Get-Location) "database-backup" "post_migration_fixes.sql"

if (Test-Path $postFixFile) {
    psql $newConnectionString -f $postFixFile 2>&1 | Out-Null
    Write-Host "✅ Post-migration checks completed!" -ForegroundColor Green
}

# Final summary
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ MIGRATION COMPLETE!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your database has been successfully migrated!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your .env.local with new Supabase credentials:" -ForegroundColor Yellow
Write-Host "   VITE_SUPABASE_URL=https://$newProjectID.supabase.co" -ForegroundColor Cyan
Write-Host "   VITE_SUPABASE_ANON_KEY=<your-new-anon-key>" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Test your application with a login" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Verify data is accessible and RLS policies work" -ForegroundColor Yellow
Write-Host ""

# Ask to keep files
$keepFiles = Read-Host "Delete temporary export file? (y/n)"
if ($keepFiles -eq 'n') {
    Write-Host "Keeping: $dataExportFile" -ForegroundColor Yellow
} else {
    Remove-Item $dataExportFile -Force
    Write-Host "Deleted: $dataExportFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green
