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