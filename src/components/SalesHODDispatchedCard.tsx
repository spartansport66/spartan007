"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

const todayIsoDate = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const SalesHODDispatchedCard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qOrderNumber, setQOrderNumber] = useState('');
  const [qDealerName, setQDealerName] = useState('');
  const [qDate, setQDate] = useState<string>(todayIsoDate());
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // base query: gate_pass_dispatch_time IS NOT NULL
      let query = supabase
        .from('orders')
        .select('id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, gate_pass_dispatch_time, dealers(name)')
        .not('gate_pass_dispatch_time', 'is', null)
        .order('gate_pass_dispatch_time', { ascending: false })
        .limit(200);

      // apply date filter (match date portion of gate_pass_dispatch_time)
      if (qDate) {
        const start = `${qDate}T00:00:00.000Z`;
        const end = `${qDate}T23:59:59.999Z`;
        query = query.gte('gate_pass_dispatch_time', start).lte('gate_pass_dispatch_time', end);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows = data || [];

      // client-side filters for order number and dealer name (supabase text-search would be better)
      if (qOrderNumber) {
        rows = rows.filter((r: any) => r.order_number && r.order_number.toString().includes(qOrderNumber));
      }
      if (qDealerName) {
        const q = qDealerName.toLowerCase();
        rows = rows.filter((r: any) => (r.dealers?.name || '').toLowerCase().includes(q));
      }

      setOrders(rows as any[]);
    } catch (err: any) {
      showError('Failed to load dispatched orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [qDate, qOrderNumber, qDealerName]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleView = (id: string) => { setSelectedOrderIdForDetails(id); setIsDetailsOpen(true); };

  return (
    <Card className="bg-card text-card-foreground shadow">
      <CardHeader className="bg-slate-700 text-white rounded-t-md p-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Dispatched (Gate Pass Date)</CardTitle>
            <CardDescription className="text-slate-200 text-sm">Showing orders with gate pass date. Defaults to today.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="flex gap-2 mb-3">
          <Input placeholder="Order #" value={qOrderNumber} onChange={(e) => setQOrderNumber(e.target.value)} />
          <Input placeholder="Dealer name" value={qDealerName} onChange={(e) => setQDealerName(e.target.value)} />
          <Input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
          <Button onClick={fetch}>Search</Button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No dispatched orders found.</p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gate Pass Date</TableHead>
                  <TableHead>Dispatch #</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id} className="hover:bg-accent/50">
                    <TableCell>{o.gate_pass_dispatch_time ? new Date(o.gate_pass_dispatch_time).toLocaleString() : '-'}</TableCell>
                    <TableCell>#{o.dispatch_number ?? '-'}</TableCell>
                    <TableCell className="font-medium">#{o.order_number}</TableCell>
                    <TableCell className="text-muted-foreground">{o.dealers?.name || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{o.total_amount?.toFixed?.(2) ?? o.total_amount}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => handleView(o.id)} title="View"><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </Card>
  );
};

export default SalesHODDispatchedCard;
