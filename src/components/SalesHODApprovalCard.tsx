"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Eye, CheckCircle, XCircle, Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import { emitHodEvent, onHodEvent } from '@/lib/hodEventBus';

interface OrderRow {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  urgent?: boolean;
}

const SalesHODApprovalCard: React.FC = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [selectedOrderForReason, setSelectedOrderForReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const { user } = useSession();

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, dealers (name)`)
        .eq('dispatched', false)
        .is('dispatch_date', null)
        .or("hod_status.eq.pending,hod_status.is.null")
        .order('order_date', { ascending: true });

      if (error) {
        console.error('fetchPending error', error.message);
        showError('Failed to load pending orders.');
        setOrders([]);
      } else {
        const filtered = (data || []).filter((o: any) => {
          const dealerName = o.dealers?.name || '';
          return dealerName !== 'Online Order';
        });

        setOrders(filtered.map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          order_date: o.order_date,
          total_amount: o.total_amount,
          dealer_name: o.dealers?.name || 'N/A',
          urgent: !!o.urgent,
        })));
      }
    } catch (err: any) {
      showError('Unexpected error loading orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  useEffect(() => {
    const off = onHodEvent((ev) => {
      // refresh when any HOD event occurs
      fetchPending();
    });
    return off;
  }, [fetchPending]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const filteredOrders = orders.filter(o => {
    if (filterOrderNumber && o.order_number?.toString() !== filterOrderNumber) return false;
    if (filterDealerName && !o.dealer_name.toLowerCase().includes(filterDealerName.toLowerCase())) return false;
    if (filterDate) {
      const od = new Date(o.order_date).toISOString().slice(0,10);
      if (od !== filterDate) return false;
    }
    return true;
  });

  const handleApprove = async (orderId: string) => {
    try {
      const { error } = await supabase.from('orders').update({ hod_status: 'approved', hod_approved_at: new Date().toISOString(), hod_approved_by: user?.id }).eq('id', orderId);
      if (error) throw error;
      showSuccess('Order approved.');
      emitHodEvent({ type: 'approved', orderId });
    } catch (err: any) {
      showError(`Approve failed: ${err.message}`);
    }
  };

  const handleDisapprove = (orderId: string) => {
    setSelectedOrderForReason(orderId);
    setReasonText('');
    setIsReasonDialogOpen(true);
  };

  const submitDisapprove = async () => {
    if (!selectedOrderForReason) return;
    try {
      const { error } = await supabase.from('orders').update({ hod_status: 'disapproved', hod_reason: reasonText, hod_approved_at: new Date().toISOString(), hod_approved_by: user?.id }).eq('id', selectedOrderForReason);
      if (error) throw error;
      showSuccess('Order disapproved.');
      setIsReasonDialogOpen(false);
      setSelectedOrderForReason(null);
      emitHodEvent({ type: 'disapproved', orderId: selectedOrderForReason });
    } catch (err: any) {
      showError(`Disapprove failed: ${err.message}`);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-indigo-600 text-white rounded-t-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Sales HOD - Orders Awaiting Approval</CardTitle>
            <CardDescription className="text-indigo-100">Approve or disapprove orders before dispatch.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="min-w-[150px]">
            <Label htmlFor="filterOrderNo">Order No.</Label>
            <Input id="filterOrderNo" placeholder="Order number" value={filterOrderNumber} onChange={(e) => setFilterOrderNumber(e.target.value)} />
          </div>
          <div className="min-w-[200px]">
            <Label htmlFor="filterDealer">Dealer Name</Label>
            <Input id="filterDealer" placeholder="Dealer name" value={filterDealerName} onChange={(e) => setFilterDealerName(e.target.value)} />
          </div>
          <div className="min-w-[150px]">
            <Label htmlFor="filterDate">Date</Label>
            <Input id="filterDate" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { /* filters applied reactively */ }}>Apply</Button>
            <Button variant="outline" onClick={() => { setFilterOrderNumber(''); setFilterDealerName(''); setFilterDate(''); }}>Clear</Button>
          </div>
        </div>

        {loading ? <p>Loading...</p> : filteredOrders.length === 0 ? <p className="text-center text-muted-foreground py-8">No pending orders.</p> : (
          <div className="overflow-x-auto">
            <div className="max-h-[360px] overflow-y-auto">{/* shows ~8 rows before scrolling */}
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
                {filteredOrders.map(o => (
                  <TableRow key={o.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">#{o.order_number}{o.urgent ? <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">URGENT</span> : null}</TableCell>
                    <TableCell className="text-muted-foreground">{o.dealer_name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(o.order_date)}</TableCell>
                    <TableCell className="text-muted-foreground text-right">{o.total_amount?.toFixed?.(2) ?? o.total_amount}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedOrderIdForDetails(o.id); setIsDetailsOpen(true); }} title="View Details"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleApprove(o.id)} title="Approve"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDisapprove(o.id)} title="Disapprove"><XCircle className="h-4 w-4 text-red-600" /></Button>
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

      <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Disapprove Order</DialogTitle>
            <DialogDescription>Please provide a reason for disapproval.</DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Reason for disapproval" />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setIsReasonDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitDisapprove} disabled={!reasonText.trim()}>Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </Card>
  );
};

export default SalesHODApprovalCard;
