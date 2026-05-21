# Payments Dashboard System - Quick Reference

## System Overview
Complete payment management system with role-based access, approval workflows, and comprehensive reporting.

## User Roles

### Payment User (`user_type: 'payment'`)
- **Access**: Payments Dashboard only
- **Permissions**:
  - Add payments for all dealers
  - View pending/approved payments
  - Cannot approve (only views pending for approval by admins)
  - Cannot access other dashboards

### Admin User (`user_type: 'admin'` or `'super_admin'`)
- **Access**: All dashboards including Payments Dashboard
- **Permissions**:
  - Full access to all payment operations
  - Can approve/reject payments
  - Can view all reports

## Dashboard Tabs

### 1. Add Payment
- **Purpose**: Enter new payment details
- **Fields**:
  - Dealer (searchable dropdown with auto-index)
  - Amount Paid (required, > 0)
  - Payment Method (cash, cheque, bank_transfer, upi, credit_card, debit_card, other)
  - Payment Date (date picker)
  - Transaction Reference (optional)
  - Remarks (optional)
- **Result**: Payment created with `approval_status: 'pending'`

### 2. Pending Payments
- **Purpose**: Manage payments awaiting approval
- **Shows**:
  - All payments with approval_status = 'pending'
  - Dealer name, amount, date, payment method
  - Who created the payment
- **Actions**:
  - Approve (with optional remarks dialog)
  - Reject (immediate, with remarks)
  - View Details (full payment information)

### 3. Approved Payments
- **Purpose**: View and export approved payments
- **Features**:
  - Date range filter (default: last 30 days)
  - Summary cards: Total Approved, Total Amount
  - Complete payment history
  - Export to PDF
- **Shows**: Approval date, approver name, all payment details

### 4. Dealer Ledger
- **Purpose**: Complete transaction history per dealer
- **Features**:
  - Dealer selector (dropdown)
  - Date range filter (default: last 90 days)
  - Summary cards:
    - Total Orders (Debit)
    - Total Payments (Credit)
    - Closing Balance
  - Transaction table with running balance
  - Export to PDF
- **Shows**: All orders and payments in chronological order

## Payment States

```
NEW PAYMENT
    ↓
PENDING (approval_status: 'pending')
    ├─→ APPROVED (approval_status: 'approved', approval_date: set, approved_by: set)
    │
    └─→ REJECTED (approval_status: 'rejected')
```

## Database Tables

### payments (Enhanced)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| dealer_id | uuid | FK to dealers |
| amount_paid | numeric | Payment amount |
| payment_date | date | When payment was made |
| payment_method | text | Method of payment |
| transaction_reference | text | Bank/cheque reference |
| approval_status | text | pending/approved/rejected |
| approved_by | uuid | Who approved |
| approval_date | timestamp | When approved |
| remarks | text | Additional notes |
| status | text | Overall status |
| created_by | uuid | Who created payment |
| created_at | timestamp | Creation time |

### payment_approvals
Tracks approval workflow and levels

### payment_request_logs
Audit trail of all payment actions

## Database Functions

### `is_payment_user()`
Returns true if current user has 'payment' role

### `is_admin()`
Returns true if current user is admin/super_admin

### `get_pending_payments(approval_status)`
Returns all pending payments with dealer and creator info

### `get_approved_payments(start_date, end_date)`
Returns approved payments within date range

### `get_dealer_ledger(dealer_id, start_date)`
Returns complete transaction history for dealer

## RLS Policies

### Payment users
- Can INSERT/SELECT/UPDATE payments for all dealers
- Cannot approve (status updates handled by backend)

### Other users
- Can only view payments for their assigned dealers

### Admins
- Full access to all payment operations

## API Endpoints Used

### Insert Payment
```typescript
supabase
  .from('payments')
  .insert([{
    dealer_id,
    payment_method,
    amount_paid,
    payment_date,
    transaction_reference,
    remarks,
    approval_status: 'pending',
    status: 'pending',
    created_by: user.id
  }])
  .select()
```

### Fetch Pending Payments
```typescript
supabase
  .rpc('get_pending_payments', {
    p_approval_status: 'pending'
  })
```

### Approve Payment
```typescript
supabase
  .from('payments')
  .update({
    approval_status: 'approved',
    approved_by: user.id,
    approved_date: new Date().toISOString()
  })
  .eq('id', paymentId)
```

## Frontend File Locations

| File | Purpose |
|------|---------|
| `src/pages/PaymentsDashboard.tsx` | Main dashboard component |
| `src/components/AddPaymentForm.tsx` | Payment entry form |
| `src/components/reports/PendingPaymentsReport.tsx` | Pending payments tab |
| `src/components/reports/ApprovedPaymentsReport.tsx` | Approved payments tab |
| `src/components/reports/DealerLedgerReport.tsx` | Dealer ledger tab |
| `src/contexts/SessionContext.tsx` | User context (has 'payment' role) |
| `src/pages/AdminPanel.tsx` | User creation with payment role |
| `src/pages/ManageUsers.tsx` | User management with payment role |
| `src/App.tsx` | Route `/payments-dashboard` |
| `src/pages/Index.tsx` | Auto-redirect for payment users |

## Environment Setup

1. **Create Payment User in Admin**
   - Admin Panel → Manage Users → Create User
   - Set user_type to "Payment"
   - Provide email and temporary password

2. **First Login**
   - Sign in with payment user credentials
   - Automatically redirected to /payments-dashboard

3. **Add Test Payment**
   - Select dealer from dropdown
   - Enter amount, method, date
   - Click "Add Payment"
   - Payment appears in "Pending" tab

4. **Approve Payment (as Admin)**
   - Log in as admin
   - Open /payments-dashboard
   - Go to "Pending" tab
   - Click "Approve" on payment
   - Payment moves to "Approved" tab

## Deployment Checklist

- [ ] Migration deployed to Supabase
- [ ] Tables and columns verified in database
- [ ] Functions created and callable
- [ ] RLS policies active
- [ ] Indexes created for performance
- [ ] Payment user created and can log in
- [ ] Payments can be added without errors
- [ ] Approval workflow works end-to-end
- [ ] Reports generate and export to PDF
- [ ] Dealer ledger shows correct balances

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| Column 'amount_paid' not found | Migration not deployed | Deploy migration to Supabase |
| Function 'get_pending_payments' not found | Functions not created | Run migration, refresh page |
| Payment user not redirecting | User type not set | Create user with 'payment' role |
| Cannot approve payment | Insufficient permissions | Log in as admin |
| Dealer dropdown empty | No dealers in system | Add dealers first |
| PDF export fails | Missing jsPDF dependency | Already installed, check console |

## Performance Notes

- Indexes created on approval_status, dealer_date, created_date for fast queries
- Running balance calculated in frontend to reduce DB load
- Date range filters default to 30-90 days for manageable data sets
- Pagination can be added if needed for large datasets

## Security Notes

- RLS policies enforce dealer access control
- is_payment_user() function checks user_type
- Only admins can approve (controlled by frontend, should add backend validation)
- All audit trails logged in payment_request_logs table
- Sensitive data not exposed in APIs

---

**System Version**: 1.0
**Last Updated**: 2025-06-20
**Status**: Ready for Testing (pending DB migration deployment)
