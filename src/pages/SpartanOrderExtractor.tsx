"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, AlertCircle, Eye, EyeOff, Save, ListChecks, Trash2, Download, Search, Package } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { buildStagingFromRows, upsertStaging, parseItemWithQty } from '@/utils/onlineOrderHelpers';
import { fetchAllCombos, expandComboToItems, Combo } from '@/utils/comboHelpers';
import * as pdfjsLib from 'pdfjs-dist';

// Import the worker directly from the package to avoid CDN issues
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up PDF.js worker using the imported URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ExtractedOrder {
  orderNo: string;
  customerName: string;
  address: string;
  item: string;
  amount: string;
  invoiceNo?: string;
  qty?: number;
  items?: Array<{product: string; qty: number; total: number; mapped_product_id?: string}>;
  invoiceDate?: string;
  productName?: string;
  productSku?: string;
  hsn?: string;
  unitPrice?: string;
  taxAmount?: string;
  igst?: string;
  deliveryLocation?: string;
  transportName?: string;
  bookingDestination?: string;
  dateOfDispatch?: string;
}

interface Product { id: string; name: string; code?: string; size?: string | number | null; dp?: number; gst?: string | number }

const SpartanOrderExtractor = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);
  const [productMapping, setProductMapping] = useState<Record<number, Record<number, string>>>({});
  const [productSearchText, setProductSearchText] = useState<Record<number, Record<number, string>>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedExtracted, setSelectedExtracted] = useState<Record<number, boolean>>({});
  const [dispatchSeries, setDispatchSeries] = useState<string>('');
  const [isCreatingGatepasses, setIsCreatingGatepasses] = useState(false);
  const selectAllRef = React.useRef<HTMLInputElement | null>(null);

  const allSelected = extractedOrders.length > 0 && extractedOrders.every((_, idx) => !!selectedExtracted[idx]);
  const someSelected = extractedOrders.some((_, idx) => !!selectedExtracted[idx]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && someSelected;
    }
  }, [allSelected, someSelected]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSel: Record<number, boolean> = {};
      extractedOrders.forEach((_, idx) => newSel[idx] = true);
      setSelectedExtracted(newSel);
    } else {
      setSelectedExtracted({});
    }
  };

  // refs to keep text inputs focused across renders (keyed by "orderIndex|itemIndex")
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [matchedMap, setMatchedMap] = useState<Record<number, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log('🚀 STARTING PRODUCT FETCH (with pagination)...');
        let allProducts: any[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        let pageCount = 0;

        while (hasMore) {
          pageCount++;
          console.log(`📄 Fetching page ${pageCount} (offset: ${offset})...`);
          const { data, error } = await supabase
            .from('products')
            .select('id, name, code, size, dp, gst')
            .eq('is_active', true)
            .order('name')
            .range(offset, offset + pageSize - 1);
          
          if (error) {
            console.error('❌ Query error:', error.message);
            throw error;
          }

          if (!data || data.length === 0) {
            console.log('✅ End of data reached');
            hasMore = false;
          } else {
            console.log(`✅ Fetched ${data.length} products, total so far: ${allProducts.length + data.length}`);
            allProducts = [...allProducts, ...data];
            if (data.length < pageSize) {
              console.log('✅ Got less than page size, stopping');
              hasMore = false;
            } else {
              offset += pageSize;
            }
          }
        }

        console.log('🎉 ALL PRODUCTS LOADED:', allProducts.length);
        setProducts(allProducts);

        // Also fetch combos
        console.log('🔄 Fetching combos...');
        const combosData = await fetchAllCombos();
        console.log('✅ Combos loaded:', combosData.length);
        setCombos(combosData);
      } catch (err: any) {
        console.error('Failed to fetch products:', err.message);
        showError(`Failed to load products: ${err.message}`);
      }
    };
    fetchProducts();
  }, []);

  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const extractNumericToken = (text: string) => { const match = text.match(/\b(\d{2,})\b/); return match ? match[1] : undefined; };

  useEffect(() => {
    if (products.length === 0) return;
    
    const enriched = products.map(p => ({
      ...p,
      normCode: p.code ? normalize(p.code) : '',
      normName: p.name ? normalize(p.name) : '',
      numericParts: (p.code || '').match(/\d{2,}/g) || []
    }));

    const map: typeof matchedMap = {} as any;
    extractedOrders.forEach((ord, idx) => {
      const text = ord.item || '';
      const parts = text.split(/\r?\n/).map(p => p.trim()).filter(Boolean);

      const union = new Map<string, Product>();
      const debugCodes: string[] = [];

      parts.forEach(part => {
        const numericToken = extractNumericToken(part);
        const normText = normalize(part);

        const candidates = enriched.filter((p: any) => {
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
          }
          return false;
        });

        candidates.forEach((c: any) => {
          if (!union.has(c.id)) {
            union.set(c.id, { id: c.id, name: c.name, code: c.code, size: c.size });
            debugCodes.push((c.code || '').toString());
          }
        });
      });

      const candidateProducts: Product[] = Array.from(union.values());
      map[idx] = { matches: candidateProducts, selectedId: candidateProducts.length === 1 ? candidateProducts[0].id : undefined, debug: { numericToken: extractNumericToken(text), normText: normalize(text), candidateCodes: debugCodes } };
    });
    setMatchedMap(map);
  }, [products, extractedOrders]);

  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Allow deleting a persisted mapping and clear UI mapping state
  const handleDeleteMapping = async (orderIndex: number, itemIndex: number) => {
    try {
      const mappedId = productMapping[orderIndex]?.[itemIndex];
      if (!mappedId) return;
      const prod = products.find(p => p.id === mappedId);
      if (!prod) return;

      const order = extractedOrders[orderIndex];
      if (!order) return;
      const item = order.items?.[itemIndex];
      // Clear the mapped_product_id and restore the original extracted name (if available)
      const updates: any = { mapped_product_id: null };
      if (item && item.product) updates.flipkart_item_name = item.product;

      const { error } = await supabase
        .from('online_order_staging')
        .update(updates)
        .eq('platform_order_number', order.orderNo)
        .eq('mapped_product_id', prod.id);

      if (error) {
        console.warn('Failed to clear mapped staging row:', error.message);
        showError('Failed to clear mapped staging item');
      } else {
        showSuccess('Cleared mapped staging item');
      }

      const updated = { ...productMapping };
      if (updated[orderIndex]) {
        delete updated[orderIndex][itemIndex];
        if (Object.keys(updated[orderIndex]).length === 0) delete updated[orderIndex];
      }
      setProductMapping(updated);
    } catch (err: any) {
      console.error('Error deleting mapping:', err);
      showError(err.message || 'Failed to delete mapping');
    }
  };

  // Auto-map items when they contain specific patterns
  useEffect(() => {
    if (products.length === 0 || extractedOrders.length === 0) return;

    const codeRegex = /vb\s*(\d+[a-zA-Z]*)/i;

    const updated = { ...productMapping };
    let changed = false;

    extractedOrders.forEach((order, orderIndex) => {
      order.items?.forEach((item, itemIndex) => {
        // skip if already mapped via UI or database
        const alreadyMapped = (updated[orderIndex] && updated[orderIndex][itemIndex]) || item.mapped_product_id;
        if (alreadyMapped) return;

        const text = item.product || '';
        const m = text.match(codeRegex);
        if (m) {
          const num = m[1];
          const wantNorm = `vb${num}`.toLowerCase().replace(/\s+/g, '');

          const regexToken = new RegExp(`\\bvb\\s*${escapeRegExp(num)}\\b`, 'i');
          const found = products.find(p => {
            const code = (p.code || '').toString();
            const name = (p.name || '').toString();
            if (regexToken.test(code)) return true;
            if (regexToken.test(name)) return true;
            const codeNorm = code.toLowerCase().replace(/\s+/g, '');
            if (codeNorm === wantNorm) return true;
            return false;
          });

          if (found) {
            if (!updated[orderIndex]) updated[orderIndex] = {} as Record<number, string>;
            updated[orderIndex][itemIndex] = found.id;
            changed = true;
            handleProductMapping(orderIndex, itemIndex, found.id).catch((err) => console.error('Auto-map failed', err));
          }
        }
      });
    });

    if (changed) setProductMapping(updated);
  }, [products, extractedOrders]);

  const handleProductMapping = async (orderIndex: number, itemIndex: number, selectedProductId: string) => {
    console.log('🔵 handleProductMapping triggered:', { orderIndex, itemIndex, selectedProductId });
    
    try {
      // Get current user
      let authUser = user;
      if (!authUser) {
        const { data: { session } } = await supabase.auth.getSession();
        authUser = session?.user ?? null;
      }
      if (!authUser) {
        showError('Please sign in to map products.');
        return;
      }

      const order = extractedOrders[orderIndex];
      const item = order.items?.[itemIndex];
      if (!item) throw new Error('Item not found');

      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) throw new Error('Product not found');

      // Use item.qty directly
      const finalQty = item.qty || 1;
      const itemAmount = item.total || 0;

      console.log('📝 Mapping data:', {
        orderNo: order.orderNo,
        rawItemName: item.product,
        mappedProductName: selectedProduct.name,
        qty: finalQty,
        total: itemAmount
      });

      // Try to update any existing staging rows for this order that match the raw item name
      console.log('🔁 Updating staging row(s) with mapped product id...');
      let updateCount = 0;

      // Exact match update
      const { data: upd1, error: updErr1 } = await supabase
        .from('online_order_staging')
        .update({
          flipkart_item_name: selectedProduct.name,
          mapped_product_id: selectedProduct.id,
          amount: parseFloat(itemAmount.toString()) || 0,
          quantity: finalQty,
          bill_no: order.invoiceNo || '',
          created_by: authUser.id,
          status: 'pending'
        })
        .eq('platform_order_number', order.orderNo)
        .eq('flipkart_item_name', item.product)
        .select();

      if (updErr1) console.warn('Exact update error', updErr1.message);
      if (upd1 && upd1.length) updateCount += upd1.length;

      // Looser substring match (case-insensitive)
      if (updateCount === 0) {
        const { data: upd2, error: updErr2 } = await supabase
          .from('online_order_staging')
          .update({
            flipkart_item_name: selectedProduct.name,
            mapped_product_id: selectedProduct.id,
            amount: parseFloat(itemAmount.toString()) || 0,
            quantity: finalQty,
            bill_no: order.invoiceNo || '',
            created_by: authUser.id,
            status: 'pending'
          })
          .eq('platform_order_number', order.orderNo)
          .ilike('flipkart_item_name', `%${item.product}%`)
          .select();

        if (updErr2) console.warn('Substring update error', updErr2.message);
        if (upd2 && upd2.length) updateCount += upd2.length;
      }

      if (updateCount === 0) {
        // fallback: insert/upsert a new mapped row
        console.log('✅ No existing row updated — upserting mapped product to staging...');
        const { data, error: insertError } = await supabase
          .from('online_order_staging')
          .upsert([{
            platform_order_number: order.orderNo,
            customer_name: order.customerName || null,
            shipping_address: order.address || null,
            flipkart_item_name: selectedProduct.name,
            mapped_product_id: selectedProduct.id,
            amount: parseFloat(itemAmount.toString()) || 0,
            quantity: finalQty,
            bill_no: order.invoiceNo || '',
            created_by: authUser.id,
            status: 'pending'
          }], {
            onConflict: 'platform_order_number,flipkart_item_name'
          })
          .select();

        if (insertError) throw insertError;
        console.log('✅ Inserted mapped product row:', data);
      } else {
        console.log(`✅ Updated ${updateCount} staging row(s) with mapped product id`);
      }

      showSuccess(`✅ Mapped & saved: ${selectedProduct.name} | Qty: ${finalQty} | Amount: ₹${itemAmount.toFixed(2)}`);

    } catch (error: any) {
      console.error('❌ Mapping error:', error);
      showError(`Failed to map product: ${error.message}`);
    }
  };

  const handleCreateGatepassesForSelected = async () => {
    const selectedIndexes = Object.keys(selectedExtracted).filter(k => selectedExtracted[+k]).map(Number);
    if (selectedIndexes.length === 0) {
      showError('Please select orders to create gatepasses.');
      return;
    }

    try {
      setIsCreatingGatepasses(true);

      // Verify all selected orders have mapped items
      for (const idx of selectedIndexes) {
        const order = extractedOrders[idx];
        const items = order.items || [];
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          if (!productMapping[idx]?.[itemIdx]) {
            showError(`Order ${order.orderNo}: Item not mapped. Please map all items before creating gatepasses.`);
            return;
          }
        }
      }

      // Ensure dealer data is available - handle both single dealer users and admins with multiple dealers
      let dealerData = null;
      try {
        const { data, error: dealerErr } = await supabase
          .from('dealers')
          .select('id')
          .eq('user_id', user?.id)
          .limit(1);

        if (dealerErr) {
          console.error('Dealer lookup error:', dealerErr);
          showError('Could not find dealer information. Please contact your administrator.');
          return;
        }

        if (data && data.length > 0) {
          dealerData = data[0];
          if (data.length > 1) {
            console.warn(`Admin user associated with ${data.length} dealers. Using first dealer: ${dealerData.id}`);
          }
        }
      } catch (dErr) {
        console.error('Dealer lookup exception:', dErr);
        showError('Error retrieving dealer information.');
        return;
      }

      if (!dealerData) {
        showError('No dealer found for this user. Please contact your administrator.');
        return;
      }

      // Ensure Spartan platform exists
      let spartanPlatformId: string | undefined;
      try {
        const { data: pf, error: pfErr } = await supabase
          .from('online_platforms')
          .select('id')
          .eq('name', 'Spartan')
          .single();

        if (pfErr) {
          console.warn('Spartan platform lookup failed:', pfErr);
          // Try to create it
          const { data: newPf, error: createErr } = await supabase
            .from('online_platforms')
            .insert([{ name: 'Spartan' }])
            .select('id')
            .single();

          if (createErr) {
            console.error('Failed to create Spartan platform:', createErr);
            showError('Could not ensure Spartan platform exists. Please contact administrator.');
            return;
          }
          spartanPlatformId = newPf?.id;
        } else {
          spartanPlatformId = pf?.id;
        }

        if (!spartanPlatformId) {
          showError('Could not get Spartan platform ID. Please contact administrator.');
          return;
        }
      } catch (e) {
        console.error('Failed to ensure Spartan platform', e);
        showError('Error ensuring platform exists.');
        return;
      }

      let createdCount = 0;
      for (const idx of selectedIndexes) {
        const order = extractedOrders[idx];
        if (!order) continue;

        const totalAmount = parseFloat(order.amount as any) || 0;
        // request a new sequence number for this online order
        let seqNum: number | null = null;
        try {
          const { data: seqData, error: seqErr } = await supabase.rpc('get_next_online_order_seq').single();
          if (!seqErr && seqData) seqNum = seqData as unknown as number;
        } catch (rpcErr) {
          console.warn('get_next_online_order_seq RPC failed', rpcErr);
        }

        const platformName = 'Spartan';
        const platformPrefix = 'S';
        const displaySeq = seqNum ?? Date.now();

        const insertPayload: any = {
          dealer_id: dealerData.id,
          user_id: user?.id || null,
          total_amount: totalAmount,
          status: 'completed',
          payment_status: 'paid',
          order_date: new Date().toISOString(),
          dispatched: false,
          dispatch_date: null,
          bill_no: order.invoiceNo || null,
        };

        // if user provided a dispatch series, prefix the bill_no
        if (dispatchSeries && insertPayload.bill_no) {
          insertPayload.bill_no = `${dispatchSeries}-${insertPayload.bill_no}`;
        }

        const onlinePayload: any = {
          order_number: `${platformPrefix}${displaySeq}`,
          order_sequence: seqNum || null,
          dealer_id: dealerData.id,
          user_id: user?.id || null,
          total_amount: totalAmount,
          status: 'completed',
          payment_status: 'paid',
          order_date: new Date().toISOString(),
          dispatched: false,
          dispatch_date: null,
          dispatch_number: `${platformPrefix}${displaySeq}`,
          bill_no: insertPayload.bill_no || null,
        };

        const { data: newOnlineOrder, error: onlineErr } = await supabase.from('online_orders').insert(onlinePayload).select('id').single();
        console.debug('SpartanExtractor: online_orders.insert result', { newOnlineOrder, onlineErr });
        if (onlineErr || !newOnlineOrder) {
          console.error('Online order create error', onlineErr);
          showError(`Failed to create online_order for ${order.orderNo}`);
          continue;
        }

        // Insert online_order_details rows per extracted item
        let insertedDetail: any = null;
        try {
          if (!spartanPlatformId) {
            console.error('Cannot insert order details: platform_id is missing');
            showError('Platform ID not available. Cannot create order details.');
            continue;
          }

          const detailsToInsert: any[] = (order.items || []).map((it, itemIndex) => {
            const mappedId = productMapping[idx] ? productMapping[idx][itemIndex] : null;
            return {
              order_id: newOnlineOrder.id,
              client_name: order.customerName,
              platform_id: spartanPlatformId,
              platform_order_number: order.orderNo,
              address: order.address,
              raw_item_name: it.product,
              mapped_product_id: mappedId || null,
            };
          });

          if (detailsToInsert.length > 0) {
            const { data: detailRows, error: detailErr } = await supabase.from('online_order_details').insert(detailsToInsert).select('id, mapped_product_id');
            console.debug('SpartanExtractor: online_order_details.insert batch result', { detailRows, detailErr });
            if (detailErr) {
              console.error('Failed to insert online_order_details batch', detailErr);
              const msg = String(detailErr.message || detailErr.description || detailErr.code || 'Unknown error');
              showError('Failed to save online order details: ' + msg);
            } else {
              insertedDetail = detailRows;
            }
          }
        } catch (e) {
          console.error('Failed to insert online_order_details', e);
          showError('Error saving order details.');
        }

        createdCount++;
      }

      showSuccess(`Created ${createdCount} gatepass(es).` + (dispatchSeries ? ` Series: ${dispatchSeries}` : ''));
    } catch (error: any) {
      console.error('Gatepass creation error', error);
      showError(error.message || 'Failed to create gatepasses.');
    } finally {
      setIsCreatingGatepasses(false);
    }
  };

  const extractSpartan = (text: string): ExtractedOrder | null => {
    // ORIGINAL SPARTAN PDF EXTRACTION - UNCHANGED
    const invoiceMatch = text.match(/Invoice\s+Number\s*-?\s*#?(\d+)/i);
    if (!invoiceMatch) return null;
    const orderNo = invoiceMatch[1];

    const invoiceDateMatch = text.match(/Invoice\s+Date\s*-?\s*([A-Za-z0-9 ,]+)/i);
    const invoiceDate = invoiceDateMatch ? invoiceDateMatch[1].trim() : undefined;

    const amountMatch = text.match(/Total\s+Amount[\s\S]*?Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : "0.00";

    let customerName = "Unknown";
    let address = "N/A";
    const billToBlockMatch = text.match(/Bill\s+To:\s*\n([\s\S]+?)(?=Ship\s+To:|Sold\s+By:|Payment\s+Method)/i);
    if (billToBlockMatch) {
        const lines = billToBlockMatch[1].trim().split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length > 0) {
            customerName = lines[0];
            address = lines.slice(1).join(', ').trim();
        }
    }

    let item = "N/A";
    let productName: string | undefined;
    let productSku: string | undefined;
    let hsn: string | undefined;
    let quantity: string | undefined;
    let unitPrice: string | undefined;
    let taxAmount: string | undefined;
    let igst: string | undefined;
    
    const allLines = text.split('\n');
    const headerIdx = allLines.findIndex(l => /Product\s+Name/i.test(l));
    if (headerIdx >= 0) {
      let startIdx = headerIdx + 1;
      // Skip all header lines and split header fragments
      // Pattern 1: Lines that start with special chars like ( % ) | -
      // Pattern 2: Lines that start with header keywords
      const headerKeywords = /^\s*[\(\)%\|\-]|^(Product|Sku|SKU|HSN|Quantity|Unit|TAX|IGST|TOTAL|Charges|Shipping|COD|SGST|CGST|including|gst|Value|Tax|Sold\s+By|Bill\s+To|Ship\s+To)/i;
      
      while (startIdx < allLines.length) {
        const line = (allLines[startIdx] || '').trim();
        if (!line || headerKeywords.test(line)) {
          startIdx++;
        } else {
          break;
        }
      }
      
      const productRowLines: string[] = [];
      for (let i = startIdx; i < Math.min(allLines.length, startIdx + 25); i++) {
        const line = (allLines[i] || '').trim();
        if (!line) continue;
        if (/^(Charges\s+Applied|Shipping\s+Charges|COD\s+Charges|Total\s+Amount|IGST\s+\(Value)/i.test(line)) break;
        productRowLines.push(line);
      }
      
      if (productRowLines.length > 0) productName = productRowLines[0];
      if (productRowLines.length > 1) productSku = productRowLines[1];
      if (productRowLines.length > 2) hsn = productRowLines[2];
      if (productRowLines.length > 3) quantity = productRowLines[3];
      if (productRowLines.length > 4) unitPrice = productRowLines[4];
      if (productRowLines.length > 5) taxAmount = productRowLines[5];
      if (productRowLines.length > 6) igst = productRowLines[6];
      
      // Build item with product name and SKU (clean)
      if (productName && productName.trim().length > 2) {
        item = productName.trim();
        if (productSku && productSku.trim().length > 0 && !/^[%|()❌\-]|From\s+PDF|SKU:|Product/i.test(productSku)) {
          item += ' - ' + productSku.trim();
        }
      }
    }
    
    if (item === "N/A") {
      const itemMatch = text.match(/Product\s+Name[\s\S]*?\n\s*([A-Za-z0-9\-\s\(\)]+?)\n\s*([A-Za-z0-9\-\s]+)/i);
      if (itemMatch) {
        const name = itemMatch[1].trim().replace(/\s+/g, ' ');
        // ONLY use the product name, not metadata
        item = name;
      }
    }

    if ((!item || item === "N/A") || customerName === "Unknown" || (amount === "0.00" && !amountMatch)) {
        console.warn("Spartan Extractor: Could not extract all fields. OrderNo:", orderNo, "Item:", item, "Amount:", amount);
    }

    // Return with items array (single item) for compatibility with Flipkart UI
    // Extract numeric value from quantity string (handle cases like "2.5", "2 units", etc.)
    let qty = 1;
    if (quantity) {
      const numMatch = quantity.match(/\d+(?:\.\d+)?/);
      qty = numMatch ? parseInt(numMatch[0]) : 1;
    }
    const total = parseFloat(amount) || 0;

    return { 
      orderNo, 
      customerName, 
      address, 
      item, 
      amount, 
      qty,
      invoiceNo: undefined,
      items: [{ product: item, qty: qty > 0 ? qty : 1, total, mapped_product_id: undefined }],
      invoiceDate,
      productName,
      productSku,
      hsn,
      unitPrice,
      taxAmount,
      igst,
      deliveryLocation: undefined,
      transportName: undefined,
      bookingDestination: undefined,
      dateOfDispatch: undefined
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setExtractedOrders([]);
    setRawText("");
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let allExtracted: ExtractedOrder[] = [];
      let fullDebugText = "";

      const invoiceRegex = /(?:Invoice(?:\s+No(?:\\.|:)?| Number)?|Bill\s*No(?:\\.|:)?)[:#\s-]*([A-Z0-9\\.\\/ -]{3,})/i;
      const labelRegex = /Invoice\s*(?:No(?:\\.|:)?|Number(?:\\.|:)?)\s*[:\\-]?\s*([^\r\n]+)/i;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join('\n');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        const pageLabelMatch = pageText.match(labelRegex);
        let pageInvoice: string | undefined;
        if (pageLabelMatch) {
          pageInvoice = pageLabelMatch[1].trim();
        } else {
          const pageInvoiceMatch = pageText.match(invoiceRegex);
          pageInvoice = pageInvoiceMatch ? pageInvoiceMatch[1].trim() : undefined;
        }

        if (pageInvoice) {
          const tokenWithDigits = pageInvoice.match(/[A-Z0-9\\-\\/\\.]*\d+[A-Z0-9\\-\\/\\.]*/i);
          if (tokenWithDigits) pageInvoice = tokenWithDigits[0];
          else if (!/\d/.test(pageInvoice)) pageInvoice = undefined;
        }

        const order = extractSpartan(pageText);
        if (order) {
          allExtracted.push(pageInvoice ? { ...order, invoiceNo: pageInvoice } : order);
        }
      }

      const docLabelMatch = fullDebugText.match(labelRegex);
      let docInvoiceNo: string | undefined;
      if (docLabelMatch) {
        docInvoiceNo = docLabelMatch[1].trim();
      } else {
        const docInvoiceMatch = fullDebugText.match(invoiceRegex);
        docInvoiceNo = docInvoiceMatch ? docInvoiceMatch[1].trim() : undefined;
      }
      if (docInvoiceNo) {
        const docTokenWithDigits = docInvoiceNo.match(/[A-Z0-9\\-\\/\\.]*\d+[A-Z0-9\\-\\/\\.]*/i);
        if (docTokenWithDigits) docInvoiceNo = docTokenWithDigits[0];
        else docInvoiceNo = undefined;
      }

      if (docInvoiceNo) {
        allExtracted = allExtracted.map(a => ({ ...a, invoiceNo: a.invoiceNo || docInvoiceNo }));
      }

      setRawText(fullDebugText);
      
      if (allExtracted.length === 0) {
        throw new Error("No valid Spartan order patterns found in the PDF. Please check the 'Debug View' to see the extracted text.");
      }

      setExtractedOrders(allExtracted);
      showSuccess(`Successfully extracted ${allExtracted.length} orders!`);
    } catch (error: any) {
      console.error("PDF Parsing Error:", error);
      showError(error.message || "Failed to parse PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToStaging = async () => {
    if (extractedOrders.length === 0) return;
    
    try {
      let unmappedCount = 0;
      for (let i = 0; i < extractedOrders.length; i++) {
        if (!productMapping[i]) {
          unmappedCount++;
          console.warn(`⚠️ Order not mapped: ${extractedOrders[i].orderNo}`);
        }
      }

      if (unmappedCount > 0) {
        showError(`❌ Please map all ${unmappedCount} unmapped order(s) before proceeding!`);
        return;
      }

      console.log('✅ All items mapped! Proceeding to process orders...');
      showSuccess('✅ All items have been saved with mapped products!');
      setTimeout(() => {
        navigate('/process-online-orders');
      }, 1500);
    } catch (error: any) {
      console.error("Error:", error);
      showError(`Error: ${error.message}`);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <div className="flex justify-start items-center mb-6">
          <Button variant="outline" onClick={() => navigate('/online-orders-admin')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Online Orders
          </Button>
        </div>

        <Card className="mb-8 border-2 border-primary/20 shadow-xl">
          <CardHeader className="bg-gray-700 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Spartan Order Data Extractor</CardTitle>
                <CardDescription className="text-gray-200">
                  Upload Spartan Website Order PDFs to automatically extract order details and map to actual products.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 bg-muted/5 hover:bg-muted/10 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Spartan Order PDF</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                The system processes the file locally in your browser.
              </p>
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                  />
                  <Button disabled={loading} className="bg-gray-700 hover:bg-gray-800 min-w-[200px]">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {loading ? 'Processing PDF...' : 'Upload & Extract'}
                  </Button>
                </div>
                
                {rawText && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-xs text-muted-foreground"
                  >
                    {showRawText ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showRawText ? 'Hide Debug View' : 'Show Debug View (Raw Text)'}
                  </Button>
                )}
              </div>
            </div>

            {showRawText && rawText && (
              <div className="mt-6 p-4 bg-slate-950 text-slate-50 rounded-md overflow-x-auto">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" /> Raw Extracted Text (Debug)
                </h4>
                <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono">
                  {rawText}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {extractedOrders.length > 0 && (
          <Card className="shadow-lg border-none">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Extracted Order Details</CardTitle>
                  <CardDescription>Found {extractedOrders.length} orders. Map each item to an actual product from the database.</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={handleSaveToStaging} disabled={isSaving} className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 border-none">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save to Staging
                  </Button>
                  <Input
                    placeholder="Dispatch series (optional)"
                    value={dispatchSeries}
                    onChange={(e) => setDispatchSeries(e.target.value)}
                    className="w-56 text-sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCreateGatepassesForSelected()}
                    disabled={isCreatingGatepasses}
                    className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 border-none"
                  >
                    {isCreatingGatepasses ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                    Create Gatepasses for Selected
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-8">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="h-4 w-4"
                          aria-label="Select all extracted orders"
                        />
                      </TableHead>
                      <TableHead className="font-bold">Order No.</TableHead>
                      <TableHead className="font-bold">Invoice No.</TableHead>
                      <TableHead className="font-bold">Customer Name</TableHead>
                      <TableHead className="font-bold">Address</TableHead>
                      <TableHead className="font-bold text-center">Qty</TableHead>
                      <TableHead className="font-bold">Item Description</TableHead>
                      <TableHead className="font-bold text-right">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedOrders.map((order, orderIndex) => (
                      <React.Fragment key={orderIndex}>
                        <TableRow className="bg-gray-50 hover:bg-gray-100 border-b-2">
                          <TableCell className="px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedExtracted[orderIndex]}
                              onChange={(e) => setSelectedExtracted(prev => ({ ...prev, [orderIndex]: e.target.checked }))}
                              className="h-4 w-4"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-gray-700">{order.orderNo}</TableCell>
                          <TableCell className="text-xs font-semibold text-gray-600">{order.invoiceNo || '—'}</TableCell>
                          <TableCell className="font-bold text-gray-800">{order.customerName}</TableCell>
                          <TableCell className="max-w-xs text-xs text-gray-700" title={order.address}>
                            {order.address}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-700">{order.qty || 0}</TableCell>
                          <TableCell colSpan={2} className="text-right font-bold text-green-700">
                            TOTAL: ₹{order.amount}
                          </TableCell>
                        </TableRow>
                        
                        {order.items && order.items.length > 0 && (
                          <TableRow className="bg-white">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 space-y-4">
                                <div>
                                  <h4 className="font-semibold text-base mb-3">📦 Items in this Order:</h4>
                                  <p className="text-xs text-muted-foreground mb-3">Order ID: <span className="font-mono font-bold">{order.orderNo}</span> | Invoice: <span className="font-mono font-bold">{order.invoiceNo || '—'}</span> | Customer: <span className="font-bold">{order.customerName}</span></p>
                                  
                                  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                                    <p className="text-sm font-semibold text-yellow-800">
                                      ⚠️ IMPORTANT: Map each extracted item to an actual product from the database. Only mapped products will be saved.
                                    </p>
                                  </div>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-gray-100 border-b">
                                        <th className="px-4 py-3 text-left font-bold text-gray-800">Extracted Item</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-800">➜ Map to Actual Product (This will be saved)</th>
                                        <th className="px-4 py-3 text-center font-bold text-gray-800 w-20">Qty</th>
                                        <th className="px-4 py-3 text-right font-bold text-gray-800 w-32">Unit Price (₹)</th>
                                        <th className="px-4 py-3 text-right font-bold text-gray-800 w-32">Total (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {order.items.map((item, itemIndex) => {
                                        const unitPrice = item.qty > 0 ? (item.total / item.qty).toFixed(2) : item.total.toFixed(2);
                                        const mappingKey = `${orderIndex}|${itemIndex}`;
                                        const selectedProductId = productMapping[orderIndex]?.[itemIndex];
                                        const selectedProduct = products.find(p => p.id === selectedProductId);
                                        
                                        return (
                                          <tr key={itemIndex} className="border-b hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 text-sm break-words font-medium text-gray-900">
                                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                                                ❌ From PDF: {item.product}
                                              </span>
                                              <p className="text-xs text-gray-500 mt-1">(Not being saved)</p>
                                            </td>
                                            <td className="px-4 py-3">
                                              {(() => {
                                                const searchKey = `${orderIndex}|${itemIndex}`;
                                                const selectedProductId = productMapping[orderIndex]?.[itemIndex];
                                                const selectedProduct = products.find(p => p.id === selectedProductId);
                                                const searchText = productSearchText[orderIndex]?.[itemIndex] || '';
                                                const isOpen = openDropdown === searchKey;
                                                
                                                const candidates = (matchedMap[orderIndex]?.matches || []).map(p => p.id);
                                                const searchLower = (searchText || '').toLowerCase().trim();

                                                let matchedList = [] as Product[];
                                                if (searchLower.length === 0) {
                                                  // Show ALL products when search is empty
                                                  matchedList = products;
                                                } else {
                                                  const bySearch = products.filter(prod => {
                                                    const searchQ = searchLower.trim();
                                                    const prodName = (prod.name || '').toLowerCase().trim();
                                                    const prodCode = (prod.code || '').toString().toLowerCase().trim();
                                                    return prodName.includes(searchQ) || prodCode.includes(searchQ);
                                                  });
                                                  matchedList = bySearch;
                                                }

                                                const filteredProducts = matchedList;
                                                
                                                return (
                                                  <div className="w-full">
                                                    <Popover open={isOpen} onOpenChange={(open) => setOpenDropdown(open ? searchKey : null)}>
                                                      <PopoverTrigger asChild>
                                                        <input
                                                          type="text"
                                                          placeholder="Type product name or code..."
                                                          value={searchText}
                                                          onChange={(e) => {
                                                            const newSearch = { ...productSearchText };
                                                            if (!newSearch[orderIndex]) newSearch[orderIndex] = {};
                                                            newSearch[orderIndex][itemIndex] = e.target.value;
                                                            setProductSearchText(newSearch);
                                                            setOpenDropdown(searchKey);
                                                            setTimeout(() => inputRefs.current[searchKey]?.focus(), 0);
                                                          }}
                                                          ref={(el) => { inputRefs.current[searchKey] = el; }}
                                                          onFocus={() => setOpenDropdown(searchKey)}
                                                          className="w-full px-3 py-2 border-2 border-gray-300 rounded bg-white text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none"
                                                        />
                                                      </PopoverTrigger>

                                                      <PopoverContent className="p-0 min-w-[450px] max-h-96 overflow-hidden flex flex-col">
                                                        {/* Search Box in Dropdown */}
                                                        <div className="sticky top-0 bg-white border-b p-2 z-10">
                                                          <input
                                                            type="text"
                                                            placeholder="🔍 Search here..."
                                                            value={searchText}
                                                            onChange={(e) => {
                                                              const newSearch = { ...productSearchText };
                                                              if (!newSearch[orderIndex]) newSearch[orderIndex] = {};
                                                              newSearch[orderIndex][itemIndex] = e.target.value;
                                                              setProductSearchText(newSearch);
                                                            }}
                                                            autoFocus
                                                            className="w-full px-3 py-2 border border-blue-300 rounded bg-blue-50 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                          />
                                                        </div>
                                                        
                                                        {/* Products and Combos List */}
                                                        <div className="overflow-y-auto flex-1">
                                                          {filteredProducts.map((prod) => (
                                                            <div
                                                              key={prod.id}
                                                              onClick={() => {
                                                                const newMapping = { ...productMapping };
                                                                if (!newMapping[orderIndex]) newMapping[orderIndex] = {};
                                                                newMapping[orderIndex][itemIndex] = prod.id;
                                                                setProductMapping(newMapping);

                                                                const newSearch = { ...productSearchText };
                                                                if (!newSearch[orderIndex]) newSearch[orderIndex] = {};
                                                                newSearch[orderIndex][itemIndex] = '';
                                                                setProductSearchText(newSearch);

                                                                setOpenDropdown(null);

                                                                handleProductMapping(orderIndex, itemIndex, prod.id);
                                                              }}
                                                              className="px-4 py-3 hover:bg-blue-100 cursor-pointer border-b text-sm transition"
                                                            >
                                                              <div className="font-semibold text-gray-900 truncate">
                                                                {prod.name}
                                                              </div>
                                                              <div className="text-xs text-gray-600 mt-1">
                                                                {prod.code && <span className="bg-gray-100 px-2 py-1 rounded mr-2">Code: {prod.code}</span>}
                                                                {prod.size && <span className="bg-gray-100 px-2 py-1 rounded">Size: {prod.size}</span>}
                                                              </div>
                                                            </div>
                                                          ))}
                                                        
                                                        {/* Combo Kit Section - Always Show */}
                                                        {combos.length > 0 && (
                                                          <>
                                                            {filteredProducts.length > 0 && <div className="px-4 py-2 text-xs font-semibold bg-blue-50 text-blue-700 border-t sticky top-[48px]">📦 COMBO KITS</div>}
                                                            {combos.map((combo) => (
                                                              <div
                                                                key={`combo-${combo.combo_id}`}
                                                                onClick={() => {
                                                                  // Expand combo and add ALL items to the order
                                                                  const expandedItems = expandComboToItems(combo, 1);
                                                                  const newOrders = [...extractedOrders];
                                                                  const order = newOrders[orderIndex];

                                                                  if (!order.items) order.items = [];

                                                                  // Convert expanded items into order item format
                                                                  const comboOrderItems = expandedItems.map((item) => {
                                                                    // Try to auto-map by product code
                                                                    const matchedProduct = products.find(p => 
                                                                      p.code && item.product_code && 
                                                                      p.code.toLowerCase().trim() === item.product_code.toLowerCase().trim()
                                                                    );
                                                                    
                                                                    return {
                                                                      product: item.product_name,
                                                                      qty: item.quantity,
                                                                      total: item.unit_price * item.quantity,
                                                                      mapped_product_id: matchedProduct?.id || item.product_id,
                                                                      sku: item.product_code,
                                                                    };
                                                                  });

                                                                  // Replace the current unmapped item with first combo item and add the rest
                                                                  order.items[itemIndex] = comboOrderItems[0];
                                                                  
                                                                  // Add remaining combo items to the order
                                                                  for (let i = 1; i < comboOrderItems.length; i++) {
                                                                    order.items.push(comboOrderItems[i]);
                                                                  }

                                                                  // Update order qty ONLY (NOT amount - keep original PDF amount)
                                                                  order.qty = order.items.reduce((sum, i) => sum + (i.qty || 0), 0);

                                                                  setExtractedOrders(newOrders);
                                                                  
                                                                  // Update mapping for all items
                                                                  const newMapping = { ...productMapping };
                                                                  if (!newMapping[orderIndex]) newMapping[orderIndex] = {};
                                                                  
                                                                  comboOrderItems.forEach((item, idx) => {
                                                                    newMapping[orderIndex][itemIndex + idx] = item.mapped_product_id;
                                                                  });
                                                                  setProductMapping(newMapping);

                                                                  const newSearch = { ...productSearchText };
                                                                  if (!newSearch[orderIndex]) newSearch[orderIndex] = {};
                                                                  newSearch[orderIndex][itemIndex] = '';
                                                                  setProductSearchText(newSearch);
                                                                  setOpenDropdown(null);

                                                                  // Auto-save all items to database and show mapping
                                                                  comboOrderItems.forEach((item, idx) => {
                                                                    handleProductMapping(orderIndex, itemIndex + idx, item.mapped_product_id);
                                                                  });

                                                                  showSuccess(`✅ Added & mapped combo "${combo.combo_name}" with ${expandedItems.length} items!`);
                                                                }}
                                                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b text-sm transition"
                                                              >
                                                                <div className="font-semibold text-blue-900 truncate">
                                                                  {combo.combo_name}
                                                                </div>
                                                                <div className="text-xs text-blue-700 mt-1">
                                                                  {combo.combo_code && <span className="bg-blue-100 px-2 py-1 rounded mr-2">Code: {combo.combo_code}</span>}
                                                                  <span className="bg-blue-100 px-2 py-1 rounded">📦 {combo.item_count} items</span>
                                                                </div>
                                                              </div>
                                                            ))}
                                                          </>
                                                        )}
                                                        {filteredProducts.length === 0 && combos.length === 0 && (
                                                          <div className="px-4 py-3 text-sm text-gray-500">
                                                            No products or combos found
                                                          </div>
                                                        )}
                                                        </div>
                                                      </PopoverContent>
                                                    </Popover>

                                                    {selectedProduct && (
                                                      <div className="mt-2 space-y-2">
                                                        <div className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded border border-green-200">
                                                          <div className="flex items-center gap-2">
                                                            <span className="font-semibold">✅ WILL SAVE:</span>
                                                            <span className="font-semibold truncate">{selectedProduct.name}</span>
                                                            <button
                                                              type="button"
                                                              onClick={() => handleDeleteMapping(orderIndex, itemIndex)}
                                                              className="ml-2 text-red-600 hover:text-red-800 rounded p-1"
                                                              title="Delete mapped item"
                                                            >
                                                              <Trash2 className="h-4 w-4" />
                                                            </button>
                                                          </div>
                                                          <div className="flex items-center gap-2 mt-1 text-[11px] text-green-800">
                                                            {selectedProduct.code && <span className="bg-white px-2 py-0.5 rounded border">Code: {selectedProduct.code}</span>}
                                                            {selectedProduct.size !== undefined && selectedProduct.size !== null && <span className="bg-white px-2 py-0.5 rounded border">Size: {selectedProduct.size}</span>}
                                                            {selectedProduct.dp !== undefined && selectedProduct.dp !== null && <span className="bg-white px-2 py-0.5 rounded border">DP: ₹{selectedProduct.dp.toFixed(2)}</span>}
                                                          </div>
                                                        </div>
                                                        
                                                        {/* Price Comparison */}
                                                        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 space-y-1">
                                                          <div className="font-semibold text-blue-900 mb-1.5">💰 PRICE COMPARISON:</div>
                                                          <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Catalog Price (DP):</span>
                                                            <span className="font-bold text-blue-700">₹{selectedProduct.dp?.toFixed(2) || '0.00'}/unit</span>
                                                          </div>
                                                          <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Order Total:</span>
                                                            <span className="font-bold text-blue-700">₹{item.total.toFixed(2)}</span>
                                                          </div>
                                                          <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Extracted Unit Price:</span>
                                                            <span className="font-bold text-amber-600">₹{unitPrice}</span>
                                                          </div>
                                                          <div className="border-t border-blue-200 pt-1 mt-1 flex justify-between items-center">
                                                            <span className="text-gray-700 font-semibold">Difference:</span>
                                                            <span className={`font-bold text-lg ${(item.total - (selectedProduct.dp * item.qty)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                              {(item.total - (selectedProduct.dp * item.qty)) > 0 ? '+' : ''}
                                                              ₹{(item.total - (selectedProduct.dp * item.qty)).toFixed(2)}
                                                            </span>
                                                          </div>
                                                          <div className="text-[10px] text-gray-500 mt-1 italic">
                                                            {Math.abs(item.total - (selectedProduct.dp * item.qty)) > 0 && 
                                                              `(${(((item.total - (selectedProduct.dp * item.qty)) / (selectedProduct.dp * item.qty)) * 100).toFixed(0)}% ${(item.total - (selectedProduct.dp * item.qty)) > 0 ? 'higher' : 'lower'})`
                                                            }
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )}
                                                    {!selectedProduct && (
                                                      <div className="text-xs text-red-600 mt-2 font-semibold flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-200">
                                                        <span>⚠️</span>
                                                        <span>NOT MAPPED - Won't save</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <input
                                                type="number"
                                                min="1"
                                                value={item.qty}
                                                onChange={(e) => {
                                                  const newOrders = [...extractedOrders];
                                                  const newQty = parseInt(e.target.value) || 1;
                                                  const unitPriceVal = parseFloat(unitPrice);
                                                  // Update qty
                                                  newOrders[orderIndex].items![itemIndex].qty = newQty;
                                                  // Recalculate total based on new qty
                                                  newOrders[orderIndex].items![itemIndex].total = newQty * unitPriceVal;
                                                  // Update order qty ONLY (NOT amount - keep original PDF amount)
                                                  newOrders[orderIndex].qty = newOrders[orderIndex].items!.reduce((sum, i) => sum + i.qty, 0);
                                                  setExtractedOrders(newOrders);
                                                }}
                                                className="w-16 px-2 py-1 border rounded text-center font-bold text-blue-600"
                                              />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                              <div className="flex items-center justify-end gap-1">
                                                <span className="text-xs text-gray-600">₹</span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={unitPrice}
                                                  onChange={(e) => {
                                                    const newOrders = [...extractedOrders];
                                                    const newUnitPrice = parseFloat(e.target.value) || 0;
                                                    const qty = order.items![itemIndex].qty;
                                                    // Update total based on new unit price (NOT amount - keep original PDF amount)
                                                    newOrders[orderIndex].items![itemIndex].total = qty * newUnitPrice;
                                                    setExtractedOrders(newOrders);
                                                  }}
                                                  className="w-40 px-2 py-1 border rounded text-right font-semibold text-gray-700"
                                                />
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600 text-base">₹{item.total.toFixed(2)}</td>
                                          </tr>
                                        );
                                      })}
                                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                                        <td colSpan={2} className="px-4 py-3 font-bold text-right text-gray-800">
                                          Order Total:
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-600 text-base">
                                          {order.items.reduce((sum, i) => sum + i.qty, 0)}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                                          ₹{order.items.reduce((sum, i) => sum + i.total, 0).toFixed(2)}
                                        </td>
                                      </tr>
                                      {/* Price Variance Summary Row */}
                                      <tr className="bg-blue-50 border-t border-blue-200">
                                        <td colSpan={5} className="px-4 py-3">
                                          <div className="grid grid-cols-4 gap-4 text-sm">
                                            <div>
                                              <div className="text-gray-600 text-xs">Original Order Total (PDF):</div>
                                              <div className="font-bold text-blue-700">₹{parseFloat(order.amount).toFixed(2)}</div>
                                            </div>
                                            <div>
                                              <div className="text-gray-600 text-xs">Current Order Total (Mapped):</div>
                                              <div className="font-bold text-blue-700">₹{order.items.reduce((sum, i) => sum + i.total, 0).toFixed(2)}</div>
                                            </div>
                                            <div className="col-span-2">
                                              <div className="text-gray-700 text-xs font-semibold">Variance:</div>
                                              <div className={`font-bold text-lg ${(order.items.reduce((sum, i) => sum + i.total, 0) - parseFloat(order.amount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {(order.items.reduce((sum, i) => sum + i.total, 0) - parseFloat(order.amount)) > 0 ? '+' : ''}
                                                ₹{(order.items.reduce((sum, i) => sum + i.total, 0) - parseFloat(order.amount)).toFixed(2)} 
                                                ({(((order.items.reduce((sum, i) => sum + i.total, 0) - parseFloat(order.amount)) / parseFloat(order.amount)) * 100).toFixed(0)}%)
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SpartanOrderExtractor;
