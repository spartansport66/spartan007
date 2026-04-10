-- ============================================================================
-- AUTOMATIC EXPORT: USERS AND ALL DATA
-- ============================================================================
-- Run this query on your CURRENT Supabase to generate INSERT statements
-- Then copy the output and paste it in the upload tool
-- ============================================================================

-- Export profiles (users)
SELECT 'INSERT INTO public.profiles (id, first_name, last_name, is_admin, user_type, must_reset_password, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(COALESCE(first_name, '')) || ', ' ||
  quote_literal(COALESCE(last_name, '')) || ', ' ||
  COALESCE(is_admin::text, 'FALSE') || ', ' ||
  quote_literal(COALESCE(user_type, 'sales_person')) || ', ' ||
  COALESCE(must_reset_password::text, 'FALSE') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ');'
FROM public.profiles;

-- Export user roles
SELECT 'INSERT INTO public.user_roles (user_id, role) VALUES (' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(role) || ');'
FROM public.user_roles;

-- Export dealers
SELECT 'INSERT INTO public.dealers (id, user_id, name, contact_person, email, phone, address, city, state, country, credit_limit, allotted_credit_days, last_billing_date, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(COALESCE(user_id::text, 'NULL')) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(COALESCE(contact_person, '')) || ', ' ||
  quote_literal(COALESCE(email, '')) || ', ' ||
  quote_literal(COALESCE(phone, '')) || ', ' ||
  quote_literal(address) || ', ' ||
  quote_literal(COALESCE(city, 'Unknown')) || ', ' ||
  quote_literal(COALESCE(state, 'Unknown')) || ', ' ||
  quote_literal(COALESCE(country, 'Unknown')) || ', ' ||
  COALESCE(credit_limit::text, '0') || ', ' ||
  COALESCE(allotted_credit_days::text, '0') || ', ' ||
  COALESCE(quote_literal(last_billing_date), 'NULL') || ', ' ||
  quote_literal(created_at) || ');'
FROM public.dealers;

-- Export dealer_sales_persons mapping
SELECT 'INSERT INTO public.dealer_sales_persons (dealer_id, sales_person_id) VALUES (' ||
  quote_literal(dealer_id) || ', ' ||
  quote_literal(sales_person_id) || ');'
FROM public.dealer_sales_persons;

-- Export categories
SELECT 'INSERT INTO public.categories (id, name, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.categories;

-- Export products
SELECT 'INSERT INTO public.products (id, user_id, category_id, name, description, code, size, hsn, gst, dp, unit_dp, opening_stock, stock_in, stock_out, closing_stock, is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(COALESCE(user_id::text, 'NULL')) || ', ' ||
  quote_literal(COALESCE(category_id::text, 'NULL')) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(COALESCE(description, '')) || ', ' ||
  quote_literal(code) || ', ' ||
  quote_literal(COALESCE(size, '')) || ', ' ||
  quote_literal(COALESCE(hsn, '')) || ', ' ||
  quote_literal(COALESCE(gst, '0.00')) || ', ' ||
  COALESCE(dp::text, '0') || ', ' ||
  COALESCE(unit_dp::text, '0') || ', ' ||
  COALESCE(opening_stock::text, '0') || ', ' ||
  COALESCE(stock_in::text, '0') || ', ' ||
  COALESCE(stock_out::text, '0') || ', ' ||
  COALESCE(closing_stock::text, '0') || ', ' ||
  COALESCE(is_active::text, 'TRUE') || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(COALESCE(updated_at, created_at)) || ');'
FROM public.products;

-- Export orders
SELECT 'INSERT INTO public.orders (id, dealer_id, user_id, order_number, order_date, total_amount, discount_amount, round_off, status, payment_status, payment_due_date, bill_no, dispatch_date, dispatched, dispatch_number, urgent, urgent_text, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  quote_literal(COALESCE(user_id::text, 'NULL')) || ', ' ||
  COALESCE(order_number::text, '0') || ', ' ||
  quote_literal(order_date) || ', ' ||
  COALESCE(total_amount::text, '0') || ', ' ||
  COALESCE(discount_amount::text, '0') || ', ' ||
  COALESCE(round_off::text, '0') || ', ' ||
  quote_literal(COALESCE(status, 'completed')) || ', ' ||
  quote_literal(COALESCE(payment_status, 'pending')) || ', ' ||
  COALESCE(quote_literal(payment_due_date), 'NULL') || ', ' ||
  quote_literal(COALESCE(bill_no, '')) || ', ' ||
  COALESCE(quote_literal(dispatch_date), 'NULL') || ', ' ||
  COALESCE(dispatched::text, 'FALSE') || ', ' ||
  COALESCE(quote_literal(dispatch_number::text), 'NULL') || ', ' ||
  COALESCE(urgent::text, 'FALSE') || ', ' ||
  quote_literal(COALESCE(urgent_text, '')) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(COALESCE(updated_at, created_at)) || ');'
