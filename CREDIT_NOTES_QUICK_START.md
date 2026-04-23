# Credit Notes - Quick Start Integration Guide

## 1-Minute Setup - Add Credit Notes to Your Dashboards

---

## For Billing Dashboard

**Add this to your imports:**
```typescript
import CreditNotesCard from '@/components/CreditNotesCard';
import CreditNotesReportDialog from '@/components/reports/CreditNotesReportDialog';
```

**Add this state:**
```typescript
const [isCreditNotesReportOpen, setIsCreditNotesReportOpen] = useState(false);
```

**Add this card to your dashboard (in the main grid):**
```tsx
<CreditNotesCard
  title="Credit Notes Management"
  showCreateButton={true}
/>
```

**Add this to your reports menu:**
```tsx
<DropdownMenuItem onClick={() => setIsCreditNotesReportOpen(true)}>
  <FileText className="h-4 w-4 mr-2" />
  Credit Notes Report
</DropdownMenuItem>

{/* Add dialog at bottom */}
<CreditNotesReportDialog
  isOpen={isCreditNotesReportOpen}
  onOpenChange={setIsCreditNotesReportOpen}
/>
```

---

## For Admin Dashboard

**Add this to your imports:**
```typescript
import CreditNotesReportDialog from '@/components/reports/CreditNotesReportDialog';
```

**Add this state:**
```typescript
const [isCreditNotesReportOpen, setIsCreditNotesReportOpen] = useState(false);
```

**Add to Reports dropdown:**
```tsx
<DropdownMenuSeparator />
<DropdownMenuLabel>Accounting</DropdownMenuLabel>
<DropdownMenuItem onClick={() => setIsCreditNotesReportOpen(true)}>
  <FileText className="h-4 w-4 mr-2" />
  Credit Notes Report
</DropdownMenuItem>

{/* Add dialog at bottom */}
<CreditNotesReportDialog
  isOpen={isCreditNotesReportOpen}
  onOpenChange={setIsCreditNotesReportOpen}
/>
```

---

## For Dealer Dashboard (if applicable)

**Add to imports:**
```typescript
import DealerBalanceWithCredits from '@/components/DealerBalanceWithCredits';
import CreditNotesCard from '@/components/CreditNotesCard';
```

**Add to main dashboard grid:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Existing cards */}
  
  {/* New Credit Section */}
  <DealerBalanceWithCredits
    dealerId={dealerId}
    companyId={companyId}
  />
  
  <CreditNotesCard
    dealerId={dealerId}
    showCreateButton={false}
    title="My Credit Notes"
  />
</div>
```

---

## For Dealer Details/Profile View

**Add to imports:**
```typescript
import DealerBalanceWithCredits from '@/components/DealerBalanceWithCredits';
import CreditNotesCard from '@/components/CreditNotesCard';
```

**Add to dealer details section:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Credit Notes & Balance Information</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    <DealerBalanceWithCredits
      dealerId={dealer.id}
      companyId={companyId}
    />
    
    <Separator />
    
    <CreditNotesCard
      dealerId={dealer.id}
      companyId={companyId}
      showCreateButton={true}
      title="Credit Notes"
    />
  </CardContent>
</Card>
```

---

## For Order Creation / Edit Dialog

**Add to imports:**
```typescript
import { getDealerCreditBalance } from '@/utils/creditNoteUtils';
```

**Add state:**
```typescript
const [dealerCredit, setDealerCredit] = useState(0);
```

**Load credit when dealer changes:**
```typescript
useEffect(() => {
  if (selectedDealerId) {
    getDealerCreditBalance(selectedDealerId).then(setDealerCredit);
  }
}, [selectedDealerId]);
```

**Display credit information:**
```tsx
{dealerCredit > 0 && (
  <Alert className="bg-blue-50 border-blue-200">
    <AlertCircle className="h-4 w-4 text-blue-600" />
    <AlertTitle className="text-blue-900">Available Credit</AlertTitle>
    <AlertDescription className="text-blue-800">
      This dealer has ₹{dealerCredit.toFixed(2)} in available credit notes.
    </AlertDescription>
  </Alert>
)}
```

---

## Database Setup (One-time)

1. **Open Supabase SQL Editor**
2. **Run the migration:**
   - Copy entire contents of `supabase/migrations/20260424_create_credit_notes_table.sql`
   - Execute in Supabase SQL Editor
3. **Verify tables created:**
   - Check Tables: `credit_notes`, `credit_note_items`, `credit_note_applications`
   - Check Functions: `get_dealer_balance_with_credits`

---

## Testing the Feature

### Test 1: Create a Credit Note
1. Go to Billing Dashboard → Credit Notes Card
2. Click "New Credit Note"
3. Select dealer, enter amount, select reason
4. Click "Create Credit Note"
5. ✅ Should see credit note in list

