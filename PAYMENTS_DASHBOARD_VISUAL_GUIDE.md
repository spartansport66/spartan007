# Payments Dashboard System - Visual Architecture Guide

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Login                              │
├─────────────────────────────────────────────────────────────────┤
│  - Email/Password verification                                   │
│  - SessionContext checks user_type                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────────┐
        │              │              │                  │
        ▼              ▼              ▼                  ▼
    payment user   admin user    sales_person     other roles
        │              │              │                  │
        │              │              │                  │
        └──────────────┴──────────────┴──────────────────┘
                       │
            ┌──────────▼───────────┐
            │ Auto-Redirect based  │
            │ on user_type         │
            └──────────┬───────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   /payments-    Admin Dashboard  Other Routes
   dashboard
        │
        ▼
┌──────────────────────────────────┐
│   Payments Dashboard             │
├──────────────────────────────────┤
│ ┌────────┬────────┬───────┬────┐│
│ │Add     │Pending │Approved│ L  ││
│ │Payment │Payments│Payments│ e  ││
│ │        │        │        │ d  ││
│ │        │        │        │ g  ││
│ │        │        │        │ e  ││
│ └────────┴────────┴───────┴────┘│
└──────────────────────────────────┘
```

## Data Flow for Adding Payment

```
┌─────────────────────────────────────┐
│  Payment Entry Form                  │
│  (AddPaymentForm.tsx)                │
│  ┌────────────────────────────────┐ │
│  │ Dealer (searchable dropdown)   │ │
│  │ Amount (validation: > 0)       │ │
│  │ Method (cash, cheque, etc)     │ │
│  │ Date (date picker)             │ │
│  │ Reference (optional)           │ │
│  │ Remarks (optional)             │ │
│  └────────────────────────────────┘ │
└──────────────────┬──────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Form Validation     │
        │ (Zod Schema)        │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ Console Log Data    │
        │ (for debugging)     │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────────────┐
        │ Supabase Insert              │
        │ .from('payments').insert()   │
        └──────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    Success              Error
         │                   │
         ▼                   ▼
    ┌────────┐         ┌──────────┐
    │ Show   │         │ Show     │
    │ Success│         │ Error    │
    │ Toast  │         │ Message  │
    └────────┘         └──────────┘
         │
         ▼
   Payment stored in DB
   with status: 'pending'
```

## Approval Workflow

```
┌────────────────────────────────────────┐
│  Payment in 'pending' Status           │
│  (Pending Payments Report)             │
│                                        │
│  ┌──────────────┬────────────────┐   │
│  │ Approve Btn  │  Reject Btn    │   │
│  └────────┬─────┴────────┬───────┘   │
└───────────┼──────────────┼────────────┘
            │              │
        ┌───▼─┐         ┌──▼───┐
        │YES  │         │YES   │
        └─────┘         └──────┘
            │              │
            ▼              ▼
    ┌──────────────┐  ┌──────────────┐
    │ Set Status   │  │ Set Status   │
    │ = 'approved' │  │ = 'rejected' │
    │ Set          │  │ Save remarks │
    │ approved_by  │  │              │
    │ Set          │  └──────────────┘
    │ approval_    │
    │ date         │
    └────┬─────────┘
         │
         ▼
    ┌──────────────────┐
    │ Update Payment   │
    │ in Database      │
    └────┬─────────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
    Approved Tab         Rejected Tab
    (Shows in list)      (Archived)
```

## Report Generation Flow

```
┌────────────────────────────────────────┐
│   Approved Payments Report             │
│   (ApprovedPaymentsReport.tsx)          │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ Date Range Picker (30 days def)  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Summary Cards:                   │  │
│  │  - Total Approved (count)        │  │
│  │  - Total Amount (sum)            │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Data Table:                      │  │
│  │  - Dealer Name                   │  │
│  │  - Amount                        │  │
│  │  - Payment Date                  │  │
│  │  - Approved Date                 │  │
│  │  - Approver Name                 │  │
│  │  - Payment Method                │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  [Export to PDF Button]          │  │
│  └──────────────────────────────────┘  │
└────────┬─────────────────────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ Generate PDF using     │
    │ jsPDF + autoTable      │
    │                        │
    │ - Add title            │
    │ - Add date range       │
    │ - Add summary cards    │
    │ - Add data table       │
    │ - Add footer           │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Download as PDF        │
    │ format: Payments_      │
    │ YYYY-MM-DD.pdf         │
    └────────────────────────┘
```

## Database Schema Relationships

```
┌──────────────────┐
│   profiles       │
├──────────────────┤
│ id (PK)          │◄──┐
│ user_type        │   │
│ first_name       │   │
│ last_name        │   │
│ ...              │   │
└──────────────────┘   │
                       │
              ┌────────┴────────┐
              │                 │
              │                 │
        ┌─────▼──────────┐  ┌───▼──────────────┐
        │ payments       │  │ payment_approvals│
        ├────────────────┤  ├──────────────────┤
        │ id (PK)        │  │ id (PK)          │
        │ dealer_id (FK) │  │ payment_id (FK) ─┼──┐
        │ amount_paid    │  │ requested_by    │ │
        │ payment_date   │  │ approved_by (FK)┼─┼──┐
        │ payment_method │  │ status          │ │  │
        │ approval_status│  │ remarks         │ │  │
        │ approved_by(FK)│  │ ...             │ │  │
        │ approval_date  │  └──────────────────┘ │  │
        │ created_by (FK)│                    │  │
        │ ...            │  ┌──────────────────┐ │  │
        └────────┬────────┘  │payment_request_ ──┘  │
                 │           │logs                 │
            ┌────▼────────┐   │ id                 │
            │ orders      │   │ payment_id (FK) ───┤
            │             │   │ action             │
            │ id          │   │ action_by (FK)     │
            │ dealer_id   │   │ ...                │
            │ bill_no     │   └────────────────────┘
            │ ...         │
            └─────────────┘
