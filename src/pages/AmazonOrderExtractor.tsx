"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, AlertCircle, Eye, EyeOff, Save, ListChecks, Trash2, Package } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { buildStagingFromRows } from '@/utils/onlineOrderHelpers';
import * as pdfjsLib from 'pdfjs-dist';

// Import the worker directly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ExtractedOrder {
  orderNo: string;
  customerName: string;
  address: string;
  item: string;
  amount: string;
  invoiceNo?: string;
  qty?: number;
  items?: Array<{product: string; qty: number; total: number; mapped_product_id?: string; sku?: string}>;
  sourceText?: string;
}

interface Product { id: string; name: string; code?: string; size?: string | number | null; dp?: number; gst?: string | number }

const AmazonOrderExtractor = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);
  const [selectedExtracted, setSelectedExtracted] = useState<Record<number, boolean>>({});
  const selectAllRef = React.useRef<HTMLInputElement | null>(null);
  const [dispatchSeries, setDispatchSeries] = useState<string>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [matchedMap, setMatchedMap] = useState<Record<number, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});
  const [productMapping, setProductMapping] = useState<Record<number, Record<number, string>>>({});
  const [productSearchText, setProductSearchText] = useState<Record<number, Record<number, string>>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        let allProducts: any[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, code, size, dp, gst')
            .order('name')
            .range(offset, offset + pageSize - 1);
          
          if (error) throw error;

          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allProducts = [...allProducts, ...data];
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              offset += pageSize;
            }
          }
        }

        console.log('✅ All products loaded:', allProducts.length);
        setProducts(allProducts);
      } catch (e) {
        console.error('Failed to load products for Amazon extractor', e);
      }
    };
    fetchProducts();
  }, []);

  // build matchedMap when products or extractedOrders change
  useEffect(() => {
    if (!products || products.length === 0 || extractedOrders.length === 0) return;
    const extractNumericToken = (str?: string) => {
      if (!str) return undefined;
      const nums = str.match(/\d{2,}/g);
      if (!nums) return undefined;
      return nums.sort((a, b) => b.length - a.length)[0];
    };
    const normalize = (s?: string) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const enriched = products.map(p => ({ ...p, normCode: normalize(p.code as any), normName: (p.name || '').toLowerCase(), numericParts: (p.code || '').toString().match(/\d{2,}/g) || [] } as any));

    const map: typeof matchedMap = {} as any;
    extractedOrders.forEach((ord, idx) => {
      const text = ord.item || '';
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
        }
        return false;
      });

      const candidateProducts: Product[] = candidates.map((c: any) => ({ id: c.id, name: c.name, code: c.code, size: c.size }));
      map[idx] = { matches: candidateProducts, selectedId: candidateProducts.length === 1 ? candidateProducts[0].id : undefined, debug: { numericToken, normText, candidateCodes: candidateProducts.map(cp => (cp.code || '').toString()) } };
    });
    setMatchedMap(map);
  }, [products, extractedOrders]);

  const allSelected = extractedOrders.length > 0 && extractedOrders.every((_, idx) => !!selectedExtracted[idx]);
  const someSelected = extractedOrders.some((_, idx) => !!selectedExtracted[idx]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = !allSelected && someSelected;
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

  const handleCreateGatepassesForSelected = async () => {
    const selectedIndexes = Object.keys(selectedExtracted).filter(k => selectedExtracted[Number(k)]).map(k => Number(k));
    if (selectedIndexes.length === 0) {
      showError('No extracted orders selected.');
      return;
    }

    let isCreating = true;
    try {
      // ensure dealer 'Online Order' exists
      let { data: dealerData, error: dealerErr } = await supabase.from('dealers').select('id').eq('name', 'Online Order').maybeSingle();
      if (dealerErr) console.warn('Dealer lookup error (will attempt to create):', dealerErr);
      if (!dealerData) {
        const { data: createdDealer, error: createErr } = await supabase.from('dealers').insert({ name: 'Online Order' }).select('id').single();
        if (createErr) throw createErr;
        dealerData = createdDealer as any;
      }

      // ensure Amazon platform id exists
      let amazonPlatformId: string | null = null;
      try {
        const { data: pf, error: pfErr } = await supabase.from('online_platforms').select('id').eq('name', 'Amazon').single();
        if (pfErr || !pf) {
          const { data: createdPf, error: createPfErr } = await supabase.from('online_platforms').insert({ name: 'Amazon' }).select('id').single();
          if (!createPfErr && createdPf) amazonPlatformId = createdPf.id;
        } else { amazonPlatformId = pf.id; }
      } catch (e) { console.warn('Failed to ensure Amazon platform id', e); }

      let createdCount = 0;
      for (const idx of selectedIndexes) {
        const order = extractedOrders[idx];
        if (!order) continue;
        const totalAmount = parseFloat(order.amount as any) || 0;
        // request sequence
        let seqNum: number | null = null;
        try {
          const { data: seqData, error: seqErr } = await supabase.rpc('get_next_online_order_seq').single();
          if (!seqErr && seqData) seqNum = seqData as unknown as number;
        } catch (rpcErr) { console.warn('get_next_online_order_seq RPC failed', rpcErr); }

        const platformName = 'Amazon';
        const platformPrefix = 'A';
        const displaySeq = seqNum ?? Date.now();

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
          bill_no: order.invoiceNo || null,
        };

        const { data: newOnlineOrder, error: onlineErr } = await supabase.from('online_orders').insert(onlinePayload).select('id').single();
        if (onlineErr || !newOnlineOrder) {
          console.error('Online order create error', onlineErr);
          showError(`Failed to create online_order for ${order.orderNo}`);
          continue;
        }

        // insert online_order_details rows
        try {
          const detailsToInsert: any[] = (order.items || []).map((it, itemIndex) => ({
            order_id: newOnlineOrder.id,
            client_name: order.customerName,
            platform_id: amazonPlatformId,
            platform_order_number: order.orderNo,
            address: order.address,
            raw_item_name: it.product,
            mapped_product_id: it.mapped_product_id || null,
          }));

          if (detailsToInsert.length > 0) {
            const { data: detailRows, error: detailErr } = await supabase.from('online_order_details').insert(detailsToInsert).select('id, mapped_product_id');
            if (detailErr) {
              const msg = String(detailErr.message || detailErr.description || detailErr.code || 'Unknown error');
              if (msg.includes('online_order_details_order_id_fkey') || msg.includes('foreign key') || msg.includes('orders')) {
                console.error('DB schema mismatch: online_order_details.order_id still references orders(id)');
                showError('DB schema mismatch: online_order_details.order_id references orders(id). Run the migration to change the FK to reference online_orders(id) and retry.');
              } else {
                showError('Failed to save online order details: ' + msg);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to insert online_order_details', e);
        }

        createdCount++;
      }

      showSuccess(`Created ${createdCount} gatepass(es).` + (dispatchSeries ? ` Series: ${dispatchSeries}` : ''));
    } catch (error: any) {
      console.error('Gatepass creation error', error);
      showError(error.message || 'Failed to create gatepasses.');
    } finally {
      isCreating = false;
    }
  };

  // helper to escape regex
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Extract a product description from a block of text (SL block)
  function extractDescriptionFromBlock(block: string) {
    if (!block) return '';
    const lines = block.split(/\r?\n|\|/).map(l => l.trim()).filter(Boolean);
    const rejectRe = /^(invoice|total|amount in words|amount|mode of payment|billing address|shipping address|gst|gstin|place of supply|tax invoice|tax rate|hsn|sl no|sno|description|unit price|net amount|tax amount|order number)\b/i;

    const candidates: Array<{line: string; idx: number; score: number}> = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!/[A-Za-z]/.test(l)) continue;
      if (rejectRe.test(l)) continue;
      // ignore lines that look like totals, amounts, dates or header rows
      if (/\b(total|amount|invoice|gst|tax|qty|unit price|net amount)\b/i.test(l)) continue;
      if (/\d{1,2}\.\d{4}/.test(l)) continue; // dates like 03.2026
      // remove numeric tokens and punctuation to score by letter count
      const lettersOnly = l.replace(/[^A-Za-z\s]/g, '').trim();
      const score = lettersOnly.length;
      if (score > 5) candidates.push({ line: l, idx: i, score });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      // include following lines that look like continuation (letters, not header/amount)
      let out = best.line;
      for (let j = best.idx + 1; j < Math.min(lines.length, best.idx + 4); j++) {
        const nl = lines[j];
        if (!/[A-Za-z]/.test(nl)) break;
        if (rejectRe.test(nl)) break;
        if (/\b(total|amount|invoice|gst|tax|qty|unit price|net amount)\b/i.test(nl)) break;
        out += ' ' + nl;
      }
      return out.replace(/\s+/g, ' ').trim().slice(0, 400);
    }

    // fallback: remove amounts and HSN and return remaining descriptive text
    const cleaned = block.replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '').replace(/\bHSN\b\s*[:\s]*\d+/i, '').replace(/\bQty\b[^\n]*/i, '').replace(/\bUnit Price\b[^\n]*/i, '').replace(/\bTotal Amount\b[^\n]*/i, '').replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, 400).trim();
  }

  const extractDataFromPageText = (text: string): ExtractedOrder | null => {
    if (!text.includes("Tax Invoice/Bill of Supply/Cash Memo")) return null;

    const orderNoMatch = text.match(/\d{3}-\d{7}-\d{7}/);
    if (!orderNoMatch) return null;
    const orderNo = orderNoMatch[0];
    
    const amountSection = text.split(/Total\s*Amount/i)[1];
    const amounts = amountSection?.match(/₹\s*([\d,]+\.\d{2})/g);
    const amount = amounts ? amounts[amounts.length - 1].replace(/[₹\s,]/g, '') : "0.00";

    const itemMatch = text.match(/Description[\s\S]*?\n\s*\d+\s+([\s\S]+?)(?=\n\s*HSN|Qty|Unit|Price|TOTAL|Amount|$)/i);
    const item = itemMatch ? itemMatch[1].trim().replace(/\s+/g, ' ') : "Amazon Item";

    let customerName = "Unknown";
    let address = "N/A";

    const billingMatch = text.match(/Billing Address\s*:\s*\n\s*([\s\S]*?)(?=\s*(?:Phone|Pin|Order ID|Invoice|Seller|GSTIN)|$)/i);
    if (billingMatch) {
      const lines = billingMatch[1].trim().split('\n');
      if (lines.length > 0) {
        customerName = lines[0].trim();
        address = lines.slice(1).join(', ').trim();
      }
    }

    return { orderNo, customerName, address, item, amount };
  };

  // helper to split a potentially multi-item description into separate rows
  const splitItems = (item: string): string[] => {
    if (!item) return [''];
    // Avoid splitting on commas because product descriptions often contain commas.
    // Only split on newlines, pipe characters, or semicolons (or explicit SL No rows elsewhere).
    const parts = item
      .split(/\s*[\r\n|;]+\s*/)
      .map(p => p.trim())
      .filter(Boolean);
    return parts.length ? parts : [item];
  };

  // Parse qty and total from an SL block. Try multiple patterns and fall back to sensible defaults.
  const parseQtyAndTotal = (blockText: string, orderAmountFallback = 0) => {
    let qty = 1;
    let total = NaN;
    const cleaned = blockText.replace(/\u00A0/g, ' ');

    // Try to find explicit Qty: patterns
    const qtyMatch1 = cleaned.match(/(?:Qty|Quantity|QTY)[:\s]*([0-9]{1,4})\b/i);
    if (qtyMatch1) qty = parseInt(qtyMatch1[1], 10);

    // Try patterns like '₹12,345.00  2  ₹24,690.00' (unit price, qty, total)
    const qtyMatch2 = cleaned.match(/₹[\d,]+(?:\.\d{2})?\s+([0-9]{1,4})\s+₹[\d,]+(?:\.\d{2})?/);
    if (qtyMatch2) qty = parseInt(qtyMatch2[1], 10);

    // Try patterns like '2 x ₹123.45' or '₹123.45 x2' or '2×₹123.45'
    const qtyMatch3 = cleaned.match(/([0-9]{1,4})\s*[x×]\s*₹[\d,]+(?:\.\d{2})?/i) || cleaned.match(/₹[\d,]+(?:\.\d{2})?\s*[x×]\s*([0-9]{1,4})/i);
    if (qtyMatch3) qty = parseInt(qtyMatch3[1], 10);

    // Try to find explicit total in the block (last currency amount)
    const amtMatches = cleaned.match(/₹?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/g);
    if (amtMatches && amtMatches.length > 0) {
      const last = amtMatches[amtMatches.length - 1];
      const num = parseFloat(last.replace(/[^0-9\.]/g, '').replace(/,/g, ''));
      if (!isNaN(num)) total = num;
    }

    // If no explicit total but we have unit price and qty, compute total
    if (isNaN(total)) {
      // find unit price
      const unitMatch = cleaned.match(/₹\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/);
      if (unitMatch) {
        const unit = parseFloat(unitMatch[1].replace(/,/g, ''));
        if (!isNaN(unit) && qty) total = unit * qty;
      }
    }

    // Fallback to evenly splitting the order amount
    if (isNaN(total) || total <= 0) {
      total = orderAmountFallback || 0;
    }

    return { qty: Number.isFinite(qty) ? qty : 1, total };
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

      // invoice extraction helpers
      const invoiceRegex = /(?:Invoice(?:\s+No(?:\\.|:)?| Number)?|Bill\s*No(?:\\.|:)?)[:#\s-]*([A-Z0-9\\.\\/ -]{3,})/i;
      const labelRegex = /Invoice\s*(?:No(?:\\.|:)?|Number(?:\\.|:)?)\s*[:\\-]?\s*([^\r\n]+)/i;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join('\n');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        // Process only even-numbered pages (skip 1st, 3rd, 5th...).
        // Keep debug text for all pages but continue early for odd pages.
        if (i % 2 === 1) {
          console.log(`Skipping odd page ${i} (not processing for order extraction)`);
          continue;
        }

        // try to extract invoice number on this page
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

        const order = extractDataFromPageText(pageText);
        if (order) {
          // include the raw page text so we can later detect SL No rows and avoid splitting long descriptions
          const withSource = { ...(pageInvoice ? { ...order, invoiceNo: pageInvoice } : order), sourceText: pageText };
          allExtracted.push(withSource as ExtractedOrder);
        }
      }

      // attach document-level invoice if present
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
        throw new Error("No valid Amazon order patterns found. Check the Debug View.");
      }

      // expand rows when a single order contains multiple items and build items[]
      const expanded: ExtractedOrder[] = [];
      allExtracted.forEach(o => {
        // Decide whether to split the item text into multiple items.
        // If the original page text contains multiple SL No rows (1,2,...), then split;
        // If exactly 1 SL No: extract description from that block as a single product;
        // otherwise use the pre-extracted item as-is.
        const source = (o as ExtractedOrder).sourceText || '';
        // detect SL No lines ONLY as single digits at line start, followed by optional . or ), then spaces/tabs (NOT newlines) and a letter.
        // Using [ \t]+ instead of \s+ ensures we only match SL numbers with text on the SAME LINE (not state codes like "08" that are alone).
        const slMatches = (source.match(/^\d[\.)]?[ \t]+(?=[A-Za-z])/gm) || []).length;
        const shouldSplit = slMatches >= 2; // true when multiple SL numbers present (2+)
        const hasSingleSL = slMatches === 1; // exactly one SL number

        if (shouldSplit) {
          // Parse SL No blocks from the source text and treat each SL block as one item
          const slRegex = /^(\d)[\.\)]?[ \t]+(.*)$/gm; // capture the single digit and following text (spaces/tabs only, not newlines)
          const matches: Array<{idx: number; sl: string; text: string}> = [];
          let m: RegExpExecArray | null;
          while ((m = slRegex.exec(source)) !== null) {
            matches.push({ idx: m.index, sl: m[1], text: m[2] });
          }

          if (matches.length > 0) {
            for (let mi = 0; mi < matches.length; mi++) {
              const start = matches[mi].idx;
              const end = mi < matches.length - 1 ? matches[mi + 1].idx : source.length;
              const block = source.substring(start, end).trim();
              // remove the leading SL number (single digit + optional . or ) + whitespace) from block
              const blockText = block.replace(/^\d[\.)]?\s*/i, '').trim();
              // extract description from the SL block (prefer Description column)
              const desc = extractDescriptionFromBlock(blockText) || blockText.replace(/\s+/g, ' ');
              // try to find amount in the block, fallback to dividing equally
              const amtMatch = blockText.match(/\d{1,3}(?:,\d{3})*\.\d{2}/g);
              const total = amtMatch ? parseFloat(amtMatch[amtMatch.length - 1].replace(/,/g, '')) : (parseFloat(o.amount) || 0);
              // Extract QTY from table: look for pattern "₹[unit price] [qty] ₹[net amount]"
              const qtyFromTable = blockText.match(/₹[\d,\.]+\s+(\d+)\s+₹/);
              const qty = qtyFromTable ? parseInt(qtyFromTable[1]) : 1;
              expanded.push({ ...o, item: desc, qty, items: [{ product: desc, qty, total }] });
            }
          } else {
            // fallback to splitting by visible separators
            const parts = splitItems(o.item);
            const amountPer = parts.length ? parseFloat(o.amount) / parts.length : parseFloat(o.amount) || 0;
            parts.forEach(p => {
              expanded.push({ ...o, item: p, qty: 1, items: [{ product: p, qty: 1, total: amountPer }] });
            });
          }
        } else if (hasSingleSL) {
          // Exactly 1 SL number: extract description from that single block as ONE product
          const slRegex = /^(\d)[\.\)]?[ \t]+(.*)$/gm; // capture single digit and text (spaces/tabs only)
          const matches: Array<{idx: number; sl: string; text: string}> = [];
          let m: RegExpExecArray | null;
          while ((m = slRegex.exec(source)) !== null) {
            matches.push({ idx: m.index, sl: m[1], text: m[2] });
          }

          if (matches.length > 0) {
            const start = matches[0].idx;
            const end = matches.length > 1 ? matches[1].idx : source.length;
            const block = source.substring(start, end).trim();
            const blockText = block.replace(/^\d[\.)]?\s*/i, '').trim(); // remove single digit + . or ) + whitespace
            const desc = extractDescriptionFromBlock(blockText) || blockText.replace(/\s+/g, ' ');
            const amtMatch = blockText.match(/\d{1,3}(?:,\d{3})*\.\d{2}/g);
            const total = amtMatch ? parseFloat(amtMatch[amtMatch.length - 1].replace(/,/g, '')) : (parseFloat(o.amount) || 0);
            // Extract QTY from table: look for pattern "₹[unit price] [qty] ₹[net amount]"
            const qtyFromTable = blockText.match(/₹[\d,\.]+\s+(\d+)\s+₹/);
            const qty = qtyFromTable ? parseInt(qtyFromTable[1]) : 1;
            expanded.push({ ...o, item: desc, qty, items: [{ product: desc, qty, total }] });
          } else {
            // no SL block found, fallback to original item
            expanded.push({ ...o, qty: 1, items: [{ product: o.item, qty: 1, total: parseFloat(o.amount) || 0, sku: undefined }] });
          }
        } else {
          // No SL numbers: use original item as single product
          expanded.push({ ...o, qty: 1, items: [{ product: o.item, qty: 1, total: parseFloat(o.amount) || 0, sku: undefined }] });
        }
      });

      // Group expanded entries by order number so multiple pages for same order merge into one
      const grouped: Record<string, { order: ExtractedOrder; totalAmount: number }> = {};
      for (const o of expanded) {
        const key = o.orderNo;
        if (!grouped[key]) grouped[key] = { order: { ...o }, totalAmount: 0 };
        const amt = parseFloat(o.amount) || 0;
        grouped[key].totalAmount += amt;
        // merge items
        grouped[key].order.items = (grouped[key].order.items || []).concat(o.items || []);
      }

      // Preserve parsed item rows (do not merge identical product lines across pages).
      // Some PDFs duplicate layout across pages; merging identical product names can
      // incorrectly aggregate quantities. Keep each parsed item row as-is so the
      // displayed qty matches the fetched value and saved DB rows.
      const deduplicated = Object.values(grouped).map(g => {
        const order = g.order;
        // merge identical product lines (normalize product text) to avoid duplicate rows
        const mergedMap = new Map<string, { product: string; qty: number; total: number; mapped_product_id?: string; sku?: string }>();
        (order.items || []).forEach((it: any) => {
          const key = (it.product || '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
          const existing = mergedMap.get(key);
          if (existing) {
            // If the duplicate entry has the same total as existing, it's likely a repeated page
            // (same product displayed twice). In that case, keep the original values and do not double-count.
            if (Math.abs((existing.total || 0) - (it.total || 0)) < 0.01) {
              // prefer existing; but ensure mapped_product_id is preserved
              if (!existing.mapped_product_id && it.mapped_product_id) existing.mapped_product_id = it.mapped_product_id;
            } else {
              // different totals -> treat as distinct quantities (sum)
              existing.qty = (existing.qty || 0) + (it.qty || 0);
              existing.total = (existing.total || 0) + (it.total || 0);
              if (!existing.mapped_product_id && it.mapped_product_id) existing.mapped_product_id = it.mapped_product_id;
            }
          } else {
            mergedMap.set(key, { product: it.product, qty: it.qty || 0, total: it.total || 0, mapped_product_id: it.mapped_product_id, sku: it.sku });
          }
        });

        const items = Array.from(mergedMap.values()).map(it => ({ ...it }));
        const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0);
        const totalAmt = items.reduce((s, it) => s + (it.total || 0), 0).toFixed(2);
        return { ...order, items, qty: totalQty, amount: totalAmt } as ExtractedOrder;
      });

      console.log('Amazon extractor - deduplicated orders:', deduplicated);
      setExtractedOrders(deduplicated);
      showSuccess(`Successfully extracted ${deduplicated.length} orders (from ${allExtracted.length} entries)!`);
    } catch (error: any) {
      showError(error.message || "Failed to parse PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToStaging = async () => {
    if (!user || extractedOrders.length === 0) return;
    setIsSaving(true);
    try {
      const rawRows = extractedOrders.map(o => ({
        platform_order_number: o.orderNo,
        customer_name: o.customerName,
        shipping_address: o.address,
        item: o.item,
        amount: parseFloat(o.amount) || 0,
        bill_no: o.invoiceNo || ''
      }));

      // Build staging rows using the shared helper then remap the provider-specific item column
      const stagingData = buildStagingFromRows(rawRows, user.id).map((r: any) => {
        const { flipkart_item_name, ...rest } = r;
        return { ...rest, amazon_item_name: flipkart_item_name };
      });

      // Upsert using amazon_item_name as the provider-specific column (do not change Flipkart)
      const { error } = await supabase.from('online_order_staging').upsert(stagingData, { onConflict: 'platform_order_number,amazon_item_name' });

      if (error) throw error;

      showSuccess(`Saved ${extractedOrders.length} orders to staging area.`);
      navigate('/process-online-orders');
    } catch (error: any) {
      showError(`Failed to save to staging: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProductMapping = async (orderIndex: number, itemIndex: number, selectedProductId: string) => {
    console.log('🔵 handleProductMapping (Amazon):', { orderIndex, itemIndex, selectedProductId });
    try {
      // ensure auth
      let authUser = user;
      if (!authUser) {
        const { data: { session } } = await supabase.auth.getSession();
        authUser = session?.user ?? null;
      }
      if (!authUser) throw new Error('User not authenticated');

      const order = extractedOrders[orderIndex];
      if (!order) throw new Error('Order not found');
      const item = order.items?.[itemIndex];
      if (!item) throw new Error('Item not found');

      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) throw new Error('Product not found');

      const finalQty = item.qty || 1;
      const itemAmount = item.total || 0;

      // Delete old staging row with raw extracted item name (provider-specific column)
      const { error: deleteError } = await supabase
        .from('online_order_staging')
        .delete()
        .eq('platform_order_number', order.orderNo)
        .eq('amazon_item_name', item.product);
      if (deleteError) console.warn('Delete warning (may not exist):', deleteError.message);

      // Upsert mapped product row with mapped_product_id
      const { data, error: insertError } = await supabase
        .from('online_order_staging')
        .upsert([{
          platform_order_number: order.orderNo,
          customer_name: order.customerName || null,
          shipping_address: order.address || null,
          amazon_item_name: selectedProduct.name,
          amount: parseFloat(itemAmount.toString()) || 0,
          quantity: finalQty,
          bill_no: order.invoiceNo || '',
          created_by: authUser.id,
          status: 'pending',
          mapped_product_id: selectedProductId
        }], { onConflict: 'platform_order_number,amazon_item_name' })
        .select();

      // Use amazon_item_name onConflict for Amazon extractor
      if (insertError) {
        // try fallback: if DB schema still expects flipkart_item_name, retry with that to avoid breaking older schemas
        if ((insertError.message || '').toLowerCase().includes('column') || (insertError.message || '').toLowerCase().includes('flipkart_item_name')) {
          const { data: retryData, error: retryErr } = await supabase
            .from('online_order_staging')
            .upsert([{
              platform_order_number: order.orderNo,
              customer_name: order.customerName || null,
              shipping_address: order.address || null,
              flipkart_item_name: selectedProduct.name,
              amount: parseFloat(itemAmount.toString()) || 0,
              quantity: finalQty,
              bill_no: order.invoiceNo || '',
              created_by: authUser.id,
              status: 'pending',
              mapped_product_id: selectedProductId
            }], { onConflict: 'platform_order_number,flipkart_item_name' })
            .select();
          if (retryErr) throw retryErr;
        } else {
          throw insertError;
        }
      }
      showSuccess(`Mapped & saved: ${selectedProduct.name} | Qty: ${finalQty} | Amount: ₹${itemAmount.toFixed(2)}`);

      // Update local UI state
      setProductMapping(prev => ({ ...prev, [orderIndex]: { ...(prev[orderIndex] || {}), [itemIndex]: selectedProductId } }));
      setExtractedOrders(prev => {
        const next = [...prev];
        const o = { ...next[orderIndex] } as ExtractedOrder;
        if (o.items && o.items[itemIndex]) {
          const newItems = [...o.items];
          newItems[itemIndex] = { ...newItems[itemIndex], mapped_product_id: selectedProductId };
          o.items = newItems;
        }
        next[orderIndex] = o;
        return next;
      });

    } catch (error: any) {
      console.error('Mapping error (Amazon):', error);
      showError(`Failed to map product: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-start items-center mb-6">
          <Button variant="outline" onClick={() => navigate('/online-orders-admin')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Online Orders
          </Button>
        </div>

        <Card className="mb-8 border-2 border-primary/20 shadow-xl">
          <CardHeader className="bg-yellow-500 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Amazon Order Data Extractor</CardTitle>
                <CardDescription className="text-yellow-100">
                  Upload Amazon Shipping Labels (PDF) to automatically extract order details.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 bg-muted/5 hover:bg-muted/10 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Amazon Label PDF</h3>
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
                  <Button disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-white min-w-[200px]">
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
                  <CardDescription>Found {extractedOrders.length} orders in the document.</CardDescription>
                </div>
                <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSaveToStaging} disabled={isSaving} className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 border-none">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save to Staging
                        </Button>
                        <Input placeholder="Dispatch series (optional)" value={dispatchSeries} onChange={(e) => setDispatchSeries(e.target.value)} className="w-56 text-sm" />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCreateGatepassesForSelected()}
                          className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 border-none"
                        >
                          <ListChecks className="h-4 w-4" />
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
                      <TableHead className="font-bold">Customer Name</TableHead>
                      <TableHead className="font-bold">Address</TableHead>
                      <TableHead className="font-bold">Item Description</TableHead>
                      <TableHead className="font-bold">Invoice No.</TableHead>
                      <TableHead className="font-bold text-right">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                      {extractedOrders.map((order, index) => {
                      const candidates = matchedMap[index]?.matches || [];
                      const selectedId = matchedMap[index]?.selectedId;
                      const searchTerm = matchedMap[index]?.search || '';
                      const selected = selectedId ? products.find(p => p.id === selectedId) : null;

                      return (
                        <React.Fragment key={index}>
                            <TableRow className="hover:bg-muted/30">
                              <TableCell className="px-3">
                                <input
                                  type="checkbox"
                                  checked={!!selectedExtracted[index]}
                                  onChange={(e) => setSelectedExtracted(prev => ({ ...prev, [index]: e.target.checked }))}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-yellow-600">{order.orderNo}</TableCell>
                            <TableCell className="font-medium">{order.customerName}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={order.address}>
                              {order.address}
                            </TableCell>
                            <TableCell className="text-sm min-w-[600px]">
                              <div className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-wrap">{order.item}</div>
                              {selected && <div className="mt-1 text-xs font-bold text-blue-600">✓ {selected.name}</div>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{order.invoiceNo || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">₹{order.amount || '0.00'}</TableCell>
                          </TableRow>

                          {order.items && order.items.length > 0 && (
                            <TableRow className="bg-gray-50">
                              <TableCell colSpan={6} className="p-0">
                                <div className="p-4 space-y-4">
                                  <div>
                                    <h4 className="font-semibold text-base mb-3">📦 Items in this Order:</h4>
                                    <p className="text-xs text-muted-foreground mb-3">Order ID: <span className="font-mono font-bold">{order.orderNo}</span> | Invoice: <span className="font-mono font-bold">{order.invoiceNo || '—'}</span> | Customer: <span className="font-bold">{order.customerName}</span></p>
                                    <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                                      <p className="text-sm font-semibold text-yellow-800">⚠️ IMPORTANT: Map each extracted item to an actual product from the database. Only mapped products will be saved to staging.</p>
                                    </div>
                                  </div>
                                  <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-yellow-100 border-b">
                                          <th className="px-4 py-3 text-left font-bold text-gray-800">Extracted Item</th>
                                          <th className="px-4 py-3 text-left font-bold text-gray-800">➜ Map to Actual Product (This will be saved)</th>
                                          <th className="px-4 py-3 text-center font-bold text-gray-800 w-20">Qty</th>
                                          <th className="px-4 py-3 text-right font-bold text-gray-800 w-32">Total (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {order.items.map((it, itemIndex) => {
                                          const mappingKey = `${index}|${itemIndex}`;
                                          const selectedProductId = productMapping[index]?.[itemIndex] || it.mapped_product_id;
                                          const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;
                                          const searchText = productSearchText[index]?.[itemIndex] || '';

                                          return (
                                            <tr key={itemIndex} className="border-b hover:bg-yellow-50 transition">
                                              <td className="px-4 py-3 text-sm break-words font-medium text-gray-900">
                                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">❌ From PDF: {it.product}</span>
                                                <p className="text-xs text-gray-500 mt-1">(Not being saved)</p>
                                              </td>
                                              <td className="px-4 py-3">
                                                {selectedProduct ? (
                                                  <div className="text-sm">
                                                    <div className="font-bold text-green-700 flex items-center gap-2">✅ {selectedProduct.name}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">{selectedProduct.code} {selectedProduct.size ? `| Size: ${selectedProduct.size}` : ''}</div>
                                                  </div>
                                                ) : (
                                                  <Popover>
                                                    <PopoverTrigger asChild>
                                                      <Button variant="outline" size="sm" className="w-full text-left">{matchedMap[index]?.matches.length ? `→ Map Product (${matchedMap[index].matches.length})` : '→ Map Product'}</Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[600px] max-w-[90vw] p-0">
                                                      <div className="p-2 border-b">
                                                        <Input placeholder="Search product..." className="h-7 text-xs" value={searchText} onChange={(e) => setProductSearchText(prev => ({ ...prev, [index]: { ...(prev[index] || {}), [itemIndex]: e.target.value } }))} />
                                                      </div>
                                                      <ScrollArea className="h-96">
                                                        {matchedMap[index]?.matches.length ? (
                                                          matchedMap[index].matches.filter(p => {
                                                            const q = (productSearchText[index]?.[itemIndex] || '').toLowerCase().trim();
                                                            if (!q) return true;
                                                            const prodName = (p.name || '').toLowerCase().trim();
                                                            const prodCode = (p.code || '').toString().toLowerCase().trim();
                                                            return prodName.includes(q) || prodCode.includes(q);
                                                          }).map(p => (
                                                            <Button key={`cand-amazon-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={() => handleProductMapping(index, itemIndex, p.id)}>
                                                              <div className="text-left w-full"><div className="font-medium text-sm">{p.name}</div><div className="text-[11px] text-muted-foreground">{p.code} {p.size ? `| Size: ${p.size}` : ''}</div></div>
                                                            </Button>
                                                          ))
                                                        ) : null}
                                                        <div className="h-px bg-muted/30 my-2" />
                                                        {products.filter(p => {
                                                          const q = (productSearchText[index]?.[itemIndex] || '').toLowerCase().trim();
                                                          if (!q) return true;
                                                          const prodName = (p.name || '').toLowerCase().trim();
                                                          const prodCode = (p.code || '').toString().toLowerCase().trim();
                                                          return prodName.includes(q) || prodCode.includes(q);
                                                        }).map(p => (
                                                          <Button key={`all-amazon-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={() => handleProductMapping(index, itemIndex, p.id)}>
                                                            <div className="text-left w-full"><div className="font-medium text-sm">{p.name}</div><div className="text-[11px] text-muted-foreground">{p.code} {p.size ? `| Size: ${p.size}` : ''}</div></div>
                                                          </Button>
                                                        ))}
                                                      </ScrollArea>
                                                    </PopoverContent>
                                                  </Popover>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-center font-bold text-gray-700">{it.qty}</td>
                                              <td className="px-4 py-3 text-right font-bold text-green-600 text-base">₹{it.total.toFixed(2)}</td>
                                            </tr>
                                          );
                                        })}
                                        <tr className="bg-yellow-50 border-t-2 border-yellow-300">
                                          <td colSpan={1} className="px-4 py-3 font-bold text-right text-gray-800">Order Total:</td>
                                          <td className="px-4 py-3 text-center font-bold text-yellow-600 text-base">{order.items.reduce((sum, i) => sum + i.qty, 0)}</td>
                                          <td className="px-4 py-3"></td>
                                          <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">₹{order.items.reduce((sum, i) => sum + i.total, 0).toFixed(2)}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
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

export default AmazonOrderExtractor;