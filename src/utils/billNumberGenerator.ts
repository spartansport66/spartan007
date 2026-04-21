// Utility function to generate next bill number based on company's highest bill number
import { supabase } from '@/integrations/supabase/client';

export async function getNextBillNumber(companyId: string, tableName: 'spartan' | 'fightor'): Promise<string> {
  try {
    // Get ALL bill numbers for this company (not just limit 1)
    // We need to find the maximum numeric suffix across all bills
    const { data, error } = await supabase
      .from(tableName)
      .select('bill_number')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100); // Get last 100 to find the highest

    if (error) {
      console.error('Error fetching bill numbers:', error);
      throw error;
    }

    // If no bills exist, start with 1
    if (!data || data.length === 0) {
      return '1';
    }

    console.log('📊 Found bill numbers:', data.map(d => d.bill_number));

    // Extract numeric part from each bill number and find the maximum
    let maxNumber = 0;
    let billPrefix = '';

    for (const billRecord of data) {
      const billNumber = billRecord.bill_number;
      
      // Extract the last numeric sequence (e.g., "1026" from "M/26-27/1026")
      const match = billNumber.match(/(\d+)$/);
      
      if (match) {
        const currentNumber = parseInt(match[1], 10);
        
        // Extract the prefix (everything before the last numeric part)
        const prefix = billNumber.substring(0, match.index);
        const padLength = match[1].length; // Preserve zero-padding
        
        console.log(`📝 Bill: ${billNumber} → Prefix: "${prefix}", Number: ${currentNumber}, PadLength: ${padLength}`);
        
        // Track the maximum number and its prefix
        if (currentNumber > maxNumber) {
          maxNumber = currentNumber;
          billPrefix = prefix;
        }
      }
    }

    // If we found bills with numeric suffixes, increment the max
    if (maxNumber > 0 && billPrefix) {
      // Get the padding length from the last bill number for consistency
      const firstBillMatch = data[0].bill_number.match(/(\d+)$/);
      const padLength = firstBillMatch ? firstBillMatch[1].length : 4;
      
      const nextNumber = (maxNumber + 1).toString().padStart(padLength, '0');
      const nextBillNumber = `${billPrefix}${nextNumber}`;
      console.log(`✅ Generated next bill number: ${nextBillNumber} (from max: ${billPrefix}${maxNumber})`);
      return nextBillNumber;
    }

    // Fallback for first bill
    console.log(`⚠️ No valid bill format found, starting with 1`);
    return '1';
  } catch (error) {
    console.error('Exception in getNextBillNumber:', error);
    // Return a timestamp-based fallback
    return Math.floor(Date.now() / 1000).toString();
  }
}
