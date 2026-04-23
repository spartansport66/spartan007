# Credit Notes Feature - Implementation Guide

## Overview

A comprehensive credit note management system has been created for dealers with full accounting compliance. This system enables:

- Creating and managing credit notes for dealers
- Tracking credit note usage and balance
- Applying credits against invoices and payments
- Reporting and analytics
- Dealer balance calculation with credits

---

## Database Schema

### Tables Created

1. **credit_notes** - Main credit note records
   - Tracks credit note details, status, approval, amounts
   - Includes GST calculations
   - Manages expiry dates

2. **credit_note_items** - Line items for credit notes
   - Product-level details for returns
   - Quantity and pricing information
   - Return reasons

3. **credit_note_applications** - Credit usage tracking
   - Records where credits are applied (invoices/payments)
   - Tracks application amounts and dates
   - Maintains audit trail

### Functions Created

- `get_dealer_balance_with_credits()` - Calculates dealer balance including credit notes

### Triggers Created

- `update_credit_note_balance()` - Automatically updates credit note balance when applications are made

---

## Components Created

### 1. **CreditNoteDialog** (`src/components/CreditNoteDialog.tsx`)
Create and edit credit notes with:
- Dealer selection
- Credit amount specification
- Reason selection (product return, quality issue, etc.)
- Invoice referencing
- Item-level details with quantities and prices
- GST calculations
- Expiry date management

**Usage:**
```typescript
<CreditNoteDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={loadCreditNotes}
  dealerId={dealerId}
/>
```

### 2. **CreditNotesCard** (`src/components/CreditNotesCard.tsx`)
Display credit notes in a table with:
- Credit note number and date
- Credit amount tracking
- Status and approval badges
- View details action
- Create new credit note button

**Usage:**
```typescript
<CreditNotesCard
  dealerId={dealerId}
  showCreateButton={true}
  title="Credit Notes"
/>
```

### 3. **CreditNoteDetailsDialog** (`src/components/CreditNoteDetailsDialog.tsx`)
View detailed credit note information:
- Full credit note details
- Line items breakdown
- GST calculations
- Credit usage summary
- Application history
- PDF download (placeholder)

**Usage:**
```typescript
<CreditNoteDetailsDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  creditNote={selectedCreditNote}
/>
```

### 4. **DealerBalanceWithCredits** (`src/components/DealerBalanceWithCredits.tsx`)
Display dealer balance including credits:
- Total invoiced amount
- Total paid amount
- Credit notes issued balance
- Available credit balance
- Net balance due calculation
- Visual breakdown of credits impact

**Usage:**
```typescript
<DealerBalanceWithCredits
  dealerId={dealerId}
  companyId={companyId}
/>
```

### 5. **CreditNotesReportDialog** (`src/components/reports/CreditNotesReportDialog.tsx`)
Comprehensive credit notes reporting:
- Filter by status, approval, date range
- Summary statistics
- Detailed table view
- CSV export functionality

**Usage:**
```typescript
<CreditNotesReportDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
/>
```

### 6. **Credit Note Utilities** (`src/utils/creditNoteUtils.ts`)
Helper functions:
- Generate credit note numbers
- Calculate available credit balance
- Apply credits to invoices/payments
- Cancel credit notes
- Check expiry status
- Format amounts for display

---

## Integration Steps

### Step 1: Admin Dashboard Integration

**File:** `src/pages/AdminDashboard.tsx`

Add the credit notes report to the reports menu:

```typescript
import CreditNotesReportDialog from '@/components/reports/CreditNotesReportDialog';

// In AdminDashboard component:
const [isCreditNotesReportOpen, setIsCreditNotesReportOpen] = useState(false);

// In the reports dropdown menu:
<DropdownMenuItem onClick={() => setIsCreditNotesReportOpen(true)}>
  <FileText className="h-4 w-4 mr-2" />
  Credit Notes Report
</DropdownMenuItem>

// Add dialog:
<CreditNotesReportDialog
  isOpen={isCreditNotesReportOpen}
  onOpenChange={setIsCreditNotesReportOpen}
/>
```

### Step 2: Billing Dashboard Integration

**File:** `src/pages/BillingDashboard.tsx`

Add credit notes management card:

```typescript
import CreditNotesCard from '@/components/CreditNotesCard';

// In BillingDashboard component, add to the main content area:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* ... existing components ... */}
  
  <CreditNotesCard
    title="Credit Notes Management"
    showCreateButton={true}
  />
</div>

// For a specific dealer view, add to order details:
<CreditNotesCard
  dealerId={selectedDealerId}
  title="Dealer Credit Notes"
  showCreateButton={true}
/>
```

### Step 3: Dealer Dashboard (if exists)

**File:** `src/pages/DealerDashboard.tsx`

Add dealer's credit information:

```typescript
import DealerBalanceWithCredits from '@/components/DealerBalanceWithCredits';
import CreditNotesCard from '@/components/CreditNotesCard';

// In the main dashboard:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Balance section */}
  <DealerBalanceWithCredits
    dealerId={currentDealerId}
    companyId={companyId}
  />
  
  {/* My Credit Notes */}
  <CreditNotesCard
    dealerId={currentDealerId}
    showCreateButton={false}
    title="My Credit Notes"
  />
</div>
```

### Step 4: Order/Invoice Creation Integration

**File:** `src/components/EditOrderDialog.tsx` or similar

Add credit note option when creating orders:

