import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Row = {
  order_id: string;
  order_number: string;
  order_date: string;
  total_amount: number;
  bill_no: string | null;
  sales_person_id: string | null;
  sales_person_name: string | null;
};

const SalesPersonDailyReport: React.FC = () => {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = async (d: string) => {
    setLoading(true);
    try {
      const start = `${d}T00:00:00.000Z`;
      const end = `${d}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from('orders')
        .select('id,order_number,order_date,total_amount,bill_no,user_id,profiles!left(first_name,last_name)')
        .filter('bill_no', 'not.is', null)
        .gte('order_date', start)
        .lte('order_date', end)
        .order('user_id', { ascending: true })
        .order('order_date', { ascending: true });

      if (error) throw error;

      const mapped: Row[] = (data || []).map((r: any) => ({
        order_id: r.id,
        order_number: r.order_number,
        order_date: r.order_date,
        total_amount: r.total_amount,
        bill_no: r.bill_no,
        sales_person_id: r.user_id || null,
        sales_person_name: `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim() || null,
      }));

      setRows(mapped);
    } catch (e: any) {
      console.error('Failed to fetch sales person daily orders', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(date);
  }, [date]);

  const totalAmount = rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);

  return (
    <div style={{ padding: 16 }}>
      <h2>Sales Person Daily Sales Report</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Date:</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={() => fetchRows(date)} style={{ marginLeft: 8 }}>Refresh</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Orders:</strong> {rows.length} &nbsp; <strong>Total:</strong> ₹{totalAmount.toFixed(2)}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>Sales Person</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>Order No</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>Order Date</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'right', padding: 8 }}>Amount</th>
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>Bill No</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: 12 }}>Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 12 }}>No orders found for this date.</td></tr>
            )}
            {!loading && rows.map(r => (
              <tr key={r.order_id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{r.sales_person_name || '—'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{r.order_number}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{new Date(r.order_date).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1', textAlign: 'right' }}>₹{Number(r.total_amount || 0).toFixed(2)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{r.bill_no || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesPersonDailyReport;