### Test 2: View Dealer Balance
1. Go to Dealer view with credit notes
2. Check `DealerBalanceWithCredits` component
3. ✅ Should show issued, used, and remaining credits

### Test 3: View Reports
1. Go to Admin/Billing Dashboard
2. Open "Credit Notes Report"
3. Filter by status/approval
4. ✅ Should display filtered results

### Test 4: Export Report
1. In Credit Notes Report
2. Click "Download CSV"
3. ✅ Should download CSV file with credit notes data

---

## Component Props Reference

### CreditNotesCard
```typescript
<CreditNotesCard
  dealerId?: string;        // Optional: filter by dealer
  companyId?: string;       // Optional: filter by company
  showCreateButton?: boolean;  // Default: true
  title?: string;           // Default: "Credit Notes"
/>
```

### DealerBalanceWithCredits
```typescript
<DealerBalanceWithCredits
  dealerId: string;         // Required: dealer ID
  companyId?: string;       // Optional: company ID
/>
```

### CreditNoteDialog
```typescript
<CreditNoteDialog
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;   // Callback after successful save
  creditNote?: CreditNote;  // For editing
  dealerId?: string;        // Pre-select dealer
/>
```

### CreditNotesReportDialog
```typescript
<CreditNotesReportDialog
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
/>
```

---

## Utility Functions

### Get Dealer's Available Credit
```typescript
import { getDealerCreditBalance } from '@/utils/creditNoteUtils';

const balance = await getDealerCreditBalance(dealerId);
// Returns: number (credit amount)
```

### Apply Credit to Invoice
```typescript
import { applyCreditNoteToInvoice } from '@/utils/creditNoteUtils';

const success = await applyCreditNoteToInvoice(
  creditNoteId,
  invoiceId,
  dealerId,
  amountToApply,
  userId
);
```

### Cancel Credit Note
```typescript
import { cancelCreditNote } from '@/utils/creditNoteUtils';

await cancelCreditNote(creditNoteId, 'Optional cancellation reason');
```

### Check if Expired
```typescript
import { isCreditNoteExpired } from '@/utils/creditNoteUtils';

if (isCreditNoteExpired(expiryDate)) {
  // Handle expired credit note
}
```

---

## Common Patterns

### Pattern 1: Dealer Selection with Credit Check
```tsx
const [selectedDealer, setSelectedDealer] = useState<string>('');
const [dealerCredit, setDealerCredit] = useState(0);

const handleDealerChange = async (dealerId: string) => {
  setSelectedDealer(dealerId);
  const credit = await getDealerCreditBalance(dealerId);
  setDealerCredit(credit);
};
```

### Pattern 2: Show Credit in Order Summary
```tsx
<OrderSummary>
  <TotalRow label="Subtotal" value={subtotal} />
  <TotalRow label="Discount" value={discount} />
  {dealerCredit > 0 && (
    <TotalRow 
      label="Less: Available Credit" 
      value={-Math.min(dealerCredit, total)} 
      className="text-green-600"
    />
  )}
  <TotalRow label="Grand Total" value={finalTotal} bold />
</OrderSummary>
```

### Pattern 3: Credit Notes in Dealer Profile
```tsx
<DealerProfileCard dealer={dealer}>
  <Tabs>
    <TabsContent value="balance">
      <DealerBalanceWithCredits dealerId={dealer.id} />
    </TabsContent>
    <TabsContent value="credits">
      <CreditNotesCard dealerId={dealer.id} showCreateButton={true} />
    </TabsContent>
  </Tabs>
</DealerProfileCard>
```

---

## Troubleshooting

### Issue: "credit_notes table does not exist"
- **Fix:** Run the migration SQL in Supabase

### Issue: Credit balance shows 0 for all dealers
- **Fix:** Ensure no credit notes have been created yet, or check RLS policies

### Issue: Can't create credit notes (permission denied)
- **Fix:** User must have admin/billing_manager role
- **Check:** User role in profiles table

### Issue: Components not showing data
- **Fix:** Clear browser cache and reload
- **Check:** Browser console for SQL errors

---

## Next Steps

1. ✅ Run the migration SQL
2. ✅ Add components to dashboards
3. ✅ Test create/view/report functionality
4. ✅ Train users on credit note workflow
5. ✅ Set up automated expiry reminders (future)
6. ✅ Configure approval workflows (future)

---

## Support Files

- Full implementation: `CREDIT_NOTES_IMPLEMENTATION_GUIDE.md`
- Database schema: `supabase/migrations/20260424_create_credit_notes_table.sql`
- Components: `src/components/Credit*.tsx`
- Utilities: `src/utils/creditNoteUtils.ts`
- Types: `src/types/creditNote.ts`

