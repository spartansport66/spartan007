"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

interface OnlineQueueOrder {
  id: string;
  order_number: string | number | null;
  dispatch_number: string | null;
  bill_no: string | null;
  dealer_id: string | null;
  user_id: string | null;
}

interface GatePassOnlineQueueCardProps {
  onDispatchSuccess: () => void;
}

const GatePassOnlineQueueCard: React.FC<GatePassOnlineQueueCardProps> = ({ onDispatchSuccess }) => {
  const [queue, setQueue] = useState<OnlineQueueOrder[]>([]);
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
      // Prefer RPCs which run as SECURITY DEFINER and can bypass RLS for authenticated users
      const { data: orderIdsRaw, error: rpcErr } = await supabase.rpc('get_online_pending_orders');
      if (!rpcErr && orderIdsRaw && Array.isArray(orderIdsRaw) && orderIdsRaw.length > 0) {
        const orderIds = orderIdsRaw;
        const { data: rpcData, error: rpcErr2 } = await supabase.rpc('get_online_order_full', { order_ids: orderIds });
        if (rpcErr2) throw rpcErr2;

        // If RPC returned meaningful rows, use them. If it returned an empty array,
        // fall through to the direct-query fallback so we can still surface the orders
        // (even when `online_order_details` are missing).
        if (Array.isArray(rpcData) && rpcData.length > 0) {
          const finalRows = rpcData.map((r: any) => {
            const items = Array.isArray(r.items) ? r.items : [];
            const qty = items.length > 0 ? items.reduce((s: number, it: any) => s + (it.qty || 0), 0) : 0;
            const rawNames = (r.raw_item_name ? [r.raw_item_name] : []).concat(items.map((it: any) => it.product_name).filter(Boolean));
            return {
              id: r.order_id,
              order_number: r.order_number,
              dispatch_number: r.dispatch_number,
              bill_no: r.bill_no,
              client_name: r.client_name || (items[0]?.client_name || null) || null,
              platform_order_number: r.platform_order_number || null,
              raw_item_name: rawNames.length > 0 ? rawNames.join(', ') : null,
              mapped_product_id: r.mapped_product_id || null,
              items: items.map((it: any) => ({ product_name: it.product_name || it.product || it.product_code || null, qty: it.qty || 0 })),
              qty,
            };
          });

          setQueue(finalRows);
          return;
        }
        // else continue to fallback path
      }

      // Fallback: direct query (may be restricted by RLS)
      const { data: ordersData, error: ordersErr } = await supabase
        .from('online_orders')
        .select('id, order_number, dispatch_number, bill_no, order_sequence, dispatch_date, dispatched')
        .eq('dispatched', false)
        .is('dispatch_date', null)
        .order('order_sequence', { ascending: true })
        .limit(200);

      if (ordersErr) throw ordersErr;
      if (!ordersData || ordersData.length === 0) {
        setQueue([]);
        return;
      }

      const orderIds2 = ordersData.map((o: any) => o.id);
      const { data: detailsData, error: detailsErr } = await supabase
        .from('online_order_details')
        .select('order_id, raw_item_name, client_name, mapped_product_id')
        .in('order_id', orderIds2);

      if (detailsErr) throw detailsErr;

      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('order_id, quantity')
        .in('order_id', orderIds2);

      if (salesErr) throw salesErr;

      const salesQtyMap: Record<string, number> = {};
      (salesData || []).forEach((s: any) => {
        salesQtyMap[s.order_id] = (salesQtyMap[s.order_id] || 0) + (s.quantity || 0);
      });

      const detailsByOrder: Record<string, any[]> = {};
      (detailsData || []).forEach((d: any) => {
        if (!detailsByOrder[d.order_id]) detailsByOrder[d.order_id] = [];
        detailsByOrder[d.order_id].push(d);
      });

      const finalRows = (ordersData || []).map((o: any) => {
        const dets = detailsByOrder[o.id] || [];
        const rawNames = dets.map(d => d.raw_item_name).filter(Boolean);
        const clientName = dets[0]?.client_name || null;
        const mappedProductId = dets[0]?.mapped_product_id || null;
        const salesQty = salesQtyMap[o.id] || 0;
        const qty = salesQty || (dets.length > 0 ? dets.length : 0);

        return {
          id: o.id,
          order_number: o.order_number,
          dispatch_number: o.dispatch_number,
          bill_no: o.bill_no,
          client_name: clientName || null,
          platform_order_number: null,
          raw_item_name: rawNames.length > 0 ? rawNames.join(', ') : null,
          mapped_product_id: mappedProductId || null,
          items: dets.map((d: any) => ({ product_name: d.raw_item_name || d.mapped_product_name || null, qty: 1 })),
          qty,
        };
      });

      setQueue(finalRows);
    } catch (error: any) {
      showError(`Failed to load online dispatch queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleDispatchOrder = async (orderId: string, orderNumber: string | number | null) => {
    setIsDispatching(orderId);
    try {
      const { error } = await supabase
        .from('online_orders')
        .update({ dispatch_date: new Date().toISOString(), dispatched: true })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess(`Order ${orderNumber} authorized for OUT!`);
      onDispatchSuccess();
    } catch (error: any) {
      showError(`Failed to authorize dispatch: ${error.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  const handleBulkDispatch = async (orderIds: string[]) => {
    if (!orderIds || orderIds.length === 0) return;
    setIsDispatching('bulk-online');
    try {
      const { error } = await supabase
        .from('online_orders')
        .update({ dispatch_date: new Date().toISOString(), dispatched: true })
        .in('id', orderIds);

      if (error) throw error;

      showSuccess(`Dispatched ${orderIds.length} online orders successfully.`);
      setSelectedQueue({});
      onDispatchSuccess();
    } catch (error: any) {
      showError(`Bulk dispatch failed: ${error.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  return (
    <>
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-emerald-600 dark:bg-emerald-800 text-white rounded-t-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold">Online Order Dispatch Queue (Awaiting Gate Pass)</CardTitle>
              <CardDescription className="text-emerald-100 dark:text-emerald-200">
                Online orders ready for gate pass dispatch.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!someSelected || !!isDispatching}>
                    {isDispatching === 'bulk-online' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Bulk Dispatch
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Bulk Dispatch</AlertDialogTitle>
                    <AlertDialogDescription>
                      Authorize final dispatch for {Object.keys(selectedQueue).filter(k => selectedQueue[k]).length} selected online orders? This will record the gate pass time for all selected orders.
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
            <p className="text-center text-muted-foreground py-8">The online dispatch queue is empty.</p>
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
                        aria-label="Select all online dispatch queue items"
                      />
                    </TableHead>
                    <TableHead>Online ID</TableHead>
                    <TableHead>Dispatch No.</TableHead>
                    <TableHead>Online Order #</TableHead>
                    <TableHead>Client / Dealer</TableHead>
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
                      <TableCell>
                        {order.id ? (
                          <span className="font-mono text-xs text-muted-foreground" title={order.id}>{String(order.id).slice(0,8)}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="font-medium">{order.dispatch_number || '—'}</TableCell>
                      <TableCell>{order.order_number || '—'}</TableCell>
                      <TableCell>
                        {order.client_name ? (
                          <>
                            <span className="font-medium">{order.client_name}</span>
                            {order.platform_order_number && (
                              <span className="block text-xs text-muted-foreground font-mono">{order.platform_order_number}</span>
                            )}
                          </>
                        ) : (
                          (order.user_id ? <span className="font-medium">{order.user_id}</span> : (order.dealer_id || 'N/A'))
                        )}
                      </TableCell>
                      <TableCell>
                        {order.items && order.items.length > 0 ? (
                          <span className="text-sm font-normal truncate">{order.items.map((it: any) => it.product_name || it.product_code || it.product_id).join(', ')}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.items && order.items.length > 0 ? (
                          <span className="text-sm font-normal">{order.items.map((it: any) => it.qty).join(', ')}</span>
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

export default GatePassOnlineQueueCard;
