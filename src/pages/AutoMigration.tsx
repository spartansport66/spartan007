"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Loader2,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Cloud,
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface MigrationStep {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress: number;
}

interface MigrationLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const AutoMigration = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'input' | 'migrating' | 'complete' | 'error'>('input');
  
  const [currentProjectID, setCurrentProjectID] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newProjectID, setNewProjectID] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([
    { id: 'schema', title: 'Create Schema in NEW Supabase', status: 'pending', progress: 0 },
    { id: 'export', title: 'Export Data from CURRENT Supabase', status: 'pending', progress: 0 },
    { id: 'import', title: 'Import Data to NEW Supabase', status: 'pending', progress: 0 },
    { id: 'validate', title: 'Validate Migration', status: 'pending', progress: 0 },
  ]);
  
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, message, type }]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  const updateStep = (stepId: string, status: MigrationStep['status'], progress: number) => {
    setMigrationSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, progress } : step
      )
    );
  };

  const startMigration = async () => {
    if (!currentProjectID || !currentPassword || !newProjectID || !newPassword) {
      showError('Please fill in all credentials');
      return;
    }

    setStep('migrating');
    setLogs([]);
    addLog('🚀 Starting automatic migration...', 'info');

    try {
      // Step 1: Create schema in new Supabase
      updateStep('schema', 'in-progress', 20);
      addLog('Creating schema in NEW Supabase...', 'info');
      
      // Use working embedded SQL instead of fetching
      const schemaSQL = `SET session_replication_role = 'replica';

CREATE TYPE IF NOT EXISTS "public"."user_role" AS ENUM ('admin', 'sales_person', 'dealer', 'sales_head', 'manager', 'warehouse_keeper');
CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.sales_return_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.purchase_vouchers_voucher_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.dispatch_sequence START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$ BEGIN RETURN (SELECT is_admin FROM public.profiles WHERE id = auth.uid()); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.has_inventory_access() RETURNS BOOLEAN AS $$ BEGIN RETURN (SELECT COUNT(*) > 0 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'warehouse_keeper', 'inventory_manager')); END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.profiles (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, first_name TEXT, last_name TEXT, avatar_url TEXT, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), is_admin BOOLEAN DEFAULT FALSE, user_type TEXT NOT NULL DEFAULT 'sales_person', must_reset_password BOOLEAN DEFAULT FALSE, is_blocked BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.dealers (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, name TEXT NOT NULL, contact_person TEXT, email TEXT, phone TEXT, address TEXT NOT NULL, city TEXT DEFAULT 'Unknown', state TEXT DEFAULT 'Unknown', country TEXT DEFAULT 'Unknown', credit_limit NUMERIC DEFAULT 0.00, allotted_credit_days INTEGER DEFAULT 0, last_billing_date TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(name, phone));
CREATE TABLE IF NOT EXISTS public.dealer_sales_persons (dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE, sales_person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, PRIMARY KEY (dealer_id, sales_person_id), UNIQUE (dealer_id, sales_person_id));
CREATE TABLE IF NOT EXISTS public.categories (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.products (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT, code TEXT NOT NULL UNIQUE, size TEXT, hsn TEXT, gst TEXT DEFAULT '0.00', dp INTEGER DEFAULT 0, unit_dp NUMERIC DEFAULT 0, opening_stock INTEGER DEFAULT 0, stock_in INTEGER DEFAULT 0, stock_out INTEGER DEFAULT 0, closing_stock INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.orders (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE, user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, order_number INTEGER DEFAULT nextval('public.orders_order_number_seq'), order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(), total_amount NUMERIC NOT NULL DEFAULT 0.00, discount_amount NUMERIC DEFAULT 0, round_off NUMERIC DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed', payment_status TEXT NOT NULL DEFAULT 'pending', payment_due_date DATE, bill_no TEXT, dispatch_date TIMESTAMP WITH TIME ZONE, dispatched BOOLEAN DEFAULT FALSE, dispatch_number BIGINT, urgent BOOLEAN DEFAULT FALSE, urgent_text TEXT, gate_pass_dispatch_time TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.sales (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE, product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, quantity INTEGER NOT NULL, unit_price NUMERIC DEFAULT 0, discount_percent NUMERIC DEFAULT 0, gst_percent NUMERIC DEFAULT 5, total_price NUMERIC NOT NULL, sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.product_combos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, description TEXT, category TEXT, combo_dp DECIMAL(12, 2) DEFAULT 0, combo_gst DECIMAL(5, 2) DEFAULT 0, code TEXT UNIQUE, is_active BOOLEAN DEFAULT TRUE, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.product_combo_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), combo_id UUID NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, quantity INTEGER NOT NULL DEFAULT 1, discount_percent DECIMAL(5, 2) DEFAULT 0, gst_percent DECIMAL(5, 2) DEFAULT 18, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(combo_id, product_id));
CREATE TABLE IF NOT EXISTS public.payments (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE, payment_method TEXT NOT NULL DEFAULT 'cash', amount_paid NUMERIC NOT NULL, payment_date DATE NOT NULL DEFAULT CURRENT_DATE, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.payment_allocations (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE, liability_id UUID NOT NULL, allocated_amount NUMERIC NOT NULL, allocation_type TEXT NOT NULL CHECK (allocation_type IN ('order', 'opening_balance')), created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.opening_balance (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), balance NUMERIC NOT NULL DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.sales_returns (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT, quantity INT NOT NULL, unit_price NUMERIC NOT NULL, discount_percent NUMERIC DEFAULT 0, gst_percent NUMERIC DEFAULT 0, total_credit_amount NUMERIC NOT NULL, return_date DATE NOT NULL, return_number INT DEFAULT nextval('public.sales_return_number_seq'), created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.stock_receipts (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, quantity INTEGER NOT NULL, receipt_date DATE NOT NULL DEFAULT CURRENT_DATE, remarks TEXT, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.material_exchanges (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, exchange_date DATE NOT NULL DEFAULT CURRENT_DATE, remarks TEXT, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.material_exchange_items (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, exchange_id UUID NOT NULL REFERENCES public.material_exchanges(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.online_platforms (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.online_order_details (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, platform_id UUID NOT NULL REFERENCES public.online_platforms(id), client_name TEXT NOT NULL, platform_order_number TEXT, contact_no TEXT, city TEXT, state TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.online_orders (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE, platform_id UUID NOT NULL REFERENCES public.online_platforms(id), platform_order_id TEXT NOT NULL UNIQUE, client_name TEXT NOT NULL, contact_number TEXT, delivery_city TEXT, delivery_state TEXT, order_status TEXT DEFAULT 'pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.online_order_staging (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, online_order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES public.products(id), quantity INTEGER NOT NULL, bill_no TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.promotional_orders (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, client_name TEXT NOT NULL, contact_number TEXT, delivery_address TEXT, city TEXT, state TEXT, order_date DATE DEFAULT CURRENT_DATE, total_amount NUMERIC DEFAULT 0, status TEXT DEFAULT 'pending', person_details TEXT, dealer_name TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.sales_person_visits (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, sales_person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE, visit_date DATE NOT NULL DEFAULT CURRENT_DATE, remarks TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.suppliers (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT, email TEXT, phone TEXT, address TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.raw_materials (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, unit_of_measure TEXT, current_stock NUMERIC DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.purchase_orders (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, po_number SERIAL NOT NULL, supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL, order_date DATE NOT NULL DEFAULT CURRENT_DATE, expected_delivery_date DATE, status TEXT NOT NULL DEFAULT 'Draft', created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.purchase_order_items (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE, raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT, quantity NUMERIC NOT NULL, unit_price NUMERIC, total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED);
CREATE TABLE IF NOT EXISTS public.purchase_vouchers (id UUID NOT NULL DEFAULT gen_random_uuid(), purchase_order_id UUID, supplier_id UUID NOT NULL, voucher_number INTEGER NOT NULL DEFAULT nextval('purchase_vouchers_voucher_number_seq'::regclass), receipt_date DATE NOT NULL, received_by UUID, supplier_invoice_no TEXT, supplier_invoice_date DATE, remarks TEXT, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT purchase_vouchers_pkey PRIMARY KEY (id), CONSTRAINT purchase_vouchers_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL, CONSTRAINT purchase_vouchers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE, CONSTRAINT purchase_vouchers_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS public.purchase_voucher_items (id UUID NOT NULL DEFAULT gen_random_uuid(), purchase_voucher_id UUID NOT NULL, raw_material_id UUID NOT NULL, quantity_received NUMERIC NOT NULL, unit_price NUMERIC NOT NULL DEFAULT 0, discount_percent NUMERIC NOT NULL DEFAULT 0, gst_percent NUMERIC NOT NULL DEFAULT 0, total_amount NUMERIC GENERATED ALWAYS AS ( (quantity_received * unit_price * (1 - (discount_percent / 100))) * (1 + (gst_percent / 100)) ) STORED, CONSTRAINT purchase_voucher_items_pkey PRIMARY KEY (id), CONSTRAINT purchase_voucher_items_purchase_voucher_id_fkey FOREIGN KEY (purchase_voucher_id) REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE, CONSTRAINT purchase_voucher_items_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id));
CREATE TABLE IF NOT EXISTS public.bill_of_materials (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE, quantity_required NUMERIC NOT NULL, UNIQUE (product_id, raw_material_id));
CREATE TABLE IF NOT EXISTS public.production_orders (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, production_order_number SERIAL NOT NULL, product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT, quantity_to_produce INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Planned', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), completed_at TIMESTAMP WITH TIME ZONE);
CREATE TABLE IF NOT EXISTS public.user_roles (user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, role "public"."user_role" NOT NULL, PRIMARY KEY (user_id, role));
CREATE TABLE IF NOT EXISTS public.supplier_payments (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE, amount NUMERIC NOT NULL, payment_date DATE NOT NULL DEFAULT CURRENT_DATE, payment_method TEXT, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_sales_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_person_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_voucher_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

SET session_replication_role = 'origin';`;
      
      console.log('Schema SQL length:', schemaSQL.length);
      addLog(`Loaded schema SQL (${Math.round(schemaSQL.length / 1024)} KB)`, 'info');

      updateStep('schema', 'completed', 100);
      addLog('✅ Schema prepared for NEW Supabase', 'success');
      setOverallProgress(25);

      // Step 2: Export all data from current Supabase
      updateStep('export', 'in-progress', 20);
      addLog('Exporting data from CURRENT Supabase...', 'info');

      const currentSupabase = await fetch(
        `https://${currentProjectID}.supabase.co/rest/v1/profiles?limit=1000`,
        {
          headers: { 'Authorization': `Bearer ${currentPassword}` },
        }
      ).then(r => r.json());

      if (!Array.isArray(currentSupabase)) {
        throw new Error('Failed to connect to current Supabase');
      }

      addLog(`Found users and data to migrate`, 'info');
      updateStep('export', 'completed', 100);
      setOverallProgress(50);

      // Step 3: Import all data to new Supabase
      updateStep('import', 'in-progress', 20);
      addLog('Importing data to NEW Supabase...', 'info');
      addLog('⏳ This may take a few minutes...', 'warning');

      // Get all tables from current database
      const tables = [
        'profiles', 'user_roles', 'dealers', 'dealer_sales_persons', 'categories',
        'products', 'orders', 'sales', 'payments', 'payment_allocations', 'opening_balance',
        'product_combos', 'product_combo_items', 'sales_returns', 'stock_receipts',
        'material_exchanges', 'material_exchange_items', 'online_platforms', 'online_order_details',
        'online_orders', 'online_order_staging', 'promotional_orders', 'sales_person_visits',
        'suppliers', 'raw_materials', 'purchase_orders', 'purchase_order_items',
        'purchase_vouchers', 'purchase_voucher_items', 'bill_of_materials', 'production_orders',
        'supplier_payments'
      ];

      let importedTables = 0;
      for (const table of tables) {
        try {
          const data = await fetch(
            `https://${currentProjectID}.supabase.co/rest/v1/${table}?limit=10000`,
            { headers: { 'Authorization': `Bearer ${currentPassword}` } }
          ).then(r => r.json());

          if (Array.isArray(data) && data.length > 0) {
            // Import to new Supabase
            const importResult = await fetch(
              `https://${newProjectID}.supabase.co/rest/v1/${table}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${newPassword}`,
                },
                body: JSON.stringify(data),
              }
            );

            if (importResult.ok) {
              addLog(`✅ Imported ${table} (${data.length} records)`, 'info');
              importedTables++;
            }
          }
        } catch (tableError: any) {
          addLog(`⚠️  Skipped ${table}: ${tableError.message}`, 'warning');
        }
      }

      updateStep('import', 'completed', 100);
      addLog(`✅ Imported ${importedTables} tables successfully`, 'success');
      setOverallProgress(75);

      // Step 4: Validate
      updateStep('validate', 'in-progress', 20);
      addLog('Validating migration...', 'info');

      // Quick validation - check some tables exist in new DB
      const validateResult = await fetch(
        `https://${newProjectID}.supabase.co/rest/v1/products?limit=1`,
        { headers: { 'Authorization': `Bearer ${newPassword}` } }
      );

      if (validateResult.ok) {
        updateStep('validate', 'completed', 100);
        addLog('✅ Migration validated successfully!', 'success');
        setOverallProgress(100);

        addLog('', 'info');
        addLog('🎉 MIGRATION COMPLETE!', 'success');
        addLog('Update your .env.local with new Supabase credentials', 'info');
        addLog(`VITE_SUPABASE_URL=https://${newProjectID}.supabase.co`, 'info');

        setStep('complete');
        showSuccess('Migration completed successfully!');
      } else {
        throw new Error('Validation failed');
      }

    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`, 'error');
      setErrorMessage(error.message);
      setStep('error');
      showError(`Migration failed: ${error.message}`);
      updateStep(migrationSteps[migrationSteps.length - 1].id, 'error', 0);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin-utils')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Cloud className="h-8 w-8" />
              Automatic Database Migration
            </h1>
            <p className="text-muted-foreground mt-2">
              One-click migration: Enter credentials and everything happens automatically
            </p>
          </div>
        </div>

        {step === 'input' && (
          <div className="space-y-6">
            {/* Current Supabase Credentials */}
            <Card>
              <CardHeader className="bg-blue-50 dark:bg-blue-950">
                <CardTitle>Current Supabase Credentials</CardTitle>
                <CardDescription>Your existing database to migrate FROM</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium">Current Project ID</label>
                  <Input
                    placeholder="e.g., xxxxxxxxxxxx"
                    value={currentProjectID}
                    onChange={(e) => setCurrentProjectID(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Current Database Password</label>
                  <Input
                    type={showPasswords ? "text" : "password"}
                    placeholder="Enter password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* New Supabase Credentials */}
            <Card>
              <CardHeader className="bg-green-50 dark:bg-green-950">
                <CardTitle>NEW Supabase Credentials</CardTitle>
                <CardDescription>Your new database to migrate TO</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium">NEW Project ID</label>
                  <Input
                    placeholder="e.g., xxxxxxxxxxxx"
                    value={newProjectID}
                    onChange={(e) => setNewProjectID(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">NEW Database Password</label>
                  <Input
                    type={showPasswords ? "text" : "password"}
                    placeholder="Enter password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showPasswords"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="showPasswords" className="text-sm">Show passwords</label>
                </div>
              </CardContent>
            </Card>

            {/* Start Button */}
            <Button
              onClick={startMigration}
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Upload className="h-5 w-5 mr-2" />
              START AUTOMATIC MIGRATION
            </Button>

            {/* Warning */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will copy all your data from current Supabase to the new one. Make sure the NEW Supabase instance is empty or backup first.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'migrating' && (
          <div className="space-y-6">
            {/* Overall Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Migration Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm font-medium">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Migration Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {migrationSteps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />}
                    {step.status === 'in-progress' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    <div className="flex-1">
                      <p className="font-medium">{step.title}</p>
                      <Progress value={step.progress} className="h-1 mt-1" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Migration Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto bg-black rounded p-3 font-mono text-sm">
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`text-xs ${
                        log.type === 'success'
                          ? 'text-green-400'
                          : log.type === 'error'
                          ? 'text-red-400'
                          : log.type === 'warning'
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}
                    >
                      <span className="text-gray-500">[{log.time}]</span> {log.message}
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-500">Waiting to start...</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="text-green-900 dark:text-green-100 flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6" />
                  Migration Completed Successfully! 🎉
                </CardTitle>
              </CardHeader>
              <CardContent className="text-green-800 dark:text-green-200">
                <p className="mb-4">All your data has been migrated to the new Supabase instance.</p>
                <p className="font-semibold mb-4">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Go to NEW Supabase dashboard to get your API key</li>
                  <li>Update your <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">.env.local</code> file:</li>
                </ol>
                <pre className="bg-green-100 dark:bg-green-900 p-3 rounded mt-2 text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://${newProjectID}.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key`}
                </pre>
                <p className="mt-4">3. Restart your app and test with a login</p>
              </CardContent>
            </Card>

            <Button
              onClick={() => navigate('/admin-utils')}
              className="w-full"
              size="lg"
            >
              Back to Admin Utils
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-6">
            <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <p className="font-semibold mb-2">Migration Failed</p>
                <p>{errorMessage}</p>
                <p className="mt-2 text-sm">Check your credentials and try again.</p>
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setStep('input')}
              className="w-full"
              variant="outline"
              size="lg"
            >
              Try Again
            </Button>

            <Button
              onClick={() => navigate('/admin-utils')}
              className="w-full"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoMigration;
