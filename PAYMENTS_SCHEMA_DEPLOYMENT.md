# Payments Schema Deployment Guide

## Overview
The payments dashboard system requires a database migration to add necessary columns, functions, and RLS policies to the existing `payments` table.

**Status**: Migration file created and ready for deployment
**Location**: `supabase/migrations/20260520_create_comprehensive_payments_schema.sql`

## What the Migration Includes

### 1. Database Schema Changes
- **Payments Table Enhancements**:
  - `order_id` (uuid) - Link to orders table
  - `transaction_reference` (text) - For bank/cheque references
  - `approval_status` (text) - 'pending', 'approved', 'rejected'
  - `approved_by` (uuid) - User who approved
  - `approval_date` (timestamp) - When approved
  - `remarks` (text) - Additional notes
  - `status` (text) - Overall payment status

### 2. Helper Tables
- **payment_approvals**: Track approval workflow with levels
- **payment_request_logs**: Audit trail of all payment actions

### 3. Database Functions
- `is_payment_user()` - Check if user has 'payment' role
- `is_admin()` - Check if user is admin/super_admin
- `get_pending_payments()` - Fetch pending payments for approval
- `get_approved_payments()` - Generate approved payments report
- `get_dealer_ledger()` - Get complete dealer transaction history

### 4. Row Level Security (RLS)
- Payment users: Can create and manage payments for all dealers
- Admins: Full access to all payments
- Other users: Limited to their dealer's payments only

### 5. Performance Indexes
- `idx_payments_approval_status`
- `idx_payments_dealer_date`
- `idx_payments_created_date`
- `idx_payments_status`
- `idx_payment_approvals_payment_id`
- `idx_payment_approvals_status`
- `idx_payment_request_logs_payment_id`
- `idx_payment_request_logs_action_date`

## Deployment Steps

### Option 1: Supabase Dashboard (Recommended)

1. **Log in to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Open: `supabase/migrations/20260520_create_comprehensive_payments_schema.sql`
   - Copy all content
   - Paste into the SQL Editor

4. **Execute**
   - Click "Run" button (or Ctrl+Enter)
   - Wait for confirmation

5. **Verify Success**
   - Check for any error messages
   - If successful, you should see: "Query executed successfully"

### Option 2: Using Supabase CLI

```bash
# Make sure you're in the project directory
cd c:\Users\Admin\dyad-apps\spartan

# Push migrations
supabase db push

# Or if you need to reset (careful - destroys data)
supabase db reset
```

### Option 3: Manual Deployment in Supabase Studio

1. Open the Supabase SQL editor
2. Run each section separately to debug any issues:
   - First: ALTER TABLE statements
   - Then: CREATE TABLE statements
   - Finally: CREATE POLICY statements

## Verification Checklist

After deployment, verify the following:

- [ ] New columns exist on `payments` table
- [ ] Triggers are created (run: `SELECT * FROM pg_triggers WHERE tgname LIKE '%payment%'`)
- [ ] Indexes are created (run: `SELECT * FROM pg_indexes WHERE tablename = 'payments'`)
- [ ] Functions are created (run: `SELECT proname FROM pg_proc WHERE proname LIKE '%payment%'`)
- [ ] RLS policies are active (run: `SELECT * FROM pg_policies WHERE tablename = 'payments'`)

### Test Query to Verify Columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
ORDER BY column_name;
```

## Testing the Payment Flow

After deployment, test the complete workflow:

1. **Add a Payment User**
   - Go to Admin Panel → Manage Users
   - Create new user with role "Payment"
   - Note the user ID

2. **Log in as Payment User**
   - Log out and sign in with payment user credentials
   - Should redirect to `/payments-dashboard`

3. **Add a Payment**
   - Select a dealer from dropdown
   - Enter payment details:
     - Amount
     - Payment Method
     - Payment Date
     - Optional: Transaction Reference, Remarks
   - Click "Add Payment"
   - Should show success message

4. **View Pending Payments**
   - Click "Pending" tab
   - Should see the payment in pending status

5. **Approve Payment**
   - In "Pending" tab, click Approve on the payment
   - Payment should move to "Approved" status

6. **View Reports**
   - "Approved" tab should show approved payments
   - "Dealer Ledger" should show complete transaction history

## Troubleshooting

### Error: "Column 'amount_paid' not found in schema cache"
- **Cause**: Migration hasn't been deployed yet
- **Solution**: Follow deployment steps above

### Error: "Function 'is_payment_user' does not exist"
- **Cause**: Functions not created yet
- **Solution**: Run migration first, then refresh page

### Error: "Insufficient permissions"
- **Cause**: RLS policy blocking access
- **Solution**: 
  - Verify user has 'payment' role
  - Check RLS policies were created
  - Check user_type in profiles table

### Payment user not redirecting to dashboard
- **Cause**: User type not updated in profiles table
- **Solution**: 
  - Admin creates user with "Payment" type
  - User logs out and back in
  - Clear browser cache if needed

## Rollback (if needed)

If you need to revert the migration:

```sql
-- Drop tables and functions
DROP TABLE IF EXISTS public.payment_request_logs CASCADE;
DROP TABLE IF EXISTS public.payment_approvals CASCADE;
DROP TRIGGER IF EXISTS set_payment_approval_date ON public.payments;
DROP FUNCTION IF EXISTS public.update_payment_approval_date();
DROP FUNCTION IF EXISTS public.get_pending_payments(text);
DROP FUNCTION IF EXISTS public.get_approved_payments(date, date);
DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid, date);
DROP FUNCTION IF EXISTS public.is_payment_user();

-- Remove columns from payments
ALTER TABLE public.payments
DROP COLUMN IF EXISTS order_id,
DROP COLUMN IF EXISTS transaction_reference,
DROP COLUMN IF EXISTS approval_status,
DROP COLUMN IF EXISTS approved_by,
DROP COLUMN IF EXISTS approval_date,
DROP COLUMN IF EXISTS remarks,
DROP COLUMN IF EXISTS status;

-- Drop indexes
DROP INDEX IF EXISTS idx_payments_approval_status;
DROP INDEX IF EXISTS idx_payments_dealer_date;
DROP INDEX IF EXISTS idx_payments_created_date;
DROP INDEX IF EXISTS idx_payments_status;
```

## Related Files

- Frontend Components:
  - `src/pages/PaymentsDashboard.tsx` - Main dashboard
  - `src/components/AddPaymentForm.tsx` - Payment entry form
  - `src/components/reports/PendingPaymentsReport.tsx` - Pending approvals
  - `src/components/reports/ApprovedPaymentsReport.tsx` - Approved payments report
  - `src/components/reports/DealerLedgerReport.tsx` - Dealer ledger

- Configuration:
  - `src/contexts/SessionContext.tsx` - Updated with 'payment' user type
  - `src/pages/AdminPanel.tsx` - User creation with payment role
  - `src/pages/ManageUsers.tsx` - User management with payment role
  - `src/App.tsx` - Route configuration

## Support

If you encounter issues:

1. Check the SQL syntax in the migration file
2. Verify all tables referenced exist (dealers, orders, profiles, auth.users)
3. Check Supabase logs for detailed error messages
4. Ensure you have appropriate permissions to modify tables and create functions

---

**Last Updated**: 2025-06-20
**Migration File Version**: 1.0
**Status**: Ready for Deployment
