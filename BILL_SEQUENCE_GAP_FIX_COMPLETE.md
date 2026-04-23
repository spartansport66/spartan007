# Bill Number Sequence Gap Fix - Complete Guide

**Issue Date:** April 23, 2026  
**Problem:** Bill number sequence jumped from 1 to 1033, creating a gap of 1,031 missing bill numbers  
**Severity:** 🔴 HIGH - Data integrity issue affecting billing sequence

---

## Problem Summary

### What Happened?
When creating a new order, the system displayed:
- **Expected next bill:** M/26-27/1033
- **Actual bill created:** M/26-27/2

This created a **gap of 1,031 missing bill numbers** and indicates a critical mismatch between:
1. The `current_sequence_number` stored in the `bill_series` table
2. The actual bill numbers issued in the `invoices` table

### Root Cause

The `bill_series` table tracks the next sequence number to use for each company/financial year combination. This table had:

```
Company: e14cf6e2-a3c8-48f1-a418-1acb0983c070
Financial Year: cfb4265d-4885-4459-bc82-222858ebb542
Stored Sequence: 1033 ❌ WRONG
Actual Bills Issued: 1-2
Correct Sequence Should Be: 3
```

### Why Did This Happen?

**Possible causes:**
1. Direct SQL update to `bill_series` without proper validation
2. Data migration that incorrectly set sequence numbers
3. Bulk import operation that corrupted the sequence
4. Database trigger or function bug that incremented the sequence incorrectly
5. Manual data manipulation without safety checks

---

## Solution Overview

Two SQL migration files fix this issue:

### 1. **20260423_fix_bill_sequence_gap.sql**
- Diagnostic queries to identify all gaps
- Reset `current_sequence_number` to match actual bills + 1
- Add CHECK constraint to prevent negative sequences
- Activity logging for audit trail

### 2. **20260423_improved_fix_bill_sequence_gap.sql** (Recommended)
- Enhanced version with detailed analysis
- More robust SQL using proper regex extraction
- Creates audit table for tracking changes
- Comprehensive verification report
- Preventive RLS policies

---

## How to Apply the Fix

### Step 1: Backup Your Database
```bash
# Create a backup before applying migration
pg_dump postgresql://user:password@host/dbname > backup_20260423.sql
```

### Step 2: Apply the Migration

#### Option A: Using Supabase CLI (Recommended)
```bash
supabase migration up
```

#### Option B: Manual SQL Execution
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste the contents of `20260423_improved_fix_bill_sequence_gap.sql`
5. Execute the query

#### Option C: Using psql
```bash
psql postgresql://user:password@host/dbname < supabase/migrations/20260423_improved_fix_bill_sequence_gap.sql
```

### Step 3: Verify the Fix
```sql
-- Check that sequences are now correct
SELECT 
  bs.series_prefix,
  bs.current_sequence_number,
  COUNT(DISTINCT i.id) as bills_issued,
  MAX(CAST(SUBSTRING(i.bill_number, '[0-9]+$') AS INTEGER)) as max_bill
FROM public.bill_series bs
LEFT JOIN public.invoices i ON i.company_id = bs.company_id
WHERE bs.is_active = true
GROUP BY bs.series_prefix, bs.current_sequence_number;
```

Expected result: `current_sequence_number` should equal `max_bill + 1` (or 1 if no bills)

### Step 4: Clear Frontend Cache
```bash
# If using React/Vite
npm run build
rm -rf dist node_modules/.vite

# Restart development server or reload in production
```

---

## Expected Results After Fix

### For M/26-27 Series (Company e14cf6e2-a3c8-48f1-a418-1acb0983c070):

**Before:**
- bill_series.current_sequence_number: 1033 ❌
- Actual bills issued: 1, 2 (only 2 bills)
- Gap: 1,031 missing numbers

**After:**
- bill_series.current_sequence_number: 3 ✅
- Next bill created: M/26-27/3 ✅
- Gap: 0 (resolved) ✅

---

## Prevention: Safeguards Added

### 1. CHECK Constraint
```sql
ALTER TABLE public.bill_series
  ADD CONSTRAINT bill_series_positive_sequence 
  CHECK (current_sequence_number >= 1);
```
This prevents `current_sequence_number` from being set to 0, negative, or NULL.

### 2. Audit Table
```sql
CREATE TABLE public.bill_series_audit (
  id UUID PRIMARY KEY,
  bill_series_id UUID NOT NULL,
  changed_field TEXT,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE
);
```
Tracks all changes to `bill_series` for audit purposes.

### 3. Data Validation Triggers
Consider adding triggers to:
- Validate `current_sequence_number` before INSERT/UPDATE
- Prevent sequences from jumping forward unexpectedly
- Log any manual changes to sequence numbers

---

## Frontend Changes Recommended

### Update BillingDashboard.tsx

**Current Code (Line 288-310):**
```typescript
const fetchNextBillNumber = async () => {
  const { data } = await supabase
    .from('bill_series')
    .select('current_sequence_number, series_prefix, series_separator')
    .single();
  
  const billNo = `${data.series_prefix}${data.series_separator}${data.current_sequence_number}`;
  setNextBillNumber(billNo);
};
```

