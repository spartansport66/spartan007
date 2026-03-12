"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

interface QueueOrder {
  id: string;
  order_number: number;
  dealer_name: string;
  bill_no: string | null;
  dispatch_number: number | null;
  platform_order_number: string | null;
  client_name: string | null;
}

interface GatePassQueueCardProps {
  onDispatchSuccess: () => void;
}

const GatePassQueueCard: React.FC<GatePassQueueCardProps> = ({ onDispatchSuccess }) => {
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<Record<string, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const allSelected = queue.length > 0 && queue.every(q => !!selectedQueue[q.id]);
  const someSelected = queue.some(q => !!selectedQueue[q.id]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = !allSelected && someSelected;
  }, [allSelected, someSelected]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          bill_no,
          dispatch_number,
          dealers (name)
        `)
        .eq('dispatched', true)
        .is('gate_pass_dispatch_time', null)
        .order('dispatch_number', { ascending: true });

      if (error) throw error;

      const onlineOrderIds = (data || []).filter(o => (o.dealers as any)?.name === 'Online Order').map(o => o.id);
      let onlineDetailsMap = new Map();

      if (onlineOrderIds.length > 0) {
        const { data: onlineDetails, error: functionError } = await supabase.functions.invoke('get-online-order-details', {
          body: { orderIds: onlineOrderIds },
        });

        if (functionError) throw functionError;

        (onlineDetails || []).forEach((d: any) => onlineDetailsMap.set(d.order_id, d));
      }

      const formattedQueue: QueueOrder[] = (data || []).map((order: any) => {
        const details = onlineDetailsMap.get(order.id);
        return {
          id: order.id,
          order_number: order.order_number,
          dealer_name: (order.dealers as any)?.name || 'N/A',
          bill_no: order.bill_no,
          dispatch_number: order.dispatch_number,
          platform_order_number: details?.platform_order_number || null,
          client_name: details?.client_name || null,
          // include items and qty from the function (if present)
          items: details?.items || [],
        } as any;
      });

      setQueue(formattedQueue);
    } catch (error: any) {
      showError(`Failed to load dispatch queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleDispatchOrder = async (orderId: string, orderNumber: number) => {
    setIsDispatching(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ gate_pass_dispatch_time: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess(`Order #${orderNumber} authorized for OUT!`);
      onDispatchSuccess(); // This will trigger a re-fetch in the parent
    } catch (error: any) {
      showError(`Failed to authorize dispatch: ${error.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleBulkDispatch = async (orderIds: string[]) => {
    if (!orderIds || orderIds.length === 0) return;
    setIsDispatching('bulk');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ gate_pass_dispatch_time: new Date().toISOString() })
        .in('id', orderIds);

      if (error) throw error;

      showSuccess(`Dispatched ${orderIds.length} orders successfully.`);
      setSelectedQueue({});
      onDispatchSuccess();
    } catch (error: any) {
      showError(`Bulk dispatch failed: ${error.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  return (
    <>
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold">Dispatch Queue (Awaiting Gate Pass)</CardTitle>
              <CardDescription className="text-blue-100 dark:text-blue-200">
                Orders processed by admin and ready for final dispatch.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!someSelected || !!isDispatching}>
                    {isDispatching === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Bulk Dispatch
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Bulk Dispatch</AlertDialogTitle>
                    <AlertDialogDescription>
                      Authorize final dispatch for {Object.keys(selectedQueue).filter(k => selectedQueue[k]).length} selected orders? This will record the gate pass time for all selected orders.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleBulkDispatch(Object.keys(selectedQueue).filter(k => selectedQueue[k]))}>
                      Confirm Bulk Dispatch
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : queue.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">The dispatch queue is empty.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            const newSel: Record<string, boolean> = {};
                            queue.forEach(q => newSel[q.id] = true);
                            setSelectedQueue(newSel);
                          } else {
                            setSelectedQueue({});
                          }
                        }}
                        className="h-4 w-4"
                        aria-label="Select all dispatch queue items"
                      />
                    </TableHead>
                    <TableHead>Dispatch #</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Dealer / Customer</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={!!selectedQueue[order.id]}
                          onChange={(e) => setSelectedQueue(prev => ({ ...prev, [order.id]: e.target.checked }))}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{order.dispatch_number}</TableCell>
                      <TableCell>#{order.order_number}</TableCell>
                      <TableCell>
                        {order.dealer_name === 'Online Order' && order.client_name ? (
                          <>
                            <span className="font-medium">{order.client_name}</span>
                            {order.platform_order_number && (
                              <span className="block text-xs text-muted-foreground font-mono">{order.platform_order_number}</span>
                            )}
                          </>
                        ) : (
                          order.dealer_name
                        )}
                      </TableCell>
                      <TableCell>
                        {((order as any).items && (order as any).items.length > 0) ? (
                          <span className="font-medium">{(() => {
                            const names = (order as any).items.map((it: any) => it.product_name || it.product_code || it.product_id);
                            return names.length === 2 ? names.map((n: any, i: number) => <div key={i}>{n}</div>) : names.join(', ');
                          })()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {((order as any).items && (order as any).items.length > 0) ? (
                          <span>{(() => {
                            const qtys = (order as any).items.map((it: any) => it.qty);
                            return qtys.length === 2 ? qtys.map((q: any, i: number) => <div key={i}>{q}</div>) : qtys.join(', ');
                          })()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{order.bill_no}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleViewOrderDetails(order.id)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={!!isDispatching}>
                                {isDispatching === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Final Material OUT</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Authorize final dispatch for Order #{order.order_number}? This will record the gate pass time.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDispatchOrder(order.id, order.order_number)}>
                                  Confirm Final OUT
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
    </>
  );
};

export default GatePassQueueCard;