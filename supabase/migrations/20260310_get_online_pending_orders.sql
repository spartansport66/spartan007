-- RPC to return UUID[] of pending online orders (dispatched=false and gate_pass_dispatch_time IS NULL)
CREATE OR REPLACE FUNCTION public.get_online_pending_orders()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_ids uuid[];
  cnt int;
BEGIN
  SELECT array_agg(id) INTO pending_ids FROM (
    SELECT o.id FROM public.online_orders o
    WHERE o.dispatched = false AND o.dispatch_date IS NULL
    ORDER BY o.order_sequence ASC
  ) t;

  IF pending_ids IS NULL THEN
    cnt := 0;
  ELSE
    cnt := array_length(pending_ids, 1);
  END IF;

  RAISE NOTICE 'get_online_pending_orders: pending count=%', cnt;
  RAISE NOTICE 'get_online_pending_orders: ids=%', pending_ids;

  RETURN pending_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_online_pending_orders() TO authenticated;
