# Migration Debug: Schema Cache Error

## Error: Could not find the 'amount_paid' column in schema cache

This typically happens after a migration when Supabase's schema cache needs to refresh.

## Quick Fixes (Try in Order)

### 1. Clear Browser Cache & Refresh
1. Open your app browser tab
2. Press `Ctrl+Shift+Delete` (open DevTools)
3. Go to "Application" tab
4. Clear "Local Storage"
5. Press `F5` to refresh the page
6. Try adding a payment again

### 2. Restart Development Server
```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
npm run dev
```

### 3. Verify Migration Actually Ran
In Supabase Dashboard:

1. Go to SQL Editor
2. Run this query:
```sql
-- Check if new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments'
ORDER BY column_name;
```

3. Look for these columns (should be present):
   - `order_id`
   - `transaction_reference`
   - `approval_status`
   - `approved_by`
   - `approval_date`
   - `remarks`
   - `status`

If these columns don't appear, the migration didn't run completely.

### 4. Check RLS Policies
Run in Supabase SQL Editor:
```sql
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'payments'
ORDER BY policyname;
```

Should see:
- `Payment users can manage payments`
- `Users can view their dealer payments`

### 5. Check Functions
Run in Supabase SQL Editor:
```sql
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname IN ('is_payment_user', 'is_admin', 'get_pending_payments', 'get_approved_payments', 'get_dealer_ledger')
ORDER BY proname;
```

All 5 functions should exist.

## If Columns Don't Exist

The migration likely didn't complete. Try this simpler version:

```sql
-- Just add the columns without constraints
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_reference text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approval_date timestamp with time zone;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Update existing rows
UPDATE public.payments SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE public.payments SET status = 'approved' WHERE status IS NULL;
```

Then run the rest of the migration separately.

## If Functions Don't Exist

```sql
-- Create the helper functions
CREATE OR REPLACE FUNCTION public.is_payment_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) = 'payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## If RLS Policies Don't Exist

```sql
-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Payment users can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their dealer payments" ON public.payments;

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Payment users can manage payments" ON public.payments
FOR ALL
USING (public.is_payment_user() OR public.is_admin())
WITH CHECK (public.is_payment_user() OR public.is_admin());

CREATE POLICY "Users can view their dealer payments" ON public.payments
FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM public.dealers WHERE id = dealer_id)
  OR public.is_admin()
);
```

## Nuclear Option: Reset & Run Fresh

If nothing works, run this to clean up and start fresh:

```sql
-- Drop everything
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Payment users can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their dealer payments" ON public.payments;

DROP TRIGGER IF EXISTS set_payment_approval_date ON public.payments;
DROP FUNCTION IF EXISTS public.update_payment_approval_date();
DROP FUNCTION IF EXISTS public.get_pending_payments(text);
DROP FUNCTION IF EXISTS public.get_approved_payments(date, date);
DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid, date);
DROP FUNCTION IF EXISTS public.is_payment_user();
DROP FUNCTION IF EXISTS public.is_admin();

DROP TABLE IF EXISTS public.payment_request_logs;
DROP TABLE IF EXISTS public.payment_approvals;

DROP INDEX IF EXISTS idx_payments_approval_status;
DROP INDEX IF EXISTS idx_payments_dealer_date;
DROP INDEX IF EXISTS idx_payments_created_date;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payment_approvals_payment_id;
DROP INDEX IF EXISTS idx_payment_approvals_status;
DROP INDEX IF EXISTS idx_payment_request_logs_payment_id;
DROP INDEX IF EXISTS idx_payment_request_logs_action_date;

-- Drop columns
ALTER TABLE public.payments DROP COLUMN IF EXISTS order_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS transaction_reference;
ALTER TABLE public.payments DROP COLUMN IF EXISTS approval_status;
ALTER TABLE public.payments DROP COLUMN IF EXISTS approved_by;
ALTER TABLE public.payments DROP COLUMN IF EXISTS approval_date;
ALTER TABLE public.payments DROP COLUMN IF EXISTS remarks;
ALTER TABLE public.payments DROP COLUMN IF EXISTS status;
```

Then run the migration file again from scratch.

## Expected Result After Successful Migration

1. ✅ 7 new columns on payments table
2. ✅ 2 helper tables created (payment_approvals, payment_request_logs)
3. ✅ 5 functions created
4. ✅ 2 RLS policies active
5. ✅ 8 indexes created
6. ✅ Can add payments without schema cache errors

## Common Causes

| Error | Cause | Fix |
|-------|-------|-----|
| Schema cache error | Migration ran but cache not refreshed | Refresh browser, restart server |
| Column not found | Migration didn't complete | Check if columns exist, run cleanup |
| Function not found | Functions not created | Re-run function creation SQL |
| Policy exists error | Policy already created | Drop policy first before creating |
| Permission denied | RLS policy blocking access | Check RLS policies and user role |

---

**Steps to Take Now:**

1. Try clearing browser cache and refreshing
2. Check if columns exist in Supabase
3. If columns exist, restart dev server
4. If columns don't exist, run the simplified column addition SQL
5. If still issues, use Nuclear Option to reset and start fresh
