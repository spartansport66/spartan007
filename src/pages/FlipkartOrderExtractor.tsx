"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, Search, Download, AlertCircle, Eye, EyeOff, Save, ListChecks, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { buildStagingFromRows, upsertStaging, parseItemWithQty } from '@/utils/onlineOrderHelpers';
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
}

interface Product { id: string; name: string; code?: string; size?: string | number | null; dp?: number; gst?: string | number }

const FlipkartOrderExtractor = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);
  const [productMapping, setProductMapping] = useState<Record<string, Record<number, string>>>({});
  const [productSearchText, setProductSearchText] = useState<Record<string, Record<number, string>>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedExtracted, setSelectedExtracted] = useState<Record<number, boolean>>({});
  const [dispatchSeries, setDispatchSeries] = useState<string>('');
  const [isCreatingGatepasses, setIsCreatingGatepasses] = useState(false);

  // refs to keep text inputs focused across renders (keyed by "orderIndex|itemIndex")
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const [products, setProducts] = useState<Product[]>([]);
  const [matchedMap, setMatchedMap] = useState<Record<number, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase.from('products').select('id, name, code, size, dp, gst').order('name');
        if (error) throw error;
        setProducts(data || []);
      } catch (err: any) {
        console.error('Failed to fetch products:', err.message);
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

  // Auto-map items when they contain specific platform codes like SSCVB502 or SSCVB502A -> map to product code "VB 502(A)"
  useEffect(() => {
    if (products.length === 0 || extractedOrders.length === 0) return;

    // capture numeric part and optional trailing letters (e.g. "502A")
    const codeRegex = /ssc\s*vb\s*(\d+[a-zA-Z]*)/i;

    const updated = { ...productMapping };
    let changed = false;

    extractedOrders.forEach((order, orderIndex) => {
      order.items?.forEach((item, itemIndex) => {
        // skip if already mapped via UI or database
        const alreadyMapped = (updated[orderIndex] && updated[orderIndex][itemIndex]) || item.mapped_product_id;
        if (alreadyMapped) return;

        const text = item.product || '';
        const m = text.match(codeRegex) || text.match(/sscvb(\d+[a-zA-Z]*)/i);
        if (m) {
          const num = m[1]; // may be like '502' or '502A'
          const wantNorm = `vb${num}`.toLowerCase().replace(/\s+/g, '');

          // Prefer exact token matches like "VB 502A" (word boundaries) and exact normalized code equals.
          const regexToken = new RegExp(`\\bvb\\s*${escapeRegExp(num)}\\b`, 'i');
          const found = products.find(p => {
            const code = (p.code || '').toString();
            const name = (p.name || '').toString();
            if (regexToken.test(code)) return true; // exact code token match
            if (regexToken.test(name)) return true; // name contains exact token
            const codeNorm = code.toLowerCase().replace(/\s+/g, '');
            if (codeNorm === wantNorm) return true; // normalized exact
            return false;
          });

          if (found) {
            if (!updated[orderIndex]) updated[orderIndex] = {} as Record<number, string>;
            updated[orderIndex][itemIndex] = found.id;
            changed = true;
            // persist mapping immediately
            handleProductMapping(orderIndex, itemIndex, found.id).catch((err) => console.error('Auto-map failed', err));
          }
        }
      });
    });

    if (changed) setProductMapping(updated);
  }, [products, extractedOrders]);

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

  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // helper to split multi-item descriptions into separate rows
  const splitItems = (item: string): string[] => {
    if (!item) return [''];
    const parts = item
      .split(/\s*[\r\n,|;]+\s*/)
      .map(p => p.trim())
      .filter(Boolean);
    return parts.length ? parts : [item];
  };

  const extractDataFromPageText = (text: string): ExtractedOrder | null => {
    const orderNoMatch = text.match(/OD\d{18}/);
    if (!orderNoMatch) return null;

    const orderNo = orderNoMatch[0];
    const amountMatch = text.match(/TOTAL PRICE\s*[:\s]+\s*([\d,]+\.\d{2})/i);
    const amount = amountMatch ? amountMatch[1].trim().replace(/,/g, '') : "0.00";

    // Capture the full item description including pipe-separated codes (keep everything until IMEI/HSN/Qty/Product)
    const itemMatch = text.match(/Total\s*,?\s*([\s\S]*?)(?=\s*IMEI|\s*HSN|\s*Qty|\s*Product|$)/i);
    let item = itemMatch ? itemMatch[1].trim() : "N/A";
    // normalize spacing and preserve pipe separators (e.g. "... | SSCHB604 | ...")
    item = item.replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').replace(/^,\s*/, '').replace(/^\|+|\|+$/g, '').trim();

    let customerName = "Unknown";
    let address = "N/A";

    const addressBlockMatch = text.match(/(?:Deliver to|Shipping Address|Billing Address)[:\s]+([\s\S]*?)(?=\s*(?:FSSAI|Seller|Phone|Pin|Order ID|Invoice)|$)/i);
    
    if (addressBlockMatch) {
      const fullText = addressBlockMatch[1].trim();
      const parts = fullText.split(/,,|,/);
      customerName = parts[0].trim();
      address = parts.slice(1).join(", ").trim().replace(/\s+/g, ' ') || "N/A";
    } else {
      const fallbackMatch = text.match(new RegExp(`${orderNo}\\s+([\\s\\S]*?)(?=\\s*(?:Product|Description|Qty|FSSAI|Seller|Invoice)|$)`, 'i'));
      if (fallbackMatch) {
        const fullText = fallbackMatch[1].trim();
        const parts = fullText.split(/,,|,/);
        customerName = parts[0].trim();
        address = parts.slice(1).join(", ").trim().replace(/\s+/g, ' ') || "N/A";
      }
    }

    return { orderNo, customerName, address, item, amount };
  };

  const handleProductMapping = async (orderIndex: number, itemIndex: number, selectedProductId: string) => {
    console.log('🔵 handleProductMapping triggered:', { orderIndex, itemIndex, selectedProductId });
    
    try {
      // Get current user
      let authUser = user;
      if (!authUser) {
        const { data: { session } } = await supabase.auth.getSession();
        authUser = session?.user ?? null;
      }
      if (!authUser) throw new Error('User not authenticated');

      const order = extractedOrders[orderIndex];
      const item = order.items?.[itemIndex];
      if (!item) throw new Error('Item not found');

      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) throw new Error('Product not found');

      // Use item.qty directly - it's already the deduplicated/merged quantity from extraction
      // item.total is the total price for all items of this type combined
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
      // First try exact match, then a looser ilike (substring) match. If none updated, upsert a new mapped row.
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

      // more permissive invoice regex (captures common formats like INV-123/45, 12345, INV.123)
      const invoiceRegex = /(?:Invoice(?:\s+No(?:\.|:)?| Number)?|Bill\s*No(?:\.|:)?)[:#\s-]*([A-Z0-9\.\/-]{3,})/i;
      // explicit label matcher capturing the rest of the line after 'Invoice No' or 'Invoice Number'
      const labelRegex = /Invoice\s*(?:No(?:\.|:)?|Number(?:\.|:)?)\s*[:\-]?\s*([^\r\n]+)/i;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join('\n');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        // try to extract invoice on this page using label-first strategy
        const pageLabelMatch = pageText.match(labelRegex);
        let pageInvoice: string | undefined;
        if (pageLabelMatch) {
          pageInvoice = pageLabelMatch[1].trim();
        } else {
          const pageInvoiceMatch = pageText.match(invoiceRegex);
          pageInvoice = pageInvoiceMatch ? pageInvoiceMatch[1].trim() : undefined;
        }

        // Clean the captured value: prefer a token containing digits, otherwise reject non-numeric false-positives
        if (pageInvoice) {
          const tokenWithDigits = pageInvoice.match(/[A-Z0-9\-\/\.]*\d+[A-Z0-9\-\/\.]*/i);
          if (tokenWithDigits) {
            pageInvoice = tokenWithDigits[0];
          } else if (!/\d/.test(pageInvoice)) {
            pageInvoice = undefined;
          }
        }

        // Extract core order metadata (orderNo, customer, address) from page
        const orderMeta = extractDataFromPageText(pageText);
        if (!orderMeta) continue; // skip pages that don't contain an order number

        // Find the product table block by checking windows of adjacent lines for header keywords.
        // This is tolerant of headers split across several lines.
        const findProductTable = (txt: string): string | null => {
          const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const headerKeywords = ['product','description','qty','gross','discount','taxable','igst','cess','total'];
          for (let k = 0; k < lines.length; k++) {
            // build a window of up to 6 lines to accommodate split headers
            const windowLines = lines.slice(k, k + 6).join(' ').replace(/\s+/g, ' ');
            let matchCount = 0;
            for (const kw of headerKeywords) if (new RegExp('\\b' + kw + '\\b','i').test(windowLines)) matchCount++;
            if (matchCount >= 4 && /\bproduct\b/i.test(windowLines) && /\bqty\b/i.test(windowLines)) {
              // find footer/total line after header (look ahead up to 60 lines)
              let endIdx = k + 5;
              // prefer a 'TOTAL PRICE' line anywhere after the header if present
              const totalPriceIndex = lines.findIndex((ln, idx) => idx > k && /\btotal\s*price\b/i.test(ln));
              if (totalPriceIndex !== -1) {
                endIdx = totalPriceIndex;
              } else {
                for (let j = k + 1; j < Math.min(lines.length, k + 60); j++) {
                  if (/\btotal\s*price\b|\btotal\b|\bsubtotal\b/i.test(lines[j]) && /\d/.test(lines[j])) { endIdx = j; break; }
                }
              }
              return lines.slice(k, endIdx + 1).join('\n');
            }
          }
          return null;
        };

        const parseProductTable = (block: string) => {
          const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          // find header index (first line that contains product and qty)
          let headerIdx = lines.findIndex(l => /\bproduct\b/i.test(l) && /\bqty\b/i.test(l));
          if (headerIdx === -1) {
            for (let i = 0; i < Math.min(lines.length, 6); i++) {
              const win = lines.slice(i, i + 4).join(' ');
              if (/\bproduct\b/i.test(win) && /\bqty\b/i.test(win)) { headerIdx = i; break; }
            }
          }
          if (headerIdx === -1) headerIdx = 0;

          // find footer index (prefer TOTAL PRICE, fallback to last total-like line)
          let footerIdx = -1;
          for (let j = headerIdx + 1; j < lines.length; j++) {
            if (/\btotal\s*price\b/i.test(lines[j]) && /\d/.test(lines[j])) { footerIdx = j; break; }
          }
          if (footerIdx === -1) {
            for (let j = lines.length - 1; j > headerIdx; j--) {
              if (/\btotal\b|\bsubtotal\b/i.test(lines[j]) && /\d/.test(lines[j])) { footerIdx = j; break; }
            }
          }
          if (footerIdx === -1) footerIdx = lines.length - 1;

          const body = lines.slice(headerIdx + 1, footerIdx);
          const amountRe = /\d{1,3}(?:,\d{3})*\.\d{2}/g;

          // Parse product rows: find each row by HSN/SKU marker, extract all amounts and identify columns
          const rows: Array<{product: string; qty: number; gross: number; discount: number; igst: number; total: number}> = [];
          
          // Find all HSN occurrences - each marks a product row
          for (let i = 0; i < body.length; i++) {
            const ln = body[i];
            if (!/\bHSN\b/i.test(ln)) continue;
            
            // Found an HSN marker - collect product description and all amounts in block
            let productLines: string[] = [];
            const allAmountsInBlock: number[] = [];
            
            // Expand window: look back 5 lines, forward 8 lines to capture full product row data
            for (let k = Math.max(0, i - 5); k <= Math.min(body.length - 1, i + 8); k++) {
              if (body[k].match(/[A-Za-z]/)) {
                productLines.push(body[k]);
              }
              // Collect all amounts in this extended block
              const amounts = (body[k].match(/\d{1,3}(?:,\d{3})*\.\d{2}/g) || []).map(a => parseFloat(a.replace(/,/g, '')) || 0);
              allAmountsInBlock.push(...amounts);
            }
            
            let productText = productLines.join(' ');
            
            // Extract Qty
            let qty = 1;
            for (let k = i; k < Math.min(body.length, i + 3); k++) {
              const qtyMatch = body[k].match(/\bQty[:\s]?(\d+)\b/i);
              if (qtyMatch) {
                qty = parseInt(qtyMatch[1]) || 1;
                break;
              }
            }
            
            // Parse amounts: filter out noise (0, small values < 5), then identify columns
            // Expected columns in sorted order: Discount, IGST, Taxable, Total, Gross
            const cleanedAmts = allAmountsInBlock.filter(a => a > 5); // remove 0, 5, etc.
            const uniqueAmts = [...new Set(cleanedAmts)].sort((a, b) => a - b);
            let gross = 0, discount = 0, igst = 0, taxable = 0, total = 0;
            
            console.log(`HSN row ${i}: All amounts found: ${JSON.stringify(allAmountsInBlock)}, Filtered (>5): ${JSON.stringify(cleanedAmts)}, Unique sorted: ${JSON.stringify(uniqueAmts)}`);
            
            // Identify columns: [Discount, IGST, Taxable, Total, Gross]
            if (uniqueAmts.length >= 5) {
              // Full row: all 5 values present
              discount = uniqueAmts[0];
              igst = uniqueAmts[1];
              taxable = uniqueAmts[2];
              total = uniqueAmts[3];
              gross = uniqueAmts[4];
            } else if (uniqueAmts.length === 4) {
              // Missing Total: calculate it from Taxable + IGST
              discount = uniqueAmts[0];
              igst = uniqueAmts[1];
              taxable = uniqueAmts[2];
              gross = uniqueAmts[3];
              total = taxable + igst;
            } else if (uniqueAmts.length === 3) {
              // Assume: Discount, IGST, Total (Gross and Taxable missing, use Total as Gross)
              discount = uniqueAmts[0];
              igst = uniqueAmts[1];
              total = uniqueAmts[2];
              gross = total;
              taxable = total - igst;
            } else if (uniqueAmts.length >= 1) {
              total = uniqueAmts[uniqueAmts.length - 1];
              gross = total;
            }
            
            console.log(`  -> Assigned: Discount=${discount}, IGST=${igst}, Taxable=${taxable}, Total=${total}, Gross=${gross}`);
            
            if (total > 0) {
              // Keep the full product name without heavy cleaning - only remove monetary amounts and metadata
              let cleaned = productText
                .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '')  // remove amounts
                .replace(/\bHSN\b\s*[:\s]*\d+/i, '')  // remove HSN label and number
                .replace(/\bIGST\b[^%]*%/i, '')  // remove IGST% part
                .replace(/\bIMEI\b[^:]*:\s*\[\[.*?\]\]/i, '')  // remove IMEI/SrNo: [[...]]
                .replace(/\bSrNo\b[^:]*:\s*\[\[.*?\]\]/i, '')  // remove SrNo: [[...]]
                .replace(/\|\s*\|\s*CESS[^|]*/i, '')  // remove CESS sections
                .trim();
              // Clean up multiple spaces and pipes
              cleaned = cleaned.replace(/\s+/g, ' ').replace(/\|\s*\|/g, '|');
              if (cleaned.length > 5) {
                rows.push({ product: cleaned || 'Unknown', qty, gross, discount, igst, total });
              }
            }
          }

          // If no rows found by HSN, fall back to finding rows with large amounts
          if (rows.length === 0) {
            for (let i = 0; i < body.length; i++) {
              const amounts = (body[i].match(/\d{1,3}(?:,\d{3})*\.\d{2}/g) || []).map(a => parseFloat(a.replace(/,/g, '')) || 0);
              const largeAmounts = amounts.filter(a => a >= 600);
              if (largeAmounts.length > 0) {
                let productText = '';
                for (let k = Math.max(0, i - 4); k < i; k++) {
                  if (body[k].match(/[A-Za-z]/)) productText += ' ' + body[k];
                }
                let qty = 1;
                const qtyMatch = productText.match(/\bQty[:\s]?(\d+)\b/i);
                if (qtyMatch) qty = parseInt(qtyMatch[1]) || 1;
                
                const total = largeAmounts[largeAmounts.length - 1] || 0;
                let cleaned = productText
                  .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '')  // remove amounts
                  .replace(/\bHSN\b\s*[:\s]*\d+/i, '')  // remove HSN
                  .replace(/\bIGST\b[^%]*%/i, '')  // remove IGST%
                  .trim();
                cleaned = cleaned.replace(/\s+/g, ' ');
                if (cleaned.length > 5 && !rows.some(r => r.product === cleaned)) {
                  rows.push({ product: cleaned || 'Unknown', qty, gross: total, discount: 0, igst: 0, total });
                }
              }
            }
          }



          // determine order total from footer line (for reference only, we now use sum of calculated item totals)
          let orderTotal: number | undefined;
          const footerLine = lines[footerIdx] || '';
          const footerAmounts = footerLine.match(amountRe);
          if (footerAmounts && footerAmounts.length > 0) orderTotal = parseFloat(footerAmounts[footerAmounts.length - 1].replace(/,/g, '')) || undefined;

          return { rows, orderTotal };
        };

        const tableBlock = findProductTable(pageText);
        if (!tableBlock) continue; // skip if we didn't find the richer product table on this page

        const parsed = parseProductTable(tableBlock);
        if (parsed.rows.length === 0) continue; // nothing to extract

        // Build a single ExtractedOrder for this orderNo combining products
        const itemText = parsed.rows.map((r, idx) => 
          `${r.product} | Qty: ${r.qty} | Total=₹${r.total.toFixed(2)}`
        ).join('\n');
        const totalQty = parsed.rows.reduce((sum, r) => sum + r.qty, 0);
        const orderAmount = parsed.rows.reduce((s, r) => s + r.total, 0).toFixed(2);
        const itemsArray = parsed.rows.map(r => ({
          product: r.product,
          qty: r.qty,
          total: parseFloat(r.total.toFixed(2))
        }));

        allExtracted.push({ ...orderMeta, item: itemText, amount: orderAmount, invoiceNo: pageInvoice || orderMeta.invoiceNo, qty: totalQty, items: itemsArray });
      }
      // fallback: try to extract a shared invoice/bill number from the whole document (label-first)
      const docLabelMatch = fullDebugText.match(labelRegex);
      let docInvoiceNo: string | undefined;
      if (docLabelMatch) {
        docInvoiceNo = docLabelMatch[1].trim();
      } else {
        const docInvoiceMatch = fullDebugText.match(invoiceRegex);
        docInvoiceNo = docInvoiceMatch ? docInvoiceMatch[1].trim() : undefined;
      }
      if (docInvoiceNo) {
        const docTokenWithDigits = docInvoiceNo.match(/[A-Z0-9\-\/\.]*\d+[A-Z0-9\-\/\.]*/i);
        if (docTokenWithDigits) docInvoiceNo = docTokenWithDigits[0];
        else docInvoiceNo = undefined;
      }

      // attach document-level invoiceNo to any entries missing it
      if (docInvoiceNo) {
        allExtracted = allExtracted.map(a => ({ ...a, invoiceNo: a.invoiceNo || docInvoiceNo }));
      }

      setRawText(fullDebugText);
      
      if (allExtracted.length === 0) {
        throw new Error("No valid Flipkart order patterns found in the PDF.");
      }

      // Group by order number and sum totals (no re-parsing needed - items are already correct)
      const grouped: Record<string, { order: ExtractedOrder; totalAmount: number }> = {};
      allExtracted.forEach(o => {
        const key = o.orderNo;
        if (!grouped[key]) {
          grouped[key] = { order: { ...o }, totalAmount: 0 };
        }
        const amt = parseFloat(o.amount) || 0;
        grouped[key].totalAmount += amt;
        // Update order's amount to the sum
        grouped[key].order.amount = grouped[key].totalAmount.toFixed(2);
      });

      // Deduplicate items within each order
      // If same item appears multiple times, merge them: sum qty and total
      const deduplicateOrderItems = (order: ExtractedOrder): ExtractedOrder => {
        if (!order.items || order.items.length === 0) return order;
        
        const itemMap: Record<string, { product: string; qty: number; total: number }> = {};
        
        for (const item of order.items) {
          // Normalize product name for grouping (lowercase, trim whitespace)
          const normalizedKey = (item.product || '').toLowerCase().trim();
          
          if (itemMap[normalizedKey]) {
            // Duplicate item found - merge quantities and amounts
            itemMap[normalizedKey].qty += item.qty;
            itemMap[normalizedKey].total += item.total;
            console.log(`✅ Merged duplicate item: "${item.product}" | New Qty: ${itemMap[normalizedKey].qty} | New Total: ₹${itemMap[normalizedKey].total.toFixed(2)}`);
          } else {
            // First occurrence of this item
            itemMap[normalizedKey] = {
              product: item.product,
              qty: item.qty,
              total: item.total
            };
          }
        }
        
        // Update order with deduplicated items
        const deduplicatedItems = Object.values(itemMap);
        const newOrderQty = deduplicatedItems.reduce((sum, i) => sum + i.qty, 0);
        const newOrderAmount = deduplicatedItems.reduce((sum, i) => sum + i.total, 0).toFixed(2);
        
        return {
          ...order,
          items: deduplicatedItems,
          qty: newOrderQty,
          amount: newOrderAmount
        };
      };

      const finalOrders: ExtractedOrder[] = Object.values(grouped).map(g => deduplicateOrderItems(g.order));

      setExtractedOrders(finalOrders);
      showSuccess(`Successfully extracted ${finalOrders.length} orders (from ${allExtracted.length} documents)!`);
    } catch (error: any) {
      console.error("PDF Parsing Error:", error);
      showError(error.message || "Failed to parse PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToStaging = async () => {
    console.log('🔵 Save button clicked!');
    
    // Since items are saved as they're mapped, just verify all are mapped and navigate
    let unmappedCount = 0;
    for (const order of extractedOrders) {
      if (order.items) {
        for (let i = 0; i < order.items.length; i++) {
          const orderIdx = extractedOrders.indexOf(order);
          if (!productMapping[orderIdx]?.[i]) {
            unmappedCount++;
            console.warn(`⚠️ Item not mapped: ${order.items[i].product}`);
          }
        }
      }
    }

    if (unmappedCount > 0) {
      showError(`❌ Please map all ${unmappedCount} unmapped item(s) before proceeding!`);
      return;
    }

    console.log('✅ All items mapped! Proceeding to process orders...');
    showSuccess('✅ All items have been saved with mapped products!');
    setTimeout(() => {
      navigate('/process-online-orders');
    }, 1500);
  };

  const handleCreateGatepassesForSelected = async () => {
    const selectedIndexes = Object.keys(selectedExtracted).filter(k => selectedExtracted[Number(k)]).map(k => Number(k));
    if (selectedIndexes.length === 0) {
      showError('No extracted orders selected.');
      return;
    }

    setIsCreatingGatepasses(true);
    try {
      // get dealer 'Online Order'
      const { data: dealerData, error: dealerErr } = await supabase.from('dealers').select('id').eq('name', 'Online Order').single();
      if (dealerErr) throw dealerErr;

      // We'll generate an online order sequence per order using the new RPC

      // ensure we have the Flipkart platform id (online_platforms.id is UUID)
      let flipkartPlatformId: string | null = null;
      try {
        const { data: pf, error: pfErr } = await supabase.from('online_platforms').select('id').eq('name', 'Flipkart').single();
        if (pfErr || !pf) {
          const { data: createdPf, error: createPfErr } = await supabase.from('online_platforms').insert({ name: 'Flipkart' }).select('id').single();
          if (!createPfErr && createdPf) flipkartPlatformId = createdPf.id;
        } else {
          flipkartPlatformId = pf.id;
        }
      } catch (e) {
        console.warn('Failed to ensure Flipkart platform id', e);
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

        const platformName = 'Flipkart';
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

        // if user provided a dispatch series, prefix the bill_no so reports can include series
        if (dispatchSeries && insertPayload.bill_no) {
          insertPayload.bill_no = `${dispatchSeries}-${insertPayload.bill_no}`;
        }

        const { data: newOrder, error: orderErr } = await supabase.from('orders').insert(insertPayload).select('id').single();
        console.debug('FlipkartExtractor: orders.insert result', { newOrder, orderErr });
        if (orderErr || !newOrder) {
          console.error('Order create error', orderErr);
          showError(`Failed to create order for ${order.orderNo}`);
          continue;
        }

        // Mirror the created order into `online_orders` so older code reading that table still works
        try {
          const onlinePayload: any = {
            id: newOrder.id,
            order_number: `${platformName}-${displaySeq}`,
            order_sequence: seqNum || null,
            dealer_id: dealerData.id,
            user_id: user?.id || null,
            total_amount: totalAmount,
            status: 'completed',
            payment_status: 'paid',
            order_date: new Date().toISOString(),
            dispatched: false,
            dispatch_date: null,
            dispatch_number: `${platformName}-gatepass-${displaySeq}`,
            bill_no: order.invoiceNo || null,
          };
          const { data: onlineRow, error: onlineErr } = await supabase.from('online_orders').insert(onlinePayload).select('id').single();
          if (onlineErr) console.warn('Failed to insert mirror online_orders row', onlineErr);
          else console.debug('Inserted mirror online_orders row', onlineRow);
        } catch (e) {
          console.warn('Failed to insert mirror online_orders row', e);
        }

        // Insert online_order_details
        const combinedRawName = (order.items || []).map(i => `${i.product} — Qty:${i.qty}`).join('\n');
        const mapForOrder = productMapping[idx] || {};
        const firstMapKey = Object.keys(mapForOrder)[0];
        const groupMappedProductId = firstMapKey ? mapForOrder[Number(firstMapKey)] : null;
        let insertedDetail: any = null;
        try {
          const { data: detailRow, error: detailErr } = await supabase.from('online_order_details').insert({
            order_id: newOrder.id,
            client_name: order.customerName,
            platform_id: flipkartPlatformId,
            platform_order_number: order.orderNo,
            address: order.address,
            raw_item_name: combinedRawName,
            mapped_product_id: groupMappedProductId || null,
          }).select('id, mapped_product_id').single();
          console.debug('FlipkartExtractor: online_order_details.insert result', { detailRow, detailErr });
          if (detailErr) {
            console.warn('Failed to insert online_order_details', detailErr);
          } else {
            insertedDetail = detailRow;
          }
        } catch (e) {
          console.warn('Failed to insert online_order_details', e);
        }

        // Insert sales for each item
        for (let i = 0; i < (order.items || []).length; i++) {
          const it = order.items![i];
          const selectedProductId = productMapping[idx]?.[i] || matchedMap[idx]?.selectedId || (insertedDetail && insertedDetail.mapped_product_id) || null;
          const product = products.find(p => p.id === selectedProductId) || null;
          let gstPercent = 0;
          if (product) {
            gstPercent = parseFloat((product as any).gst) || 0;
            if (gstPercent > 0 && gstPercent <= 1) gstPercent = gstPercent * 100;
          }

          const qty = it.qty || 1;
          const unitBase = qty > 0 ? (it.total || 0) / qty : (it.total || 0);
          const unit_price = gstPercent > 0 ? unitBase / (1 + gstPercent / 100) : unitBase;

          try {
            if (!product || !product.id) {
              console.warn('Skipping sales insert for order', newOrder.id, 'item index', i, 'no mapped product id available');
            } else {
              const { error: salesErr } = await supabase.from('sales').insert({
                order_id: newOrder.id,
                product_id: product.id,
                quantity: qty,
                unit_price,
                gst_percent: gstPercent,
                total_price: it.total || 0,
              });
              console.debug('FlipkartExtractor: sales.insert result', { salesErr });
              if (salesErr) {
                console.error('Sales insert error', salesErr);
                showError(`Sales insert failed: ${salesErr.message || JSON.stringify(salesErr)}`);
              }
            }
          } catch (e) {
            console.error('Sales insert exception', e);
          }
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


  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
          </Button>
          <Button variant="secondary" onClick={() => navigate('/process-online-orders')} className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Process Staged Orders
          </Button>
        </div>

        <Card className="mb-8 border-2 border-primary/20 shadow-xl">
          <CardHeader className="bg-blue-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Flipkart Order Data Extractor</CardTitle>
                <CardDescription className="text-blue-100">
                  Upload Flipkart Shipping Labels (PDF) to automatically extract order details.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 bg-muted/5 hover:bg-muted/10 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Flipkart Label PDF</h3>
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
                  <Button disabled={loading} className="bg-blue-600 hover:bg-blue-700 min-w-[200px]">
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
                    <TableHead className="w-8" />
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
                        {/* Main Order Row */}
                        <TableRow className="bg-blue-50 hover:bg-blue-100 border-b-2">
                          <TableCell className="px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedExtracted[orderIndex]}
                              onChange={(e) => setSelectedExtracted(prev => ({ ...prev, [orderIndex]: e.target.checked }))}
                              className="h-4 w-4"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-blue-700">{order.orderNo}</TableCell>
                          <TableCell className="text-xs font-semibold text-blue-600">{order.invoiceNo || '—'}</TableCell>
                          <TableCell className="font-bold text-gray-800">{order.customerName}</TableCell>
                          <TableCell className="max-w-xs text-xs text-gray-700" title={order.address}>
                            {order.address}
                          </TableCell>
                          <TableCell className="text-center font-bold text-green-700">{order.qty || 0}</TableCell>
                          <TableCell colSpan={2} className="text-right font-bold text-green-700">
                            TOTAL: ₹{order.amount}
                          </TableCell>
                        </TableRow>
                        
                        {/* Items Sub-Table */}
                        {order.items && order.items.length > 0 && (
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 space-y-4">
                                <div>
                                  <h4 className="font-semibold text-base mb-3">📦 Items in this Order:</h4>
                                  <p className="text-xs text-muted-foreground mb-3">Order ID: <span className="font-mono font-bold">{order.orderNo}</span> | Invoice: <span className="font-mono font-bold">{order.invoiceNo || '—'}</span> | Customer: <span className="font-bold">{order.customerName}</span></p>
                                  
                                  {/* Warning/Info Banner */}
                                  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                                    <p className="text-sm font-semibold text-yellow-800">
                                      ⚠️ IMPORTANT: Map each extracted item to an actual product from the database. Only mapped products will be saved to staging.
                                    </p>
                                    <p className="text-xs text-yellow-700 mt-1">
                                      Unmapped items will be skipped and NOT saved.
                                    </p>
                                  </div>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-blue-100 border-b">
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
                                          <tr key={itemIndex} className="border-b hover:bg-blue-50 transition">
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
                                                
                                                // Build dropdown results:
                                                // - If user has typed text: show all products matching the text (name/code)
                                                // - If input is empty: show algorithmic candidate matches for this item (from matchedMap)
                                                // - When both apply, prioritize candidate matches at the top
                                                const candidates = (matchedMap[orderIndex]?.matches || []).map(p => p.id);
                                                const searchLower = (searchText || '').toLowerCase().trim();

                                                let matchedList = [] as Product[];
                                                if (searchLower.length === 0) {
                                                  // show only the candidate matches when no search typed
                                                  matchedList = products.filter(p => candidates.includes(p.id));
                                                } else {
                                                  // show products matching the search text
                                                  const bySearch = products.filter(prod => {
                                                    return (
                                                      prod.name.toLowerCase().includes(searchLower) ||
                                                      (prod.code ? prod.code.toLowerCase().includes(searchLower) : false)
                                                    );
                                                  });
                                                  // put candidate matches first (de-duplicated)
                                                  const candidateSet = new Set(candidates);
                                                  const candidateMatches = bySearch.filter(p => candidateSet.has(p.id));
                                                  const others = bySearch.filter(p => !candidateSet.has(p.id));
                                                  matchedList = [...candidateMatches, ...others];
                                                }

                                                const filteredProducts = matchedList; // Show all relevant products
                                                
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
                                                            // keep cursor focused in the same input so user can continue typing
                                                            setTimeout(() => inputRefs.current[searchKey]?.focus(), 0);
                                                          }}
                                                          ref={(el) => { inputRefs.current[searchKey] = el; }}
                                                          onFocus={() => setOpenDropdown(searchKey)}
                                                          className="w-full px-3 py-2 border-2 border-gray-300 rounded bg-white text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none"
                                                        />
                                                      </PopoverTrigger>

                                                      <PopoverContent className="p-0 min-w-[300px] max-h-80 overflow-y-auto">
                                                        {filteredProducts.length > 0 ? (
                                                          filteredProducts.map((prod) => (
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

                                                                // 🔴 REAL-TIME MAPPING: Save to database immediately!
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
                                                          ))
                                                        ) : (
                                                          <div className="px-4 py-3 text-sm text-gray-500">
                                                            No products found matching "{searchText}"
                                                          </div>
                                                        )}
                                                      </PopoverContent>
                                                    </Popover>

                                                    {/* Selected Product Display */}
                                                    {selectedProduct && (
                                                      <div className="text-xs text-green-700 mt-2 font-medium bg-green-50 px-2 py-1 rounded border border-green-200">
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
                                                          {selectedProduct.dp !== undefined && selectedProduct.dp !== null && <span className="bg-white px-2 py-0.5 rounded border">DP: {selectedProduct.dp}</span>}
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
                                                  // Update order amount and qty
                                                  newOrders[orderIndex].qty = newOrders[orderIndex].items!.reduce((sum, i) => sum + i.qty, 0);
                                                  newOrders[orderIndex].amount = newOrders[orderIndex].items!.reduce((sum, i) => sum + i.total, 0).toFixed(2);
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
                                                    // Update total based on new unit price
                                                    newOrders[orderIndex].items![itemIndex].total = qty * newUnitPrice;
                                                    // Update order amount
                                                    newOrders[orderIndex].amount = newOrders[orderIndex].items!.reduce((sum, i) => sum + i.total, 0).toFixed(2);
                                                    setExtractedOrders(newOrders);
                                                  }}
                                                  className="w-24 px-2 py-1 border rounded text-right font-semibold text-gray-700"
                                                />
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600 text-base">₹{item.total.toFixed(2)}</td>
                                          </tr>
                                        );
                                      })}
                                      {/* Summary Row */}
                                      <tr className="bg-blue-50 border-t-2 border-blue-300">
                                        <td colSpan={1} className="px-4 py-3 font-bold text-right text-gray-800">
                                          Order Total:
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600 text-base">
                                          {order.items.reduce((sum, i) => sum + i.qty, 0)}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                                          ₹{order.items.reduce((sum, i) => sum + i.total, 0).toFixed(2)}
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

export default FlipkartOrderExtractor;