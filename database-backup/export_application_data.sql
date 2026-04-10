-- ============================================================================
-- EXPORT: APPLICATION DATA
-- ============================================================================
-- This script exports all application data from all tables
-- Excludes auth schema data (use export_users_auth.sql for that)
-- ============================================================================

-- ============================================================================
-- 1. DISABLE FOREIGN KEY CONSTRAINTS DURING IMPORT (for new database)
-- ============================================================================
-- Note: Add this at the beginning of the import file
-- SET session_replication_role = 'replica';

-- ============================================================================
-- 2. EXPORT PRODUCTS TABLE
-- ============================================================================

SELECT 'INSERT INTO public.products (id, product_code, product_name, category, unit_dp, unit_gst, unit_mrp, hsn_code, is_active, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(product_code) || ', ' ||
  quote_literal(product_name) || ', ' ||
  quote_literal(category) || ', ' ||
  unit_dp || ', ' ||
  unit_gst || ', ' ||
  unit_mrp || ', ' ||
  quote_literal(hsn_code) || ', ' ||
  is_active || ', ' ||
  quote_literal(created_by) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.products
ORDER BY created_at;

-- ============================================================================
-- 3. EXPORT PRODUCT COMBOS
-- ============================================================================

SELECT 'INSERT INTO public.product_combos (id, name, description, category, combo_dp, combo_gst, is_active, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(description) || ', ' ||
  quote_literal(category) || ', ' ||
  combo_dp || ', ' ||
  combo_gst || ', ' ||
  is_active || ', ' ||
  quote_literal(created_by) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.product_combos
ORDER BY created_at;

-- ============================================================================
-- 4. EXPORT PRODUCT COMBO ITEMS
-- ============================================================================

SELECT 'INSERT INTO public.product_combo_items (id, combo_id, product_id, quantity, discount_percent, gst_percent, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(combo_id) || ', ' ||
  quote_literal(product_id) || ', ' ||
  quantity || ', ' ||
  discount_percent || ', ' ||
  gst_percent || ', ' ||
  quote_literal(created_at) ||
  ');'
FROM public.product_combo_items
ORDER BY created_at;

-- ============================================================================
-- 5. EXPORT DEALERS/CUSTOMERS
-- ============================================================================

SELECT 'INSERT INTO public.dealers (id, dealer_code, dealer_name, contact_person, phone, email, city, state, pincode, is_active, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(dealer_code) || ', ' ||
  quote_literal(dealer_name) || ', ' ||
  quote_literal(contact_person) || ', ' ||
  quote_literal(phone) || ', ' ||
  quote_literal(email) || ', ' ||
  quote_literal(city) || ', ' ||
  quote_literal(state) || ', ' ||
  quote_literal(pincode) || ', ' ||
  is_active || ', ' ||
  quote_literal(created_by) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.dealers
ORDER BY created_at;

-- ============================================================================
-- 6. EXPORT ORDERS
-- ============================================================================

SELECT 'INSERT INTO public.orders (id, order_number, dealer_id, order_date, delivery_date, total_amount, order_status, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_number) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  quote_literal(order_date) || ', ' ||
  quote_literal(delivery_date) || ', ' ||
  total_amount || ', ' ||
  quote_literal(order_status) || ', ' ||
  quote_literal(created_by) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.orders
ORDER BY created_at;

-- ============================================================================
-- 7. EXPORT ORDER DETAILS/ITEMS
-- ============================================================================

SELECT 'INSERT INTO public.order_details (id, order_id, product_id, quantity, unit_price, discount_percent, gst_percent, line_total, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_id) || ', ' ||
  quote_literal(product_id) || ', ' ||
  quantity || ', ' ||
  unit_price || ', ' ||
  discount_percent || ', ' ||
  gst_percent || ', ' ||
  line_total || ', ' ||
  quote_literal(created_at) ||
  ');'
FROM public.order_details
ORDER BY created_at;

-- ============================================================================
-- 8. EXPORT PAYMENTS
-- ============================================================================

