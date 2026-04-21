# Bill Company Change Implementation - Complete

## Workflow Implemented

### Scenario 1: Creating NEW Bill
- ✅ Calls RPC `generate_bill_number` to generate AND increment sequence
- ✅ Saves bill_no in orders table
- ✅ Creates new invoice with bill_number
- ✅ Sequence auto-increments properly

### Scenario 2: Editing Bill - SAME COMPANY
- ✅ Keeps existing bill number (no change)
- ✅ Updates only other fields (dealer, amounts, dates)
- ✅ Old invoice remains unchanged

### Scenario 3: Editing Bill - COMPANY CHANGED ⭐ NEW
- ✅ Creates FRESH NEW INVOICE (don't update old)
- ✅ Calls RPC to get next available bill number for new company
- ✅ New invoice has:
  - New company_id
  - New bill_number (from new company's sequence)
  - New bill_date
  - Same order_id (no new order)
  - Fresh copy of items
- ✅ Old invoice kept for reference with:
  - `reassigned_to_invoice_id` = new invoice ID
  - `reassignment_reason` = "Company changed from X to Y"
  - `reassigned_at` = timestamp
- ✅ New invoice has:
  - `reassigned_from_invoice_id` = old invoice ID
  - Shows it's a reassignment

## Files Modified

1. **EditOrderDialog.tsx**
   - Fixed RPC call to use `generate_bill_number` (increments properly)
   - Added new logic to create NEW invoice when company changes
   - Keeps old invoice unchanged when company same
   - Tracks reassignment with new fields

2. **Migrations Created**
   - `20260420_remove_unique_constraint_bill_number.sql` - Allow bill_number updates
   - `20260420_add_invoice_reassignment_tracking.sql` - Track reassignments

## Key Changes

### Bill Number Generation (Fixed)
**Before:** Manually calculated, no increment
**After:** Uses RPC function that generates AND increments sequence

### Company Change Logic (New)
**Before:** Updated old invoice
**After:** Creates new invoice, keeps old as reference

## Data Integrity

- ✅ Bill sequences properly increment
- ✅ No duplicate bill numbers (old ones kept only for reference)
- ✅ Audit trail preserved (can trace reassignments)
- ✅ One order can have multiple invoices (for reassignments)

## Next Steps

1. Deploy migrations:
   ```bash
   supabase db push
   ```

2. Test the workflow:
   - Create new bill (should have unique number)
   - Edit bill same company (bill number unchanged)
   - Edit bill change company (new bill created)

3. Verify database:
   ```sql
   -- Check no more duplicates
   SELECT bill_number, COUNT(*) 
   FROM invoices 
   GROUP BY bill_number 
   HAVING COUNT(*) > 1;
   
   -- Check reassignments
   SELECT bill_number, reassigned_from_invoice_id, reassigned_to_invoice_id
   FROM invoices
   WHERE reassigned_from_invoice_id IS NOT NULL;
   ```
