import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

/**
 * Updates the allotted_credit_days for all dealers to a specified value.
 * This function should only be called by an Admin user.
 * @param days The new number of allotted credit days.
 */
export const updateAllDealerCreditDays = async (days: number) => {
  try {
    const { error } = await supabase
      .from('dealers')
      .update({ allotted_credit_days: days })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

    if (error) throw error;

    showSuccess(`Successfully updated allotted credit days to ${days} for all dealers.`);
    return true;
  } catch (error: any) {
    console.error('Error updating all dealer credit days:', error.message);
    showError(`Failed to update all dealer credit days: ${error.message}`);
    return false;
  }
};

/**
 * Approves or rejects a payment record.
 * @param paymentId The ID of the payment record.
 * @param orderId The ID of the associated order (null for general balance payments).
 * @param dealerId The ID of the dealer.
 * @param action 'approve' or 'reject'.
 */
export const approveRejectPayment = async ({ paymentId, orderId, dealerId, action }: { paymentId: string, orderId: string | null, dealerId: string, action: 'approve' | 'reject' }) => {
  try {
    // Fetch payment amount and current opening balance if it's a general payment
    let paymentAmount = 0;
    let currentOpeningBalance = 0;

    if (!orderId) {
      // This is a general balance payment (Order #0)
      const { data: paymentData, error: paymentFetchError } = await supabase
        .from('payments')
        .select('amount')
        .eq('id', paymentId)
        .single();

      if (paymentFetchError) throw new Error(`Failed to fetch payment amount: ${paymentFetchError.message}`);
      paymentAmount = paymentData.amount;

      const { data: balanceData, error: balanceFetchError } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', dealerId)
        .single();

      if (balanceFetchError && balanceFetchError.code !== 'PGRST116') throw new Error(`Failed to fetch dealer balance: ${balanceFetchError.message}`);
      currentOpeningBalance = balanceData?.opening_balance || 0;
    }

    if (action === 'approve') {
      // 1. Update payment status to 'completed' and set approved_at timestamp
      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ status: 'completed', approved_at: new Date().toISOString() })
        .eq('id', paymentId);

      if (paymentUpdateError) {
        throw new Error(`Failed to update payment status: ${paymentUpdateError.message}`);
      }

      if (orderId) {
        // 2a. Order Payment: Update order payment status to 'paid'
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', orderId);

        if (orderUpdateError) {
          throw new Error(`Failed to update order payment status: ${orderUpdateError.message}`);
        }
        showSuccess('Order payment approved and credit freed up successfully.');
      } else {
        // 2b. General Payment: Reduce the dealer's opening balance by the payment amount
        const newOpeningBalance = Math.max(0, currentOpeningBalance - paymentAmount); // Ensure balance doesn't go negative

        const { error: balanceUpdateError } = await supabase
          .from('dealer_balances')
          .update({ opening_balance: newOpeningBalance })
          .eq('dealer_id', dealerId);

        if (balanceUpdateError) {
          throw new Error(`Failed to update dealer opening balance: ${balanceUpdateError.message}`);
        }
        showSuccess('General payment approved and opening balance reduced successfully.');
      }

    } else if (action === 'reject') {
      if (orderId) {
        // 1a. Order Payment: Revert order payment status to 'pending'
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ payment_status: 'pending' })
          .eq('id', orderId);

        if (orderUpdateError) {
          throw new Error(`Failed to revert order payment status: ${orderUpdateError.message}`);
        }
      }
      // 2. Delete the payment record (for both order and general payments)
      const { error: paymentDeleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (paymentDeleteError) {
        throw new Error(`Failed to delete payment record: ${paymentDeleteError.message}`);
      }
      showSuccess(`Payment rejected and record deleted. ${orderId ? 'Order reverted to pending.' : ''}`);
    }
    return true;
  } catch (error: any) {
    console.error(`Error during payment ${action}:`, error.message);
    showError(`Failed to ${action} payment: ${error.message}`);
    return false;
  }
};