CREATE OR REPLACE FUNCTION public.get_dealer_ledger(dealer_id_param uuid)
RETURNS TABLE(
    transaction_date date,
    details text,
    debit numeric,
    credit numeric
)
LANGUAGE sql
AS $$
    -- Opening Balance
    SELECT
        COALESCE(d.last_billing_date, '1970-01-01'::date) as transaction_date,
        'Opening Balance' as details,
        db.opening_balance as debit,
        0 as credit
    FROM public.dealer_balances db
    JOIN public.dealers d ON db.dealer_id = d.id
    WHERE db.dealer_id = dealer_id_param

    UNION ALL

    -- Dispatched Orders (Invoices)
    SELECT
        o.dispatch_date::date as transaction_date,
        'Invoice / Bill No: ' || o.bill_no as details,
        o.total_amount as debit,
        0 as credit
    FROM public.orders o
    WHERE o.dealer_id = dealer_id_param
    AND o.dispatched = true
    AND o.dispatch_date IS NOT NULL

    UNION ALL

    -- Completed Payments
    SELECT
        p.payment_date::date as transaction_date,
        'Payment Received (' || p.payment_method || ') - Ref: ' || COALESCE(p.transaction_id, p.cheque_dd_no, 'N/A') as details,
        0 as debit,
        p.amount as credit
    FROM public.payments p
    WHERE p.dealer_id = dealer_id_param
    AND p.status = 'completed'

    ORDER BY transaction_date;
$$;