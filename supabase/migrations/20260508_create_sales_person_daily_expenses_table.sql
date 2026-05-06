-- Create a daily expenses table for sales persons to log tour expenses with receipt capture.

CREATE TABLE IF NOT EXISTS sales_person_daily_expenses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_person_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    expense_date date NOT NULL DEFAULT current_date,
    expense_type text NOT NULL,
    amount numeric(12, 2) NOT NULL,
    remarks text,
    receipt_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE IF EXISTS sales_person_daily_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales persons can insert their own expenses"
ON public.sales_person_daily_expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sales_person_id);

CREATE POLICY "Sales persons can view their own expenses"
ON public.sales_person_daily_expenses FOR SELECT
TO authenticated
USING (auth.uid() = sales_person_id);

CREATE POLICY "Admins can view all daily expenses"
ON public.sales_person_daily_expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid() AND public.profiles.is_admin = TRUE
  )
);
