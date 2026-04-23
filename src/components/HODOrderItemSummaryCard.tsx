"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

type SortKey = 'pendingQty' | 'approvedQty' | 'closingStock' | 'netShortStock' | 'totalQty';

interface ItemSummary {
  productName: string;
  approvedQty: number;
  pendingQty: number;
  totalQty: number;
  closingStock: number;
  netShortStock: number;
}

const HODOrderItemSummaryCard: React.FC = () => {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalQty');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const printRef = useRef<HTMLDivElement>(null);

  const fetchItemSummary = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, hod_status, dealers (name), sales (quantity, products (id, name, closing_stock))')
        .is('bill_no', null)
        .in('hod_status', ['approved', 'pending'])
        .eq('dispatched', false)
        .is('dispatch_date', null)
        .limit(500);

      if (ordersError) {
        throw ordersError;
      }

      const orderRows = (ordersData || []) as any[];
      const orderIds = orderRows.map((order) => order.id).filter(Boolean);
      const onlineOrderIds = new Set<string>();

      if (orderIds.length > 0) {
        const [onlineOrdersRes, onlineDetailsRes] = await Promise.all([
          supabase.from('online_orders').select('order_id').in('order_id', orderIds),
          supabase.from('online_order_details').select('order_id').in('order_id', orderIds),
        ]);

        if (onlineOrdersRes.error) console.error('Failed fetch online_orders', onlineOrdersRes.error);
        if (onlineDetailsRes.error) console.error('Failed fetch online_order_details', onlineDetailsRes.error);

        (onlineOrdersRes.data || []).forEach((row: any) => { if (row.order_id) onlineOrderIds.add(row.order_id); });
        (onlineDetailsRes.data || []).forEach((row: any) => { if (row.order_id) onlineOrderIds.add(row.order_id); });
      }

      const filteredOrders = orderRows.filter((order) => {
        if (!order || !order.id) return false;
        if (onlineOrderIds.has(order.id)) return false;
        if (order.dealers?.name === 'Online Order') return false;
        return true;
      });

      const summaryMap = new Map<string, ItemSummary>();

      filteredOrders.forEach((order) => {
        const hodStatus = String(order.hod_status || '').toLowerCase();
        const isApproved = hodStatus === 'approved';
        const isPending = hodStatus === 'pending';

        if (!order.sales || !Array.isArray(order.sales)) return;

        order.sales.forEach((sale: any) => {
          const productId = sale.products?.id || null;
          const productName = (sale.products?.name || 'Unknown Product').trim();
          if (!productName) return;

          const itemKey = productId ? `${productId}` : productName;
          const quantity = Number(sale.quantity || 0);
          if (quantity <= 0) return;

          const closingStock = Number(sale.products?.closing_stock || 0);
          const existing = summaryMap.get(itemKey) || {
            productName,
            approvedQty: 0,
            pendingQty: 0,
            totalQty: 0,
            closingStock: 0,
            netShortStock: 0,
          };

          existing.closingStock = Math.max(existing.closingStock, closingStock);
          if (isApproved) {
            existing.approvedQty += quantity;
          } else if (isPending) {
            existing.pendingQty += quantity;
          }
          existing.totalQty += quantity;
          existing.netShortStock = Math.max(0, existing.totalQty - existing.closingStock);
          summaryMap.set(itemKey, existing);
        });
      });

      const summaryItems = Array.from(summaryMap.values()).sort((a, b) => b.totalQty - a.totalQty || a.productName.localeCompare(b.productName));
      setItems(summaryItems);
    } catch (err: any) {
      console.error('Failed to load HOD item summary', err);
      showError('Failed to load item-wise HOD order summary.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItemSummary();
  }, [fetchItemSummary]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>HOD Item-wise Order Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>HOD Item-wise Order Summary</h1>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const filteredItems = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    if (!lowerSearch) return items;
    return items.filter((item) => {
      const searchValues = [
        item.productName,
        String(item.pendingQty),
        String(item.approvedQty),
        String(item.closingStock),
        String(item.netShortStock),
        String(item.totalQty),
      ];
      return searchValues.some((value) => value.toLowerCase().includes(lowerSearch));
    });
  }, [items, search]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      const aVal = Number(a[sortKey] ?? 0);
      const bVal = Number(b[sortKey] ?? 0);
      if (aVal === bVal) {
        return a.productName.localeCompare(b.productName);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [filteredItems, sortKey, sortDirection]);

  const totalApprovedQty = useMemo(() => filteredItems.reduce((sum, item) => sum + item.approvedQty, 0), [filteredItems]);
  const totalPendingQty = useMemo(() => filteredItems.reduce((sum, item) => sum + item.pendingQty, 0), [filteredItems]);

  const applySort = (key: SortKey, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDirection(direction);
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-sky-600 text-white rounded-t-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">HOD Item-wise Approval Summary</CardTitle>
            <CardDescription className="text-sky-100">
              Shows item quantities for HOD-approved and HOD-pending orders that are not billed yet.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4" ref={printRef}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Search item name or quantity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <div className="rounded-lg bg-slate-50 p-3 text-slate-900">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending Order Qty</p>
              <p className="mt-1 text-2xl font-semibold">{totalPendingQty}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-slate-900">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Approved Order Qty</p>
              <p className="mt-1 text-2xl font-semibold">{totalApprovedQty}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No item-wise HOD order data found.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[520px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span>Pending Qty</span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('pendingQty', 'asc')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('pendingQty', 'desc')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span>Approved Qty</span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('approvedQty', 'asc')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('approvedQty', 'desc')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span>Closing Stock</span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('closingStock', 'asc')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('closingStock', 'desc')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span>Net Short Stock</span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('netShortStock', 'asc')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('netShortStock', 'desc')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span>Total Qty</span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('totalQty', 'asc')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => applySort('totalQty', 'desc')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow key={item.productName} className="hover:bg-accent/50">
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right font-medium text-orange-600">{item.pendingQty}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">{item.approvedQty}</TableCell>
                      <TableCell className="text-right font-medium">{item.closingStock}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{item.netShortStock}</TableCell>
                      <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HODOrderItemSummaryCard;
