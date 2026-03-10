/**
 * This file contains the full SQL schema for the Spartan ERP system.
 * It is used to generate a complete SQL dump for easy migration to a new Supabase account.
 */

export const FULL_SCHEMA_SQL = `
-- ==========================================
-- 1. EXTENSIONS & SEQUENCES
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.dispatch_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.production_orders_production_order_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.purchase_vouchers_voucher_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.purchase_orders_po_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.sales_return_number_seq;

-- ==========================================
-- 2. TABLES
-- ==========================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  user_type TEXT NOT NULL DEFAULT 'sales_person',
  must_reset_password BOOLEAN DEFAULT FALSE
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
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

-- Raw Materials
CREATE TABLE IF NOT EXISTS public.raw_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  unit_of_measure TEXT,
  current_stock NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Online Platforms
CREATE TABLE IF NOT EXISTS public.online_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company Info
CREATE TABLE IF NOT EXISTS public.company_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  opening_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dealers
CREATE TABLE IF NOT EXISTS public.dealers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
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

-- Dealer Balances
CREATE TABLE IF NOT EXISTS public.dealer_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE UNIQUE,
  opening_balance NUMERIC DEFAULT 0.00,
  closing_balance NUMERIC DEFAULT 0.00,
  balance_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dealer Sales Persons (Join Table)
CREATE TABLE IF NOT EXISTS public.dealer_sales_persons (
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  sales_person_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (dealer_id, sales_person_id)
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  size TEXT,
  hsn TEXT,
  gst TEXT DEFAULT '0.00',
  dp INTEGER DEFAULT 0,
  opening_stock INTEGER DEFAULT 0,
  stock_in INTEGER DEFAULT 0,
  stock_out INTEGER DEFAULT 0,
  closing_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
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
  gate_pass_dispatch_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales (Order Items)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 5,
  total_price NUMERIC NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES public.profiles(id),
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  cheque_dd_no TEXT,
  cheque_dd_date DATE,
  transaction_id TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  card_number TEXT,
  card_holder_name TEXT,
  expiry_date TEXT,
  cvv TEXT,
  upi_id TEXT,
  source TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Allocations
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  liability_id UUID NOT NULL, -- Can be order_id or dealer_id (for opening balance)
  allocated_amount NUMERIC NOT NULL,
  allocation_type TEXT NOT NULL, -- 'order' or 'opening_balance'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Person Visits
CREATE TABLE IF NOT EXISTS public.sales_person_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_person_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  visit_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  photo_url TEXT,
  visit_status TEXT,
  remarks TEXT,
  next_visit_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Targets
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_person_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_amount NUMERIC NOT NULL DEFAULT 0.00,
  target_month DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sales_person_id, target_month)
);

-- Combo Offers
CREATE TABLE IF NOT EXISTS public.combo_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Combo Offer Products
CREATE TABLE IF NOT EXISTS public.combo_offer_products (
  combo_offer_id UUID REFERENCES public.combo_offers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_offer_id, product_id)
);

-- Combo Offer Dealers
CREATE TABLE IF NOT EXISTS public.combo_offer_dealers (
  combo_offer_id UUID REFERENCES public.combo_offers(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (combo_offer_id, dealer_id)
);

-- Notification Emails
CREATE TABLE IF NOT EXISTS public.notification_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number INTEGER DEFAULT nextval('public.purchase_orders_po_number_seq'),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by UUID REFERENCES public.profiles(id),
  supplier_invoice_no TEXT,
  supplier_invoice_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  raw_material_id UUID REFERENCES public.raw_materials(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC,
  total_price NUMERIC,
  quantity_received NUMERIC DEFAULT 0
);

-- Purchase Vouchers
CREATE TABLE IF NOT EXISTS public.purchase_vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_number INTEGER DEFAULT nextval('public.purchase_vouchers_voucher_number_seq'),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  receipt_date DATE NOT NULL,
  received_by UUID REFERENCES public.profiles(id),
  supplier_invoice_no TEXT,
  supplier_invoice_date DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Voucher Items
CREATE TABLE IF NOT EXISTS public.purchase_voucher_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_voucher_id UUID REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE,
  raw_material_id UUID REFERENCES public.raw_materials(id),
  quantity_received NUMERIC NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 0,
  total_amount NUMERIC
);

-- Sales Returns
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number INTEGER DEFAULT nextval('public.sales_return_number_seq'),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 0,
  total_credit_amount NUMERIC NOT NULL,
  return_date DATE NOT NULL,
  remarks TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Online Order Staging
CREATE TABLE IF NOT EXISTS public.online_order_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_order_number TEXT NOT NULL,
  customer_name TEXT,
  shipping_address TEXT,
  flipkart_item_name TEXT,
  mapped_product_id UUID REFERENCES public.products(id),
  amount NUMERIC,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- note: a composite unique index on (platform_order_number, flipkart_item_name)
-- is maintained by migrations to support multi‑item orders.
-- Online Order Details
CREATE TABLE IF NOT EXISTS public.online_order_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  platform_id UUID REFERENCES public.online_platforms(id),
  client_name TEXT NOT NULL,
  platform_order_number TEXT,
  contact_no TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  raw_item_name TEXT,
  mapped_product_id UUID REFERENCES public.products(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Login Logs
CREATE TABLE IF NOT EXISTS public.login_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  ip_address TEXT
);

-- User Activity Logs
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  user_id UUID PRIMARY KEY,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Sent Logs
CREATE TABLE IF NOT EXISTS public.whatsapp_sent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_offer_id UUID REFERENCES public.combo_offers(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_by UUID REFERENCES public.profiles(id),
  message_type TEXT
);

-- Production Orders
CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_number INTEGER DEFAULT nextval('public.production_orders_production_order_number_seq'),
  product_id UUID REFERENCES public.products(id),
  quantity_to_produce INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Production Alerts
CREATE TABLE IF NOT EXISTS public.production_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  required_quantity INTEGER NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill of Materials
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC NOT NULL
);

-- Stock Receipts
CREATE TABLE IF NOT EXISTS public.stock_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. FUNCTIONS & TRIGGERS
-- ==========================================

-- Function: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: has_inventory_access
CREATE OR REPLACE FUNCTION public.has_inventory_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'inventory_manager'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: increment_stock
CREATE OR REPLACE FUNCTION public.increment_stock(product_id_in UUID, quantity_in INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products
  SET stock_in = stock_in + quantity_in,
      closing_stock = opening_stock + (stock_in + quantity_in) - stock_out
  WHERE id = product_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: decrement_stock
CREATE OR REPLACE FUNCTION public.decrement_stock(product_id_in UUID, quantity_in INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products
  SET stock_out = stock_out + quantity_in,
      closing_stock = opening_stock + stock_in - (stock_out + quantity_in)
  WHERE id = product_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function: decrease_stock_on_sale
CREATE OR REPLACE FUNCTION public.decrease_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET stock_out = stock_out + NEW.quantity,
        closing_stock = opening_stock + stock_in - (stock_out + NEW.quantity)
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: trigger_decrease_stock
DROP TRIGGER IF EXISTS trigger_decrease_stock ON public.sales;
CREATE TRIGGER trigger_decrease_stock
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.decrease_stock_on_sale();

-- ==========================================
-- 4. RLS POLICIES (BASIC)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all dealers" ON public.dealers FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Sales persons view assigned dealers" ON public.dealers FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.dealer_sales_persons dsp WHERE dsp.dealer_id = dealers.id AND dsp.sales_person_id = auth.uid()));

-- (Additional policies would follow the same pattern)
`;