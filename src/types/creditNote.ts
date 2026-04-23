/**
 * Credit Note Types
 * Defines all TypeScript interfaces for credit note functionality
 */

export interface CreditNote {
  id: string;
  company_id?: string;
  dealer_id: string;
  credit_note_number: string;
  credit_note_date: string;
  financial_year_id?: string;
  
  // Details
  reason: string;
  description?: string;
  credit_amount: number;
  
  // References
  referenced_invoice_id?: string;
  referenced_bill_number?: string;
  
  // Status
  status: 'draft' | 'issued' | 'partially_used' | 'fully_used' | 'cancelled' | 'expired';
  approval_status: 'pending' | 'approved' | 'rejected';
  
  // Credit Tracking
  credit_used: number;
  credit_remaining: number;
  
  // Expiry
  expiry_date?: string;
  
  // GST
  gst_percentage?: number;
  gst_amount?: number;
  
  // Approval
  approved_by?: string;
  approval_date?: string;
  rejection_reason?: string;
  
  // Audit
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  
  // Relations
  dealers?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  companies?: {
    id: string;
    name: string;
  };
}

export interface CreditNoteItem {
  id: string;
  credit_note_id: string;
  product_id?: string;
  description: string;
  quantity_returned: number;
  unit_price: number;
  item_amount: number;
  reason_for_return?: string;
  created_at?: string;
}

export interface CreditNoteApplication {
  id: string;
  credit_note_id: string;
  dealer_id: string;
  invoice_id?: string;
  payment_id?: string;
  amount_applied: number;
  application_date: string;
  applied_by?: string;
  created_at?: string;
}

export interface DealerBalanceWithCredits {
  total_invoiced: number;
  total_paid: number;
  credit_notes_issued: number;
  credit_notes_used: number;
  credit_notes_balance: number;
  net_balance: number;
}

export interface CreditNoteFormData {
  dealer_id: string;
  reason: string;
  description?: string;
  credit_amount: number;
  referenced_invoice_id?: string;
  referenced_bill_number?: string;
  expiry_date?: string;
  gst_percentage?: number;
  items: CreditNoteItem[];
}
