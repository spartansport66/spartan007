/**
 * Credit Note Utilities
 * Helper functions for credit note operations
 */

import { supabase } from '@/integrations/supabase/client';
import { CreditNote } from '@/types/creditNote';

/**
 * Generate next credit note number
 */
export const generateCreditNoteNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `CN-${timestamp}-${random}`;
};

/**
 * Get dealer's available credit balance
 */
export const getDealerCreditBalance = async (
  dealerId: string,
  companyId?: string
): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('credit_notes')
      .select('credit_remaining')
      .eq('dealer_id', dealerId)
      .eq('status', 'issued')
      .or('status.eq.partially_used');

    if (error) throw error;

    const total = (data || []).reduce(
      (sum, cn) => sum + (cn.credit_remaining || 0),
      0
    );

    return total;
  } catch (err) {
    console.error('Error calculating credit balance:', err);
    return 0;
  }
};

/**
 * Apply credit note to invoice
 */
export const applyCreditNoteToInvoice = async (
  creditNoteId: string,
  invoiceId: string,
  dealerId: string,
  amountToApply: number,
  userId: string
): Promise<boolean> => {
  try {
    // Create application record
    const { data, error } = await supabase
      .from('credit_note_applications')
      .insert({
        credit_note_id: creditNoteId,
        dealer_id: dealerId,
        invoice_id: invoiceId,
        amount_applied: amountToApply,
        applied_by: userId,
      })
      .select();

    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error('Error applying credit note:', err);
    return false;
  }
};

/**
 * Apply credit note to payment
 */
export const applyCreditNoteToPayment = async (
  creditNoteId: string,
  paymentId: string,
  dealerId: string,
  amountToApply: number,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('credit_note_applications')
      .insert({
        credit_note_id: creditNoteId,
        dealer_id: dealerId,
        payment_id: paymentId,
        amount_applied: amountToApply,
        applied_by: userId,
      })
      .select();

    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error('Error applying credit note:', err);
    return false;
  }
};

/**
 * Cancel credit note
 */
export const cancelCreditNote = async (
  creditNoteId: string,
  reason?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('credit_notes')
      .update({
        status: 'cancelled',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', creditNoteId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error cancelling credit note:', err);
    return false;
  }
};

/**
 * Get credit notes for dealer
 */
export const getDealerCreditNotes = async (
  dealerId: string,
  status?: string
): Promise<CreditNote[]> => {
  try {
    let query = supabase
      .from('credit_notes')
      .select('*')
      .eq('dealer_id', dealerId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('credit_note_date', {
      ascending: false,
    });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error getting dealer credit notes:', err);
    return [];
  }
};

/**
 * Calculate credit note expiry status
 */
export const isCreditNoteExpired = (expiryDate: string | null): boolean => {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
};

/**
 * Get utilization percentage
 */
export const getCreditUtilizationPercentage = (
  creditAmount: number,
  creditUsed: number
): number => {
  if (creditAmount === 0) return 0;
  return Math.min((creditUsed / creditAmount) * 100, 100);
};

/**
 * Format credit note for display
 */
export const formatCreditNoteAmount = (amount: number): string => {
  return `₹${amount.toFixed(2)}`;
};
