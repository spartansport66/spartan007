-- Drop any and all previously existing function signatures to prevent conflicts.
DROP FUNCTION IF EXISTS get_dealer_balance_report(UUID, TEXT);
DROP FUNCTION IF EXISTS get_dealer_balance_report(UUID, TEXT, INT, INT);

-- Create the function from a clean slate with the CORRECT column names.
-- This version uses `initial_balance` and `initial_balance_due_date` from the `dealers` table.
CREATE OR REPLACE FUNCTION get_dealer_balance_report(
    p_sales_person_id UUID DEFAULT NULL,
    p_dealer_name_filter TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
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
    last_dispatch_date TIMESTAMPTZ,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_dealers AS (
        SELECT
            d.id,
            d.name,
            d.phone,
            -- CORRECTED: Using `d.initial_balance` from the `dealers` table.
            COALESCE(d.initial_balance, 0) AS opening_balance,
            -- CORRECTED: Using `d.initial_balance_due_date` from the `dealers` table.
            d.initial_balance_due_date AS opening_balance_due_date,
            COALESCE(sales.total_sales, 0) AS total_sales,
            COALESCE(payments.total_payments_received, 0) AS total_payments_received,
            -- CORRECTED: Using `d.initial_balance` in the calculation.
            (COALESCE(d.initial_balance, 0) + COALESCE(sales.total_sales, 0) - COALESCE(payments.total_payments_received, 0)) AS closing_balance,
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
            AND (p_dealer_name_filter IS NULL OR d.name ILIKE '%' || p_dealer_name_filter || '%')
    )
    SELECT
        *,
        (SELECT COUNT(*) FROM filtered_dealers) AS total_count
    FROM
        filtered_dealers
    ORDER BY
        name
    LIMIT
        p_limit
    OFFSET
        p_offset;
END;
$$ LANGUAGE plpgsql;