# Step-by-Step Testing Guide: Payment Credit Limit Fix

**Purpose:** Verify that the credit limit fix works correctly  
**Time Required:** 15 minutes  
**Difficulty:** Easy - UI-based testing

---

## 📋 Pre-Test Requirements

- [ ] Migrations deployed (`supabase db push` executed)
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] Test access to Supabase dashboard
- [ ] Accounts user account created
- [ ] Sales person account created  
- [ ] Test dealer created
- [ ] Permission to run SQL queries

---

## 🔧 Test Setup

### Step 0: Verify Database Function Exists

1. Go to Supabase Dashboard
2. → SQL Editor
3. Run this query:

```sql
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'update_dealer_credit_on_payment_approval';
```

**Expected Result:**
```
proname                                    | prosecdef
update_dealer_credit_on_payment_approval   | true
```

✅ If you see 1 row with `prosecdef = true`, migrations deployed correctly

---

### Step 1: Verify RLS Policies

1. Supabase Dashboard → SQL Editor
2. Run:

```sql
SELECT policyname, qual FROM pg_policies 
WHERE tablename = 'dealers' 
AND policyname LIKE '%accounts%';
```

**Expected Result:**
```
policyname                                              | qual
Allow accounts users to read all dealers               | [policy definition]
Allow accounts users to update dealer credit and balance | [policy definition]
```

✅ If you see 2 policies, RLS policies created

---

### Step 2: Create Test Data

1. Note down your test dealer ID:

```sql
SELECT id, name, opening_balance, credit_limit 
FROM dealers 
WHERE name = '[YOUR_TEST_DEALER]';
```

**Store this ID:** `[TEST_DEALER_ID]`

2. Create a test payment:

```sql
INSERT INTO payment_received 
(dealer_id, amount, payment_method, payment_date, status, created_by)
VALUES 
(
  '[TEST_DEALER_ID]'::uuid,
  5000.00,
  'Bank Transfer',
  NOW(),
  'pending_approval',
  '[SALES_PERSON_USER_ID]'::uuid
);
```

---

## ✅ Test 1: Approve Payment (Happy Path)

### Setup
- Initial dealer balance: $0
- Initial dealer credit: $5,000  
- Payment amount: $5,000
- Operation: Approve

### Execution

1. **Log in as accounts user**
   - Open browser
   - Go to your app
   - Login with accounts user credentials
   - ✅ Should see "Accounts Dashboard" in menu

2. **Navigate to Accounts Dashboard**
   - Click menu → "Accounts Dashboard"
   - ✅ See tab showing payment counts

3. **Find test payment**
   - Look for "Pending" section
   - Click to expand if collapsed
   - ✅ See your test payment (test dealer, ₹5,000)

4. **Approve the payment**
   - Click "Approve" button on test payment
   - ✅ See success message:
     ```
     "Payment approved! Dealer balance: ₹-5000.00 | Credit Limit: ₹10000.00"
     ```

5. **Verify frontend updates**
   - Payment moves from "Pending" to "Approved" section
   - ✅ Shows success message with actual values
   - ✅ Approved section now shows 1 payment

### Database Verification

1. Run in Supabase SQL Editor:

```sql
SELECT id, opening_balance, credit_limit, updated_at 
FROM dealers 
WHERE id = '[TEST_DEALER_ID]'::uuid
ORDER BY updated_at DESC 
LIMIT 1;
```

**Expected Results:**
```
id                                      | opening_balance | credit_limit | updated_at
[TEST_DEALER_ID]                        | -5000.00        | 10000.00     | 2026-04-13 [time]
```

✅ **Test 1 PASSED** if:
- [ ] Success message shown with correct values
- [ ] opening_balance = -5,000 (decreased by payment)
- [ ] credit_limit = 10,000 (increased by payment)
- [ ] updated_at is recent

---

## ✅ Test 2: Reject Approved Payment

