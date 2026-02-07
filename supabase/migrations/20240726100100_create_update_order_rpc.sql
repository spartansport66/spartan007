CREATE OR REPLACE FUNCTION update_order_and_items(
    p_order_id uuid,
    p_order_data jsonb,
    p_order_items jsonb
)
RETURNS void AS $$
DECLARE
    item jsonb;
    original_item record;
    stock_change int;
BEGIN
    -- Step 1: Revert stock for all original items
    FOR original_item IN
        SELECT product_id, quantity FROM public.sales WHERE order_id = p_order_id
    LOOP
        UPDATE public.products
        SET stock = stock + original_item.quantity
        WHERE id = original_item.product_id;
    END LOOP;

    -- Step 2: Delete old sales items
    DELETE FROM public.sales WHERE order_id = p_order_id;

    -- Step 3: Insert new sales items and decrement stock
    FOR item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        stock_change := (item->>'quantity')::int;

        -- Insert new sale item
        INSERT INTO public.sales (order_id, product_id, quantity, total_price)
        VALUES (
            p_order_id,
            (item->>'product_id')::uuid,
            stock_change,
            (item->>'total_price')::numeric
        );

        -- Decrement stock
        UPDATE public.products
        SET stock = stock - stock_change
        WHERE id = (item->>'product_id')::uuid;
    END LOOP;

    -- Step 4: Update the order itself
    UPDATE public.orders
    SET
        order_date = (p_order_data->>'order_date')::timestamptz,
        total_amount = (p_order_data->>'total_amount')::numeric,
        dispatch_date = (p_order_data->>'dispatch_date')::date,
        dispatch_number = (p_order_data->>'dispatch_number')::bigint,
        bill_no = p_order_data->>'bill_no'
    WHERE id = p_order_id;

END;
$$ LANGUAGE plpgsql;