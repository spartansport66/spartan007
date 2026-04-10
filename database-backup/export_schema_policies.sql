-- ============================================================================
-- EXPORT: SCHEMA AND RLS POLICIES  
-- ============================================================================
-- ✅ EXECUTABLE SQL FILE - Ready to run in Supabase SQL Editor
-- This file contains all CREATE TABLE, CREATE INDEX, and RLS POLICIES
-- Run this FIRST on your NEW Supabase instance
-- ============================================================================

SET session_replication_role = 'replica';

-- ============================================================================
-- 1. CREATE ENUM TYPES
-- ============================================================================

CREATE TYPE IF NOT EXISTS "public"."user_role" AS ENUM (
  'admin',
  'sales_person',
  'dealer',
  'sales_head',
  'manager',
  'warehouse_keeper'
);

-- ============================================================================
-- 2. CREATE SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.sales_return_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.purchase_vouchers_voucher_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.dispatch_sequence START WITH 1 INCREMENT BY 1;

-- ============================================================================
-- 3. CREATE CUSTOM FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT is_admin FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_inventory_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) > 0
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'warehouse_keeper', 'inventory_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE BASE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  user_type TEXT NOT NULL DEFAULT 'sales_person',
  must_reset_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dealers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Unknown',
  state TEXT DEFAULT 'Unknown',
  country TEXT DEFAULT 'Unknown',
  credit_limit NUMERIC DEFAULT 0.00,
  allotted_credit_days INTEGER DEFAULT 0,
  last_billing_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, phone)
);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dealer_sales_persons (
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  sales_person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (dealer_id, sales_person_id),
  UNIQUE (dealer_id, sales_person_id)
);

ALTER TABLE public.dealer_sales_persons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL UNIQUE,
  size TEXT,
  hsn TEXT,
  gst TEXT DEFAULT '0.00',
  dp INTEGER DEFAULT 0,
  unit_dp NUMERIC DEFAULT 0,
  opening_stock INTEGER DEFAULT 0,
  stock_in INTEGER DEFAULT 0,
  stock_out INTEGER DEFAULT 0,
  closing_stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_number INTEGER DEFAULT nextval('public.orders_order_number_seq'),
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_amount NUMERIC NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC DEFAULT 0,
  round_off NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_due_date DATE,
  bill_no TEXT,
  dispatch_date TIMESTAMP WITH TIME ZONE,
  dispatched BOOLEAN DEFAULT FALSE,
  dispatch_number BIGINT,
  urgent BOOLEAN DEFAULT FALSE,
  urgent_text TEXT,
  gate_pass_dispatch_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 5,
  total_price NUMERIC NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  combo_dp DECIMAL(12, 2) DEFAULT 0,
  combo_gst DECIMAL(5, 2) DEFAULT 0,
  code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  gst_percent DECIMAL(5, 2) DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(combo_id, product_id)
);

ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  amount_paid NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  liability_id UUID NOT NULL,
  allocated_amount NUMERIC NOT NULL,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('order', 'opening_balance')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.opening_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS single_row_opening_balance ON public.opening_balance ((true));
ALTER TABLE public.opening_balance ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 0,
  total_credit_amount NUMERIC NOT NULL,
  return_date DATE NOT NULL,
  return_number INT DEFAULT nextval('public.sales_return_number_seq'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stock_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.material_exchanges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  exchange_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_exchanges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.material_exchange_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange_id UUID NOT NULL REFERENCES public.material_exchanges(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_exchange_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.online_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.online_platforms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.online_order_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES public.online_platforms(id),
  client_name TEXT NOT NULL,
  platform_order_number TEXT,
  contact_no TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.online_order_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.online_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES public.online_platforms(id),
  platform_order_id TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  contact_number TEXT,
  delivery_city TEXT,
  delivery_state TEXT,
  order_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.online_order_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  online_order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  bill_no TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.online_order_staging ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.promotional_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  contact_number TEXT,
  delivery_address TEXT,
  city TEXT,
  state TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  person_details TEXT,
  dealer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.promotional_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sales_person_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sales_person_visits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.raw_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  unit_of_measure TEXT,
  current_stock NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number SERIAL NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.purchase_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id UUID,
  supplier_id UUID NOT NULL,
  voucher_number INTEGER NOT NULL DEFAULT nextval('purchase_vouchers_voucher_number_seq'::regclass),
  receipt_date DATE NOT NULL,
  received_by UUID,
  supplier_invoice_no TEXT,
  supplier_invoice_date DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT purchase_vouchers_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_vouchers_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  CONSTRAINT purchase_vouchers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE,
  CONSTRAINT purchase_vouchers_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.purchase_voucher_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  purchase_voucher_id UUID NOT NULL,
  raw_material_id UUID NOT NULL,
  quantity_received NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  gst_percent NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC GENERATED ALWAYS AS ( (quantity_received * unit_price * (1 - (discount_percent / 100))) * (1 + (gst_percent / 100)) ) STORED,
  CONSTRAINT purchase_voucher_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_voucher_items_purchase_voucher_id_fkey FOREIGN KEY (purchase_voucher_id) REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE,
  CONSTRAINT purchase_voucher_items_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id)
);

ALTER TABLE public.purchase_voucher_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC NOT NULL,
  UNIQUE (product_id, raw_material_id)
);

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_number SERIAL NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_to_produce INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role "public"."user_role" NOT NULL,
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dealers_name ON public.dealers(name);
CREATE INDEX IF NOT EXISTS idx_dealers_user_id ON public.dealers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_dealer_id ON public.orders(dealer_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_order_id ON public.sales(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_product_combos_active ON public.product_combos(is_active);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_combo_id ON public.product_combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_payments_dealer_id ON public.payments(dealer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_dealer_id ON public.sales_returns(dealer_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_product_id ON public.stock_receipts(product_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_raw_materials_code ON public.raw_materials(code);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);

-- ============================================================================
-- 6. RESTORE REPLICATION ROLE
-- ============================================================================

SET session_replication_role = 'origin';

-- ============================================================================
-- ✅ SCHEMA CREATION COMPLETE
-- ============================================================================
