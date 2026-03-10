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
  qty: number;
  invoiceNo?: string;
  invoiceDate?: string;
  productName?: string;
  productSku?: string;
  hsn?: string;
  unitPrice?: string;
  taxAmount?: string;
  igst?: string;
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
  const [productMapping, setProductMapping] = useState<Record<number, string>>({});
  const [productSearchText, setProductSearchText] = useState<Record<number, string>>({});
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

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

  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Real-time product mapping: Delete raw item, insert mapped product
  const handleProductMapping = async (orderIndex: number, selectedProductId: string) => {
    try {
      let authUser = user;
      if (!authUser) {
        const { data: { session } } = await supabase.auth.getSession();
        authUser = session?.user;
      }
      if (!authUser) throw new Error('User not authenticated');

      const order = extractedOrders[orderIndex];
      if (!order) throw new Error('Order not found');

      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) throw new Error('Product not found');

      const itemAmount = parseFloat(order.amount) || 0;

      console.log('📝 Mapping data:', {
        orderNo: order.orderNo,
        rawItemName: order.item,
        mappedProductName: selectedProduct.name,
        amount: itemAmount
      });

      // Step 1: Delete old staging row with raw item name
      console.log('🗑️ Deleting old staging row with raw item name...');
      const { error: deleteError } = await supabase
        .from('online_order_staging')
        .delete()
        .eq('platform_order_number', order.orderNo)
        .eq('flipkart_item_name', order.item);

      if (deleteError) {
        console.warn('⚠️ Delete warning (may not exist):', deleteError.message);
      } else {
        console.log('✅ Deleted old row');
      }

      // Step 2: Upsert new row with mapped product data
      console.log('✅ Upserting mapped product to staging...');
      const { data, error: insertError } = await supabase
        .from('online_order_staging')
        .upsert([{
          platform_order_number: order.orderNo,
          customer_name: order.customerName || null,
          shipping_address: order.address || null,
          flipkart_item_name: selectedProduct.name,
          amount: itemAmount,
          quantity: order.qty || 1,
          bill_no: order.invoiceNo || '',
          created_by: authUser.id,
          status: 'pending'
        }], {
          onConflict: 'platform_order_number,flipkart_item_name'
        })
        .select();

      if (insertError) {
        throw insertError;
      }

      // Update local state to show mapping
      setProductMapping(prev => ({ ...prev, [orderIndex]: selectedProductId }));
      
      console.log('✅ Inserted mapped product row:', data);
      showSuccess(`✅ Mapped & saved: ${selectedProduct.name} | Amount: ₹${itemAmount.toFixed(2)}`);

    } catch (error: any) {
      console.error('❌ Mapping error:', error);
      showError(`Failed to map product: ${error.message}`);
    }
  };

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

    // 4. Item Description - Show ALL product details in raw format for extraction
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
      // Skip header line and any empty lines or column headers
      let startIdx = headerIdx + 1;
      const headerKeywords = /^(Product\s+Sku|HSN|Quantity|Unit\s+Price|TAX\s+Amount|IGST|TOTAL|Charges\s+Applied|Shipping|COD|Tax\s+Amount)/i;
      
      // Skip over column header lines
      while (startIdx < allLines.length) {
        const line = (allLines[startIdx] || '').trim();
        if (!line || headerKeywords.test(line)) {
          startIdx++;
        } else {
          break;
        }
      }
      
      // Collect the next several non-empty lines that form the product row
      const productRowLines: string[] = [];
      for (let i = startIdx; i < Math.min(allLines.length, startIdx + 25); i++) {
        const line = (allLines[i] || '').trim();
        if (!line) continue;
        // Stop when we hit section headers or tax/charge lines
        if (/^(Charges\s+Applied|Shipping\s+Charges|COD\s+Charges|Total\s+Amount|IGST\s+\(Value)/i.test(line)) break;
        productRowLines.push(line);
      }
      
      // Extract fields from the product row lines
      if (productRowLines.length > 0) {
        productName = productRowLines[0];
      }
      if (productRowLines.length > 1) {
        productSku = productRowLines[1];
      }
      if (productRowLines.length > 2) {
        hsn = productRowLines[2];
      }
      if (productRowLines.length > 3) {
        quantity = productRowLines[3];
      }
      if (productRowLines.length > 4) {
        unitPrice = productRowLines[4];
      }
      if (productRowLines.length > 5) {
        taxAmount = productRowLines[5];
      }
      if (productRowLines.length > 6) {
        igst = productRowLines[6];
      }
      
      // Format as single raw text paragraph
      const parts = [];
      if (productName) parts.push(`Product Name: ${productName}`);
      if (productSku) parts.push(`SKU: ${productSku}`);
      if (hsn) parts.push(`HSN: ${hsn}`);
      if (quantity) parts.push(`Qty: ${quantity}`);
      if (unitPrice) parts.push(`Unit Price: ${unitPrice}`);
      if (taxAmount) parts.push(`TAX: ${taxAmount}`);
      if (igst) parts.push(`IGST: ${igst}`);
      
      item = parts.length > 0 ? parts.join(' | ') : "N/A";
    }
    
    // fallback if product extraction failed
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

    return { 
      orderNo, 
      customerName, 
      address, 
      item, 
      amount, 
      qty: 1, 
      invoiceDate,
      productName,
      productSku,
      hsn,
      unitPrice,
      taxAmount,
      igst
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

      // For Spartan, each extracted order has ONE item - no need to split
      // Just use allExtracted directly as final orders
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
      // Check if all items are mapped
      let unmappedCount = 0;
      for (let i = 0; i < extractedOrders.length; i++) {
        if (!productMapping[i]) {
          unmappedCount++;
          console.warn(`⚠️ Item not mapped: ${extractedOrders[i].item}`);
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
    } catch (error: any) {
      console.error("Error:", error);
      showError(`Error: ${error.message}`);
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
                      <TableHead className="font-bold">Item Description (All Product Details)</TableHead>
                      <TableHead className="font-bold">Invoice Date</TableHead>
                      <TableHead className="font-bold">Invoice No.</TableHead>
                      <TableHead className="font-bold text-right">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedOrders.map((order, index) => {
                      const selectedProductId = productMapping[index];
                      const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;
                      const searchText = productSearchText[index] || '';
                      
                      // Find ALL matching products based on the item name
                      const matchingProducts = products.filter(p => {
                        const itemLower = (order.item || '').toLowerCase();
                        const nameLower = (p.name || '').toLowerCase();
                        const codeLower = (p.code || '').toString().toLowerCase();
                        return itemLower.includes(codeLower) || itemLower.includes(nameLower.substring(0, 20)) || codeLower.includes(itemLower.substring(0, 10));
                      });
                      
                      // Apply search filter
                      const filteredProducts = searchText 
                        ? products.filter(p => (p.name || '').toLowerCase().includes(searchText.toLowerCase()) || (p.code || '').toString().toLowerCase().includes(searchText.toLowerCase()))
                        : products;

                      return (
                        <TableRow key={index} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-semibold text-gray-600">{order.orderNo}</TableCell>
                          <TableCell className="font-medium">{order.customerName}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={order.address}>
                            {order.address}
                          </TableCell>
                          <TableCell className="text-sm min-w-[700px]">
                            {/* Show extracted item name in red badge */}
                            <div className="mb-3 inline-block">
                              <div className="text-xs bg-red-100 text-red-900 px-3 py-2 rounded border border-red-300 break-words">
                                ❌ From PDF: {order.item}
                                <div className="text-[11px] text-red-700 mt-1">(Not being saved)</div>
                              </div>
                            </div>

                            {/* Product mapping dropdown */}
                            <Popover open={openDropdown === index} onOpenChange={(open) => setOpenDropdown(open ? index : null)}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full text-left justify-start mb-2">
                                  → Map to Actual Product (This will be saved)
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[600px] max-w-[90vw] p-3 max-h-96 flex flex-col">
                                {/* Matching products section */}
                                {matchingProducts.length > 0 && (
                                  <div className="mb-3">
                                    <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Matched Products ({matchingProducts.length})</h4>
                                    <ScrollArea className="max-h-40">
                                      {matchingProducts.map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => {
                                            handleProductMapping(index, p.id);
                                            setOpenDropdown(null);
                                          }}
                                          className="w-full text-left p-2 bg-green-50 hover:bg-green-100 rounded-md text-xs border border-green-300 cursor-pointer mb-2 block"
                                        >
                                          <div className="font-bold text-green-900">{p.name}</div>
                                          <div className="text-green-700 text-[11px]">Code: {p.code || 'N/A'}</div>
                                        </button>
                                      ))}
                                    </ScrollArea>
                                  </div>
                                )}

                                {/* Search and all products section */}
                                <div className="border-t pt-2">
                                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Search All Products</h4>
                                  <Input
                                    type="text"
                                    placeholder="Type product name or code..."
                                    value={searchText}
                                    onChange={(e) => setProductSearchText(prev => ({ ...prev, [index]: e.target.value }))}
                                    className="mb-2 text-xs"
                                    autoFocus
                                  />
                                  <ScrollArea className="max-h-48">
                                    {filteredProducts.map(p => (
                                      <button
                                        key={p.id}
                                        onClick={() => {
                                          handleProductMapping(index, p.id);
                                          setOpenDropdown(null);
                                        }}
                                        className="w-full text-left p-2 hover:bg-blue-50 text-xs border-b last:border-b-0 cursor-pointer"
                                      >
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-muted-foreground text-[11px]">Code: {p.code || 'N/A'}</div>
                                      </button>
                                    ))}
                                  </ScrollArea>
                                </div>
                              </PopoverContent>
                            </Popover>

                            {/* Show mapping status */}
                            {selectedProduct ? (
                              <div className="text-xs bg-green-100 text-green-900 px-3 py-2 rounded border border-green-300 break-words">
                                ✅ WILL SAVE: {selectedProduct.name}
                                <div className="text-[11px] text-green-700 mt-1">Code: {selectedProduct.code || 'N/A'}</div>
                              </div>
                            ) : (
                              <div className="text-xs bg-yellow-100 text-yellow-900 px-3 py-2 rounded border border-yellow-300">
                                ⚠️ NOT MAPPED - Select a product above
                              </div>
                            )}
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