SELECT 'INSERT INTO public.payments (id, order_id, dealer_id, payment_amount, payment_date, payment_method, reference_number, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_id) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  payment_amount || ', ' ||
  quote_literal(payment_date) || ', ' ||
  quote_literal(payment_method) || ', ' ||
  quote_literal(reference_number) || ', ' ||
  quote_literal(created_by) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.payments
ORDER BY created_at;

-- ============================================================================
-- 9. EXPORT DEALER BALANCES/LEDGER
-- ============================================================================

SELECT 'INSERT INTO public.dealer_balances (id, dealer_id, opening_balance, total_invoiced, total_paid, current_balance, last_payment_date, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  opening_balance || ', ' ||
  total_invoiced || ', ' ||
  total_paid || ', ' ||
  current_balance || ', ' ||
  quote_literal(last_payment_date) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.dealer_balances
ORDER BY updated_at;

-- ============================================================================
-- 10. EXPORT STOCK/INVENTORY
-- ============================================================================

SELECT 'INSERT INTO public.stock (id, product_id, warehouse_location, quantity_on_hand, reorder_level, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(product_id) || ', ' ||
  quote_literal(warehouse_location) || ', ' ||
  quantity_on_hand || ', ' ||
  reorder_level || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.stock
ORDER BY created_at;

-- ============================================================================
-- 11. EXPORT ACTIVITY LOGS
-- ============================================================================

SELECT 'INSERT INTO public.activity_logs (id, user_id, action, table_name, record_id, details, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(action) || ', ' ||
  quote_literal(table_name) || ', ' ||
  quote_literal(record_id) || ', ' ||
  quote_literal(details) || ', ' ||
  quote_literal(created_at) ||
  ');'
FROM public.activity_logs
ORDER BY created_at;

-- ============================================================================
-- 12. EXPORT PROMOTIONAL ORDERS (if exists)
-- ============================================================================

SELECT 'INSERT INTO public.promotional_orders (id, order_number, dealer_id, dealer_name, person_name, person_phone, person_address, status, created_by, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_number) || ', ' ||
  quote_literal(dealer_id) || ', ' ||
  quote_literal(dealer_name) || ', ' ||
  quote_literal(person_name) || ', ' ||
  quote_literal(person_phone) || ', ' ||
  quote_literal(person_address) || ', ' ||
  quote_literal(status) || ', ' ||
  quote_literal(created_by) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.promotional_orders
ORDER BY created_at;

-- ============================================================================
-- 13. EXPORT ONLINE ORDERS (if exists)
-- ============================================================================

SELECT 'INSERT INTO public.online_orders (id, order_number, order_date, status, total_amount, dispatch_sequence, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(order_number) || ', ' ||
  quote_literal(order_date) || ', ' ||
  quote_literal(status) || ', ' ||
  total_amount || ', ' ||
  quote_literal(dispatch_sequence) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.online_orders
ORDER BY created_at;

-- ============================================================================
-- 14. RE-ENABLE FOREIGN KEY CONSTRAINTS (for new database)
-- ============================================================================
-- Note: Add this at the end of the import file
-- SET session_replication_role = 'origin';

-- ============================================================================
-- 15. REFRESH ALL SEQUENCES
-- ============================================================================
-- After import, run these to reset auto-increment sequences
SELECT 'SELECT setval(pg_get_serial_sequence(' || quote_literal(schemaname || '.' || tablename) || ', ' || 
       quote_literal(attname) || '), (SELECT MAX(' || attname || ') FROM ' || 
       schemaname || '.' || tablename || '));'
FROM pg_tables t
JOIN pg_attribute a ON a.attrelid = (t.schemaname || '.' || t.tablename)::regclass
WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
AND a.attname LIKE '%id' 
AND a.attname NOT LIKE 'user_%';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 1. Export output to data_export.sql file
-- 2. Prepend with: SET session_replication_role = 'replica';
-- 3. Append with: SET session_replication_role = 'origin';
-- 4. Apply to new database AFTER schema and users:
--    psql -h [new-host] -U postgres -d postgres < data_export.sql
-- 5. Verify data counts match between old and new databases
-- ============================================================================
