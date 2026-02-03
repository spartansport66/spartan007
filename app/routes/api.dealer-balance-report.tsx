import { json, LoaderFunction } from '@remix-run/node';
import { createServerClient } from '@supabase/auth-helpers-remix';
import { getPagination } from '~/utils/pagination';

export const loader: LoaderFunction = async ({ request }) => {
  const response = new Response();
  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    request,
    response,
  });

  const { searchParams } = new URL(request.url);
  const salesPersonId = searchParams.get('salesPersonId');
  const dealerName = searchParams.get('dealerName');
  const { page, size } = getPagination(request);
  const offset = (page - 1) * size;

  try {
    const { data, error } = await supabase.rpc('get_dealer_balance_report', {
      p_sales_person_id: salesPersonId || null,
      p_dealer_name_filter: dealerName || null,
      p_limit: size,
      p_offset: offset,
    });

    if (error) {
      console.error('Error fetching dealer balance report:', error);
      throw new Error('Failed to fetch dealer balance report');
    }

    const count = data && data.length > 0 ? data[0].total_count : 0;

    const reportData = data.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      opening_balance: d.opening_balance,
      opening_balance_due_date: d.opening_balance_due_date,
      total_sales: d.total_sales,
      total_payments_received: d.total_payments_received,
      closing_balance: d.closing_balance,
      last_dispatch_date: d.last_dispatch_date,
      opening_balance_due_days: d.opening_balance_due_date
        ? Math.ceil((new Date().getTime() - new Date(d.opening_balance_due_date).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      days_since_last_dispatch: d.last_dispatch_date
        ? Math.ceil((new Date().getTime() - new Date(d.last_dispatch_date).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return json({ data: reportData, count: count ?? 0, page, size });
  } catch (error) {
    console.error('Unexpected error in dealer balance report loader:', error);
    return json({ error: 'An unexpected error occurred while fetching dealer data.' }, { status: 500 });
  }
};