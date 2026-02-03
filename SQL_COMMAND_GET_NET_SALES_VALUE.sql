CREATE OR REPLACE FUNCTION get_net_sales_value()
RETURNS TABLE (net_sales_value NUMERIC)
LANGUAGE sql
AS $$
  SELECT SUM(total_amount) - SUM(discount_amount)
  FROM orders;
$$;