```typescript
import { getDealerCreditBalance } from '@/utils/creditNoteUtils';
import DealerBalanceWithCredits from '@/components/DealerBalanceWithCredits';

// Load dealer's credit balance:
const [dealerCredit, setDealerCredit] = useState(0);

useEffect(() => {
  if (selectedDealerId) {
    getDealerCreditBalance(selectedDealerId).then(setDealerCredit);
  }
}, [selectedDealerId]);

// Display available credit:
{dealerCredit > 0 && (
  <Alert className="bg-blue-50">
    <Info className="h-4 w-4" />
    <AlertTitle>Available Credit</AlertTitle>
    <AlertDescription>
      Dealer has ₹{dealerCredit.toFixed(2)} in available credit notes.
    </AlertDescription>
  </Alert>
)}
```

### Step 5: Dealer Profile/View Integration

**File:** `src/pages/DealerProfile.tsx` or similar

Add complete credit notes section:

```typescript
<Card>
  <CardHeader>
    <CardTitle>Credit Notes & Balance</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    <DealerBalanceWithCredits
      dealerId={dealerId}
      companyId={companyId}
    />
    
    <Separator />
    
    <CreditNotesCard
      dealerId={dealerId}
      showCreateButton={true}
      title="Credit Notes"
    />
  </CardContent>
</Card>
```

---

## Data Types

All TypeScript types are defined in `src/types/creditNote.ts`:

- `CreditNote` - Main credit note record
- `CreditNoteItem` - Line item details
- `CreditNoteApplication` - Credit application record
- `DealerBalanceWithCredits` - Calculated dealer balance
- `CreditNoteFormData` - Form submission data

---

## Usage Examples

### Create a Credit Note

```typescript
const handleCreateCreditNote = async () => {
  // Dialog will handle the creation through CreditNoteDialog component
  setIsCreditNoteDialogOpen(true);
};
```

### Get Dealer's Available Credit

```typescript
import { getDealerCreditBalance } from '@/utils/creditNoteUtils';

const creditBalance = await getDealerCreditBalance(dealerId);
console.log(`Available credit: ₹${creditBalance.toFixed(2)}`);
```

### Apply Credit to Invoice

```typescript
import { applyCreditNoteToInvoice } from '@/utils/creditNoteUtils';

const applied = await applyCreditNoteToInvoice(
  creditNoteId,
  invoiceId,
  dealerId,
  amountToApply,
  userId
);
```

### View Dealer's Balance with Credits

```typescript
<DealerBalanceWithCredits
  dealerId={dealerId}
  companyId={companyId}
/>
```

---

## Features Included

### 1. Credit Note Creation
- ✅ Dealer selection
- ✅ Credit amount and GST
- ✅ Reason categorization
- ✅ Invoice referencing
- ✅ Item-level tracking
- ✅ Expiry date management
- ✅ Approval workflow support

### 2. Credit Tracking
- ✅ Balance calculation (issued, used, remaining)
- ✅ Application history
- ✅ Expiry status
- ✅ Usage percentage

### 3. Dealer Balance
- ✅ Total invoiced vs paid
- ✅ Available credits
- ✅ Net balance calculation
- ✅ Credit impact visualization

### 4. Reporting
- ✅ Credit notes listing with filters
- ✅ Summary statistics
- ✅ CSV export
- ✅ Status and approval tracking

### 5. Integration Points
- ✅ Admin Dashboard reporting
- ✅ Billing Dashboard management
- ✅ Dealer Dashboard visibility
- ✅ Order creation integration
- ✅ Dealer profile integration

---

## Future Enhancements

1. **PDF Generation** - Download credit notes as PDFs
2. **Email Notifications** - Notify dealers when credit notes are issued
3. **Batch Operations** - Create multiple credit notes at once
4. **Credit Note Templates** - Standardized templates for common scenarios
5. **Advanced Analytics** - Credit trends and patterns
6. **Mobile Support** - Mobile-optimized credit note management
7. **Workflow Approval** - Multi-level approval process
8. **Credit Expiry Warnings** - Automatic notifications for expiring credits

---

## File Locations Summary

```
src/
├── components/
│   ├── CreditNoteDialog.tsx
│   ├── CreditNoteDetailsDialog.tsx
│   ├── CreditNotesCard.tsx
│   ├── DealerBalanceWithCredits.tsx
│   └── reports/
│       └── CreditNotesReportDialog.tsx
├── types/
│   └── creditNote.ts
└── utils/
    └── creditNoteUtils.ts

supabase/migrations/
└── 20260424_create_credit_notes_table.sql
```

---

## Support & Troubleshooting

### Issue: Credit balance not updating
- **Solution:** Ensure the `update_credit_note_balance()` trigger is active
- **Check:** Run SQL: `SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%credit%'`

### Issue: RLS preventing access
- **Solution:** Verify RLS policies are correct for user role
- **Check:** User must be admin/billing_manager or the dealer owner

### Issue: Credit note number duplicates
- **Solution:** Use the `generateCreditNoteNumber()` utility function
- **Check:** Ensure uniqueness constraint is enabled on credit_note_number

---

## API Integration

All components use Supabase for data operations:
- Real-time updates via subscriptions (can be added)
- Row-level security for data access control
- Automatic timestamp management
- Referential integrity enforcement

---

## Deployment Checklist

- [ ] Run migration: `20260424_create_credit_notes_table.sql`
- [ ] Import all components in dashboards
- [ ] Update types in TypeScript configuration
- [ ] Test credit note creation flow
- [ ] Test credit balance calculations
- [ ] Test reporting functionality
- [ ] Verify RLS policies
- [ ] Clear browser cache
- [ ] Test in production environment

