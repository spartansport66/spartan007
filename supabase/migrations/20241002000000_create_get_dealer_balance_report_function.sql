CREATE OR REPLACE FUNCTION get_dealer_balance_report(
    p_sales_person_id UUID DEFAULT NULL,
    p_dealer_name_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    opening_balance NUMERIC,
    opening_balance_due_date TIMESTAMPTZ, -- Added
    total_sales NUMERIC,
    total_payments_received NUMERIC,
    closing_balance NUMERIC,
    last_dispatch_date TIMESTAMPTZ -- Changed from last_billing_date
) AS $$
BEGIN
    RETURN QUERY
    WITH last_order_dispatch AS (
        SELECT
            o.dealer_id,
            MAX(o.dispatch_date) as max_dispatch_date
        FROM
            orders o
        WHERE
            o.dispatch_date IS NOT NULL
        GROUP BY
            o.dealer_id
    ),
    dealer_sales AS (
        SELECT
            d.id,
            d.name,
            d.phone,
            d.opening_balance_due_date, -- Added
            COALESCE(db.opening_balance, 0) AS opening_balance,
            COALESCE(SUM(o.total_amount), 0) AS total_sales
        FROM
            dealers d
        LEFT JOIN
            dealer_balances db ON d.id = db.dealer_id
        LEFT JOIN
            orders o ON d.id = o.dealer_id
        GROUP BY
            d.id, d.name, d.phone, d.opening_balance_due_date, db.opening_balance
    ),
    dealer_payments AS (
        SELECT
            p.dealer_id,
            COALESCE(SUM(p.amount), 0) AS total_payments_received
        FROM
            payments p
        WHERE
            p.status = 'completed'
        GROUP BY
            p.dealer_id
    )
    SELECT
        ds.id,
        ds.name,
        ds.phone,
        ds.opening_balance,
        ds.opening_balance_due_date, -- Added
        ds.total_sales,
        COALESCE(dp.total_payments_received, 0) AS total_payments_received,
        (ds.opening_balance + ds.total_sales - COALESCE(dp.total_payments_received, 0)) AS closing_balance,
        lod.max_dispatch_date AS last_dispatch_date -- Changed
    FROM
        dealer_sales ds
    LEFT JOIN
        dealer_payments dp ON ds.id = dp.dealer_id
    LEFT JOIN
        last_order_dispatch lod ON ds.id = lod.dealer_id -- Joined to get last dispatch date
    WHERE
        (p_sales_person_id IS NULL OR ds.id IN (SELECT dsp.dealer_id FROM dealer_sales_persons dsp WHERE dsp.sales_person_id = p_sales_person_id))
        AND (p_dealer_name_filter IS NULL OR ds.name ILIKE '%' || p_dealer_name_filter || '%');
END;
$$ LANGUAGE plpgsql;