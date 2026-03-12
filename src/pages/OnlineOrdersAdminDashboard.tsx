"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Eye, Edit, Trash2, Printer, FileSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

const OnlineOrdersAdminDashboard: React.FC = () => {
  const { user, userType, loading } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [awaiting, setAwaiting] = useState<any[]>([]);
  const [dispatched, setDispatched] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      // fetch awaiting and dispatched, include details
      // fetch orders first (avoid relying on embedded relationship in PostgREST)
      const { data: awaitingData, error: aErr } = await supabase
        .from('online_orders')
        .select('*')
        .eq('dispatched', false)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (aErr) throw aErr;

      const { data: dispatchedData, error: dErr } = await supabase
        .from('online_orders')
        .select('*')
        .eq('dispatched', true)
        .order('dispatch_date', { ascending: false })
        .limit(1000);
      if (dErr) throw dErr;

      // fetch details for all orders in one go to avoid needing a DB relationship in the schema cache
      const allOrderIds = [ ...(awaitingData || []).map((o: any) => o.id), ...(dispatchedData || []).map((o: any) => o.id) ];
      let details: any[] = [];
      // try to invoke edge function that uses service role (bypasses RLS) to get detailed rows including items
      if (allOrderIds.length > 0) {
        try {
          const { data: funcData, error: funcErr } = await supabase.functions.invoke('get-online-order-details', { body: { orderIds: allOrderIds } });
          if (funcErr) {
            console.warn('get-online-order-details function returned error:', funcErr);
          } else if (funcData && Array.isArray(funcData)) {
            // convert function result into the legacy 'online_order_details' array shape per order
            const byOrder: Record<string, any[]> = {};
            (funcData || []).forEach((d: any) => {
              if (!byOrder[d.order_id]) byOrder[d.order_id] = [];
              byOrder[d.order_id].push(d);
            });
            details = Object.keys(byOrder).flatMap(k => byOrder[k]);
          }
        } catch (e) {
          console.warn('Failed to call get-online-order-details function, falling back to direct queries', e);
        }

        if (details.length === 0) {
          // fallback: fetch by order_id directly
          const { data: detData, error: detErr } = await supabase
            .from('online_order_details')
            .select('*')
            .in('order_id', allOrderIds);
          if (detErr) {
            console.warn('Fetch online_order_details by order_id failed, falling back to batch fetch', detErr);
            // fallback: fetch a reasonable batch and filter client-side to avoid PostgREST column errors
            const { data: batchData, error: batchErr } = await supabase
              .from('online_order_details')
              .select('*')
              .limit(2000);
            if (batchErr) throw batchErr;
            details = (batchData || []).filter((d: any) => allOrderIds.includes(d.order_id));
          } else {
            details = detData || [];
          }
        }
      }

      // fetch sales for these orders so we can show mapped products (sales.product -> products.name)
      let sales: any[] = [];
      if (allOrderIds.length > 0) {
        try {
          const { data: salesData, error: salesErr } = await supabase
            .from('sales')
            .select('order_id, quantity, unit_price, total_price, products(name, code)')
            .in('order_id', allOrderIds as any[]);
          if (salesErr) throw salesErr;
          sales = salesData || [];
        } catch (e) {
          console.warn('Failed to fetch sales for online orders', e);
          sales = [];
        }
      }

      // debug: log counts so we can inspect in browser console when details are missing
      console.debug('OnlineOrdersAdminDashboard: fetched counts', {
        awaiting: (awaitingData || []).length,
        dispatched: (dispatchedData || []).length,
        details: details.length,
      });

      // attach details array to each order (online_order_details.order_id references online_orders.id)
      const salesByOrder: Record<string, any[]> = {};
      for (const s of sales) {
        const key = s.order_id;
        salesByOrder[key] = salesByOrder[key] || [];
        salesByOrder[key].push(s);
      }

      const attachDetails = (orders: any[]) => orders.map(o => {
        const dets = details.filter(d => d.order_id === o.id);
        let salesFallback = salesByOrder[o.id] || [];
        if ((!salesFallback || salesFallback.length === 0) && dets && dets.length > 0 && dets[0].items && Array.isArray(dets[0].items)) {
          salesFallback = dets[0].items.map((it: any) => ({ product_id: it.product_id || null, quantity: it.qty || 1, unit_price: 0, total_price: 0, products: { name: it.product_name || null, code: it.product_code || null } }));
        }
        return { ...o, online_order_details: dets, sales: salesFallback };
      });
      let awaitingWithDetails = attachDetails(awaitingData || []);
      let dispatchedWithDetails = attachDetails(dispatchedData || []);

      // if some orders have no raw_item_name in details, try fetching sales+product names as a fallback
      const ordersMissingItems = [...awaitingWithDetails, ...dispatchedWithDetails].filter((o: any) => {
        const d = (o.online_order_details && o.online_order_details[0]);
        const hasRaw = (d && d.raw_item_name && d.raw_item_name.trim().length > 0);
        const hasSales = (o.sales && o.sales.length > 0);
        return !(hasRaw || hasSales);
      }).map((o: any) => o.id);

      if (ordersMissingItems.length > 0) {
        console.debug('Orders missing item details, attempting sales fallback for order ids:', ordersMissingItems);
        const { data: salesData, error: salesErr } = await supabase
          .from('sales')
          .select('order_id, quantity, products(name, code)')
          .in('order_id', ordersMissingItems as any[]);
        console.debug('Sales fallback result', { error: salesErr, count: (salesData || []).length });
        if (!salesErr && salesData) {
          const salesByOrderText: Record<string, string[]> = {};
          for (const s of salesData) {
            const key = s.order_id;
            salesByOrderText[key] = salesByOrderText[key] || [];
            salesByOrderText[key].push(`${(s.products && s.products.name) || 'Item'} x${s.quantity}`);
          }
          const fillFromSales = (orders: any[]) => orders.map(o => {
            if ((!o.online_order_details || o.online_order_details.length === 0 || !(o.online_order_details[0].raw_item_name && o.online_order_details[0].raw_item_name.trim().length > 0)) && salesByOrderText[o.id]) {
              const raw = salesByOrderText[o.id].join('\n');
              return { ...o, online_order_details: [{ ...(o.online_order_details && o.online_order_details[0] ? o.online_order_details[0] : {}), raw_item_name: raw }], sales: salesByOrder[o.id] || [] };
            }
            return { ...o, sales: salesByOrder[o.id] || [] };
          });
          awaitingWithDetails = fillFromSales(awaitingWithDetails);
          dispatchedWithDetails = fillFromSales(dispatchedWithDetails);
        }
      }

      const { data: totals, error: tErr } = await supabase
        .from('online_orders')
        .select('total_amount', { head: false });
      if (tErr) throw tErr;

      const sum = (totals || []).reduce((s: number, r: any) => s + (parseFloat(r.total_amount) || 0), 0);
      setTotalSales(sum);
      setTotalOrders(((awaitingWithDetails || []).length) + ((dispatchedWithDetails || []).length));
      setAwaiting(awaitingWithDetails || []);
      setDispatched(dispatchedWithDetails || []);
      // debug: show sample orders with attached details for troubleshooting missing fields
      console.log('OnlineOrdersAdminDashboard: sample awaiting with details', (awaitingWithDetails || []).slice(0,5));
      console.log('OnlineOrdersAdminDashboard: sample dispatched with details', (dispatchedWithDetails || []).slice(0,5));
    } catch (err: any) {
      console.error('Failed to load online orders', err);
      const msg = (err && (err.message || err.error || err.msg)) ? (err.message || err.error || err.msg) : String(err);
      showError(`Failed to load online orders: ${msg}`);
      setAwaiting([]);
      setDispatched([]);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => { if (!loading) fetchData(); }, [loading, fetchData]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(awaiting.map(o => o.id)); else setSelectedIds([]);
  };

  const handleView = async (order: any) => {
    try {
      console.log('OnlineOrdersAdminDashboard: viewOrder clicked', order);
      // try invoking edge function to get authoritative details for this order
      try {
        const { data: funcData, error: funcErr } = await supabase.functions.invoke('get-online-order-details', { body: { orderIds: [order.id] } });
        if (funcErr) console.warn('get-online-order-details error', funcErr);
        if (funcData && Array.isArray(funcData) && funcData.length > 0) {
          const d = funcData[0];
          // normalize into expected shapes
          order.online_order_details = [{
            order_id: d.order_id,
            client_name: d.client_name,
            platform_order_number: d.platform_order_number,
            raw_item_name: d.raw_item_name,
            mapped_product_id: d.mapped_product_id,
            items: d.items,
          }];
          if (d.items && Array.isArray(d.items) && d.items.length > 0) {
            order.sales = d.items.map((it: any) => ({ products: { name: it.product_name, code: it.product_code }, quantity: it.qty, unit_price: 0, total_price: 0 }));
          }
          console.log('get-online-order-details result for view', d);
        }
      } catch (e) {
        console.warn('Failed to invoke get-online-order-details for view', e);
      }

      console.log('online_order_details:', order?.online_order_details);
      console.log('sales:', order?.sales);
      let panel = document.getElementById('online-view-debug');
      const debugObj = { id: order?.id, order_number: order?.order_number, details: order?.online_order_details, sales: order?.sales };
      if (!panel) {
        panel = document.createElement('pre');
        panel.id = 'online-view-debug';
        panel.style.position = 'fixed';
        panel.style.left = '10px';
        panel.style.bottom = '10px';
        panel.style.maxWidth = '40%';
        panel.style.maxHeight = '40%';
        panel.style.overflow = 'auto';
        panel.style.background = 'rgba(0,0,0,0.85)';
        panel.style.color = '#fff';
        panel.style.padding = '8px';
        panel.style.zIndex = '99999';
        document.body.appendChild(panel);
      }
      panel.textContent = JSON.stringify(debugObj, null, 2);
    } catch (e) {
      console.warn('Could not render view debug panel', e);
    }
    setViewOrder(order);
    setIsViewOpen(true);
  };

  const handleOpenEdit = (order: any) => { setEditingOrder(order); setIsEditOpen(true); };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('online_orders').update({ bill_no: editingOrder.bill_no, total_amount: editingOrder.total_amount }).eq('id', editingOrder.id);
      if (error) throw error;
      showSuccess('Order updated.');
      setIsEditOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      showError('Failed to update order.');
    } finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this online order? This cannot be undone.')) return;
    setIsProcessing(true);
    try {
      // Try deleting the authoritative `orders` row first. If the DB doesn't have cascade
      // constraints yet, we'll also attempt to delete the mirror in `online_orders` below.
      let orderErr: any = null;
      try {
        const res = await supabase.from('orders').delete().eq('id', id);
        orderErr = res.error;
        if (!orderErr) console.debug('Deleted orders row (if existed)', { id });
      } catch (e) {
        orderErr = e;
      }

      // Always attempt to delete the mirror row to ensure UI delete removes the record
      let onlineErr: any = null;
      try {
        const res2 = await supabase.from('online_orders').delete().eq('id', id);
        onlineErr = res2.error;
        if (!onlineErr) console.debug('Deleted online_orders mirror row (if existed)', { id });
      } catch (e) {
        onlineErr = e;
      }

      if (orderErr && onlineErr) {
        // Both deletions failed
        console.error('Both orders and online_orders delete failed', { orderErr, onlineErr });
        throw orderErr || onlineErr;
      }

      showSuccess('Order deleted.');
      fetchData();
    } catch (err: any) {
      console.error('Failed to delete order', err);
      showError('Failed to delete order.');
    } finally { setIsProcessing(false); }
  };

  const handleBulkPrint = () => {
    if (selectedIds.length === 0) { showError('No orders selected.'); return; }
    const rows: any[] = [];
    const all = [...awaiting, ...dispatched];
      console.debug('OnlineOrdersAdminDashboard: bulk print selectedIds', selectedIds);
      // visible debug: create/update a small debug panel on the page so users without DevTools can see data
      try {
        const selectedOrders = selectedIds.map(id => all.find(x => x.id === id)).filter(Boolean);
        const sample = selectedOrders[0] || null;
        const debugObj = {
          selectedCount: selectedIds.length,
          sampleHasDetails: !!(sample && sample.online_order_details && sample.online_order_details.length > 0),
          sampleHasSales: !!(sample && sample.sales && sample.sales.length > 0),
          sampleDetails: sample ? (sample.online_order_details && sample.online_order_details[0]) : null,
          sampleSales: sample ? (sample.sales || []).slice(0,3) : null,
        };
        // show a toast + render a small visible panel
        showSuccess(`DEBUG: ${debugObj.selectedCount} selected — details:${debugObj.sampleHasDetails} sales:${debugObj.sampleHasSales}`);
        let panel = document.getElementById('online-bulk-debug');
        if (!panel) {
          panel = document.createElement('pre');
          panel.id = 'online-bulk-debug';
          panel.style.position = 'fixed';
          panel.style.right = '10px';
          panel.style.bottom = '10px';
          panel.style.maxWidth = '40%';
          panel.style.maxHeight = '40%';
          panel.style.overflow = 'auto';
          panel.style.background = 'rgba(0,0,0,0.8)';
          panel.style.color = '#fff';
          panel.style.padding = '8px';
          panel.style.zIndex = '99999';
          document.body.appendChild(panel);
        }
        panel.textContent = JSON.stringify(debugObj, null, 2);
      } catch (e) {
        console.warn('Could not render debug panel', e);
      }
    for (const id of selectedIds) {
      const o = all.find(x => x.id === id);
      console.debug('OnlineOrdersAdminDashboard: building row for order', { id, order: o });
      if (!o) continue;
      const details = (o.online_order_details && o.online_order_details[0]) || {};
        console.debug('OnlineOrdersAdminDashboard: attached details for order', { id, details });
        if (o.sales && o.sales.length > 0) {
        for (const s of o.sales) {
          const prodName = (s.products && s.products.name) || s.product_name || '-';
            const prodCode = (s.products && (s.products.code || s.products.product_code)) || s.product_code || '-';
          const qty = s.quantity != null ? String(s.quantity) : '-';
          rows.push([
            o.order_number || '-',
            o.dispatch_number || '-',
            o.bill_no || '-',
            details.client_name || '-',
            prodName,
            prodCode,
            qty,
          ]);
        }
      } else {
          // fallback: parse raw_item_name into one or more product lines with qty when possible
          const raw = (details.raw_item_name || '').replace(/\r/g, '').trim();
          if (raw && raw.length > 0) {
            const parts = raw.split(/\n+/).map(p => p.trim()).filter(Boolean);
            for (const part of parts) {
              // try to extract qty (e.g., 'Product Name x2' or 'Qty: 2')
              let qty = '-';
              const m = part.match(/(?:\bqty[:\s]*|\bx|×)\s*(\d+)/i);
              if (m && m[1]) qty = m[1];
              // remove currency and qty hints from product text
              const prod = part.replace(/₹?\s?\d+[.,]?\d*/g, '').replace(/(?:\bqty[:\s]*|\bx|×)\s*\d+/i, '').trim() || '-';
              rows.push([
                o.order_number || '-',
                o.dispatch_number || '-',
                o.bill_no || '-',
                details.client_name || '-',
                prod,
                '-',
                qty,
              ]);
            }
          } else {
            rows.push([
              o.order_number || '-',
              o.dispatch_number || '-',
              o.bill_no || '-',
              details.client_name || '-',
              '-',
              '-',
              '-',
            ]);
          }
      }
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [['Order No', 'Gatepass No', 'Invoice No', 'Client Name', 'Product', 'Product Code', 'Qty']],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30,58,138], textColor: [255,255,255] }
    });
    doc.save('online_orders_bulk_print.pdf');
    showSuccess('PDF generated');
  };

  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-6 bg-background text-foreground">
      <div className="flex gap-6">
        <aside className="w-64 bg-white/80 p-4 rounded shadow-sm">
          <h2 className="font-semibold mb-3">Extractors</h2>
          <div className="flex flex-col gap-2">
            <Button variant="ghost" onClick={() => navigate('/flipkart-extractor')} className="justify-start"><FileSearch className="h-4 w-4 mr-2"/>Flipkart</Button>
            <Button variant="ghost" onClick={() => navigate('/amazon-extractor')} className="justify-start"><FileSearch className="h-4 w-4 mr-2"/>Amazon</Button>
            <Button variant="ghost" onClick={() => navigate('/meesho-extractor')} className="justify-start"><FileSearch className="h-4 w-4 mr-2"/>Meesho</Button>
            <Button variant="ghost" onClick={() => navigate('/spartan-extractor')} className="justify-start"><FileSearch className="h-4 w-4 mr-2"/>Spartan Website</Button>
            <div className="border-t my-3" />
            <Button onClick={() => window.open('/flipkart-extractor', '_blank')} className="justify-start">Open Flipkart Extractor (new tab)</Button>
            <Button onClick={() => {
              if (selectedIds.length === 0) { showError('No orders selected'); return; }
              const q = encodeURIComponent(selectedIds.join(','));
              window.open(`/flipkart-extractor?ids=${q}`, '_blank');
            }} disabled={selectedIds.length === 0} className="justify-start">Send Selected to Extractor</Button>
          </div>
        </aside>

        <main className="flex-1">
          <h1 className="text-2xl font-bold mb-4">Online Orders — Admin (Awaiting Dispatch & Dispatched)</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="bg-blue-500 text-white"><CardTitle>Total Sales</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">₹{totalSales.toFixed(2)}</div><CardDescription>Total sales amount (online orders)</CardDescription></CardContent>
            </Card>
            <Card>
              <CardHeader className="bg-green-500 text-white"><CardTitle>Total Orders</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalOrders}</div><CardDescription>Awaiting + Dispatched</CardDescription></CardContent>
            </Card>
            <Card>
              <CardHeader className="bg-yellow-500 text-white"><CardTitle>Awaiting Dispatch</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{awaiting.length}</div><CardDescription>Orders ready to dispatch</CardDescription></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Orders Awaiting Dispatch</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
                  <Input placeholder="Search order, bill or client" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="flex-1" />
                  <Button onClick={() => fetchData()}>Filter</Button>
                  <Button onClick={() => { setFromDate(''); setToDate(''); setSearchText(''); fetchData(); }}>Clear</Button>
                </div>

                <div className="mb-2 flex items-center gap-2">
                  <input type="checkbox" onChange={(e) => handleSelectAll(e.target.checked)} checked={selectedIds.length === awaiting.length && awaiting.length > 0} />
                  <Label> Select All</Label>
                  <Button onClick={handleBulkPrint} disabled={selectedIds.length === 0} className="ml-4"><Printer className="h-4 w-4 mr-2"/> Print Selected</Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Button onClick={() => window.open('/flipkart-extractor', '_blank')}>Open Extractor</Button>
                    <Button onClick={() => fetchData()}>Refresh</Button>
                    <Button onClick={() => {
                      if (selectedIds.length === 0) { showError('No orders selected'); return; }
                      const q = encodeURIComponent(selectedIds.join(','));
                      window.open(`/flipkart-extractor?ids=${q}`, '_blank');
                    }} disabled={selectedIds.length === 0}>
                      Send Selected to Extractor
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Order No.</TableHead>
                      <TableHead>Bill No.</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {awaiting.filter(o => {
                      if (fromDate && new Date(o.order_date) < new Date(fromDate)) return false;
                      if (toDate && new Date(o.order_date) > new Date(toDate + 'T23:59:59')) return false;
                      if (!searchText) return true;
                      const det = (o.online_order_details && o.online_order_details[0]) || {};
                      const hay = `${o.order_number} ${o.bill_no || ''} ${det.client_name || ''} ${(det.raw_item_name || '').replace(/\n/g,' ')}`.toLowerCase();
                      return hay.includes(searchText.toLowerCase());
                    }).map(o => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={(e) => toggleSelect(o.id, e.target.checked)} />
                        </TableCell>
                        <TableCell>{o.order_number}</TableCell>
                        <TableCell>{o.bill_no || '-'}</TableCell>
                        <TableCell>₹{parseFloat(o.total_amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => handleView(o)} title="View"><Eye className="h-4 w-4"/></Button>
                            <Button variant="ghost" onClick={() => handleOpenEdit(o)} title="Edit"><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" onClick={() => handleDelete(o.id)} title="Delete"><Trash2 className="h-4 w-4 text-red-600"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dispatched Orders</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order No.</TableHead>
                      <TableHead>Dispatch No.</TableHead>
                      <TableHead>Dispatch Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatched.filter(o => {
                      if (fromDate && new Date(o.dispatch_date) < new Date(fromDate)) return false;
                      if (toDate && new Date(o.dispatch_date) > new Date(toDate + 'T23:59:59')) return false;
                      if (!searchText) return true;
                      const det = (o.online_order_details && o.online_order_details[0]) || {};
                      const hay = `${o.order_number} ${o.dispatch_number || ''} ${o.bill_no || ''} ${det.client_name || ''}`.toLowerCase();
                      return hay.includes(searchText.toLowerCase());
                    }).map(o => (
                      <TableRow key={o.id}>
                        <TableCell>{o.order_number}</TableCell>
                        <TableCell>{o.dispatch_number}</TableCell>
                        <TableCell>{o.dispatch_date ? new Date(o.dispatch_date).toLocaleString() : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => handleView(o)} title="View"><Eye className="h-4 w-4"/></Button>
                            <Button variant="ghost" onClick={() => handleOpenEdit(o)} title="Edit"><Edit className="h-4 w-4"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View online order details.</DialogDescription>
          </DialogHeader>
          <div className="p-4">
            {viewOrder ? (
              <div>
                <p><strong>Order No:</strong> {viewOrder.order_number}</p>
                <p><strong>Gatepass:</strong> {viewOrder.dispatch_number}</p>
                <p><strong>Bill No:</strong> {viewOrder.bill_no}</p>
                <p><strong>Amount:</strong> ₹{parseFloat(viewOrder.total_amount || 0).toFixed(2)}</p>
                <p><strong>Details:</strong></p>
                {viewOrder && viewOrder.sales && viewOrder.sales.length > 0 ? (
                  <div>
                    <table className="w-full text-sm mb-3">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left px-2 py-1">Product</th>
                          <th className="text-right px-2 py-1">Qty</th>
                          <th className="text-right px-2 py-1">Unit</th>
                          <th className="text-right px-2 py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewOrder.sales.map((s: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="px-2 py-1">{(s.products && s.products.name) || '-'}</td>
                            <td className="px-2 py-1 text-right">{s.quantity}</td>
                            <td className="px-2 py-1 text-right">₹{parseFloat(s.unit_price || 0).toFixed(2)}</td>
                            <td className="px-2 py-1 text-right">₹{parseFloat(s.total_price || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-right font-semibold">
                      <div>Subtotal: ₹{(viewOrder.sales.reduce((acc: number, r: any) => acc + (parseFloat(r.total_price || 0)), 0)).toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  <pre className="text-sm bg-slate-50 p-2 rounded">{(viewOrder.online_order_details && viewOrder.online_order_details[0] && viewOrder.online_order_details[0].raw_item_name) || '-'}</pre>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Online Order</DialogTitle>
            <DialogDescription>Modify bill number and total amount.</DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <Label>Bill No</Label>
            <Input value={editingOrder?.bill_no || ''} onChange={(e) => setEditingOrder(prev => prev ? { ...prev, bill_no: e.target.value } : prev)} />
            <Label>Total Amount</Label>
            <Input type="number" value={editingOrder?.total_amount || 0} onChange={(e) => setEditingOrder(prev => prev ? { ...prev, total_amount: parseFloat(e.target.value || '0') } : prev)} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setIsEditOpen(false)} variant="outline">Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isProcessing}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnlineOrdersAdminDashboard;
