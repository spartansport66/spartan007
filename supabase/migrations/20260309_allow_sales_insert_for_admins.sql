-- Allow admins to INSERT into sales for online orders (so admin users can create sales rows)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert sales for online orders" ON public.sales
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
);

-- This complements the existing policy that allows online_orders managers to INSERT sales.
-- Apply this migration to the DB to permit admin users to insert sales rows for online orders.
