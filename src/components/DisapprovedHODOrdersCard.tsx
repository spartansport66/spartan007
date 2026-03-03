"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Eye, CheckCircle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import { emitHodEvent, onHodEvent } from '@/lib/hodEventBus';

const DisapprovedHODOrdersCard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qOrderNumber, setQOrderNumber] = useState('');
  const [qDealerName, setQDealerName] = useState('');
  const [qDate, setQDate] = useState('');
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { user } = useSession();

  const fetchDisapproved = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`id, order_number, order_date, total_amount, dealers (name), hod_reason, hod_approved_at`)
        .eq('hod_status', 'disapproved')
        .order('hod_approved_at', { ascending: false })
        .limit(200);

      if (qDate) {
        const start = `${qDate}T00:00:00.000Z`;
        const end = `${qDate}T23:59:59.999Z`;
        query = query.gte('hod_approved_at', start).lte('hod_approved_at', end);
      }

      const { data, error } = await query;
      if (error) {
        showError('Failed to load disapproved orders.');
        setOrders([]);
      } else setOrders(data || []);
    } catch (err: any) { showError('Unexpected error.'); } finally { setLoading(false); }
  }, [qDate]);

  useEffect(() => { fetchDisapproved(); }, [fetchDisapproved]);
  useEffect(() => {
    const off = onHodEvent((ev) => {
      fetchDisapproved();
    });
    return off;
  }, [fetchDisapproved]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-red-600 text-white rounded-t-lg p-4">
        <div>
          <CardTitle className="text-xl font-semibold">Disapproved Orders</CardTitle>
          <CardDescription className="text-red-100">Recently disapproved by HOD</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex gap-2 mb-3">
          <Input placeholder="Order #" value={qOrderNumber} onChange={(e) => setQOrderNumber(e.target.value)} />
          <Input placeholder="Dealer name" value={qDealerName} onChange={(e) => setQDealerName(e.target.value)} />
          <Input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
          <Button onClick={fetchDisapproved}>Search</Button>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No disapproved orders.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[200px] overflow-y-auto">{/* shows ~4 rows before scrolling */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders
                    .filter((r:any) => qOrderNumber ? (r.order_number && r.order_number.toString().includes(qOrderNumber)) : true)
                    .filter((r:any) => qDealerName ? ((r.dealers?.name || '').toLowerCase().includes(qDealerName.toLowerCase())) : true)
                    .map((o:any) => (
                    <TableRow key={o.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">#{o.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{o.dealers?.name || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{o.hod_reason || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-right">{o.total_amount?.toFixed?.(2) ?? o.total_amount}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedOrderIdForDetails(o.id); setIsDetailsOpen(true); }} title="View Details"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            try {
                              const { error } = await supabase.from('orders').update({ hod_status: 'approved', hod_approved_at: new Date().toISOString(), hod_approved_by: user?.id }).eq('id', o.id);
                              if (error) throw error;
                              showSuccess('Order approved.');
                              emitHodEvent({ type: 'approved', orderId: o.id });
                            } catch (err: any) { showError(`Approve failed: ${err.message}`); }
                          }} title="Approve"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </Card>
  );
};

export default DisapprovedHODOrdersCard;
