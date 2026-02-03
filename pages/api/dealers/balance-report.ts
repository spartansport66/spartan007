import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const supabase = createServerSupabaseClient({ req, res });
    const { sales_person_id, dealer_name_filter } = req.query;

    const rpcParams: { [key: string]: string | undefined } = {};
    if (sales_person_id) {
      rpcParams.p_sales_person_id = sales_person_id as string;
    }
    if (dealer_name_filter) {
      rpcParams.p_dealer_name_filter = dealer_name_filter as string;
    }

    const { data, error } = await supabase.rpc('get_dealer_balance_report', rpcParams);

    if (error) {
      console.error('Error fetching dealer balance report:', error);
      return res.status(500).json({ error: 'Failed to fetch dealer balance report', details: error.message });
    }

    // If data is null (no rows returned), return an empty array to prevent a server crash.
    if (!data) {
      return res.status(200).json([]);
    }

    // Data processing to add calculated fields
    const processedData = data.map((dealer: any) => {
      const openingBalanceDueDate = dealer.opening_balance_due_date ? new Date(dealer.opening_balance_due_date) : null;
      const lastDispatchDate = dealer.last_dispatch_date ? new Date(dealer.last_dispatch_date) : null;
      const now = new Date();

      const openingBalanceDueDays = openingBalanceDueDate
        ? Math.floor((now.getTime() - openingBalanceDueDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const daysSinceLastDispatch = lastDispatchDate
        ? Math.floor((now.getTime() - lastDispatchDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...dealer,
        opening_balance_due_days: openingBalanceDueDays,
        days_since_last_dispatch: daysSinceLastDispatch,
      };
    });

    res.status(200).json(processedData);
  } catch (error: any) {
    console.error('Unexpected error in balance-report handler:', error);
    res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
  }
};

export default handler;