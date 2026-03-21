"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Truck, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import OnlineOrderPreview from '@/components/OnlineOrderPreview';

interface OnlineQueueOrder {
  id: string;
  order_number: string | number | null;
  dispatch_number: string | null;
  bill_no: string | null;
  dealer_id: string | null;
  user_id: string | null;
  client_name?: string | null;
  platform_order_number?: string | null;
  raw_item_name?: string | null;
  items?: any[];
  qty?: number;
  platform_name?: string;
}

interface GatePassOnlineQueueCardProps {
  onDispatchSuccess: () => void;
}

const getPlatformPrefix = (platform: string): string => {
  const prefixes: Record<string, string> = {
    'Flipkart': 'F',
    'Meesho': 'M',
    'Amazon': 'A',
    'Spartan': 'S',
  };
  return prefixes[platform] || 'S';
};

// Helper function to clean header patterns from raw item names
const cleanItemName = (itemName: string | null): string | null => {
  if (!itemName) return null;
  
  // Remove common header patterns from Spartan PDFs
  let cleaned = itemName
    .replace(/^Product\s+Name:\s*\%\)\s*\|\s*SKU:\s*TOTAL\s*\|\s*HSN:\s*\(Including\s*\|\s*Qty:\s*GST\)\s*\|\s*Unit\s+Price:/gi, '')
    .replace(/Product\s+Name.*?Unit\s+Price:/gi, '')
    .trim();
  
  // Remove other common header patterns
  cleaned = cleaned
    .replace(/\(Including\s*GST\)/gi, '')
    .replace(/\(%\)/gi, '')
    .trim();
  
  return cleaned.length > 0 ? cleaned : null;
};

const GatePassOnlineQueueCard: React.FC<GatePassOnlineQueueCardProps> = ({ onDispatchSuccess }) => {
  const [queue, setQueue] = useState<OnlineQueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const [selectedQueue, setSelectedQueue] = useState<Record<string, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>('Flipkart');
  const platforms = ['Flipkart', 'Meesho', 'Amazon', 'Spartan'];

  const filteredQueue = queue.filter(q => {
    const matchesPlatform = selectedPlatform && q.platform_name === selectedPlatform;
    const matchesSearch = !searchQuery.trim() || [
      String(q.order_number || ''),
      String(q.dispatch_number || ''),
      String(q.client_name || '')
    ].some(f => f.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return matchesPlatform && matchesSearch;
  });

  const getCountByPlatform = (platform: string): number => {
    return queue.filter(q => q.platform_name === platform).length;
  };

  const allSelected = filteredQueue.length > 0 && filteredQueue.every(q => !!selectedQueue[q.id]);
  const someSelected = filteredQueue.some(q => !!selectedQueue[q.id]);

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
            const cleanedRawName = cleanItemName(r.raw_item_name);
            const rawNames = (cleanedRawName ? [cleanedRawName] : []).concat(items.map((it: any) => it.product_name).filter(Boolean));
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
              platform_name: r.platform_name || 'Website',
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
        .select('order_id, raw_item_name, client_name, mapped_product_id, platform_id')
        .in('order_id', orderIds2);

      if (detailsErr) throw detailsErr;

      // Get platform names for the platform IDs
      const platformIds = detailsData ? [...new Set(detailsData.map(d => d.platform_id).filter(Boolean))] : [];
      const platformNames: Record<string, string> = {};
      if (platformIds.length > 0) {
        const { data: platformData } = await supabase
          .from('online_platforms')
          .select('id, name')
          .in('id', platformIds);
        
        if (platformData) {
          platformData.forEach(p => {
            platformNames[p.id] = p.name;
          });
        }
      }

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
        const cleanedNames = dets.map(d => cleanItemName(d.raw_item_name)).filter(Boolean);
        const rawNames = cleanedNames.length > 0 ? cleanedNames : dets.map(d => d.raw_item_name).filter(Boolean);
        const clientName = dets[0]?.client_name || null;
        const mappedProductId = dets[0]?.mapped_product_id || null;
        const platformName = (dets[0]?.platform_id ? platformNames[dets[0].platform_id] : null) || 'Website';
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
          platform_name: platformName,
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
              <div className="flex items-center">
                <Input placeholder="Search dispatch#, order#, client name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mr-2" />
                <Button size="sm" variant="ghost" onClick={() => setSearchQuery('')}>Clear</Button>
              </div>
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
        <CardContent className="p-4 space-y-4">
          {/* Platform Filter Buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold">Platform:</span>
            {platforms.map(platform => (
              <Button
                key={platform}
                size="sm"
                variant={selectedPlatform === platform ? 'default' : 'outline'}
                onClick={() => setSelectedPlatform(platform)}
                className={selectedPlatform === platform ? (
                  platform === 'Flipkart' ? 'bg-blue-600 hover:bg-blue-700' :
                  platform === 'Meesho' ? 'bg-pink-600 hover:bg-pink-700' :
                  platform === 'Amazon' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-gray-700 hover:bg-gray-800'
                ) : ''}
              >
                {platform} ({getCountByPlatform(platform)})
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : queue.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">The online dispatch queue is empty.</p>
          ) : filteredQueue.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders found for selected platform.</p>
          ) : (
            <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6 p-2">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            const newSel: Record<string, boolean> = {};
                            filteredQueue.forEach(q => newSel[q.id] = true);
                            setSelectedQueue(newSel);
                          } else {
                            setSelectedQueue({});
                          }
                        }}
                        className="h-3 w-3"
                        aria-label="Select all online dispatch queue items"
                      />
                    </TableHead>
                    <TableHead className="p-2 min-w-20 sm:w-24">Dispatch</TableHead>
                    <TableHead className="p-2 min-w-20 sm:w-28">Client</TableHead>
                    <TableHead className="p-2 flex-grow min-w-32">Item</TableHead>
                    <TableHead className="p-2 min-w-10 text-center">Qty</TableHead>
                    <TableHead className="p-2 min-w-20 text-center">Act</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueue.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="p-2">
                        <input
                          type="checkbox"
                          checked={!!selectedQueue[order.id]}
                          onChange={(e) => setSelectedQueue(prev => ({ ...prev, [order.id]: e.target.checked }))}
                          className="h-3 w-3"
                        />
                      </TableCell>
                      <TableCell className="p-2 text-xs font-medium truncate" title={order.dispatch_number || 'N/A'}>
                        {order.dispatch_number ? String(order.dispatch_number).slice(0, 12) : '—'}
                      </TableCell>
                      <TableCell className="p-2 text-xs truncate" title={order.client_name || 'N/A'}>
                        {order.client_name || '—'}
                      </TableCell>
                      <TableCell className="p-2 text-xs max-w-xs truncate" title={order.raw_item_name || 'N/A'}>
                        {order.raw_item_name || '—'}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-center font-medium">
                        {order.qty || '—'}
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewOrderDetails(order.id)} 
                            title={`View Details - Order #${order.order_number}`}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 h-6 px-2" 
                                disabled={!!isDispatching}
                              >
                                {isDispatching === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
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
      <OnlineOrderPreview
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
    </>
  );
};

export default GatePassOnlineQueueCard;
