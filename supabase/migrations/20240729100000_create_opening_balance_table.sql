-- Create the opening_balance table
CREATE TABLE public.opening_balance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    balance numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enforce that only a single row can exist in this table (for a global balance)
CREATE UNIQUE INDEX single_row_opening_balance ON public.opening_balance ((true));

-- Insert the initial row with a zero balance if the table is empty
INSERT INTO public.opening_balance (balance)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM public.opening_balance);

-- Enable Row Level Security
ALTER TABLE public.opening_balance ENABLE ROW LEVEL SECURITY;

-- Policy to allow 'admin' and 'manager' roles to SELECT the opening balance
CREATE POLICY "Allow admin and manager to view opening balance"
ON public.opening_balance
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- Policy to allow 'admin' role to UPDATE the opening balance
CREATE POLICY "Allow admin to update opening balance"
ON public.opening_balance
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);