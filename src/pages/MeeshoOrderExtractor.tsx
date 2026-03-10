"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, Search, Download, AlertCircle, Eye, EyeOff, Save, ListChecks, Trash2, Copy, User, Package } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { buildStagingFromRows, upsertStaging, parseItemWithQty, extractSkuToken } from '@/utils/onlineOrderHelpers';
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
  items?: Array<{product: string; qty: number; total: number; mapped_product_id?: string; sku?: string}>;
}

const MeeshoOrderExtractor = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

  interface Product { id: string; name: string; code?: string; size?: string | number | null; dp?: number; gst?: string | number }
  const [products, setProducts] = useState<Product[]>([]);
  const [matchedMap, setMatchedMap] = useState<Record<number, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase.from('products').select('id, name, code, size, dp, gst').order('name');
        if (error) throw error;
        setProducts(data || []);
      } catch (e) {
        console.error('Failed to load products for Meesho extractor', e);
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

  // helper to escape regex
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Try to find a SKU for a given item by searching nearby text in the page/document
  function findSkuForItem(docText: string, itemText: string): string | undefined {
    if (!docText || !itemText) return undefined;
    try {
      const it = itemText.trim();
      // Look for the item occurrence and search a window around it
      const lower = docText.toLowerCase();
      const idx = lower.indexOf(it.toLowerCase());
      const windowSize = 400;
      const start = idx >= 0 ? Math.max(0, idx - windowSize) : 0;
      const area = docText.substring(start, Math.min(docText.length, (idx >= 0 ? idx + it.length + windowSize : windowSize)));

      // Prioritize explicit "Product Details" table if present
      const prodDetailsMatch = docText.match(/Product\s*Details[\s\S]{0,600}/i);
      if (prodDetailsMatch) {
        const pd = prodDetailsMatch[0];
        // look for 'SKU' header followed by a value on the next line or same line
        const skuLine = pd.match(/SKU(?:\s*[:\-]?\s*)([A-Z0-9\-\/.]{3,})/i);
        if (skuLine && skuLine[1]) return skuLine[1].trim();
        // try header/value table style: find header tokens and following row tokens
        const lines = pd.split(/\r?\n|\|/).map(l => l.trim()).filter(Boolean);
        for (let i = 0; i < lines.length - 1; i++) {
          if (/\bsku\b/i.test(lines[i])) {
            // pick first token from next line that looks like SKU
            const next = lines[i+1];
            const toks = next.match(/([A-Z0-9\-\/]{3,})/gi);
            if (toks && toks.length) return toks[0];
          }
          // handle case where header and values are on same line
          if (/\bsku\b/i.test(lines[i])) {
            const toks = lines[i].match(/\bsku\b[^A-Za-z0-9]*([A-Z0-9\-\/]{3,})/i);
            if (toks && toks[1]) return toks[1];
          }
        }
      }

      // Common explicit labels
      const labelRe = /(?:SKU|Art\s*No|Product\s*Code|Code|Style\s*No|Article)[:\s\-]*([A-Z0-9\-\/.]{3,})/i;
      const labeled = area.match(labelRe);
      if (labeled && labeled[1]) return labeled[1].trim();

      // Table row style: try lines near the item and pick alpha+digit tokens
      const lines = area.split(/\r?\n|\|/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        // skip lines that equal the item text
        if (line.toLowerCase().includes(it.toLowerCase()) && /[A-Z0-9]/i.test(line)) {
          // look for candidate tokens in the same line
          const toks = line.match(/([A-Z0-9\-\/]{3,})/gi);
          if (toks) {
            const mixed = toks.find(t => /[A-Za-z]/.test(t) && /[0-9]/.test(t));
            if (mixed) return mixed;
            // otherwise return first that isn't just a short size like M/L/XL or a pure number
            const candidate = toks.find(t => !/^\d{1,3}$/.test(t) && !/^[SMLX]{1,4}$/i.test(t));
            if (candidate) return candidate;
          }
        }
      }

      // fallback: search entire area for alpha+digit tokens
      const wholeToks = area.match(/([A-Z0-9\-\/]{4,})/gi);
      if (wholeToks) {
        const mixed = wholeToks.find(t => /[A-Za-z]/.test(t) && /[0-9]/.test(t));
        if (mixed) return mixed;
        return wholeToks[0];
      }

      return undefined;
    } catch (e) {
      return undefined;
    }
  }

  const handleProductMapping = async (orderIndex: number, itemIndex: number, selectedProductId: string) => {
    console.log('🔵 handleProductMapping triggered (Meesho):', { orderIndex, itemIndex, selectedProductId });
    
    try {
      // Get current user
      let authUser = user;
      if (!authUser) {
        const { data: { session } } = await supabase.auth.getSession();
        authUser = session?.user;
      }
      if (!authUser) throw new Error('User not authenticated');

      const order = extractedOrders[orderIndex];
      const item = order.items?.[itemIndex];
      if (!item) throw new Error('Item not found');

      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) throw new Error('Product not found');

      const finalQty = item.qty || 1;
      const itemAmount = item.total || 0;

      console.log('📝 Mapping data:', {
        orderNo: order.orderNo,
        rawItemName: item.product,
        mappedProductName: selectedProduct.name,
        qty: finalQty,
        total: itemAmount
      });

      // Delete old staging row with raw extracted item name
      console.log('🗑️ Deleting old staging row with raw item name...');
      const { error: deleteError } = await supabase
        .from('online_order_staging')
        .delete()
        .eq('platform_order_number', order.orderNo)
        .eq('flipkart_item_name', item.product);

      if (deleteError) {
        console.warn('⚠️ Delete warning (may not exist):', deleteError.message);
      } else {
        console.log('✅ Deleted old row');
      }

      // Upsert new row with mapped product data
      console.log('✅ Upserting mapped product to staging...');
      const { data, error: insertError } = await supabase
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
        }], {
          onConflict: 'platform_order_number,flipkart_item_name'
        })
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Inserted mapped product row:', data);
      showSuccess(`✅ Mapped & saved: ${selectedProduct.name} | Qty: ${finalQty} | Amount: ₹${itemAmount.toFixed(2)}`);

      // Update UI state to reflect mapping (so it looks like Flipkart extractor)
      setMatchedMap(prev => ({ ...prev, [orderIndex]: { ...(prev[orderIndex] || { matches: [] }), selectedId: selectedProductId } }));
      setExtractedOrders(prev => {
        const next = [...prev];
        const o = { ...next[orderIndex] } as ExtractedOrder;
        if (o.items && o.items[itemIndex]) {
          const newItems = [...o.items];
          newItems[itemIndex] = { ...newItems[itemIndex], mapped_product_id: selectedProductId };
          o.items = newItems;
          // append product name to visible item text if not already present
          if (!o.item.includes(` — ${selectedProduct.name}`)) {
            o.item = `${o.item} — ${selectedProduct.name}`;
          }
        }
        next[orderIndex] = o;
        return next;
      });

    } catch (error: any) {
      console.error('❌ Mapping error:', error);
      showError(`Failed to map product: ${error.message}`);
    }
  };

  const extractDataFromPageText = (text: string): ExtractedOrder | null => {
    // 1. Extract Order ID (Meesho uses "Sub Order ID" or "Order ID")
    const orderNoMatch = text.match(/(?:Sub Order ID|Order ID|Order No)[:\s]*([a-zA-Z0-9_]+)/i) || 
                         text.match(/\b(sub_[a-zA-Z0-9]+)\b/i) ||
                         text.match(/\b(\d{14,18})\b/);
    
    if (!orderNoMatch) return null;
    const orderNo = orderNoMatch[1] || orderNoMatch[0];

    // 2. Extract Amount
    // Specifically look for the "Total" row at the bottom of the table: "Total Rs.XX.XX Rs.YY.YY"
    // The second Rs. value is usually the grand total.
    const totalRowMatch = text.match(/Total\s+Rs\.\d+\.\d+\s+Rs\.([\d,]+\.\d{2})/i);
    let amount = "0.00";
    
    if (totalRowMatch) {
      amount = totalRowMatch[1].trim().replace(/,/g, '');
    } else {
      // Fallback to general amount search
      const amountMatch = text.match(/(?:Total|Collectable Amount|Order Value|Price|Amount|Payable)[:\s]*₹?\s*([\d,]+(?:\.\d{2})?)/i) || 
                          text.match(/₹\s*([\d,]+(?:\.\d{2})?)/);
      amount = amountMatch ? amountMatch[1].trim().replace(/,/g, '') : "0.00";
    }

    // 3. Extract Item/Product Description
    // Look for the text after the table headers and before the HSN code (6-8 digits)
    const itemTableMatch = text.match(/(?:Description HSN Qty|Product Details)[\s\S]*?Total\s+([\s\S]*?)\s+\d{6,8}/i);
    let item = "N/A";
    
    if (itemTableMatch) {
      item = itemTableMatch[1].trim().replace(/\s+/g, ' ');
    } else {
      // Fallback to general description search
      const descMatch = text.match(/(?:Product|Description|Item Name|SKU)[:\s]+([\s\S]*?)(?=\s*(?:Qty|Size|Color|Price|HSN|GST|Details|Total)|$)/i);
      if (descMatch) {
        item = descMatch[1].trim();
      }
    }
    
    // Clean up common noise
    if (item.toLowerCase().includes("details sku")) item = "N/A";

    // 4. Extract Customer Name and Address
    let customerName = "Unknown";
    let address = "N/A";

    const nameMatch = text.match(/(?:Customer Name|Ship to|Deliver to|Name)[:\s]*([^\n,]+)/i);
    if (nameMatch) {
      customerName = nameMatch[1].trim();
    }

    const addressMatch = text.match(/(?:Address)[:\s]*([\s\S]*?)(?=\s*(?:If undelivered|return to|Phone|Pin|Order ID|Invoice|Seller|GSTIN|Mobile)|$)/i);
    
    if (addressMatch) {
      address = addressMatch[1].trim().replace(/\s+/g, ' ');
    } else {
      const blockMatch = text.match(/(?:Customer Name|Shipping Address)[:\s]*([\s\S]*?)(?=\s*(?:If undelivered|return to|Phone|Pin|Order ID)|$)/i);
      if (blockMatch) {
        const parts = blockMatch[1].trim().split(/\n|,|,,/);
        if (customerName === "Unknown") customerName = parts[0].trim();
        address = parts.slice(1).join(", ").trim() || "N/A";
      }
    }

    return { orderNo, customerName, address, item, amount };
  };

  // split multi-item descriptions into separate entries
  const splitItems = (item: string): string[] => {
    if (!item) return [''];
    const parts = item
      .split(/\s*[\r\n,|;]+\s*/)
      .map(p => p.trim())
      .filter(Boolean);
    return parts.length ? parts : [item];
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

      // invoice extraction helpers (document-level and per-page)
      const invoiceRegex = /(?:Invoice(?:\s+No(?:\.|:)?| Number)?|Bill\s*No(?:\.|:)?)[:#\s-]*([A-Z0-9\.\/ -]{3,})/i;
      const labelRegex = /Invoice\s*(?:No(?:\.|:)?|Number(?:\.|:)?)\s*[:\-]?\s*([^\r\n]+)/i;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

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
          const tokenWithDigits = pageInvoice.match(/[A-Z0-9\-\/\.]*\d+[A-Z0-9\-\/\.]*/i);
          if (tokenWithDigits) pageInvoice = tokenWithDigits[0];
          else if (!/\d/.test(pageInvoice)) pageInvoice = undefined;
        }

        const order = extractDataFromPageText(pageText);
        if (order) {
          allExtracted.push(pageInvoice ? { ...order, invoiceNo: pageInvoice } : order);
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
        const docTokenWithDigits = docInvoiceNo.match(/[A-Z0-9\-\/\.]*\d+[A-Z0-9\-\/\.]*/i);
        if (docTokenWithDigits) docInvoiceNo = docTokenWithDigits[0];
        else docInvoiceNo = undefined;
      }

      if (docInvoiceNo) {
        allExtracted = allExtracted.map(a => ({ ...a, invoiceNo: a.invoiceNo || docInvoiceNo }));
      }

      setRawText(fullDebugText);

      if (allExtracted.length === 0) {
        throw new Error("No valid Meesho order patterns found. Please check the 'Debug View' to see the extracted text.");
      }

      // expand multi-item rows and build items array (attach SKU found in document)
      const expanded: ExtractedOrder[] = [];
      allExtracted.forEach(o => {
        const parts = splitItems(o.item);
        const itemsArray: Array<{product: string; qty: number; total: number; mapped_product_id?: string}> = [];
        
        if (parts.length > 1) {
          // Multiple items - divide amount equally
          const amountPerItem = parseFloat(o.amount) / parts.length;
          parts.forEach(p => {
            const sku = findSkuForItem(fullDebugText, p);
            itemsArray.push({ product: p, qty: 1, total: amountPerItem, ...(sku ? { sku } : {}) } as any);
            expanded.push({ ...o, item: p, qty: 1, items: [{ product: p, qty: 1, total: amountPerItem, ...(sku ? { sku } : {}) } as any] });
          });
        } else {
          // Single item
          const sku = findSkuForItem(fullDebugText, o.item);
          itemsArray.push({ product: o.item, qty: 1, total: parseFloat(o.amount), ...(sku ? { sku } : {}) } as any);
          expanded.push({ ...o, qty: 1, items: itemsArray });
        }
      });

      setExtractedOrders(expanded);
      showSuccess(`Successfully extracted ${expanded.length} orders (from ${allExtracted.length} entries)!`);
    } catch (error: any) {
      console.error("PDF Parsing Error:", error);
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
      const stagingData = buildStagingFromRows(rawRows, user.id);

      const { error } = await supabase.from('online_order_staging').upsert(stagingData, { onConflict: 'platform_order_number,flipkart_item_name' });

      if (error) throw error;

      showSuccess(`Saved ${extractedOrders.length} orders to staging area.`);
      navigate('/process-online-orders');
    } catch (error: any) {
      console.error("Staging Error:", error);
      showError(`Failed to save to staging: ${error.message}`);
    } finally {
      setIsSaving(false);
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
          <CardHeader className="bg-pink-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Meesho Order Data Extractor</CardTitle>
                <CardDescription className="text-pink-100">
                  Upload Meesho Shipping Labels (PDF) to automatically extract order details.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 bg-muted/5 hover:bg-muted/10 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Meesho Label PDF</h3>
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
                  <Button disabled={loading} className="bg-pink-600 hover:bg-pink-700 min-w-[200px]">
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
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
                        <TableRow className="bg-pink-50 hover:bg-pink-100 border-b-2">
                          <TableCell className="font-mono text-xs font-bold text-pink-700">{order.orderNo}</TableCell>
                          <TableCell className="text-xs font-semibold text-pink-600">{order.invoiceNo || '—'}</TableCell>
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
                            <TableCell colSpan={7} className="p-0">
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
                                      <tr className="bg-pink-100 border-b">
                                        <th className="px-4 py-3 text-left font-bold text-gray-800">Extracted Item</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-800">➜ Map to Actual Product (This will be saved)</th>
                                        <th className="px-4 py-3 text-center font-bold text-gray-800 w-20">Qty</th>
                                        <th className="px-4 py-3 text-right font-bold text-gray-800 w-32">Total (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {order.items.map((item, itemIndex) => {
                                        const selectedProductId = item.mapped_product_id || matchedMap[orderIndex]?.selectedId;
                                        const selectedProduct = products.find(p => p.id === selectedProductId);
                                        
                                        return (
                                          <tr key={itemIndex} className="border-b hover:bg-pink-50 transition">
                                            <td className="px-4 py-3 text-sm break-words font-medium text-gray-900">
                                              {(() => {
                                                // Prefer SKU from mapped product, else use detected item.sku or try extract
                                                const skuFromProduct = selectedProduct?.code || (item as any).sku;
                                                const raw = item.product || '';
                                                let extractedSku: string | null = null;
                                                if (skuFromProduct) extractedSku = skuFromProduct;
                                                else {
                                                  // use shared helper which prefers alpha+digit tokens
                                                  const candidate = extractSkuToken((raw || '').toUpperCase() || raw);
                                                  if (candidate) {
                                                    const tokenClean = candidate.replace(/[^A-Z0-9\-]/gi, '');
                                                    const sizeTokens = ['S','M','L','XL','XS','XXL','XXXL','XXXXL'];
                                                    // ignore pure short numeric sizes and common size codes
                                                    if (!/^[0-9]{1,3}$/.test(tokenClean) && !sizeTokens.includes(tokenClean.toUpperCase())) {
                                                      extractedSku = candidate;
                                                    }
                                                  }
                                                }

                                                return (
                                                  <>
                                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                                                      ❌ From PDF: {raw}
                                                    </span>
                                                    {extractedSku && (
                                                      <div className="text-xs text-muted-foreground mt-1">SKU: {extractedSku}</div>
                                                    )}
                                                    <p className="text-xs text-gray-500 mt-1">(Not being saved)</p>
                                                  </>
                                                );
                                              })()}
                                            </td>
                                            <td className="px-4 py-3">
                                              {selectedProduct ? (
                                                <div className="text-sm">
                                                  <div className="font-bold text-green-700 flex items-center gap-2">
                                                    ✅ {selectedProduct.name}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground mt-1">
                                                    {selectedProduct.code && <span className="bg-green-100 px-2 py-1 rounded mr-1">Code: {selectedProduct.code}</span>}
                                                    {selectedProduct.size && <span className="bg-green-100 px-2 py-1 rounded">Size: {selectedProduct.size}</span>}
                                                  </div>
                                                </div>
                                              ) : (
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-full text-left">
                                                      {matchedMap[orderIndex]?.matches.length ? `→ Map Product (${matchedMap[orderIndex].matches.length})` : '→ Map Product'}
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-[600px] max-w-[90vw] p-0">
                                                    <div className="p-2 border-b">
                                                      <Input 
                                                        placeholder="Search product..." 
                                                        className="h-7 text-xs" 
                                                        value={matchedMap[orderIndex]?.search || ''} 
                                                        onChange={(e) => setMatchedMap(prev => ({ ...prev, [orderIndex]: { ...prev[orderIndex], search: e.target.value } }))} 
                                                      />
                                                    </div>
                                                    <ScrollArea className="h-[300px]">
                                                      {matchedMap[orderIndex]?.matches.length ? (
                                                        matchedMap[orderIndex].matches.filter(p => {
                                                          const q = (matchedMap[orderIndex]?.search || '').toLowerCase();
                                                          if (!q) return true;
                                                          return (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                                                        }).map(p => (
                                                          <Button key={`cand-meesho-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={() => {
                                                            handleProductMapping(orderIndex, itemIndex, p.id);
                                                          }}>
                                                            <div className="text-left w-full">
                                                              <div className="font-medium text-sm">{p.name}</div>
                                                              <div className="text-[11px] text-muted-foreground">{p.code} {p.size ? `| Size: ${p.size}` : ''}</div>
                                                            </div>
                                                          </Button>
                                                        ))
                                                      ) : null}
                                                      <div className="h-px bg-muted/30 my-2" />
                                                      {products.filter(p => {
                                                        const q = (matchedMap[orderIndex]?.search || '').toLowerCase();
                                                        if (!q) return true;
                                                        return (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                                                      }).map(p => (
                                                        <Button key={`all-meesho-${p.id}`} variant="ghost" className="w-full justify-start text-[12px] h-auto py-2 px-3" onClick={() => {
                                                          handleProductMapping(orderIndex, itemIndex, p.id);
                                                        }}>
                                                          <div className="text-left w-full">
                                                            <div className="font-medium text-sm">{p.name}</div>
                                                            <div className="text-[11px] text-muted-foreground">{p.code} {p.size ? `| Size: ${p.size}` : ''}</div>
                                                          </div>
                                                        </Button>
                                                      ))}
                                                    </ScrollArea>
                                                  </PopoverContent>
                                                </Popover>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-700">
                                              {item.qty}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600 text-base">₹{item.total.toFixed(2)}</td>
                                          </tr>
                                        );
                                      })}
                                      {/* Summary Row */}
                                      <tr className="bg-pink-50 border-t-2 border-pink-300">
                                        <td colSpan={1} className="px-4 py-3 font-bold text-right text-gray-800">
                                          Order Total:
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-pink-600 text-base">
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

export default MeeshoOrderExtractor;