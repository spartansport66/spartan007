## PrintBillDialog Fix - Improved Bill Search Logic

### Problem
The PrintBillDialog was failing to find bills because:
1. The `source_table` property was not being passed from BillingDashboard to PrintBillDialog
2. When `source_table` was undefined, it couldn't prioritize searching the correct bill table
3. The bill ID (d0c3c5a8-9476-4aa6-8484-d1f90326804c) was not found in orders table

### Solution Implemented

#### 1. **Improved Loop-Based Table Search** (PrintBillDialog.tsx)
Changed from single-table queries to a loop-based approach that tries multiple tables:

```typescript
// Try each table in order (spartan first if it's the source, then fightor)
for (const tableName of tablesToTry) {
  console.log(`  🔍 Searching for bill in ${tableName} table...`);
  
  let billData = await supabase.from(tableName).select(...).eq('id', id).maybeSingle();
  
  if (billData.data && billData.data.order_id) {
    console.log(`✅ Found bill in ${tableName} table, fetching complete order...`);
    // Fetch complete order from orders table using bill's order_id
    return; // Exit after successful fetch
  } else if (billData.error) {
    console.log(`❌ Error querying ${tableName}: ${error.message}`);
    continue; // Try next table
  }
  // No data and no error = not in this table, try next
}
```

#### 2. **Better Fallback Logic**
If bill not found in `spartan` or `fightor`, falls back to trying orders table as a last resort.

#### 3. **Enhanced Logging**
Added detailed debug logs to trace the search path:
- 🔍 Searching for bill in spartan/fightor
- ✅ Found bill - fetching complete order
- ❌ Error encountered - trying next table
- 📋 Falling back to orders table

### What To Check

#### On Browser Console
When printing a bill, you should see logs like:

```
📋 Fetching order details with ID: d0c3c5a8-9476-4aa6-8484-d1f90326804c
Source Table: undefined (or 'spartan' or 'fightor')
🎯 Prioritizing spartan table based on source...
  🔍 Searching for bill in spartan table...
✅ Found bill in spartan table, fetching complete order...
```

#### Possible Outcomes

1. **Bill Found in First Table** ✅
   - Bill exists in spartan/fightor
   - Order data fetched successfully
   - Print dialog displays bill

2. **Bill Found in Second Table** ✅
   - First table returned no results
   - Found in alternate table (spartan or fightor)
   - Print dialog displays bill

3. **Bill Found in Orders Table** ✅
   - Not in spartan/fightor
   - Found in orders table
   - Print dialog displays bill

4. **Bill Not Found in Any Table** ❌
   - Error: "Order not found with ID: d0c3c5a8..."
   - Indicates: Bill ID doesn't exist in database
   - Action needed: Verify bill was created, not deleted

### SQL Query to Find Missing Bill

If print still fails, run this query to locate the bill:

```sql
-- Search for bill with ID
SELECT 'spartan' as table_name, id, bill_number, order_id FROM public.spartan WHERE id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c'
UNION ALL
SELECT 'fightor', id, bill_number, order_id FROM public.fightor WHERE id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c'
UNION ALL
SELECT 'orders', id, order_number, bill_no FROM public.orders WHERE id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c';
```

### Files Modified

1. **PrintBillDialog.tsx** - Lines 136-340
   - Refactored fetchOrderDetails() function
   - Changed from single queries to loop-based table search
   - Added better error handling and logging

2. **BillingDashboard.tsx** - Lines 156, 1003-1011
   - Updated handlePrintBill() to pass source_table info
   - Added validation checks before print
   - Added debug logging for invoice object

### Next Steps

1. **Test Print Functionality**
   - Try printing a bill from Approved Bills section
   - Check browser console for log messages
   - Verify print dialog opens with bill details

2. **If Still Failing**
   - Check console logs to see which table was searched
   - Run SQL query above to verify bill exists
   - Check if order_id is NULL in the bill record (may need manual fix)

3. **If sourceTable Still Undefined**
   - Verify BillingDashboard is fetching bills with `source_table` field
   - Ensure spartanWithSource and fightorWithSource are being created (lines 362-363)
   - Check that bills array maintains source_table through filtering

### Technical Details

**Why the Loop?**
- Previous approach failed if trying wrong table first
- New approach tries both tables and continues on errors
- Dramatically improves reliability when source_table is undefined

**Why Prioritize Source Table?**
- Bills have a fixed company association (spartan or fightor)
- Knowing source table reduces query count from 3 to 2
- Improves performance and user experience

**Error Handling**
- `.maybeSingle()` instead of `.single()` - allows safe 0-result queries
- Uses `continue` statement to skip tables with errors
- Only throws error if bill not found in ANY table
