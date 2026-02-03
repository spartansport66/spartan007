-- Drop the old function first to allow for changing the return signature.
DROP FUNCTION IF EXISTS get_dealer_balance_report(UUID, TEXT);

-- Recreate the function with a corrected and optimized query
CREATE OR REPLACE FUNCTION get_dealer_balance_report(
    p_sales_person_id UUID DEFAULT NULL,
    p_dealer_name_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    opening_balance NUMERIC,
    opening_balance_due_date TIMESTAMPTZ,
    total_sales NUMERIC,
    total_payments_received NUMERIC,
    closing_balance NUMERIC,
    last_dispatch_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.name,
        d.phone,
        COALESCE(d.opening_balance, 0) AS opening_balance,
        d.opening_balance_due_date,
        COALESCE(sales.total_sales, 0) AS total_sales,
        COALESCE(payments.total_payments_received, 0) AS total_payments_received,
        (COALESCE(d.opening_balance, 0) + COALESCE(sales.total_sales, 0) - COALESCE(payments.total_payments_received, 0)) AS closing_balance,
        last_dispatch.last_dispatch_date
    FROM
        dealers d
    LEFT JOIN (
        SELECT o.dealer_id, SUM(o.total_amount) AS total_sales
        FROM orders o
        GROUP BY o.dealer_id
    ) AS sales ON d.id = sales.dealer_id
    LEFT JOIN (
        SELECT p.dealer_id, SUM(p.amount) AS total_payments_received
        FROM payments p
        WHERE p.status = 'completed'
        GROUP BY p.dealer_id
    ) AS payments ON d.id = payments.dealer_id
    LEFT JOIN (
        SELECT o.dealer_id, MAX(o.dispatch_date) AS last_dispatch_date
        FROM orders o
        WHERE o.dispatch_date IS NOT NULL
        GROUP BY o.dealer_id
    ) AS last_dispatch ON d.id = last_dispatch.dealer_id
    WHERE
        (p_sales_person_id IS NULL OR d.id IN (SELECT dsp.dealer_id FROM dealer_sales_persons dsp WHERE dsp.sales_person_id = p_sales_person_id))
        AND (p_dealer_name_filter IS NULL OR d.name ILIKE '%' || p_dealer_name_filter || '%');
END;
$$ LANGUAGE plpgsql;