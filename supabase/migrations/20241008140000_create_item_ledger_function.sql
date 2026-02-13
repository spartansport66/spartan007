CREATE OR REPLACE FUNCTION public.get_dealer_item_ledger(dealer_id_param uuid)
RETURNS TABLE(
    transaction_date date,
    transaction_type text,
    order_number int,
    product_code text,
    product_name text,
    quantity int,
    unit_price numeric,
    discount_percent numeric,
    gst_percent numeric,
    total_value numeric
)
LANGUAGE sql
AS $function$
    -- Sales (Debit)
    SELECT
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
        sr.return_date as transaction_date,
        'Return' as transaction_type,
        o.order_number,
        p.code as product_code,
        p.name as product_name,
        -sr.quantity as quantity, -- Negative quantity for returns
        sr.unit_price,
        sr.discount_percent,
        sr.gst_percent,
        -sr.total_credit_amount as total_value -- Negative value for returns
    FROM public.sales_returns sr
    JOIN public.orders o ON sr.order_id = o.id
    JOIN public.products p ON sr.product_id = p.id
    WHERE o.dealer_id = dealer_id_param
    AND o.dispatched = true;
$function$;