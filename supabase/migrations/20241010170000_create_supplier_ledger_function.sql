CREATE OR REPLACE FUNCTION public.get_supplier_ledger(supplier_id_param uuid)
RETURNS TABLE(transaction_date date, details text, debit numeric, credit numeric)
LANGUAGE sql
AS $$
    -- Debits from Purchase Vouchers (Goods Received)
    SELECT
        pv.receipt_date AS transaction_date,
        'Purchase Voucher #' || pv.voucher_number || 
        COALESCE(' (Inv: ' || pv.supplier_invoice_no || ')', '') AS details,
        (SELECT SUM(pvi.quantity_received * pvi.unit_price) FROM public.purchase_voucher_items pvi WHERE pvi.purchase_voucher_id = pv.id) AS debit,
        0 AS credit
    FROM
        public.purchase_vouchers pv
    WHERE
        pv.supplier_id = supplier_id_param

    UNION ALL

    -- Credits from Supplier Payments (Payments Made)
    SELECT
        sp.payment_date AS transaction_date,
        'Payment (' || sp.payment_method || ')' || 
        COALESCE(' - Ref: ' || sp.reference_no, '') AS details,
        0 AS debit,
        sp.amount AS credit
    FROM
        public.supplier_payments sp
    WHERE
        sp.supplier_id = supplier_id_param
    
    ORDER BY
        transaction_date;
$$;