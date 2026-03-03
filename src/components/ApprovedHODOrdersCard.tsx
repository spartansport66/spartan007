"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Eye, XCircle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import { emitHodEvent, onHodEvent } from '@/lib/hodEventBus';

const ApprovedHODOrdersCard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qOrderNumber, setQOrderNumber] = useState('');
  const [qDealerName, setQDealerName] = useState('');
  const [qDate, setQDate] = useState('');
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDisapproveDialogOpen, setIsDisapproveDialogOpen] = useState(false);
  const [disapproveOrderId, setDisapproveOrderId] = useState<string | null>(null);
  const [disapproveReason, setDisapproveReason] = useState('');
  const { user } = useSession();

  const fetchApproved = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`id, order_number, order_date, total_amount, hod_approved_at, dealers (name)`)
        .eq('hod_status', 'approved')
        .order('hod_approved_at', { ascending: false })
        .limit(200);

      if (qDate) {
        const start = `${qDate}T00:00:00.000Z`;
        const end = `${qDate}T23:59:59.999Z`;
        query = query.gte('hod_approved_at', start).lte('hod_approved_at', end);
      }

      const { data, error } = await query;
      if (error) {
        showError('Failed to load approved orders.');
        setOrders([]);
      } else setOrders(data || []);
    } catch (err: any) { showError('Unexpected error.'); } finally { setLoading(false); }
  }, [qDate]);

  useEffect(() => { fetchApproved(); }, [fetchApproved]);

  useEffect(() => {
    const off = onHodEvent((ev) => {
      // refresh when any HOD event occurs
      fetchApproved();
    });
    return off;
  }, [fetchApproved]);

  useEffect(() => { fetchApproved(); }, [fetchApproved]);

  const handleOpenDetails = (orderId: string) => { setSelectedOrderIdForDetails(orderId); setIsDetailsOpen(true); };

  const handleOpenDisapprove = (orderId: string) => { setDisapproveOrderId(orderId); setDisapproveReason(''); setIsDisapproveDialogOpen(true); };

  const submitDisapprove = async () => {
    if (!disapproveOrderId) return;
    try {
      const { error } = await supabase.from('orders').update({ hod_status: 'disapproved', hod_reason: disapproveReason, hod_approved_at: new Date().toISOString(), hod_approved_by: user?.id }).eq('id', disapproveOrderId);
      if (error) throw error;
      showSuccess('Order disapproved.');
      setIsDisapproveDialogOpen(false);
      setDisapproveOrderId(null);
      emitHodEvent({ type: 'disapproved', orderId: disapproveOrderId });
    } catch (err: any) { showError(`Disapprove failed: ${err.message}`); }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-green-600 text-white rounded-t-lg p-4">
        <div>
          <CardTitle className="text-xl font-semibold">Approved Orders</CardTitle>
          <CardDescription className="text-green-100">Recently approved by HOD</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex gap-2 mb-3">
          <Input placeholder="Order #" value={qOrderNumber} onChange={(e) => setQOrderNumber(e.target.value)} />
          <Input placeholder="Dealer name" value={qDealerName} onChange={(e) => setQDealerName(e.target.value)} />
          <Input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
          <Button onClick={fetchApproved}>Search</Button>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No approved orders.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[200px] overflow-y-auto">{/* shows ~4 rows before scrolling */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Order Date</TableHead>
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
                      <TableCell className="text-muted-foreground text-right">{o.total_amount?.toFixed?.(2) ?? o.total_amount}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDetails(o.id)} title="View Details"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDisapprove(o.id)} title="Disapprove"><XCircle className="h-4 w-4 text-red-600" /></Button>
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

      <Dialog open={isDisapproveDialogOpen} onOpenChange={setIsDisapproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disapprove Order</DialogTitle>
            <DialogDescription>Provide a reason for disapproval.</DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <Input placeholder="Reason (required)" value={disapproveReason} onChange={(e) => setDisapproveReason(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDisapproveDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitDisapprove} disabled={!disapproveReason.trim()}>Disapprove</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ApprovedHODOrdersCard;
