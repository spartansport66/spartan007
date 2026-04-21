# Real-Time Sync Not Working - Diagnostic & Fix Guide

## Problem
Real-time subscriptions are set up but not firing when data changes.

## Likely Causes

### 1. **Realtime Extension Not Enabled** (Most Common)
Supabase requires the `realtime` extension to be explicitly enabled on each table.

### 2. **RLS Policies Blocking Realtime**
Row Level Security can prevent realtime messages from being sent.

### 3. **Wrong Subscription Configuration**
Channel names or event filters might be incorrect.

---

## Solution: Enable Realtime

### Step 1: Go to Supabase Dashboard
1. Open **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Create a **New Query**

### Step 2: Enable Realtime on Tables

Run this SQL:

```sql
-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Enable realtime for invoices table
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;

-- Enable realtime for payment_received table
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_received;

-- Verify realtime is enabled
SELECT schemaname, tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY schemaname, tablename;
```

### Step 3: Verify RLS Policies
Check that RLS policies allow read access for your user:

```sql
-- Check policies on orders table
SELECT * FROM pg_policies WHERE tablename = 'orders';

-- Check policies on invoices table
SELECT * FROM pg_policies WHERE tablename = 'invoices';
```

### Step 4: Test Real-Time Connection
After enabling, refresh the Billing Dashboard (F5) and:

1. Open **Console** (F12)
2. Look for: `✅ Orders subscription CONNECTED`
3. Mark an order as URGENT
4. Should see: `✨ Order real-time update`

---

## If Still Not Working

### Check Browser Console for Errors:
- Permission denied errors
- Channel connection failures
- Network errors

### Check Supabase Logs:
1. Go to **Supabase Dashboard** → **Logs**
2. Look for realtime connection errors

### Alternative: Force Manual Refresh
If realtime truly doesn't work, app has button to manually refresh all data.

---

## Summary

**The fix is usually just running the SQL above to enable realtime on the tables.**

Once enabled, the app will automatically sync when:
- ✅ Orders are marked as URGENT
- ✅ Bills are created/updated
- ✅ Payments are received
- ✅ Hold status changes
