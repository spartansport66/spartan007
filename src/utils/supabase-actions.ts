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
    if (action === 'approve') {
      const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select('id, amount, order_id, dealer_id')
        .eq('id', paymentId)
        .single();
      if (fetchError || !payment) throw new Error('Payment not found');

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ status: 'completed', approved_at: new Date().toISOString() })
        .eq('id', paymentId);
      if (paymentUpdateError) throw paymentUpdateError;

      const isGeneral = !payment.order_id;
      const allocationData = {
        payment_id: payment.id,
        allocated_amount: payment.amount,
        liability_id: isGeneral ? payment.dealer_id : payment.order_id,
        allocation_type: isGeneral ? 'opening_balance' : 'order',
      };
      const { error: allocationError } = await supabase.from('payment_allocations').insert(allocationData);
      if (allocationError) throw allocationError;

      if (!isGeneral) {
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('id', payment.order_id)
          .single();
        if (orderFetchError) throw orderFetchError;

        const { data: allocations, error: allocFetchError } = await supabase
          .from('payment_allocations')
          .select('allocated_amount, payments(status)')
          .eq('liability_id', payment.order_id)
          .eq('allocation_type', 'order')
          .eq('payments.status', 'completed');
        if (allocFetchError) throw allocFetchError;

        const totalPaid = (allocations || []).reduce((sum, alloc) => sum + alloc.allocated_amount, 0);
        const newPaymentStatus = totalPaid >= orderData.total_amount ? 'paid' : 'pending';

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ payment_status: newPaymentStatus })
          .eq('id', payment.order_id);
        if (orderUpdateError) throw orderUpdateError;
      }
      showSuccess('Payment approved and allocated.');

    } else if (action === 'reject') {
      if (orderId) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ payment_status: 'pending' })
          .eq('id', orderId);
        if (orderUpdateError) throw orderUpdateError;
      }
      
      const { error: paymentDeleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);
      if (paymentDeleteError) throw paymentDeleteError;
      showSuccess(`Payment rejected and record deleted. ${orderId ? 'Order reverted to pending.' : ''}`);
    }
    return true;
  } catch (error: any) {
    console.error(`Error during payment ${action}:`, error.message);
    showError(`Failed to ${action} payment: ${error.message}`);
    return false;
  }
};