### Setup
- Use the payment from Test 1 (now approved and moved to Approved section)
- Operation: Reject approved payment

### Execution

1. **In Accounts Dashboard**
   - Go to "Approved" section
   - ✅ See your payment there

2. **Reject the payment**
   - Click "Reject" button
   - ✅ See confirmation dialog
   - Click "Yes" to confirm
   - ✅ See success message:
     ```
     "Payment rejected! Dealer balance: ₹0.00 | Credit Limit: ₹5000.00"
     ```

3. **Verify frontend updates**
   - Payment moves to "Rejected" section
   - ✅ Approved section now shows 0 payments
   - ✅ Rejected section shows 1 payment

### Database Verification

1. Run in Supabase SQL Editor:

```sql
SELECT id, opening_balance, credit_limit, updated_at 
FROM dealers 
WHERE id = '[TEST_DEALER_ID]'::uuid
ORDER BY updated_at DESC 
LIMIT 1;
```

**Expected Results:**
```
id                                      | opening_balance | credit_limit | updated_at
[TEST_DEALER_ID]                        | 0.00            | 5000.00      | 2026-04-13 [time]
```

✅ **Test 2 PASSED** if:
- [ ] Success message shown with correct values
- [ ] opening_balance = 0 (reverted to original)
- [ ] credit_limit = 5,000 (decreased back)
- [ ] updated_at is recent (after approval)

---

## ✅ Test 3: Re-Approve Rejected Payment

### Setup
- Use the payment from Test 2 (now rejected and in Rejected section)
- Operation: Re-approve

### Execution

1. **In Accounts Dashboard**
   - Go to "Rejected" section
   - ✅ See your payment

2. **Approve the rejected payment**
   - Click "Approve" button
   - ✅ See confirmation dialog
   - Click "Yes"
   - ✅ See success message:
     ```
     "Payment approved! Dealer balance: ₹-5000.00 | Credit Limit: ₹10000.00"
     ```

3. **Verify frontend updates**
   - Payment moves back to "Approved" section
   - ✅ Rejected section now shows 0 payments
   - ✅ Approved section shows 1 payment

### Database Verification

1. Run in Supabase SQL Editor:

```sql
SELECT id, opening_balance, credit_limit, updated_at 
FROM dealers 
WHERE id = '[TEST_DEALER_ID]'::uuid
ORDER BY updated_at DESC 
LIMIT 1;
```

**Expected Results:**
```
id                                      | opening_balance | credit_limit | updated_at
[TEST_DEALER_ID]                        | -5000.00        | 10000.00     | 2026-04-13 [time]
```

✅ **Test 3 PASSED** if:
- [ ] Success message shown with correct values
- [ ] opening_balance = -5,000 (deducted again)
- [ ] credit_limit = 10,000 (increased again)
- [ ] Payment status = 'completed' in DB

---

## ✅ Test 4: Sales Person Submits Payment

### Setup
- Create a new payment from sales person
- Create new dealer for this test
- Initial dealer credit: $5,000

### Execution

1. **Log in as sales person**
   - Use sales person account
   - ✅ Should see "Payment Received" tab or form

2. **Create new payment**
   - Select dealer: [TEST_DEALER_2]
   - Amount: $3,000
   - Payment method: Check
   - Click "Submit"
   - ✅ See success: "Payment submitted successfully"

3. **Switch to accounts user**
   - Log out
   - Log in as accounts user

4. **Approve the new payment**
   - Go to Accounts Dashboard
   - Find new payment in Pending section
   - Click Approve
   - ✅ See: "Payment approved! ... Credit Limit: ₹8000.00"

### Database Verification

```sql
SELECT id, name, credit_limit 
FROM dealers 
WHERE name = '[TEST_DEALER_2]';
-- Should show credit_limit = 8000
```

✅ **Test 4 PASSED** if:
- [ ] Payment created successfully
- [ ] Payment approved successfully
- [ ] credit_limit increased from 5,000 to 8,000

