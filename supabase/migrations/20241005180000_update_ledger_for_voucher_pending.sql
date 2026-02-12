CREATE OR REPLACE FUNCTION public.get_dealer_ledger(
    dealer_id_param uuid,
    p_show_pending_only BOOLEAN DEFAULT false
)
RETURNS TABLE(transaction_date date, details text, debit numeric, credit numeric)
LANGUAGE sql
AS $function$
    -- Opening Balance
    SELECT
        COALESCE(d.last_billing_date, '1970-01-01'::date) as transaction_date,
        'Opening Balance' as details,
        db.opening_balance as debit,
        0 as credit
    FROM public.dealer_balances db
    JOIN public.dealers d ON db.dealer_id = d.id
    WHERE db.dealer_id = dealer_id_param
    AND (
        p_show_pending_only = false OR
        (
            p_show_pending_only = true AND
            db.opening_balance > (
                SELECT COALESCE(SUM(pa.allocated_amount), 0)
                FROM public.payment_allocations pa
                JOIN public.payments p ON pa.payment_id = p.id
                WHERE pa.liability_id = dealer_id_param
                AND pa.allocation_type = 'opening_balance'
                AND p.status = 'completed'
            )
        )
    )

    UNION ALL

    -- Dispatched Orders (Invoices)
    SELECT
        o.dispatch_date::date as transaction_date,
        'Order #' || o.order_number || ' / Bill #' || COALESCE(o.bill_no, 'N/A') || ' / Gatepass #' || COALESCE(o.dispatch_number::text, 'N/A') as details,
        o.total_amount as debit,
        0 as credit
    FROM public.orders o
    WHERE o.dealer_id = dealer_id_param
    AND o.dispatched = true
    AND o.dispatch_date IS NOT NULL
    AND (
        p_show_pending_only = false OR
        (
            p_show_pending_only = true AND
            o.total_amount > (
                SELECT COALESCE(SUM(pa.allocated_amount), 0)
                FROM public.payment_allocations pa
                JOIN public.payments p ON pa.payment_id = p.id
                WHERE pa.liability_id = o.id
                AND pa.allocation_type = 'order'
                AND p.status = 'completed'
            )
        )
    )

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
    AND p_show_pending_only = false

    UNION ALL

    -- Pending Approval Payments (from Vouchers only)
    SELECT
        p.payment_date::date as transaction_date,
        'Payment Pending Approval (' || p.payment_method || ') - Ref: ' || COALESCE(p.transaction_id, p.cheque_dd_no, 'N/A') || ' - Due: ' || TO_CHAR(p.cheque_dd_date, 'DD/MM/YYYY') as details,
        0 as debit,
        p.amount as credit
    FROM public.payments p
    WHERE p.dealer_id = dealer_id_param
    AND p.status = 'pending_approval'
    AND p.source = 'voucher';
$function$;