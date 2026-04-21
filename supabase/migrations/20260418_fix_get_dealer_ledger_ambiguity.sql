-- Fix ambiguous column reference in get_dealer_ledger function
DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid);

CREATE FUNCTION public.get_dealer_ledger(dealer_id_param UUID)
RETURNS TABLE (
    transaction_date DATE,
    details TEXT,
    debit NUMERIC,
    credit NUMERIC,
    bill_amount NUMERIC,
    transaction_id UUID,
    transaction_type TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT (COALESCE(d.last_billing_date, '1970-01-01'::timestamp))::date as transaction_date,
           'Opening Balance' as details, db.opening_balance as debit, 0 as credit,
           0 as bill_amount, d.id as transaction_id, 'opening_balance' as transaction_type
    FROM public.dealer_balances db
    JOIN public.dealers d ON db.dealer_id = d.id
    WHERE db.dealer_id = dealer_id_param
    UNION ALL
    SELECT o.dispatch_date::date, 'Order #' || o.order_number || ' / Bill #' || COALESCE(i.bill_number, 'N/A'),
           o.total_amount, 0, COALESCE(i.grand_total, o.total_amount), o.id, 'order'
    FROM public.orders o
    LEFT JOIN public.invoices i ON o.id = i.order_id
    WHERE o.dealer_id = dealer_id_param AND o.dispatched = true AND o.dispatch_date IS NOT NULL
        UNION ALL
        -- Include invoices that are approved but not included via dispatched orders
        SELECT i.bill_date::date, 'Invoice ' || i.bill_number,
                     i.grand_total, 0, i.grand_total, i.id, 'invoice'
        FROM public.invoices i
        LEFT JOIN public.orders o2 ON i.order_id = o2.id
        WHERE i.dealer_id = dealer_id_param
            AND i.status IN ('approve','approved')
            AND (i.order_id IS NULL OR (o2.dispatched IS DISTINCT FROM true OR o2.dispatch_date IS NULL))

        UNION ALL
        SELECT p.payment_date::date, 'Payment Received (' || p.payment_method || ')', 0, p.amount, 0, p.id, 'payment'
        FROM public.payments p
        WHERE p.dealer_id = dealer_id_param AND p.status = 'completed'
    ORDER BY transaction_date ASC;
END;
$$;
