"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Trash2, Package, User, Play } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface StagedOrder {
  id: string;
  platform_order_number: string;
  customer_name: string;
  shipping_address: string;
  flipkart_item_name: string;
  amount: number;
  status: string;
  bill_no?: string | null;
}

interface Product {
  id: string;
  name: string;
  code?: string;
  size?: string | number | null;
  dp?: number;
  gst?: string | number;
}

const ProcessOnlineOrders: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useSession() as any;

  const [loading, setLoading] = useState(true);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<'COD' | 'Prepaid'>('COD');

  const [matchedMap, setMatchedMap] = useState<Record<string, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});
  const [selectedStagedIds, setSelectedStagedIds] = useState<string[]>([]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all products with pagination
      const allProducts: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, code, size, dp, gst')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allProducts.push(...data);
        }
        if (!data || data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      const [platformsRes, stagedRes] = await Promise.all([
        supabase.from('online_platforms').select('*').order('name'),
        supabase.from('online_order_staging').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      if (platformsRes.error) throw platformsRes.error;
      if (stagedRes.error) throw stagedRes.error;

      setProducts(allProducts);
      setPlatforms(platformsRes.data || []);
      setStagedOrders((stagedRes.data || []).map((s: any) => ({
        id: s.id,
        platform_order_number: s.platform_order_number || s.order_number || '—',
        customer_name: s.customer_name || '',
        shipping_address: s.shipping_address || '',
        flipkart_item_name: s.item_name || s.raw_item_name || s.flipkart_item_name || '',
        amount: Number(s.amount || s.total_amount || 0),
        status: s.status || 'pending',
        bill_no: s.bill_no || null,
      })));
    } catch (error: any) {
      console.error('Failed to load data', error);
      showError('Failed to load staging data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Matching heuristics: build matchedMap when products or stagedOrders change
  useEffect(() => {
    if (!products || products.length === 0 || stagedOrders.length === 0) return;
    const map: Record<string, { matches: Product[]; selectedId?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }> = {};
    const sizeRegex = /Size[:\s]*([0-9]+)/i;

    const extractNumericToken = (str: string | undefined) => {
      if (!str) return undefined;
      const nums = str.match(/\d{2,}/g);
      if (!nums || nums.length === 0) return undefined;
      return nums.sort((a, b) => b.length - a.length)[0];
    };

    const normalize = (s: string | undefined) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const enriched = products.map(p => ({
      ...p,
      normCode: normalize(p.code as any),
      normName: (p.name || '').toLowerCase(),
      numericParts: (p.code || '').toString().match(/\d{2,}/g) || []
    } as any));

    for (const s of stagedOrders) {
      const text = s.flipkart_item_name || '';
      const sizeMatch = text.match(sizeRegex);
      const size = sizeMatch ? sizeMatch[1] : undefined;

      const numericToken = extractNumericToken(text);
      const normText = normalize(text);

      let candidates = enriched.filter((p: any) => {
        if (!p.code && !p.name) return false;

        if (p.normCode && normText.includes(p.normCode)) return true;

        if (numericToken) {
          if (p.numericParts.some((np: string) => np.includes(numericToken) || numericToken.includes(np))) return true;
          if ((p.normCode || '').includes(numericToken)) return true;
        }

        if (p.normName && normText.includes(p.normName.substring(0, Math.min(12, p.normName.length)))) return true;

        const textTokens = normText.split(/\s+/).filter((t: string) => t.length > 2);
        const productTokens = (p.normName || '').split(/\s+/).filter((t: string) => t.length > 2);
        if (textTokens.length > 0 && productTokens.length > 0) {
          const intersect = textTokens.filter((t: string) => productTokens.includes(t));
          if (intersect.length >= 2) return true;
          if (intersect.length >= 1 && textTokens.includes('spartan')) return true;
        }

        return false;
      });

      if (size) {
        const sizeFiltered = candidates.filter((p: any) => (p.size || '').toString() === size.toString() || (p.name || '').toLowerCase().includes(`size: ${size}`));
        if (sizeFiltered.length > 0) candidates = sizeFiltered;
      }

      const candidateProducts: Product[] = candidates.map((c: any) => ({ id: c.id, name: c.name, code: c.code, size: c.size }));

      map[s.id] = {
        matches: candidateProducts,
        selectedId: candidateProducts.length === 1 ? candidateProducts[0].id : undefined,
        debug: {
          numericToken,
          normText,
          candidateCodes: candidateProducts.map(cp => (cp.code || '').toString())
        }
      };
    }

    setMatchedMap(map);
  }, [products, stagedOrders]);

  // helper to escape regex
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // highlight matching substring (case-insensitive)
  function highlightMatch(text: string | undefined, query: string | undefined) {
    const t = text || '';
    const q = (query || '').trim();
    if (!q) return t;
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return t;
    const before = t.slice(0, idx);
    const match = t.slice(idx, idx + q.length);
    const after = t.slice(idx + q.length);
    return (
      <span>
        {before}
        <span className="font-semibold text-primary">{match}</span>
        {after}
      </span>
    );
  }

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchInitialData();
  }, [isAdmin, navigate, fetchInitialData]);

  const handleBulkProcess = async () => {
    if (stagedOrders.length === 0) return;
    if (!selectedPlatformId) {
      showError("Please select an online platform.");
      return;
    }
    if (!user) return;

    setIsProcessingBulk(true);
    let successCount = 0;

    try {
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Online Order')
        .single();
      
      if (dealerError) throw new Error("Could not find 'Online Order' dealer. Please create one first.");

      const paymentStatus = bulkPaymentMethod === 'COD' ? 'pending' : 'paid';

      for (const stagedOrder of stagedOrders) {
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            dealer_id: dealerData.id,
            user_id: user.id,
            total_amount: stagedOrder.amount,
            status: 'completed',
            payment_status: paymentStatus,
            order_date: new Date().toISOString(),
            bill_no: stagedOrder.bill_no || null,
          })
          .select('id')
          .single();

        if (orderError) {
          console.error(`Error creating order for ${stagedOrder.platform_order_number}:`, orderError);
          continue;
        }

        const selectedProductId = (matchedMap[stagedOrder.id] && matchedMap[stagedOrder.id].selectedId) ? matchedMap[stagedOrder.id].selectedId : null;
        const { error: onlineError } = await supabase
          .from('online_order_details')
          .insert({
            order_id: newOrder.id,
            client_name: stagedOrder.customer_name,
            platform_id: selectedPlatformId,
            platform_order_number: stagedOrder.platform_order_number,
            address: stagedOrder.shipping_address,
            raw_item_name: stagedOrder.flipkart_item_name,
            mapped_product_id: selectedProductId,
          });

        if (onlineError) {
          console.error(`Error creating details for ${stagedOrder.platform_order_number}:`, onlineError);
          continue;
        }

        await supabase
          .from('online_order_staging')
          .update({ status: 'processed' })
          .eq('id', stagedOrder.id);

        successCount++;
      }

      showSuccess(`Successfully created ${successCount} orders. You can now map products and add bill numbers in the Dispatch section.`);
      fetchInitialData();
    } catch (error: any) {
      console.error("Bulk Processing Error:", error);
      showError(`Failed to process orders: ${error.message}`);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleCreateGatepassesForSelected = async () => {
    if (selectedStagedIds.length === 0) {
      showError('No staged orders selected.');
      return;
    }

    setIsProcessingBulk(true);
    let successCount = 0;
    try {
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Online Order')
        .single();
      if (dealerError) throw dealerError;

      const paymentStatus = bulkPaymentMethod === 'COD' ? 'pending' : 'paid';

      for (const stagedId of selectedStagedIds) {
        const staged = stagedOrders.find(s => s.id === stagedId);
        if (!staged) continue;

        let nextDispatchNumber = 1;
        try {
          const { data: lastRow } = await supabase
            .from('orders')
            .select('dispatch_number')
            .not('dispatch_number', 'is', null)
            .order('dispatch_number', { ascending: false })
            .limit(1)
            .single();
          if (lastRow && lastRow.dispatch_number) nextDispatchNumber = (Number(lastRow.dispatch_number) || 0) + 1;
        } catch (e) {
          // ignore and fallback to 1
        }

        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            dealer_id: dealerData.id,
            user_id: user?.id,
            total_amount: staged.amount,
            status: 'completed',
            payment_status: paymentStatus,
            order_date: new Date().toISOString(),
            dispatched: true,
            dispatch_date: new Date().toISOString(),
            dispatch_number: nextDispatchNumber,
            bill_no: staged.bill_no || null
          })
          .select('id')
          .single();

        if (orderError) {
          console.error('Order create error', orderError);
          continue;
        }

        const selectedProductId = (matchedMap[staged.id] && matchedMap[staged.id].selectedId) ? matchedMap[staged.id].selectedId : null;
        const { error: detailsError } = await supabase.from('online_order_details').insert({
          order_id: newOrder.id,
          client_name: staged.customer_name,
          platform_id: selectedPlatformId,
          platform_order_number: staged.platform_order_number,
          address: staged.shipping_address,
          raw_item_name: staged.flipkart_item_name,
          mapped_product_id: selectedProductId,
        });

        if (detailsError) {
          console.error('Details insert error', detailsError);
        }

        const product = products.find(p => p.id === selectedProductId);
        let gstPercent = 0;
        if (product) {
          gstPercent = parseFloat((product as any).gst) || 0;
          if (gstPercent > 0 && gstPercent <= 1) gstPercent = gstPercent * 100;
        }

        const { error: salesError } = await supabase.from('sales').insert({
          order_id: newOrder.id,
          product_id: product?.id || null,
          quantity: 1,
          unit_price: gstPercent > 0 ? staged.amount / (1 + gstPercent / 100) : staged.amount,
          gst_percent: gstPercent,
          total_price: staged.amount,
        });

        if (salesError) console.error('Sales insert error', salesError);

        await supabase.from('online_order_staging').update({ status: 'processed' }).eq('id', staged.id);

        successCount++;
      }

      showSuccess(`Created gatepasses for ${successCount} staged order(s).`);
      setSelectedStagedIds([]);
      fetchInitialData();
    } catch (error: any) {
      console.error('Gatepass creation error', error);
      showError(error.message || 'Failed to create gatepasses.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleDeleteStaged = async (id: string) => {
    try {
      const { error } = await supabase.from('online_order_staging').delete().eq('id', id);
      if (error) throw error;
      setStagedOrders(prev => prev.filter(o => o.id !== id));
      showSuccess("Staged order removed.");
    } catch (error: any) {
      showError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full">
        <Button variant="outline" onClick={() => navigate('/flipkart-extractor')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Extractor
        </Button>

        <Card className="mb-6 w-full">
          <CardHeader className="bg-indigo-600 text-white rounded-t-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">Process Staged Online Orders</CardTitle>
                <CardDescription className="text-indigo-100">
                  Bulk create orders from extracted data. Mapping to actual products happens during dispatch.
                </CardDescription>
              </div>
              <div className="flex items-end gap-4">
                <div className="w-48">
                  <Label className="text-white mb-1 block text-xs">Target Platform</Label>
                  <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId as any}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Label className="text-white mb-1 block text-xs">Payment Method</Label>
                  <Select value={bulkPaymentMethod} onValueChange={(value) => setBulkPaymentMethod(value as 'COD' | 'Prepaid')}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                      <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleBulkProcess} 
                    disabled={isProcessingBulk || stagedOrders.length === 0}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Bulk Create {stagedOrders.length} Orders
                  </Button>
                  <Button
                    onClick={handleCreateGatepassesForSelected}
                    disabled={isProcessingBulk || selectedStagedIds.length === 0 || !selectedStagedIds.every(id => (stagedOrders.find(s => s.id === id)?.bill_no || '').trim() !== '')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create Gatepasses for Selected
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStagedIds.length === stagedOrders.length && stagedOrders.length > 0}
                        onCheckedChange={(checked) => setSelectedStagedIds(!!checked ? stagedOrders.map(s => s.id) : [])}
                      />
                    </TableHead>
                    <TableHead className="w-[150px]">Order No.</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Customer Details</TableHead>
                    <TableHead>Extracted Item Name (Dummy)</TableHead>
                    <TableHead>Match Debug</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {stagedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No pending staged orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stagedOrders.map((order) => (
                      <TableRow key={order.id} className={"hover:bg-muted/30 " + (selectedStagedIds.includes(order.id) ? 'bg-muted/10' : '')}>
                        <TableCell>
                          <Checkbox checked={selectedStagedIds.includes(order.id)} onCheckedChange={(checked) => setSelectedStagedIds(prev => !!checked ? [...prev, order.id] : prev.filter(id => id !== order.id))} />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-blue-600">{order.platform_order_number}</TableCell>
                        <TableCell className="text-xs">{order.bill_no || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {matchedMap[order.id]?.selectedId ? (
                            <div className="flex items-center justify-between gap-2">
                              {(() => {
                                const sel = products.find(p => p.id === matchedMap[order.id].selectedId);
                                if (!sel) return <span>Selected</span>;
                                return (
                                  <div className="text-left">
                                    <div className="font-medium">{sel.name}</div>
                                    <div className="text-[11px] text-muted-foreground">{sel.code} {sel.size ? `| Size: ${sel.size}` : ''} {typeof sel.dp !== 'undefined' ? `| DP: ₹${sel.dp}` : ''}</div>
                                    <div className="text-[11px] truncate max-w-[220px]">{sel.name}</div>
                                  </div>
                                );
                              })()}
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                const selId = matchedMap[order.id]?.selectedId;
                                const selProd = products.find(p => p.id === selId);
                                setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: undefined } }));
                                if (selProd) {
                                  setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: s.flipkart_item_name.replace(new RegExp(`\\s*—\\s*${escapeRegExp(selProd.name)}$`), '') } : s));
                                }
                              }} title="Remove product"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full text-left h-auto py-1">
                                  {matchedMap[order.id]?.matches.length ? `Select (${matchedMap[order.id].matches.length})` : 'No matches'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[340px] p-0">
                                <div className="p-2 border-b">
                                  <Input
                                    placeholder="Search..."
                                    className="h-7 text-xs"
                                    value={matchedMap[order.id]?.search || ''}
                                    onChange={(e) => setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], search: e.target.value } }))}
                                  />
                                </div>
                                <ScrollArea className="h-[300px]">
                                  {matchedMap[order.id]?.matches.length ? (
                                    matchedMap[order.id].matches
                                      .filter(p => {
                                        const q = (matchedMap[order.id]?.search || '').toLowerCase();
                                        if (!q) return true;
                                        return (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                                      })
                                      .map(p => (
                                      <Button key={`cand-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={() => {
                                        setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: p.id } }));
                                        setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: `${s.flipkart_item_name} — ${p.name}` } : s));
                                      }}>
                                        <div className="text-left w-full">
                                          <div className="font-medium text-sm">{highlightMatch(p.name, matchedMap[order.id]?.search)}</div>
                                          <div className="text-[11px] text-muted-foreground">{highlightMatch(p.code || '', matchedMap[order.id]?.search)} {p.size ? `| Size: ${p.size}` : ''} {typeof (p as any).dp !== 'undefined' ? `| DP: ₹${(p as any).dp}` : ''}</div>
                                        </div>
                                      </Button>
                                    ))
                                  ) : null}
                                  <div className="h-px bg-muted/30 my-2" />
                                  {products
                                    .filter(p => {
                                      const q = (matchedMap[order.id]?.search || '').toLowerCase();
                                      if (!q) return true;
                                      return (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                                    })
                                    .map(p => (
                                    <Button key={`all-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={() => {
                                      setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: p.id } }));
                                      setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: `${s.flipkart_item_name} — ${p.name}` } : s));
                                    }}>
                                      <div className="text-left w-full">
                                        <div className="font-medium text-sm">{highlightMatch(p.name, matchedMap[order.id]?.search)}</div>
                                        <div className="text-[11px] text-muted-foreground">{highlightMatch(p.code || '', matchedMap[order.id]?.search)} {p.size ? `| Size: ${p.size}` : ''} {typeof (p as any).dp !== 'undefined' ? `| DP: ₹${(p as any).dp}` : ''}</div>
                                      </div>
                                    </Button>
                                  ))}
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium flex items-center gap-1"><User className="h-3 w-3" /> {order.customer_name}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{order.shipping_address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                              {(() => {
                                const txt = order.flipkart_item_name || '';
                                const parts = txt.split('—');
                                const base = parts[0] ? parts[0].trim() : txt;
                                const appended = parts.length > 1 ? parts.slice(1).join('—').trim() : null;
                                return (
                                  <>
                                    <span className="truncate max-w-[380px]">{base}</span>
                                    {appended && (
                                      <span className="ml-2 px-2 py-0.5 rounded bg-muted/20 text-[12px] text-muted-foreground">{appended}</span>
                                    )}
                                    {(() => {
                                      const matchedSelectionId = matchedMap[order.id]?.selectedId;
                                      const foundProd = appended ? products.find(p => (p.name || '') === appended || (p.name || '').includes(appended)) : undefined;
                                      const shouldShowDelete = !!matchedSelectionId || !!appended;
                                      if (!shouldShowDelete) return null;
                                      return (
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                          const selId = matchedSelectionId || foundProd?.id;
                                          const selProd = products.find(p => p.id === selId) || foundProd;
                                          setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: undefined } }));
                                          if (selProd) {
                                            setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: s.flipkart_item_name.replace(new RegExp(`\\s*—\\s*${escapeRegExp(selProd.name)}$`), '') } : s));
                                          } else if (appended) {
                                            setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: s.flipkart_item_name.replace(new RegExp(`\\s*—\\s*${escapeRegExp(appended)}$`), '') } : s));
                                          }
                                        }} title="Remove appended product"><Trash2 className="h-4 w-4" /></Button>
                                      );
                                    })()}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="text-[11px] text-muted-foreground">
                            <div>token: {matchedMap[order.id]?.debug?.numericToken || '—'}</div>
                            <div>codes: {matchedMap[order.id]?.debug?.candidateCodes?.join(', ') || '—'}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">₹{order.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteStaged(order.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ProcessOnlineOrders;
