# Credit Limit Update Fix - Quick Checklist

**Issue:** Credit limit not updating after payment approval  
**Root Cause:** Missing RLS policy for 'accounts' user type on dealers table  
**Solution:** Secure SECURITY DEFINER function + RLS policies

---

## 📋 Deployment Checklist

### Step 1: Deploy Database Changes
- [ ] Push migrations: `supabase db push`
  - Creates: `update_dealer_credit_on_payment_approval()` function
  - Adds: RLS policies for accounts users on dealers table
  - Grants: Execute permissions to authenticated users

### Step 2: Verify Function Exists
```sql
-- Run in Supabase SQL Editor
SELECT p.proname, p.prosecdef FROM pg_proc p 
WHERE p.proname = 'update_dealer_credit_on_payment_approval';
-- Should show: (update_dealer_credit_on_payment_approval, true)
```

### Step 3: Verify RLS Policies
```sql
-- Run in Supabase SQL Editor
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'dealers' 
AND policyname LIKE '%accounts%';
```

### Step 4: Test Payment Approval
1. Log in as **accounts** user
2. See pending payments
3. Click **Approve** on any payment
4. ✅ Check: Success message shows **NEW credit_limit value**
5. ✅ Verify in DB:
   ```sql
   SELECT opening_balance, credit_limit FROM dealers WHERE id = '[dealer_id]';
   ```

---

## 🔍 Troubleshooting

### Problem: Still seeing "Failed to approve payment"

**Check 1:** Is the function deployed?
```sql
SELECT proname FROM pg_proc WHERE proname = 'update_dealer_credit_on_payment_approval';
```

**Check 2:** Can you call it manually?
```sql
SELECT public.update_dealer_credit_on_payment_approval(
  '[dealer_id]'::uuid, 
  5000.00, 
  'increase'
);
```

**Check 3:** Check RLS policies exist
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'dealers';
```

### Problem: Function returns success but values don't change

**Possible causes:**
1. RLS UPDATE policy is still blocking → Run Layer 2 RLS migrations
2. User authentication issue → Check auth.uid() matches profiles table
3. Dealer ID doesn't exist → Verify dealer_id in payment record

---

## 📁 Files Changed

| File | Change |
|------|--------|
| `src/pages/AccountsDashboard.tsx` | Updated 3 handlers to use RPC function |
| `supabase/migrations/20260413_create_dealer_credit_function.sql` | NEW: Function with SECURITY DEFINER |
| `supabase/migrations/20260413_add_accounts_dealer_rls.sql` | NEW: RLS policies for accounts |

---

## ✅ Success Indicators

- [ ] Payment status changes to 'completed'
- [ ] No error message in toast
- [ ] Success message shows: "Payment approved! Dealer balance: ₹X | Credit Limit: ₹Y"
- [ ] Both numbers are correct (balance - amount, credit + amount)
- [ ] Database values updated (verified with SQL)
- [ ] Dealer can place order up to new credit_limit

---

## 🚀 How to Activate

### Option 1: Full Deployment
```bash
cd c:\Users\Admin\dyad-apps\spartan
supabase db push
```

### Option 2: Manual SQL (If supabase CLI unavailable)
1. Go to Supabase dashboard → SQL Editor
2. Copy-paste from: `supabase/migrations/20260413_create_dealer_credit_function.sql`
3. Execute
4. Copy-paste from: `supabase/migrations/20260413_add_accounts_dealer_rls.sql`
5. Execute

---

## 📊 Data Flow

```
Approve Button Clicked
    ↓
handleApprovePayment()
    ↓
Update payment_received status → 'completed'
    ↓
Call RPC: update_dealer_credit_on_payment_approval(dealer_id, amount, 'increase')
    ↓
SECURITY DEFINER function executes (bypasses RLS)
    ├─ Validates: user_type = 'accounts' or 'admin'
    ├─ Calculate: new_balance = old_balance - amount
    ├─ Calculate: new_credit_limit = old_credit_limit + amount
    └─ UPDATE dealers table with both values
    ↓
Return JSON: {success: true, new_balance, new_credit_limit}
    ↓
Frontend receives → Shows success message with new values
    ↓
Refresh payment list → Payment now shows in "Approved" section
```

---

## 🔐 Security Notes

- ✅ SECURITY DEFINER ensures only intended logic runs with elevated permission
- ✅ User validation inside function prevents unauthorized access
- ✅ RLS policies provide defense-in-depth
- ✅ Function requires authentication (no public access)
- ✅ Proper error handling prevents information disclosure

---

## 📞 Next Steps

1. Deploy migrations
2. Test with accounts user
3. Verify credit_limit in orders validation
4. Update order placement to check new credit_limit
5. Notify sales team about new workflow
