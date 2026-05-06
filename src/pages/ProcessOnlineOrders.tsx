"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Play, Trash2, Copy, User, Package } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface StagedOrder {
  id: string;
  platform_order_number: string;
  customer_name: string;
  shipping_address: string;
  flipkart_item_name: string;
  amount: number;
  quantity?: number;
  status: string;
  bill_no?: string | null;
  mapped_product_id?: string | null;
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
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | undefined>(undefined);
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<'COD' | 'Prepaid'>('COD');

  const [matchedMap, setMatchedMap] = useState<Record<string, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});
  const [selectedStagedIds, setSelectedStagedIds] = useState<string[]>([]);
  const [unmappedIds, setUnmappedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  
  const handleApplyProductToMatching = async (sourceId: string) => {
    const src = stagedOrders.find(s => s.id === sourceId);
    const selId = matchedMap[sourceId]?.selectedId;
    if (!src || !selId) return;
    const baseText = src.flipkart_item_name.split('—')[0].trim();
    const prod = products.find(p => p.id === selId);
    const suffix = prod ? ` — ${prod.name}` : '';

    const toUpdate = stagedOrders.filter(s => {
      const txt = s.flipkart_item_name.split('—')[0].trim();
      return txt === baseText && s.id !== sourceId;
    });

    if (toUpdate.length === 0) {
      showError('No other orders with same extracted name found.');
      return;
    }

    setMatchedMap(prev => {
      const next = { ...prev };
      toUpdate.forEach(s => {
        if (!next[s.id]) next[s.id] = { matches: [] } as any;
        next[s.id].selectedId = selId;
      });
      return next;
    });

    setStagedOrders(prev => prev.map(s => {
      if (toUpdate.find(u => u.id === s.id)) {
        if (!s.flipkart_item_name.includes(suffix)) {
          return { ...s, flipkart_item_name: s.flipkart_item_name + suffix };
        }
      }
      return s;
    }));

    try {
      for (const s of toUpdate) {
        await supabase
          .from('online_order_staging')
          .update({ flipkart_item_name: s.flipkart_item_name + suffix })
          .eq('id', s.id);
      }
      showSuccess(`Mapped ${toUpdate.length} matching order(s).`);
    } catch (e) {
      console.error('Apply matching error', e);
      showError('Failed to map matching orders.');
    }
  };

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
        quantity: s.quantity || 1,
        status: s.status || 'pending',
        bill_no: s.bill_no || null,
        mapped_product_id: s.mapped_product_id || null,
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

    // preserve any manually chosen selections when recomputing the map
    const prevSelected: Record<string, string | undefined> = {};
    Object.keys(matchedMap).forEach(k => {
      if (matchedMap[k].selectedId) prevSelected[k] = matchedMap[k].selectedId;
    });

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

    const map: Record<string, { matches: Product[]; selectedId?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }> = {};

    for (const s of stagedOrders) {
      const text = s.flipkart_item_name || '';
      const sizeMatch = text.match(sizeRegex);
      const size = sizeMatch ? sizeMatch[1] : undefined;

      const numericToken = extractNumericToken(text);
      const normText = normalize(text);

      const candidateProducts = enriched.filter((p: any) => {
        if (!p.code && !p.name) return false;
        if (p.normCode && normText.includes(p.normCode)) return true;
        if (p.normName && normText.includes(p.normName)) return true;
        if (size && p.size && String(p.size) === String(size)) return true;
        if (numericToken && p.numericParts && p.numericParts.includes(numericToken)) return true;
        return false;
      });

      let selectedId: string | undefined = prevSelected[s.id];
      if (!selectedId && candidateProducts.length === 1) selectedId = candidateProducts[0].id;

      map[s.id] = {
        matches: candidateProducts as any,
        selectedId,
        debug: {
          numericToken,
          normText,
          candidateCodes: candidateProducts.map((cp: any) => (cp.code || '').toString())
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

  // Attempt to extract product name and SKU from raw extracted text when
  // no mapped product exists. This is a lightweight heuristic for cases like
  // "SUPER VOLLEY LEATHER - 3 VB 502A-1 950699 ..."
  function extractNameSku(text: string | undefined): { name?: string; sku?: string } | null {
    if (!text) return null;
    const t = text.replace(/\s+/g, ' ').trim();
    // Try to find an SKU-like token: letters, optional space, digits and optional suffix with hyphen
    const skuRegex = /\b([A-Z]{1,}[A-Z0-9\s]*\d[A-Z0-9\-]*)\b/; // e.g. VB 502A-1
    const m = t.match(skuRegex);
    if (m && m.index !== undefined) {
      const sku = m[1].trim();
      // product name is text before the SKU token
      let name = t.slice(0, m.index).trim();
      // remove trailing separators or quantity markers
      name = name.replace(/[-–—\|,:\s]+$/g, '').trim();
      // strip common column headings accidentally captured
      name = name.replace(/(HSN|Quantity|Unit Price|TAX|CGST|SGST|TOTAL).*$/i, '').trim();
      return { name: name || undefined, sku: sku || undefined };
    }
    return null;
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

    const displaySeq = Date.now();

    // warn if some orders have no mapped product; they will still be created but
    // without a mapping. this gives the user a heads-up so they can choose to map
    // before running the action next time.
    const unmappedCount = stagedOrders.filter(s => !matchedMap[s.id]?.selectedId).length;
    if (unmappedCount > 0) {
      showError(`${unmappedCount} staged order(s) have no product mapped.`);
    }

    try {
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Online Order')
        .single();
      
      if (dealerError) throw new Error("Could not find 'Online Order' dealer. Please create one first.");

      const paymentStatus = bulkPaymentMethod === 'COD' ? 'pending' : 'paid';
      const displaySeq = Date.now();

      // group rows by order number so we create a single order per platform_order_number
      const groups: Record<string, StagedOrder[]> = {};
      stagedOrders.forEach(s => {
        const key = s.platform_order_number;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });

      for (const orderNo of Object.keys(groups)) {
        const rows = groups[orderNo];
        const totalAmt = rows.reduce((sum, r) => sum + r.amount, 0);
        const first = rows[0];

        // Create only an `online_orders` row (do NOT create a normal `orders` row)
        const onlinePayload: any = {
          order_number: `${selectedPlatformId || 'PL'}-${displaySeq || Date.now()}`,
          order_sequence: null,
          dealer_id: dealerData.id,
          user_id: user.id,
          total_amount: totalAmt,
          status: 'completed',
          payment_status: paymentStatus,
          order_date: new Date().toISOString(),
          dispatched: false,
          dispatch_date: null,
          bill_no: first.bill_no || null,
        };

        const { data: newOnlineOrder, error: onlineErr } = await supabase
          .from('online_orders')
          .insert(onlinePayload)
          .select('id')
          .single();

        if (onlineErr || !newOnlineOrder) {
          console.error(`Error creating online_order for ${orderNo}:`, onlineErr);
          continue;
        }

        // prepare a combined raw_item_name string for the group and collect ids
        const combinedNames: string[] = [];
        rows.forEach(stagedOrder => {
          let rawName = stagedOrder.flipkart_item_name || '';
          // Prefer persisted mapped_product_id from staging (set by extractor), else use local matchedMap
          const selectedProductId = stagedOrder.mapped_product_id || matchedMap[stagedOrder.id]?.selectedId || null;
          if (selectedProductId) {
            const selProd = products.find(p => p.id === selectedProductId);
            if (selProd) {
              const suffix = ` — ${selProd.name}`;
              if (!rawName.includes(suffix)) rawName = rawName + suffix;
            }
          }
          combinedNames.push(rawName);
        });
        const combinedRawName = combinedNames.join('\n');

        // insert details once for the whole order (reference online_orders)
        if (newOnlineOrder) {
          // determine mapped product for the group: prefer any persisted mapping from the rows
          const groupMappedProductId = rows.find(r => r.mapped_product_id)?.mapped_product_id || matchedMap[rows[0].id]?.selectedId || null;
          const { error: onlineError } = await supabase
            .from('online_order_details')
            .insert({
              order_id: newOnlineOrder.id,
              client_name: first.customer_name,
              platform_id: selectedPlatformId,
              platform_order_number: first.platform_order_number,
              address: first.shipping_address,
              raw_item_name: combinedRawName,
              mapped_product_id: groupMappedProductId,
            });
          if (onlineError) {
            console.error(`Error creating details for ${first.platform_order_number}:`, onlineError);
          }
        }

        for (const stagedOrder of rows) {
          // Prefer persisted mapped_product_id from staging (set by extractor), fall back to matchedMap
          const selectedProductId = stagedOrder.mapped_product_id || matchedMap[stagedOrder.id]?.selectedId || null;
          let rawName = stagedOrder.flipkart_item_name || '';
          if (selectedProductId) {
            const selProd = products.find(p => p.id === selectedProductId);
            if (selProd) {
              const suffix = ` — ${selProd.name}`;
              if (!rawName.includes(suffix)) rawName = rawName + suffix;
            }
          }

          if (rawName !== stagedOrder.flipkart_item_name) {
            await supabase
              .from('online_order_staging')
              .update({ flipkart_item_name: rawName })
              .eq('id', stagedOrder.id);
          }

          // insert a sales line for each staged row
          const product = products.find(p => p.id === selectedProductId);
          let gstPercent = 0;
          if (product) {
            gstPercent = parseFloat((product as any).gst) || 0;
            if (gstPercent > 0 && gstPercent <= 1) gstPercent = gstPercent * 100;
          }

          const qty = (stagedOrder as any).quantity || 1;
          const unitBase = qty > 0 ? stagedOrder.amount / qty : stagedOrder.amount;
          const unit_price = gstPercent > 0 ? unitBase / (1 + gstPercent / 100) : unitBase;
          if (!product || !product.id) {
            console.warn('Skipping sales insert for grouped order (no mapped product) staged id', stagedOrder.id);
          } else {
            // Skipping insertion into `sales` because we are not creating rows in `orders`.
            // If you want sales created, adjust schema or instruct me to insert into a dedicated online_sales table.
            console.debug('Skipping sales insert for online order (would require orders row).');
          }

          await supabase
            .from('online_order_staging')
            .update({ status: 'processed' })
            .eq('id', stagedOrder.id);
        }

        successCount++;
      }

      showSuccess(`Successfully created ${successCount} order${successCount !== 1 ? 's' : ''} (items for multi-line orders added automatically). You can now map products and add bill numbers in the Dispatch section.` +
        (successCount > 0 ? ' Selected products have been recorded.' : ''));
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

    // try to auto‑infer mappings from the suffix in the extracted name
    selectedStagedIds.forEach(id => {
      if (!matchedMap[id]?.selectedId) {
        const staged = stagedOrders.find(s => s.id === id);
        if (staged) {
          const parts = staged.flipkart_item_name.split('—').map(p => p.trim());
          if (parts.length > 1) {
            const suffix = parts.slice(1).join('—');
            const prod = products.find(p => p.name === suffix || p.code === suffix);
            if (prod) {
              setMatchedMap(prev => ({ ...prev, [id]: { ...(prev[id] || { matches: [] }), selectedId: prod.id } }));
            }
          }
        }
      }
    });

    try {
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Online Order')
        .single();
      if (dealerError) throw dealerError;

      const paymentStatus = bulkPaymentMethod === 'COD' ? 'pending' : 'paid';

      // group selected rows by order number to avoid duplicate orders
      const selectedRows = stagedOrders.filter(s => selectedStagedIds.includes(s.id));
      const groups: Record<string, StagedOrder[]> = {};
      selectedRows.forEach(s => {
        const key = s.platform_order_number;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });

      for (const orderNo of Object.keys(groups)) {
        const rows = groups[orderNo];
        const totalAmt = rows.reduce((sum, r) => sum + r.amount, 0);
        const first = rows[0];

        // Create an `online_orders` row (do NOT create a normal `orders` row)
        const onlinePayload: any = {
          order_number: `${selectedPlatformId || 'PL'}-${displaySeq || Date.now()}`,
          order_sequence: null,
          dealer_id: dealerData.id,
          user_id: user?.id,
          total_amount: totalAmt,
          status: 'completed',
          payment_status: paymentStatus,
          order_date: new Date().toISOString(),
          dispatched: true,
          dispatch_date: new Date().toISOString(),
          bill_no: first.bill_no || null,
          dispatch_number: `${selectedPlatformId || 'PL'}-gatepass-${displaySeq || Date.now()}`,
        };

        const { data: newOnlineOrder, error: orderError } = await supabase
          .from('online_orders')
          .insert(onlinePayload)
          .select('id')
          .single();

        if (orderError || !newOnlineOrder) {
          console.error('Online order create error', orderError);
          showError(`Failed to create online order for staged ${first.platform_order_number || first.id}`);
        }

        // prepare combined raw names and process each row for sales
        const combinedNames: string[] = [];
        rows.forEach(staged => {
          let rawName = staged.flipkart_item_name || '';
          const selectedProductId = staged.mapped_product_id || matchedMap[staged.id]?.selectedId || null;
          if (selectedProductId) {
            const selProd = products.find(p => p.id === selectedProductId);
            if (selProd) {
              const suffix = ` — ${selProd.name}`;
              if (!rawName.includes(suffix)) rawName = rawName + suffix;
            }
          }
          combinedNames.push(rawName);
        });
        const combinedRawName = combinedNames.join('\n');

        if (newOnlineOrder) {
          // insert single details row for the grouped order
          const groupMappedProductId = rows.find(r => r.mapped_product_id)?.mapped_product_id || matchedMap[rows[0].id]?.selectedId || null;
          try {
            const { error: detailsError } = await supabase.from('online_order_details').insert({
              order_id: newOnlineOrder.id,
              client_name: first.customer_name,
              platform_id: selectedPlatformId,
              platform_order_number: first.platform_order_number,
              address: first.shipping_address,
              raw_item_name: combinedRawName,
              mapped_product_id: groupMappedProductId,
            });
            if (detailsError) {
              const msg = String(detailsError.message || detailsError.description || detailsError.code || 'Unknown error');
              if (msg.includes('online_order_details_order_id_fkey') || msg.includes('foreign key') || msg.includes('orders')) {
                try {
                  // create mirror orders row with same id as online_orders to satisfy FK
                  const mirror = {
                    id: newOnlineOrder.id,
                    order_number: onlinePayload.order_number || `${selectedPlatformId || 'PL'}-${displaySeq || Date.now()}`,
                    dealer_id: dealerData.id,
                    user_id: user?.id || null,
                    total_amount: totalAmt,
                    status: 'completed',
                    payment_status: paymentStatus,
                    order_date: new Date().toISOString(),
                    dispatched: true,
                    dispatch_date: new Date().toISOString(),
                    bill_no: first.bill_no || null,
                  };
                  const { error: mirrorErr } = await supabase.from('orders').insert(mirror);
                  if (mirrorErr) throw mirrorErr;
                  const { error: retryErr } = await supabase.from('online_order_details').insert({
                    order_id: newOnlineOrder.id,
                    client_name: first.customer_name,
                    platform_id: selectedPlatformId,
                    platform_order_number: first.platform_order_number,
                    address: first.shipping_address,
                    raw_item_name: combinedRawName,
                    mapped_product_id: groupMappedProductId,
                  });
                  if (retryErr) {
                    console.error('Retry details insert failed', retryErr);
                  }
                } catch (mirrorCreateErr) {
                  console.error('Failed to create mirror orders row for FK workaround', mirrorCreateErr);
                }
              } else {
                console.error('Details insert error', detailsError);
              }
            }
          } catch (e) {
            console.error('Details insert exception', e);
          }
        }

        for (const staged of rows) {
          const selectedProductId = staged.mapped_product_id || matchedMap[staged.id]?.selectedId || null;

          let rawName = staged.flipkart_item_name || '';
          if (selectedProductId) {
            const selProd = products.find(p => p.id === selectedProductId);
            if (selProd) {
              const suffix = ` — ${selProd.name}`;
              if (!rawName.includes(suffix)) rawName = rawName + suffix;
            }
          }

          const product = products.find(p => p.id === selectedProductId);
          let gstPercent = 0;
          if (product) {
            gstPercent = parseFloat((product as any).gst) || 0;
            if (gstPercent > 0 && gstPercent <= 1) gstPercent = gstPercent * 100;
          }

          const qty = (staged as any).quantity || 1;
          const unitBase = qty > 0 ? staged.amount / qty : staged.amount;
          const unit_price = gstPercent > 0 ? unitBase / (1 + gstPercent / 100) : unitBase;
          // Skipping insertion into `sales` because we are not creating rows in `orders`.
          console.debug('Skipping sales insert for staged', staged.id, 'product', product?.id);

          if (rawName !== staged.flipkart_item_name) {
            await supabase
              .from('online_order_staging')
              .update({ flipkart_item_name: rawName })
              .eq('id', staged.id);
          }

          await supabase.from('online_order_staging').update({ status: 'processed' }).eq('id', staged.id);

          successCount++;
        }
      }

      showSuccess(`Created gatepasses for ${successCount} staged order(s).` +
        (successCount > 0 ? ' Selected products were also mapped.' : ''));
      setSelectedStagedIds([]);
      fetchInitialData();
    } catch (error: any) {
      console.error('Gatepass creation error', error);
      showError(error.message || 'Failed to create gatepasses.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedStagedIds.length === 0) {
      showError('No staged orders selected.');
      return;
    }

    const ok = window.confirm(`Delete ${selectedStagedIds.length} selected staged order(s)? This cannot be undone.`);
    if (!ok) return;

    setIsProcessingBulk(true);
    try {
      const { error } = await supabase.from('online_order_staging').delete().in('id', selectedStagedIds);
      if (error) throw error;
      setStagedOrders(prev => prev.filter(s => !selectedStagedIds.includes(s.id)));
      setSelectedStagedIds([]);
      showSuccess(`Deleted ${selectedStagedIds.length} staged order(s).`);
    } catch (error: any) {
      console.error('Bulk delete error', error);
      showError(error?.message || 'Failed to delete staged orders.');
    } finally {
      setIsProcessingBulk(false);
      fetchInitialData();
    }
  };

  const autoMapInferredForRow = async (orderId: string) => {
    const staged = stagedOrders.find(s => s.id === orderId);
    if (!staged) return;
    const inferred = extractNameSku(staged.flipkart_item_name);
    if (!inferred || (!inferred.sku && !inferred.name)) {
      showError('No SKU or product name could be extracted from this row.');
      return;
    }

    // try to find product by code (sku) first, then by name
    let prod = undefined as Product | undefined;
    if (inferred.sku) {
      const normSku = (inferred.sku || '').replace(/\s+/g, '').toLowerCase();
      prod = products.find(p => (p.code || '').toString().replace(/\s+/g, '').toLowerCase() === normSku);
      if (!prod) {
        prod = products.find(p => (p.code || '').toString().replace(/\s+/g, '').toLowerCase().includes(normSku));
      }
    }
    if (!prod && inferred.name) {
      const normName = inferred.name.toLowerCase();
      prod = products.find(p => (p.name || '').toLowerCase().includes(normName) || normName.includes((p.name || '').toLowerCase()));
    }

    if (!prod) {
      showError('No matching product found for inferred SKU/name.');
      return;
    }

    // apply mapping locally
    setMatchedMap(prev => ({ ...prev, [orderId]: { ...(prev[orderId] || { matches: [] }), selectedId: prod!.id } }));
    setStagedOrders(prev => prev.map(s => s.id === orderId ? { ...s, flipkart_item_name: s.flipkart_item_name.includes(` — ${prod!.name}`) ? s.flipkart_item_name : `${s.flipkart_item_name} — ${prod!.name}` } : s));

    try {
      await supabase.from('online_order_staging').update({ flipkart_item_name: (staged.flipkart_item_name || '') + ` — ${prod.name}` }).eq('id', orderId);
      showSuccess(`Mapped row to product ${prod.name}`);
    } catch (e) {
      console.error('Failed to persist inferred mapping', e);
      showError('Failed to persist inferred mapping to database.');
    }
  };

  const handleBulkAutoMapInferred = async () => {
    if (selectedStagedIds.length === 0) {
      showError('No staged orders selected.');
      return;
    }
    setIsProcessingBulk(true);
    let mapped = 0;
    try {
      for (const id of selectedStagedIds) {
        const staged = stagedOrders.find(s => s.id === id);
        if (!staged) continue;
        const inferred = extractNameSku(staged.flipkart_item_name);
        if (!inferred) continue;
        let prod = undefined as Product | undefined;
        if (inferred.sku) {
          const normSku = (inferred.sku || '').replace(/\s+/g, '').toLowerCase();
          prod = products.find(p => (p.code || '').toString().replace(/\s+/g, '').toLowerCase() === normSku) || products.find(p => (p.code || '').toString().replace(/\s+/g, '').toLowerCase().includes(normSku));
        }
        if (!prod && inferred.name) {
          const normName = inferred.name.toLowerCase();
          prod = products.find(p => (p.name || '').toLowerCase().includes(normName) || normName.includes((p.name || '').toLowerCase()));
        }
        if (!prod) continue;
        mapped++;
        setMatchedMap(prev => ({ ...prev, [id]: { ...(prev[id] || { matches: [] }), selectedId: prod!.id } }));
        setStagedOrders(prev => prev.map(s => s.id === id ? { ...s, flipkart_item_name: s.flipkart_item_name.includes(` — ${prod!.name}`) ? s.flipkart_item_name : `${s.flipkart_item_name} — ${prod!.name}` } : s));
        try {
          await supabase.from('online_order_staging').update({ flipkart_item_name: (staged.flipkart_item_name || '') + ` — ${prod.name}` }).eq('id', id);
        } catch (e) {
          console.error('Failed to persist inferred mapping for', id, e);
        }
      }
      if (mapped > 0) showSuccess(`Auto-mapped ${mapped} row(s) from inferred SKU/name.`);
      else showError('No inferred SKUs matched any product.');
    } catch (e) {
      console.error('Bulk auto-map error', e);
      showError('Auto-mapping failed.');
    } finally {
      setIsProcessingBulk(false);
      fetchInitialData();
    }
  };

  const handleSelectAll = () => {
    setSelectedStagedIds(stagedOrders.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedStagedIds([]);
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
                    onClick={handleSelectAll}
                    disabled={stagedOrders.length === 0}
                    className="bg-slate-500 hover:bg-slate-600 text-white"
                  >
                    Select All
                  </Button>
                  <Button
                    onClick={handleClearSelection}
                    disabled={selectedStagedIds.length === 0}
                    variant="outline"
                    className="text-slate-600"
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={handleBulkDeleteSelected}
                    disabled={isProcessingBulk || selectedStagedIds.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Selected
                  </Button>
                  <Button
                    onClick={handleBulkAutoMapInferred}
                    disabled={isProcessingBulk || selectedStagedIds.length === 0}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    Auto-map Inferred
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
            <div className="px-4 pt-4 pb-2 flex justify-between items-center border-b">
              {stagedOrders.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground">
                    {viewMode === 'grouped' ? '📦 Invoice-Style Grouped View' : '📋 Flat Item List View'}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setViewMode(viewMode === 'grouped' ? 'flat' : 'grouped')}
                    className="ml-auto"
                  >
                    Switch to {viewMode === 'grouped' ? 'Flat' : 'Grouped'} View
                  </Button>
                </>
              )}
            </div>
            <div className="overflow-x-auto">
              {viewMode === 'grouped' ? (
                // GROUPED VIEW - Invoice Style
                <div className="space-y-6 p-4">
                  {stagedOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No pending staged orders found.</div>
                  ) : (() => {
                    // Group orders by platform_order_number
                    const grouped = stagedOrders.reduce((acc, order) => {
                      if (!acc[order.platform_order_number]) {
                        acc[order.platform_order_number] = {
                          orderNo: order.platform_order_number,
                          billNo: order.bill_no || '',
                          customerName: order.customer_name || '',
                          shippingAddress: order.shipping_address || '',
                          items: []
                        };
                      }
                      acc[order.platform_order_number].items.push(order);
                      return acc;
                    }, {} as any);

                    return Object.values(grouped).map((grp: any) => {
                      const totalQty = grp.items.reduce((sum: number, item: StagedOrder) => sum + (item.quantity || 1), 0);
                      const totalAmount = grp.items.reduce((sum: number, item: StagedOrder) => sum + (item.amount || 0), 0);
                      
                      return (
                        <Card key={grp.orderNo} className="border-2 border-blue-200">
                          <CardHeader className="bg-blue-50 pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg text-blue-900">Order #{grp.orderNo}</CardTitle>
                                <CardDescription className="text-sm mt-1">
                                  <span className="font-semibold">Invoice:</span> {grp.billNo || '—'}  |  
                                  <span className="font-semibold ml-2">Customer:</span> {grp.customerName}
                                </CardDescription>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-600">Total Items: <span className="text-blue-600 text-lg">{totalQty}</span></div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-blue-100 border-b">
                                    <th className="px-4 py-3 text-left font-bold text-gray-800">Item Details</th>
                                    <th className="px-4 py-3 text-center font-bold text-gray-800 w-20">Qty</th>
                                    <th className="px-4 py-3 text-right font-bold text-gray-800 w-32">Amount (₹)</th>
                                    <th className="px-4 py-3 text-center font-bold text-gray-800 w-24">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {grp.items.map((item: StagedOrder, idx: number) => {
                                    const product = products.find(p => p.name === item.flipkart_item_name?.split('—')[0]);
                                    const productCode = product?.code || 'N/A';
                                    return (
                                    <tr key={item.id} className="border-b hover:bg-blue-50 transition">
                                      <td className="px-4 py-3 text-sm break-words">
                                        <div className="font-medium text-gray-900">{item.flipkart_item_name?.split('—')[0] || 'Unknown'}</div>
                                        <div className="text-xs text-gray-600 mt-1">Code: <span className="font-semibold text-blue-700">{productCode}</span></div>
                                        {matchedMap[item.id]?.selectedId && (
                                          <div className="mt-1 text-xs bg-green-100 text-green-900 px-2 py-1 rounded w-fit">
                                            ✓ {products.find(p => p.id === matchedMap[item.id].selectedId)?.name || 'Mapped'}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-center font-semibold text-blue-600">{item.quantity || 1}</td>
                                      <td className="px-4 py-3 text-right font-bold text-green-600">₹{(item.amount || 0).toFixed(2)}</td>
                                      <td className="px-4 py-3 text-center">
                                        <Checkbox 
                                          checked={selectedStagedIds.includes(item.id)} 
                                          onCheckedChange={(checked) => setSelectedStagedIds(prev => !!checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} 
                                        />
                                      </td>
                                    </tr>
                                  );
                                  })}
                                  <tr className="bg-blue-50 border-t-2 border-blue-300 font-bold">
                                    <td className="px-4 py-3 text-right">Order Total:</td>
                                    <td className="px-4 py-3 text-center text-blue-600 text-base">{totalQty}</td>
                                    <td className="px-4 py-3 text-right text-green-700 text-lg">₹{totalAmount.toFixed(2)}</td>
                                    <td></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              ) : (
                // FLAT VIEW - Original Table
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 sticky left-0 bg-background z-20">
                      <Checkbox
                        checked={selectedStagedIds.length === stagedOrders.length && stagedOrders.length > 0}
                        onCheckedChange={(checked) => setSelectedStagedIds(!!checked ? stagedOrders.map(s => s.id) : [])}
                      />
                    </TableHead>
                    <TableHead className="w-[150px] sticky left-12 bg-background z-20">Order No.</TableHead>
                    <TableHead className="sticky left-[162px] bg-background z-20">Bill No.</TableHead>
                    <TableHead className="sticky left-[262px] bg-background z-20 min-w-[550px]">Extracted Item Name (Product)</TableHead>
                    <TableHead>Product (Mapped)</TableHead>
                    <TableHead>Customer Details</TableHead>
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
                      <TableRow id={`row-${order.id}`} key={order.id} className={
                        "hover:bg-muted/30 " +
                        (selectedStagedIds.includes(order.id) ? 'bg-muted/10 ' : '') +
                        (unmappedIds.includes(order.id) ? 'bg-red-100' : '')
                      }>
                        <TableCell className="sticky left-0 bg-background z-10">
                          <Checkbox checked={selectedStagedIds.includes(order.id)} onCheckedChange={(checked) => setSelectedStagedIds(prev => !!checked ? [...prev, order.id] : prev.filter(id => id !== order.id))} />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-blue-600 sticky left-12 bg-background z-10">{order.platform_order_number}</TableCell>
                        <TableCell className="text-xs sticky left-[162px] bg-background z-10">{order.bill_no || '—'}</TableCell>
                        <TableCell className="text-xs sticky left-[262px] bg-background z-10 min-w-[550px]">
                          <div className="flex flex-col gap-2 text-sm">
                            <div className="flex items-start gap-2">
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-2 flex-1">
                              {(() => {
                                const txt = order.flipkart_item_name || '';
                                const parts = txt.split('—');
                                const base = parts[0] ? parts[0].trim() : txt;
                                const appended = parts.length > 1 ? parts.slice(1).join('—').trim() : null;
                                const selProd = products.find(p => p.id === matchedMap[order.id]?.selectedId);
                                const inferred = extractNameSku(txt);
                                return (
                                  <>
                                    <span className="whitespace-pre-wrap break-words text-sm font-medium" title={txt}>{base}</span>
                                    {appended && (
                                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-900 text-[12px] font-semibold w-fit">✓ {appended}</span>
                                    )}
                                    {selProd ? (
                                      <div className="mt-1 text-[12px] text-muted-foreground">
                                        <div><span className="font-semibold">Product:</span> {selProd.name}</div>
                                        <div><span className="font-semibold">SKU:</span> {selProd.code || '—'}</div>
                                      </div>
                                    ) : inferred ? (
                                      <div className="mt-1 text-[12px] text-muted-foreground">
                                        <div><span className="font-semibold">Product:</span> {inferred.name || '—'}</div>
                                        <div><span className="font-semibold">SKU:</span> {inferred.sku || '—'} <span className="text-[11px] text-muted-foreground">(extracted)</span></div>
                                      </div>
                                    ) : null}
                                  </>
                                );
                              })()}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {matchedMap[order.id]?.selectedId ? (
                            <div className="flex items-center justify-between gap-2">
                              {(() => {
                                const sel = products.find(p => p.id === matchedMap[order.id].selectedId);
                                if (!sel) return <span>Selected</span>;
                                return (
                                  <div className="text-left">
                                    <div className="font-medium text-sm">{sel.code || sel.name}</div>
                                    <div className="text-[11px] text-muted-foreground">{sel.code} {sel.size ? `| Size: ${sel.size}` : ''} {typeof sel.dp !== 'undefined' ? `| DP: ₹${sel.dp}` : ''}</div>
                                  </div>
                                );
                              })()}
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                  const selId = matchedMap[order.id]?.selectedId;
                                  const selProd = products.find(p => p.id === selId);
                                  setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: undefined } }));
                                  if (selProd) {
                                    setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: s.flipkart_item_name.replace(new RegExp(`\\s*—\\s*${escapeRegExp(selProd.name)}$`), '') } : s));
                                  }
                                }} title="Remove product"><Trash2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleApplyProductToMatching(order.id)} title="Apply to matching"><Copy className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full text-left h-auto py-1">
                                  {(() => {
                                    const cnt = matchedMap[order.id]?.matches.length || 0;
                                    return `Select product${cnt > 0 ? ` (${cnt})` : ''}`;
                                  })()}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[600px] max-w-[90vw] p-0">
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
                                      <Button key={`cand-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={async () => {
                                        setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: p.id } }));
                                        setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: `${s.flipkart_item_name} — ${p.code || p.name}` } : s));
                                        try {
                                          await supabase
                                            .from('online_order_staging')
                                            .update({ flipkart_item_name: `${order.flipkart_item_name} — ${p.code || p.name}` })
                                            .eq('id', order.id);
                                        } catch (e) {
                                          console.error('failed to persist manual mapping', e);
                                        }
                                      }}>
                                        <div className="text-left w-full">
                                          <div className="font-medium text-sm whitespace-normal break-words">{highlightMatch(p.code || p.name, matchedMap[order.id]?.search)}</div>
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
                                    <Button key={`all-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={async () => {
                                      setMatchedMap(prev => ({ ...prev, [order.id]: { ...prev[order.id], selectedId: p.id } }));
                                      setStagedOrders(prev => prev.map(s => s.id === order.id ? { ...s, flipkart_item_name: `${s.flipkart_item_name} — ${p.name}` } : s));
                                      try {
                                        await supabase
                                          .from('online_order_staging')
                                          .update({ flipkart_item_name: `${order.flipkart_item_name} — ${p.name}` })
                                          .eq('id', order.id);
                                      } catch (e) {
                                        console.error('failed to persist manual mapping', e);
                                      }
                                    }}>
                                      <div className="text-left w-full">
                                        <div className="font-medium text-sm whitespace-normal break-words">{highlightMatch(p.name, matchedMap[order.id]?.search)}</div>
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
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ProcessOnlineOrders;
