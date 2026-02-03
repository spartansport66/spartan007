CREATE OR REPLACE FUNCTION get_dealer_balance_report(
    p_sales_person_id UUID DEFAULT NULL,
    p_dealer_name_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    opening_balance NUMERIC,
    total_sales NUMERIC,
    total_payments_received NUMERIC,
    closing_balance NUMERIC,
    last_billing_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH dealer_sales AS (
        SELECT
            d.id,
            d.name,
            d.phone,
            d.last_billing_date,
            COALESCE(db.opening_balance, 0) AS opening_balance,
            COALESCE(SUM(o.total_amount), 0) AS total_sales
        FROM
            dealers d
        LEFT JOIN
            dealer_balances db ON d.id = db.dealer_id
        LEFT JOIN
            orders o ON d.id = o.dealer_id
        GROUP BY
            d.id, d.name, d.phone, d.last_billing_date, db.opening_balance
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
        ds.total_sales,
        COALESCE(dp.total_payments_received, 0) AS total_payments_received,
        (ds.opening_balance + ds.total_sales - COALESCE(dp.total_payments_received, 0)) AS closing_balance,
        ds.last_billing_date
    FROM
        dealer_sales ds
    LEFT JOIN
        dealer_payments dp ON ds.id = dp.dealer_id
    WHERE
        (p_sales_person_id IS NULL OR ds.id IN (SELECT dsp.dealer_id FROM dealer_sales_persons dsp WHERE dsp.sales_person_id = p_sales_person_id))
        AND (p_dealer_name_filter IS NULL OR ds.name ILIKE '%' || p_dealer_name_filter || '%');
END;
$$ LANGUAGE plpgsql;