FROM public.orders;

-- Export sales (order items)
SELECT 'INSERT INTO public.sales (id, order_id, product_id, quantity, unit_price, discount_percent, gst_percent, total_price, sale_date, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_id) || ', ' ||
  quote_literal(COALESCE(product_id::text, 'NULL')) || ', ' ||
  quantity || ', ' ||
  COALESCE(unit_price::text, '0') || ', ' ||
  COALESCE(discount_percent::text, '0') || ', ' ||
  COALESCE(gst_percent::text, '5') || ', ' ||
  total_price || ', ' ||
  quote_literal(sale_date) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.sales;

-- Export payments
SELECT 'INSERT INTO public.payments (id, dealer_id, payment_method, amount_paid, payment_date, created_by, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  quote_literal(COALESCE(payment_method, 'cash')) || ', ' ||
  amount_paid || ', ' ||
  quote_literal(payment_date) || ', ' ||
  quote_literal(COALESCE(created_by::text, 'NULL')) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.payments;

-- Product combos
SELECT 'INSERT INTO public.product_combos (id, name, description, category, combo_dp, combo_gst, code, is_active, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(COALESCE(description, '')) || ', ' ||
  quote_literal(COALESCE(category, '')) || ', ' ||
  COALESCE(combo_dp::text, '0') || ', ' ||
  COALESCE(combo_gst::text, '0') || ', ' ||
  quote_literal(COALESCE(code, '')) || ', ' ||
  COALESCE(is_active::text, 'TRUE') || ', ' ||
  quote_literal(COALESCE(created_by::text, 'NULL')) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(COALESCE(updated_at, created_at)) || ');'
FROM public.product_combos;

-- Product combo items
SELECT 'INSERT INTO public.product_combo_items (id, combo_id, product_id, quantity, discount_percent, gst_percent, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(combo_id) || ', ' ||
  quote_literal(product_id) || ', ' ||
  quantity || ', ' ||
  COALESCE(discount_percent::text, '0') || ', ' ||
  COALESCE(gst_percent::text, '18') || ', ' ||
  quote_literal(created_at) || ');'
FROM public.product_combo_items;

-- Export opening balance
SELECT 'INSERT INTO public.opening_balance (id, balance, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  balance || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ');'
FROM public.opening_balance;

-- Export online platforms
SELECT 'INSERT INTO public.online_platforms (id, name, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.online_platforms;

-- Export sales returns
SELECT 'INSERT INTO public.sales_returns (id, order_id, dealer_id, product_id, quantity, unit_price, discount_percent, gst_percent, total_credit_amount, return_date, return_number, created_by, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_id) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  quote_literal(product_id) || ', ' ||
  quantity || ', ' ||
  unit_price || ', ' ||
  COALESCE(discount_percent::text, '0') || ', ' ||
  COALESCE(gst_percent::text, '0') || ', ' ||
  total_credit_amount || ', ' ||
  quote_literal(return_date) || ', ' ||
  COALESCE(return_number::text, '0') || ', ' ||
  quote_literal(COALESCE(created_by::text, 'NULL')) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.sales_returns;

-- Export stock receipts
SELECT 'INSERT INTO public.stock_receipts (id, product_id, quantity, receipt_date, remarks, created_by, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(product_id) || ', ' ||
  quantity || ', ' ||
  quote_literal(receipt_date) || ', ' ||
  quote_literal(COALESCE(remarks, '')) || ', ' ||
  quote_literal(COALESCE(created_by::text, 'NULL')) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.stock_receipts;

-- Export promotional orders
SELECT 'INSERT INTO public.promotional_orders (id, order_number, client_name, contact_number, delivery_address, city, state, order_date, total_amount, status, person_details, dealer_name, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_number) || ', ' ||
  quote_literal(client_name) || ', ' ||
  quote_literal(COALESCE(contact_number, '')) || ', ' ||
  quote_literal(COALESCE(delivery_address, '')) || ', ' ||
  quote_literal(COALESCE(city, '')) || ', ' ||
  quote_literal(COALESCE(state, '')) || ', ' ||
  quote_literal(order_date) || ', ' ||
  COALESCE(total_amount::text, '0') || ', ' ||
  quote_literal(COALESCE(status, 'pending')) || ', ' ||
  quote_literal(COALESCE(person_details, '')) || ', ' ||
  quote_literal(COALESCE(dealer_name, '')) || ', ' ||
  quote_literal(created_at) || ');'
FROM public.promotional_orders;

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================
-- 1. Run this entire query on your CURRENT Supabase (SQL Editor)
-- 2. Copy all the output (all the INSERT statements)
-- 3. Paste it in a text file and save as: data_export.sql
-- 4. Use the upload tool with this file
-- This will automatically populate all your data in the new instance!
-- ============================================================================