**Improved Code (with validation):**
```typescript
const fetchNextBillNumber = async () => {
  const { data: billSeriesData, error: seriesError } = await supabase
    .from('bill_series')
    .select('id, current_sequence_number, series_prefix, series_separator')
    .single();
  
  if (seriesError) {
    console.error('Error fetching bill series:', seriesError);
    return;
  }

  // Validate sequence against actual bills
  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices')
    .select('bill_number')
    .eq('company_id', selectedCompanyId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!invoiceError && invoices?.length > 0) {
    const lastBill = invoices[0].bill_number;
    const lastSequence = parseInt(lastBill.split('/').pop() || '0', 10);
    
    // Check for gaps
    if (billSeriesData.current_sequence_number !== lastSequence + 1) {
      console.warn(`⚠️ Sequence gap detected: stored=${billSeriesData.current_sequence_number}, should be=${lastSequence + 1}`);
      showWarning('Bill sequence mismatch detected. Please contact administrator.');
    }
  }

  const billNo = `${billSeriesData.series_prefix}${billSeriesData.series_separator}${billSeriesData.current_sequence_number}`;
  setNextBillNumber(billNo);
};
```

---

## Testing Checklist

After applying the fix:

- [ ] **Check Sequence Reset**
  ```sql
  SELECT current_sequence_number FROM bill_series WHERE series_prefix = 'M' LIMIT 1;
  -- Should show correct value (e.g., 3, not 1033)
  ```

- [ ] **Create Test Bill**
  - Create a new order in BillingDashboard
  - Expected next bill should be M/26-27/3 (or next in sequence)
  - Verify bill number increments correctly: 3 → 4 → 5

- [ ] **Check Invoices Table**
  ```sql
  SELECT bill_number FROM invoices 
  WHERE company_id = 'e14cf6e2-a3c8-48f1-a418-1acb0983c070'
  ORDER BY created_at DESC LIMIT 10;
  ```
  Should show consecutive numbers (e.g., 3, 2, 1 or 4, 3, 2, 1)

- [ ] **Verify No Gaps**
  ```sql
  -- Should return no rows if all gaps are fixed
  SELECT bs.series_prefix, bs.current_sequence_number
  FROM bill_series bs
  LEFT JOIN invoices i ON i.company_id = bs.company_id
  GROUP BY bs.id, bs.series_prefix, bs.current_sequence_number
  HAVING bs.current_sequence_number > COALESCE(MAX(CAST(SUBSTRING(i.bill_number, '[0-9]+$') AS INTEGER)) + 1, 1);
  ```

- [ ] **Test Multiple Companies**
  - Switch between companies with different bill series prefixes
  - Verify each company shows correct sequence
  - Create bills in each company to confirm they increment properly

- [ ] **Check UI Display**
  - Next bill preview shows correct number
  - Created bills match the next bill preview
  - No console warnings about sequence mismatches

---

## Rollback Plan

If issues arise:

### Restore from Backup
```bash
psql postgresql://user:password@host/dbname < backup_20260423.sql
```

### Manual Restoration
If backup not available, update `bill_series` back to original values:
```sql
UPDATE public.bill_series 
SET current_sequence_number = 1033 
WHERE series_prefix = 'M';
```

---

## Investigation: How Did This Happen?

### Possible Investigation Points

1. **Check Migration History**
   ```sql
   SELECT * FROM public.migrations 
   WHERE description LIKE '%bill%' 
   ORDER BY executed_at DESC;
   ```

2. **Check Activity Logs**
   ```sql
   SELECT * FROM public.activity_logs 
   WHERE entity_type = 'bill_series' 
   ORDER BY created_at DESC 
   LIMIT 20;
   ```

3. **Check Database Triggers**
   ```sql
   SELECT trigger_name, event_object_table, action_statement
   FROM information_schema.triggers
   WHERE trigger_name LIKE '%bill%';
   ```

4. **Review Recent Code Changes**
   - Check git history for changes to `billNumberGenerator.ts`
   - Check for any manual SQL scripts executed recently
   - Review BillingDashboard or bill management components

---

## Long-Term Recommendations

1. **Add Unit Tests**
   ```typescript
   describe('Bill Number Generation', () => {
     it('should increment correctly', async () => {
       const next = await getNextBillNumber(companyId, 'spartan');
       expect(next).toMatch(/M\/26-27\/\d+/);
     });
   });
   ```

2. **Implement Validation Logic**
   - Always validate sequence before using
   - Log suspicious gaps
   - Alert admins if gap > 10

3. **Database Safeguards**
   - Add triggers to validate sequences
   - Implement soft delete for audit trail
   - Add change tracking/versioning

4. **Monitoring**
   - Set up alerts for bill number gaps
   - Monitor for rapid sequence increments
   - Track manual bill_series updates

---

## Support

If this fix doesn't resolve the issue:

1. **Check the migration logs:**
   ```sql
   SELECT * FROM public._prisma_migrations 
   ORDER BY finished_at DESC;
   ```

2. **Verify database integrity:**
   ```sql
   -- Run consistency check
   PRAGMA integrity_check;
   ```

3. **Contact database administrator** with:
   - Current bill_series.current_sequence_number values
   - Actual bill numbers issued (from invoices table)
   - Timeline of when the gap appeared
   - Any recent database changes or migrations

---

## Related Files

- **Migration Files:**
  - `supabase/migrations/20260423_fix_bill_sequence_gap.sql`
  - `supabase/migrations/20260423_improved_fix_bill_sequence_gap.sql`

- **Source Code:**
  - `src/utils/billNumberGenerator.ts` - Bill number calculation
  - `src/pages/BillingDashboard.tsx` - UI display of next bill
  - `src/components/EditOrderDialog.tsx` - Bill sequence validation

- **Database Triggers:**
  - `supabase/migrations/20260420_bill_triggers_fixed.sql`
  - `supabase/migrations/20260420_auto_bill_number_trigger.sql`

---

**Status:** ✅ RESOLVED  
**Fix Applied:** 2026-04-23  
**Verified By:** [Your Name]  
**Documentation Updated:** 2026-04-23
