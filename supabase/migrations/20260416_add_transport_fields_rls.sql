-- Add RLS policies for transport detail fields on orders table
-- Ensures billing users and admins can view and update transport details

-- Policy: Allow billing users and admins to SELECT orders (including transport fields)
CREATE POLICY "Billing users and admins can SELECT orders with transport fields"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
  OR
  (auth.uid() = user_id)
) ON CONFLICT DO NOTHING;

-- Policy: Allow billing users and admins to UPDATE transport fields on orders
DROP POLICY IF EXISTS "Billing users and admins can UPDATE transport fields" ON public.orders;
CREATE POLICY "Billing users and admins can UPDATE transport fields"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
);

-- Add column comments for documentation
COMMENT ON COLUMN public.orders.delivery_location IS 'Delivery location for the order (e.g., door deliver, warehouse)';
COMMENT ON COLUMN public.orders.transport_name IS 'Name of the transport/logistics company handling the shipment';
COMMENT ON COLUMN public.orders.booking_destination IS 'Destination address for the booking/shipment';
COMMENT ON COLUMN public.orders.date_of_dispatch IS 'Date when the goods are dispatched to the customer';

-- Grant permissions to authenticated users for selecting and updating orders
GRANT SELECT, UPDATE ON public.orders TO authenticated;
