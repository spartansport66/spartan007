"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, AlertCircle, Eye, EyeOff, Save, ListChecks, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
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
  invoiceDate?: string;
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

  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Lightweight extractor to find product name and SKU in the item text.
  const extractNameSku = (text: string | undefined): { name?: string; sku?: string } | null => {
    if (!text) return null;
    const t = text.replace(/\s+/g, ' ').trim();
    // Look for SKU patterns like 'VB 502A-1' or '950699' or '502A-1'
    const skuRegex = /\b([A-Z]{1,}[A-Z0-9\s]*\d[0-9A-Z\-]*)\b/; // permissive
    const m = t.match(skuRegex);
    if (m && m.index !== undefined) {
      const sku = m[1].trim();
      let name = t.slice(0, m.index).trim();
      name = name.replace(/[-–—\|,:\s]+$/g, '').trim();
      name = name.replace(/(HSN|Quantity|Unit Price|TAX|CGST|SGST|TOTAL).*$/i, '').trim();
      return { name: name || undefined, sku: sku || undefined };
    }
    return null;
  };

  const extractSpartan = (text: string): ExtractedOrder | null => {
    // 1. Invoice Number (updated to capture from "Invoice Number - #1461" format)
    const invoiceMatch = text.match(/Invoice\s+Number\s*-?\s*#?(\d+)/i);
    if (!invoiceMatch) return null;
    const orderNo = invoiceMatch[1];

    // 1b. Invoice Date
    const invoiceDateMatch = text.match(/Invoice\s+Date\s*-?\s*([A-Za-z0-9 ,]+)/i);
    const invoiceDate = invoiceDateMatch ? invoiceDateMatch[1].trim() : undefined;

    // 2. Total Amount (updated to handle "Rs. 1002" format with optional decimals)
    const amountMatch = text.match(/Total\s+Amount[\s\S]*?Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : "0.00";

    // 3. Customer Name and Address (from Bill To section)
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

    // 4. Item Description (extract Product Name and SKU from table)
    let item = "N/A";
    const allLines = text.split('\n');
    let prodName: string | undefined;
    let prodSku: string | undefined;
    const headerIdx = allLines.findIndex(l => /Product\s+Name/i.test(l));
    if (headerIdx >= 0) {
      for (let i = headerIdx + 1; i < Math.min(allLines.length, headerIdx + 30); i++) {
        const line = (allLines[i] || '').trim();
        if (!line) continue;
        // skip known header tokens
        if (/^(Product\s+Sku|HSN|Quantity|Unit Price|TAX Amount|TAX|CGST|SGST|IGST|TOTAL|\(Including|Charges Applied|Shipping Charges|COD Charges|Total Amount)$/i.test(line)) continue;
        // consider this a product name if it contains letters and isn't a short token
        if (/[A-Za-z]/.test(line) && line.length > 2 && line.length < 120) {
          prodName = line.replace(/\s+/g, ' ').trim();
          // find next non-empty, non-header line as SKU
          for (let j = i + 1; j < Math.min(allLines.length, i + 8); j++) {
            const l2 = (allLines[j] || '').trim();
            if (!l2) continue;
            if (/^(HSN|Quantity|Unit Price|TAX Amount|TAX|CGST|SGST|IGST|TOTAL|Charges Applied|Shipping Charges|COD Charges|Total Amount)$/i.test(l2)) continue;
            prodSku = l2.replace(/\s+/g, ' ').trim();
            break;
          }
          break;
        }
      }
    }
    if (prodName) {
      item = prodSku ? `${prodName} — ${prodSku}` : prodName;
    }
    // fallback: attempt loose regex capture
    if (item === "N/A") {
      const itemMatch = text.match(/Product\s+Name[\s\S]*?\n\s*([A-Za-z0-9\-\s\(\)]+?)\n\s*([A-Za-z0-9\-\s]+)/i);
      if (itemMatch) {
        const name = itemMatch[1].trim().replace(/\s+/g, ' ');
        const sku = itemMatch[2].trim().replace(/\s+/g, ' ');
        item = `${name} — ${sku}`;
      }
    }

    // Final validation
    if ((!item || item === "N/A") || customerName === "Unknown" || (amount === "0.00" && !amountMatch)) {
        console.warn("Spartan Extractor: Could not extract all fields. OrderNo:", orderNo, "Item:", item, "Amount:", amount);
    }

    return { orderNo, customerName, address, item, amount, invoiceDate };
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
    if (!user || extractedOrders.length === 0) return;
    setIsSaving(true);
    try {
      const stagingData = extractedOrders.map(order => ({
        platform_order_number: order.orderNo,
        customer_name: order.customerName,
        shipping_address: order.address,
        flipkart_item_name: order.item,
        bill_no: order.invoiceNo,
        amount: parseFloat(order.amount),
        created_by: user.id,
        status: 'pending'
      }));

      const { error } = await supabase
        .from('online_order_staging')
        .upsert(stagingData, { onConflict: 'platform_order_number' });

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

  const autoMapAndSaveRow = async (index: number) => {
    const order = extractedOrders[index];
    if (!order || !user) return;
    const inferred = extractNameSku(order.item);
    if (!inferred || (!inferred.sku && !inferred.name)) {
      showError('Could not extract SKU or product name from this row.');
      return;
    }

    // Try to find product by SKU then by name
    let prod = undefined as Product | undefined;
    if (inferred.sku) {
      const normSku = inferred.sku.replace(/\s+/g, '').toLowerCase();
      prod = products.find(p => (p.code || '').toString().replace(/\s+/g, '').toLowerCase() === normSku)
        || products.find(p => (p.code || '').toString().replace(/\s+/g, '').toLowerCase().includes(normSku));
    }
    if (!prod && inferred.name) {
      const normName = inferred.name.toLowerCase();
      prod = products.find(p => (p.name || '').toLowerCase().includes(normName) || normName.includes((p.name || '').toLowerCase()));
    }

    if (!prod) {
      showError('No matching product found for inferred SKU/name.');
      return;
    }

    // Update UI state
    setMatchedMap(m => ({ ...m, [index]: { ...(m[index] || { matches: [] }), selectedId: prod!.id } }));
    const newOrders = [...extractedOrders];
    if (!newOrders[index].item.includes(` — ${prod.name}`)) newOrders[index].item = `${newOrders[index].item} — ${prod.name}`;
    setExtractedOrders(newOrders);

    // Persist this single row to staging
    try {
      setIsSaving(true);
      const row = {
        platform_order_number: newOrders[index].orderNo,
        customer_name: newOrders[index].customerName,
        shipping_address: newOrders[index].address,
        flipkart_item_name: newOrders[index].item,
        bill_no: newOrders[index].invoiceNo,
        amount: parseFloat(newOrders[index].amount),
        created_by: user.id,
        status: 'pending'
      };
      const { error } = await supabase.from('online_order_staging').upsert([row], { onConflict: 'platform_order_number' });
      if (error) throw error;
      showSuccess(`Mapped and saved order ${row.platform_order_number} to staging.`);
    } catch (e: any) {
      console.error('Failed to save mapped row', e);
      showError(e?.message || 'Failed to save mapped row to staging.');
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
          <CardHeader className="bg-gray-700 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Spartan Order Data Extractor</CardTitle>
                <CardDescription className="text-gray-200">
                  Upload Spartan Website Order PDFs to automatically extract order details.
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
                      <TableHead className="font-bold">Customer Name</TableHead>
                      <TableHead className="font-bold">Address</TableHead>
                      <TableHead className="font-bold">Item Description</TableHead>
                      <TableHead className="font-bold">Invoice Date</TableHead>
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
                      const inferred = extractNameSku(order.item);

                      return (
                        <TableRow key={index} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-semibold text-gray-600">{order.orderNo}</TableCell>
                          <TableCell className="font-medium">{order.customerName}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={order.address}>
                            {order.address}
                          </TableCell>
                          <TableCell className="text-sm min-w-[600px]">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="link" className="p-0 h-auto whitespace-normal text-left text-sm font-medium break-words">
                                  {`Select product (${candidates.length})`}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[600px] max-w-[90vw] p-3 max-h-96 flex flex-col">
                                <div className="space-y-2 flex-1 overflow-auto">
                                  {candidates.length > 0 && (
                                    <>
                                      <h4 className="font-semibold text-xs uppercase text-muted-foreground">Best Matches ({candidates.length})</h4>
                                      {candidates.slice(0, 5).map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => {
                                            const newOrders = [...extractedOrders];
                                            newOrders[index].item = `${order.item} — ${p.code || p.name}`;
                                            setExtractedOrders(newOrders);
                                            setMatchedMap(m => ({ ...m, [index]: { ...m[index], selectedId: p.id } }));
                                          }}
                                          className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 rounded-md text-xs border border-blue-200 cursor-pointer"
                                        >
                                          <div className="font-bold text-blue-900 whitespace-normal break-words">{p.code || p.name}</div>
                                          {p.code && <div className="text-blue-700">{p.code}</div>}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  <div className="border-t pt-2 mt-2">
                                    <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">All Products</h4>
                                    <Input
                                      placeholder="Search products..."
                                      value={searchTerm}
                                      onChange={(e) => setMatchedMap(m => ({ ...m, [index]: { ...m[index], search: e.target.value } }))}
                                      className="mb-2 text-xs"
                                    />
                                    <ScrollArea className="max-h-48">
                                      {(searchTerm ? products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase())) : products).map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => {
                                            const newOrders = [...extractedOrders];
                                            newOrders[index].item = `${order.item} — ${p.code || p.name}`;
                                            setExtractedOrders(newOrders);
                                            setMatchedMap(m => ({ ...m, [index]: { ...m[index], selectedId: p.id } }));
                                          }}
                                          className="w-full text-left p-2 hover:bg-gray-100 text-xs border-b last:border-b-0 cursor-pointer"
                                        >
                                          <div className="font-medium whitespace-normal break-words">{p.code || p.name}</div>
                                          {p.code && <div className="text-muted-foreground text-xs">{p.code}</div>}
                                        </button>
                                      ))}
                                    </ScrollArea>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <div className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-wrap">{order.item}</div>
                            {selected ? (
                              <div className="mt-1 text-xs font-bold text-blue-600">✓ {selected.name}</div>
                            ) : inferred ? (
                              <div className="mt-1 text-xs text-muted-foreground flex items-start gap-3">
                                <div>
                                  <div><span className="font-semibold">Product:</span> {inferred.name || '—'}</div>
                                  <div><span className="font-semibold">SKU:</span> {inferred.sku || '—'} <span className="text-[11px] text-muted-foreground">(extracted)</span></div>
                                </div>
                                <div className="flex items-center">
                                  <Button size="sm" onClick={() => autoMapAndSaveRow(index)} disabled={isSaving} className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white">Use extracted</Button>
                                </div>
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{order.invoiceDate || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{order.invoiceNo || '-'}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">₹{order.amount}</TableCell>
                        </TableRow>
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

export default SpartanOrderExtractor;