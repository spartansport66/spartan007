DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid, boolean);

CREATE OR REPLACE FUNCTION public.get_dealer_ledger(dealer_id_param uuid, p_show_pending_only boolean DEFAULT false)
 RETURNS TABLE(
    transaction_date date, 
    details text, 
    debit numeric, 
    credit numeric,
    transaction_id uuid,
    transaction_type text
)
 LANGUAGE sql
AS $function$
    -- Opening Balance
    SELECT
        COALESCE(d.last_billing_date, '1970-01-01'::date) as transaction_date,
        'Opening Balance' as details,
        db.opening_balance as debit,
        0 as credit,
        d.id as transaction_id,
        'opening_balance' as transaction_type
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

    -- Billed Orders (include billed orders even if dispatch is pending)
    SELECT
        COALESCE(o.dispatch_date, o.order_date)::date as transaction_date,
        'Order #' || o.order_number || ' / Bill #' || COALESCE(o.bill_no, 'N/A') || ' / Gatepass #' || COALESCE(o.dispatch_number::text, 'N/A') as details,
        o.total_amount as debit,
        0 as credit,
        o.id as transaction_id,
        'order' as transaction_type
    FROM public.orders o
    WHERE o.dealer_id = dealer_id_param
    AND o.bill_no IS NOT NULL
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
        p.amount as credit,
        p.id as transaction_id,
        'payment' as transaction_type
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
        p.amount as credit,
        p.id as transaction_id,
        'payment' as transaction_type
    FROM public.payments p
    WHERE p.dealer_id = dealer_id_param
    AND p.status = 'pending_approval'
    AND p.source = 'voucher'

    UNION ALL

    -- Sales Returns (Credit Notes)
    SELECT
        sr.return_date as transaction_date,
        'Sales Return (Order #' || o.order_number || ') - ' || prod.name as details,
        0 as debit,
        sr.total_credit_amount as credit,
        sr.id as transaction_id,
        'sales_return' as transaction_type
    FROM public.sales_returns sr
    JOIN public.orders o ON sr.order_id = o.id
    JOIN public.products prod ON sr.product_id = prod.id
    WHERE o.dealer_id = dealer_id_param
    AND p_show_pending_only = false;
$function$;