```

## Authentication & Authorization Flow

```
┌─────────────────────────────────────────┐
│ User Attempts Login                     │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼─────────┐
        │ Verify Email &   │
        │ Password         │
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ Get user_type    │
        │ from profiles    │
        └────────┬─────────┘
                 │
    ┌────────────┼────────────┬─────────────┐
    │            │            │             │
    ▼            ▼            ▼             ▼
 'payment'    'admin'   'sales_person'   'other'
    │            │            │             │
    │            │            │             │
    ▼            ▼            ▼             ▼
Redirect to   All Access   Sales Dash   Specific
Payments      (including    (with        Routes
Dashboard     payments)     payments
(only)                      access)

Additionally, all database access controlled by RLS:

┌──────────────────────────────────┐
│ RLS Policy Check                 │
├──────────────────────────────────┤
│ is_payment_user() = true?        │──► Can access all payments
│ is_admin() = true?               │──► Can access all payments
│ Dealer match?                    │──► Can access own dealer payments
│ None above?                      │──► Access denied
└──────────────────────────────────┘
```

## Component Hierarchy

```
┌─────────────────────────────────────────┐
│         Index.tsx                       │
│  (Auto-redirect based on user_type)     │
└────────────┬────────────────────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ PaymentsDashboard.tsx  │
    │ (Main Container)       │
    └────────────┬───────────┘
                 │
    ┌────────────┼──────────────────┬─────────────┬─────────────┐
    │            │                  │             │             │
    ▼            ▼                  ▼             ▼             ▼
AddPayment   Pending           Approved        Dealer          Summary
Form         Payments          Payments        Ledger          Cards
             Report            Report          Report
   │          │                 │               │               │
   │          │                 │               │               │
   ▼          ▼                 ▼               ▼               ▼
Supabase  PendingPayments  ApprovedPayments DealerLedger   Summary
Insert    Report.tsx       Report.tsx        Report.tsx     Data

All components use:
- SessionContext (user info)
- Supabase (API calls)
- React Hook Form (form management)
- Zod (validation)
- TailwindCSS (styling)
- shadcn/ui (components)
```

## Deployment Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Developer                        │
└─────────────────────┬────────────────────────────────┘
                      │
          ┌───────────▼───────────┐
          │ Git Repository        │
          │ (with migration file) │
          └───────────┬───────────┘
                      │
          ┌───────────▼──────────────┐
          │ Supabase Dashboard       │
          │ SQL Editor               │
          │ [Copy & Run Migration]   │
          └───────────┬──────────────┘
                      │
          ┌───────────▼──────────────┐
          │ Supabase Database        │
          │                          │
          │ ✅ New Columns Added     │
          │ ✅ Functions Created     │
          │ ✅ RLS Policies Set      │
          │ ✅ Indexes Built         │
          │ ✅ Triggers Active       │
          └───────────┬──────────────┘
                      │
          ┌───────────▼──────────────┐
          │ React Application Ready  │
          │ - Add Payment Form       │
          │ - Pending Reports       │
          │ - Approved Reports      │
          │ - Dealer Ledger         │
          └──────────────────────────┘
```

## User Journey Maps

### Payment User Journey
```
1. Admin creates payment user account
                │
                ▼
2. Payment user receives credentials
                │
                ▼
3. Login to application
                │
                ▼
4. Auto-redirect to /payments-dashboard
                │
                ▼
5. Choose "Add Payment" tab
                │
                ▼
6. Fill form:
   - Select dealer (searchable)
   - Enter amount
   - Choose payment method
   - Set payment date
   - (Optional) Add reference & remarks
                │
                ▼
7. Click "Add Payment"
                │
                ├─► Success: Toast notification
                │   Payment in "Pending" status
                │
                └─► Error: Error message
                    Form stays populated
                │
                ▼
8. Choose "Pending" tab
   (to see their submitted payments)
                │
                ▼
9. (Waiting for admin approval)
                │
                ▼
10. Approval received (admin approves)
                │
                ▼
11. Payment appears in "Approved" tab
    (Can export to PDF)
```

### Admin Approval Journey
```
1. Login as admin
                │
                ▼
2. Access /payments-dashboard
   (admins have full access)
                │
                ▼
3. Choose "Pending" tab
                │
                ▼
4. See all pending payments
   with creator information
                │
                ├─► Click "Approve"
                │   ├─► Dialog: Enter remarks (optional)
                │   ├─► Click "Approve"
                │   │
                │   ▼
                │   ✅ Payment approved
                │   - approval_status = 'approved'
                │   - approval_date = now
                │   - approved_by = admin user_id
                │
                └─► Click "Reject"
                    ├─► Dialog: Enter rejection reason
                    ├─► Click "Reject"
                    │
                    ▼
                    ✅ Payment rejected
                    - approval_status = 'rejected'
                    - No approval_date set
                │
                ▼
5. Choose "Approved" tab
   to verify approval
                │
                ▼
6. Filter by date range if needed
                │
                ▼
7. Export to PDF if needed
```

---

**This visual guide complements the technical documentation.**
**Refer to:**
- `PAYMENTS_SCHEMA_DEPLOYMENT.md` - Deployment details
- `PAYMENTS_DASHBOARD_QUICK_REFERENCE.md` - Quick lookup
- `PAYMENTS_DASHBOARD_IMPLEMENTATION_COMPLETE.md` - Full overview
