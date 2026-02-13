CREATE OR REPLACE FUNCTION public.get_dealer_item_ledger(dealer_id_param uuid)
RETURNS TABLE(
    parent_id uuid,
    parent_type text,
    transaction_date date,
    transaction_type text,
    order_number integer,
    product_code text,
    product_name text,
    quantity integer,
    unit_price numeric,
    discount_percent numeric,
    gst_percent numeric,
    total_value numeric
)
LANGUAGE sql
AS $$
    -- Sales (Debit)
    SELECT
        o.id as parent_id,
        'order' as parent_type,
        s.sale_date::date as transaction_date,
        'Sale' as transaction_type,
        o.order_number,
        p.code as product_code,
        p.name as product_name,
        s.quantity,
        s.unit_price,
        s.discount_percent,
        s.gst_percent,
        s.total_price as total_value
    FROM public.sales s
    JOIN public.orders o ON s.order_id = o.id
    JOIN public.products p ON s.product_id = p.id
    WHERE o.dealer_id = dealer_id_param
    AND o.dispatched = true

    UNION ALL

    -- Sales Returns (Credit)
    SELECT
        sr.id as parent_id,
        'sales_return' as parent_type,
        sr.return_date as transaction_date,
        'Return' as transaction_type,
        o.order_number,
        p.code as product_code,
        p.name as product_name,
        sr.quantity,
        sr.unit_price,
        sr.discount_percent,
        sr.gst_percent,
        -sr.total_credit_amount as total_value -- Negative value for credit
    FROM public.sales_returns sr
    JOIN public.orders o ON sr.order_id = o.id
    JOIN public.products p ON sr.product_id = p.id
    WHERE o.dealer_id = dealer_id_param

    ORDER BY transaction_date, order_number;
$$;