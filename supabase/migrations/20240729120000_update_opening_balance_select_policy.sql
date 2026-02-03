-- Update RLS policy for SELECT on opening_balance table
-- Grant access to 'admin' and 'manager' roles

DROP POLICY IF EXISTS "Allow admin and manager to view opening balance" ON "public"."opening_balance";

CREATE POLICY "Allow admin and manager to view opening balance"
ON "public"."opening_balance"
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