---

## ✅ Test 5: Order Placement with New Credit

### Setup
- Use dealer from Test 1 or 3 (has $10,000 credit)
- Create new order

### Execution (Optional - if order creation available)

1. **Log in as sales person**
   - Go to order creation
   - Select dealer: [TEST_DEALER_1]
   
2. **Try to place order**
   - Add items totaling $9,000
   - ✅ Order should be accepted (within $10,000 limit)
   
3. **Try to exceed credit**
   - Add items totaling $11,000
   - ❌ Order should be rejected (exceeds $10,000 limit)

✅ **Test 5 PASSED** (if implemented) if:
- [ ] Can place order up to new $10,000 limit
- [ ] Cannot place order exceeding $10,000 limit

---

## 🔴 Test 6: Error Handling

### Test Invalid Payment Approval

1. **Create malformed test case**
   - Go to Supabase SQL Editor
   - Try to call function with invalid dealer ID:

```sql
SELECT public.update_dealer_credit_on_payment_approval(
  '00000000-0000-0000-0000-000000000000'::uuid,
  1000.00,
  'increase'
);
```

**Expected Response:**
```
{
  "success": false,
  "error": "Dealer not found"
}
```

✅ **Test 6 PASSED** if:
- [ ] Function returns error (not success)
- [ ] Error message is clear

---

## 📊 Test Summary Sheet

| Test # | Scenario | Expected | Result | Status |
|--------|----------|----------|--------|--------|
| 1 | Approve payment | Balance↓ Credit↑ | | ☐ Pass ☐ Fail |
| 2 | Reject approved | Balance↑ Credit↓ | | ☐ Pass ☐ Fail |
| 3 | Re-approve | Balance↓ Credit↑ | | ☐ Pass ☐ Fail |
| 4 | Sales person submit | New payment visible | | ☐ Pass ☐ Fail |
| 5 | Order validation | Can place order | | ☐ Pass ☐ Fail |
| 6 | Error handling | Clear error msgs | | ☐ Pass ☐ Fail |

---

## ✅ Final Verification Checklist

All Tests Passed?

- [ ] Test 1: Approve Payment ✅
- [ ] Test 2: Reject Approved ✅
- [ ] Test 3: Re-approve Rejected ✅
- [ ] Test 4: Sales person workflow ✅
- [ ] Test 5: Order placement (optional)
- [ ] Test 6: Error handling ✅

**Overall Result:** 
- [ ] ✅ ALL TESTS PASSED - Ready for production
- [ ] ⚠️ SOME FAILURES - Investigate and retry
- [ ] ❌ CRITICAL FAILURES - Rollback and fix

---

## 🐛 If Tests Fail

### Problem: Success message doesn't show new values
**Solution:** Check 1) Function deployed correctly, 2) Correct dealer ID

### Problem: Values don't update in database
**Solution:** Check 1) RLS policies applied, 2) Migrations ran, 3) User is 'accounts' type

### Problem: Approval button doesn't work
**Solution:** Check 1) Browser cache cleared, 2) Code redeployed, 3) User has 'accounts' role

### Problem: Error saying "Function not found"
**Solution:** Run `supabase db push` to push migrations

---

## 📝 Test Result Documentation

**Date Tested:** _______________  
**Tester Name:** _______________  
**Environment:** ☐ Dev ☐ Staging ☐ Prod  

**Results:**
- ☐ All tests passed
- ☐ Minor issues (describe): _____________
- ☐ Major issues (describe): _____________

**Sign-Off:**
- ☐ Ready for production
- ☐ Needs more testing
- ☐ Blocked - needs fixes

**Notes:** _______________________________________________

---

**Status:** ✅ Ready for testing  
**Estimated Time:** 15-20 minutes  
**Difficulty:** Easy - UI-based

Good luck! 🚀
