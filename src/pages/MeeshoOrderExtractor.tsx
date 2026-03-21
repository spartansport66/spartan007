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
// Removed: buildStagingFromRows, upsertStaging, parseItemWithQty, extractSkuToken - using gatepass creation instead
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
  const [isCreatingGatepasses, setIsCreatingGatepasses] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);
  const [productMapping, setProductMapping] = useState<Record<string, Record<number, string>>>({});
  const [productSearchText, setProductSearchText] = useState<Record<string, Record<number, string>>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedExtracted, setSelectedExtracted] = useState<Record<number, boolean>>({});
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

  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  interface Product { id: string; name: string; code?: string; size?: string | number | null; dp?: number; gst?: string | number }
  const [products, setProducts] = useState<Product[]>([]);
  const [matchedMap, setMatchedMap] = useState<Record<number, { matches: Product[]; selectedId?: string; search?: string; debug?: { numericToken?: string; normText?: string; candidateCodes?: string[] } }>>({});

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
            .eq('is_active', true)
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

      // First priority: Check if any item has a SKU that matches a product code
      let skuCandidates: any[] = [];
      if (ord.items && ord.items.length > 0) {
        const skuValue = ord.items[0].sku; // Get SKU from first item
        if (skuValue) {
          // Try to find product by SKU code match
          skuCandidates = enriched.filter((p: any) => {
            if (!p.code) return false;
            const normSkuValue = normalize(skuValue);
            const normCode = normalize(p.code);
            // Match if code contains SKU or SKU is in code
            return normCode.includes(normSkuValue) || normSkuValue.includes(normCode) || p.code.toString().includes(skuValue);
          });
        }
      }

      // If SKU found a match, use those candidates
      let candidates = skuCandidates.length > 0 ? skuCandidates : enriched.filter((p: any) => {
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
      // Auto-select if only one match found (especially from SKU matching)
      const autoSelectId = candidateProducts.length === 1 ? candidateProducts[0].id : (skuCandidates.length === 1 ? candidateProducts[0].id : undefined);
      map[idx] = { matches: candidateProducts, selectedId: autoSelectId, debug: { numericToken, normText, candidateCodes: candidateProducts.map(cp => (cp.code || '').toString()) } };
    });
    setMatchedMap(map);
  }, [products, extractedOrders]);

  // helper to escape regex
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Try to find a SKU for a given item
  function findSkuForItem(docText: string, itemText: string): string | undefined {
    if (!docText) return undefined;
    try {
      // Find Product Details section in this page/text
      const prodDetailsIdx = docText.indexOf('Product Details');
      const taxInvoiceIdx = docText.indexOf('TAX INVOICE');
      
      // Also try to find Description section boundaries
      const descIdx = docText.indexOf('Description');
      
      if (prodDetailsIdx === -1) {
        console.log(`SKU DEBUG: "Product Details" not found in this page text`);
        return undefined;
      }
      
      // Use TAX INVOICE as end boundary if found, otherwise use Description, otherwise use end of text
      let endIdx = taxInvoiceIdx !== -1 ? taxInvoiceIdx : (descIdx !== -1 ? descIdx : docText.length);
      
      // Make sure start is before end
      if (prodDetailsIdx >= endIdx && descIdx !== -1) {
        endIdx = docText.length;
      }
      
      const prodSection = docText.substring(prodDetailsIdx, endIdx);
      console.log(`SKU DEBUG - Looking in page Product Details (${prodDetailsIdx}-${endIdx}), length: ${prodSection.length}`);
      console.log(`SKU DEBUG - First 200 chars: "${prodSection.substring(0, 200)}"`);
      
      // Strategy 1: Find "SKU" keyword followed by alphanumeric
      const skuKeywordIdx = prodSection.toLowerCase().indexOf('sku');
      if (skuKeywordIdx !== -1) {
        const afterSku = prodSection.substring(skuKeywordIdx + 3);
        const skuMatch = afterSku.match(/([A-Z][A-Z0-9\-\/\.]{2,})/);
        
        if (skuMatch && skuMatch[1]) {
          const sku = skuMatch[1].trim();
          if (!/^(Size|Free|Color|Qty|Order|No|Colour|PCS|RS)/i.test(sku)) {
            console.log(`SKU DEBUG - Found via SKU keyword: "${sku}"`);
            return sku;
          }
        }
      }
      
      // Strategy 2: Look for uppercase alphanumeric pattern at line boundaries (FB1237, XY5678, etc.)
      const lines = prodSection.split('\n');
      console.log(`SKU DEBUG - Scanning ${lines.length} lines in Product Details section`);
      for (let idx = 0; idx < lines.length; idx++) {
        const trimmed = lines[idx].trim();
        if (!trimmed || trimmed.length < 3) continue;
        
        // Skip known column headers  
        if (/^(SKU|Size|Qty|Color|Order|No|Gross|Discount|Taxable|Taxes|Free|PCS|Colour)/i.test(trimmed)) {
          console.log(`SKU DEBUG - Skipping header line: "${trimmed}"`);
          continue;
        }
        
        // Look for patterns like "FB1237" or "VL008381054711"
        const skuPattern = /^([A-Z]{1,3}\d{3,6})(\s|$)/;
        const match = trimmed.match(skuPattern);
        if (match) {
          console.log(`SKU DEBUG - Found via line pattern at line ${idx}: "${match[1]}" from "${trimmed}"`);
          return match[1];
        }
      }
      
      console.log(`SKU DEBUG - No SKU found in this page after trying all strategies`);
      return undefined;
    } catch (e) {
      console.log(`SKU DEBUG - Error: ${e}`);
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

      // Update UI state to reflect mapping
      const newMapping = { ...productMapping };
      if (!newMapping[orderIndex]) newMapping[orderIndex] = {};
      newMapping[orderIndex][itemIndex] = selectedProductId;
      setProductMapping(newMapping);

      const newSearch = { ...productSearchText };
      if (!newSearch[orderIndex]) newSearch[orderIndex] = {};
      newSearch[orderIndex][itemIndex] = '';
      setProductSearchText(newSearch);

      setOpenDropdown(null);
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

    // 3. Extract Item/Product Description - Find the Description table and get first product
    let item = "N/A";
    
    // Find "Description" text in the document
    const descIdx = text.toLowerCase().indexOf('description');
    if (descIdx !== -1) {
      // Look for the next HSN code after "Description"
      const searchArea = text.substring(descIdx, descIdx + 2000); // Search in next 2000 chars
      
      // SKIP entire section if it's pure metadata (starts with ❌ or From PDF)
      const isMetadataOnly = /^[^a-z]*❌|^[^a-z]*From\s+PDF/i.test(searchArea);
      
      if (!isMetadataOnly) {
        const hsnMatch = searchArea.match(/\d{6,8}/);
        
        if (hsnMatch) {
          const hsnIdx = searchArea.indexOf(hsnMatch[0]);
          let productText = searchArea.substring(0, hsnIdx).trim();
          
          // Clean it up
          productText = productText
            .replace(/Description/i, '')
            .replace(/HSN/i, '')
            .replace(/Qty/i, '')
            .replace(/Gross\s+Amount/i, '')
            .replace(/Discount/i, '')
            .replace(/Taxable\s+Value/i, '')
            .replace(/Taxes/i, '')
            .replace(/Total/i, '')
            .replace(/Color/i, '')
            .replace(/Size/i, '')
            .replace(/Order\s+No/i, '')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Only use if it's a real product name (not metadata)
          if (productText.length > 4 && !/^[%|()❌]/.test(productText) && !/from\s+pdf|product\s+name|sku:|igst|sgst|cgst|tax:/i.test(productText)) {
            item = productText;
          }
        }
      }
    }

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

  // Parse Description table and extract items - Simple approach: find HSN codes
  const parseDescriptionTableItems = (fullText: string): string[] => {
    if (!fullText || !fullText.trim()) return [''];
    
    const items: string[] = [];
    
    // Find "Description" in the text
    const descIdx = fullText.toLowerCase().indexOf('description');
    if (descIdx === -1) return [''];
    
    // Search from Description up to "Total" for HSN codes
    const totalIdx = fullText.indexOf('Total', descIdx);
    const searchArea = fullText.substring(descIdx, totalIdx !== -1 ? totalIdx : descIdx + 3000);
    
    // Find all HSN codes (6-8 digits) in this area
    const hsnRegex = /\d{6,8}/g;
    let match;
    let lastPos = 0;
    
    while ((match = hsnRegex.exec(searchArea)) !== null) {
      // Get text from last position to this HSN code
      let productText = searchArea.substring(lastPos, match.index).trim();
      
      // If contains metadata block, extract what comes AFTER IGST
      if (productText.toLowerCase().includes('from pdf') || productText.includes('❌')) {
        const afterIgst = productText.match(/IGST:\s*\d+\s+(.+?)$/i);
        if (afterIgst && afterIgst[1]) {
          productText = afterIgst[1].trim();
        } else {
          // Strip entire metadata block if IGST not found
          productText = productText.replace(/❌[^]*From\s+PDF:[^]*?IGST:\s*\d+\s*/gi, '').trim();
        }
      }
      
      // Remove column headers
      productText = productText
        .replace(/Description/i, '')
        .replace(/HSN/i, '')
        .replace(/Qty/i, '')
        .replace(/Gross\s+Amount/i, '')
        .replace(/Discount/i, '')
        .replace(/Taxable\s+Value/i, '')
        .replace(/Taxes/i, '')
        .replace(/Total/i, '')
        .replace(/Color/i, '')
        .replace(/Size/i, '')
        .replace(/Order\s+No/i, '')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Reject if contains any metadata indicators
      const hasMetadata = /^[%|()❌]|from\s+pdf|product\s+name|sku:|igst|sgst|cgst|tax:|Place\s+of\s+Supply|Sold\s+by|GSTIN|Purchase|Invoice|Bill|Charges|Other|spartanextract/i.test(productText);
      
      if (productText.length > 4 && !hasMetadata) {
        items.push(productText);
      }
      
      lastPos = match.index + match[0].length;
    }
    
    return items.length > 0 ? items : [''];
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
      
      let allExtracted: Array<ExtractedOrder & { pageText?: string }> = [];
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
          allExtracted.push(pageInvoice ? { ...order, invoiceNo: pageInvoice, pageText } : { ...order, pageText });
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

      // expand multi-item rows and build items array (attach SKU found in that page)
      const expanded: ExtractedOrder[] = [];
      allExtracted.forEach(o => {
        // Use the page text where this order was found (not the entire document)
        const searchText = o.pageText || fullDebugText;
        
        // Use improved parsing to exclude charges from items
        const parts = parseDescriptionTableItems(searchText);
        const itemsArray: Array<{product: string; qty: number; total: number; mapped_product_id?: string}> = [];
        
        // Determine the product name to use
        let productName = o.item; // Default to what we extracted from the table
        
        // If parseDescriptionTableItems found a non-empty item, use that instead
        if (parts.length > 0 && parts[0] && parts[0].trim().length > 0) {
          productName = parts[0].trim();
        }
        
        // Find SKU from the same page text where the item was found
        const sku = findSkuForItem(searchText, productName);
        console.log(`Extracted order from page: SKU="${sku}" for product="${productName}"`);
        itemsArray.push({ product: productName, qty: 1, total: parseFloat(o.amount), ...(sku ? { sku } : {}) } as any);
        
        // Remove pageText from final output
        const { pageText, ...orderWithoutPageText } = o;
        expanded.push({ ...orderWithoutPageText, item: productName, qty: 1, items: itemsArray });
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

  const handleCreateGatepassesForSelected = async () => {
    const selectedIndexes = Object.keys(selectedExtracted).filter(k => selectedExtracted[Number(k)]).map(k => Number(k));
    if (selectedIndexes.length === 0) {
      showError('No extracted orders selected.');
      return;
    }

    setIsCreatingGatepasses(true);
    try {
      // get dealer 'Online Order' (use maybeSingle so we can create it if missing)
      let { data: dealerData, error: dealerErr } = await supabase.from('dealers').select('id').eq('name', 'Online Order').maybeSingle();
      if (dealerErr) console.warn('Dealer lookup error (will attempt to create):', dealerErr);
      if (!dealerData) {
        const { data: createdDealer, error: createErr } = await supabase.from('dealers').insert({ name: 'Online Order' }).select('id').single();
        if (createErr) throw createErr;
        dealerData = createdDealer as any;
      }

      // ensure we have the Meesho platform id (online_platforms.id is UUID)
      let meeshoPlatformId: string | null = null;
      try {
        const { data: pf, error: pfErr } = await supabase.from('online_platforms').select('id').eq('name', 'Meesho').single();
        if (pfErr || !pf) {
          const { data: createdPf, error: createPfErr } = await supabase.from('online_platforms').insert({ name: 'Meesho' }).select('id').single();
          if (!createPfErr && createdPf) meeshoPlatformId = createdPf.id;
        } else {
          meeshoPlatformId = pf.id;
        }
      } catch (e) {
        console.warn('Failed to ensure Meesho platform id', e);
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

        const platformName = 'Meesho';
        const platformPrefix = 'M';
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
        console.debug('MeeshoExtractor: online_orders.insert result', { newOnlineOrder, onlineErr });
        if (onlineErr || !newOnlineOrder) {
          console.error('Online order create error', onlineErr);
          showError(`Failed to create online_order for ${order.orderNo}`);
          continue;
        }

        // Insert one online_order_details row per extracted item (preserve mapped product id, qty, amount)
        let insertedDetail: any = null;
        try {
          const detailsToInsert: any[] = (order.items || []).map((it, itemIndex) => {
            const mappedId = productMapping[idx] ? productMapping[idx][itemIndex] : null;
            return {
              order_id: newOnlineOrder.id,
              client_name: order.customerName,
              platform_id: meeshoPlatformId,
              platform_order_number: order.orderNo,
              address: order.address,
              raw_item_name: it.product,
              mapped_product_id: mappedId || null,
            };
          });

          if (detailsToInsert.length > 0) {
            const { data: detailRows, error: detailErr } = await supabase.from('online_order_details').insert(detailsToInsert).select('id, mapped_product_id');
            console.debug('MeeshoExtractor: online_order_details.insert batch result', { detailRows, detailErr });
            if (detailErr) {
              console.warn('Failed to insert online_order_details batch', detailErr);
              const msg = String(detailErr.message || detailErr.description || detailErr.code || 'Unknown error');
              if (msg.includes('online_order_details_order_id_fkey') || msg.includes('foreign key') || msg.includes('orders')) {
                console.error('DB schema mismatch: online_order_details.order_id still references orders(id)');
                showError('DB schema mismatch: online_order_details.order_id references orders(id). Run the migration to change the FK to reference online_orders(id) and retry.');
              } else {
                showError('Failed to save online order details: ' + msg);
              }
            } else {
              insertedDetail = detailRows;
            }
          }
        } catch (e) {
          console.warn('Failed to insert online_order_details', e);
        }

        createdCount++;
      }

      showSuccess(`Created ${createdCount} gatepass(es).`);
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
        <div className="flex justify-start items-center mb-6">
          <Button variant="outline" onClick={() => navigate('/online-orders-admin')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Online Orders
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
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => handleCreateGatepassesForSelected()} disabled={isCreatingGatepasses} className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 border-none">
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
                        {/* Main Order Row */}
                        <TableRow className="bg-pink-50 hover:bg-pink-100 border-b-2">
                          <TableCell className="px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedExtracted[orderIndex]}
                              onChange={(e) => setSelectedExtracted(prev => ({ ...prev, [orderIndex]: e.target.checked }))}
                              className="h-4 w-4"
                            />
                          </TableCell>
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
                                      <tr className="bg-pink-100 border-b">
                                        <th className="px-4 py-3 text-left font-bold text-gray-800">Extracted Item</th>
                                        <th className="px-4 py-3 text-left font-bold text-gray-800">SKU</th>
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
                                          <tr key={itemIndex} className="border-b hover:bg-pink-50 transition">
                                            <td className="px-4 py-3 text-sm break-words font-medium text-gray-900">
                                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                                                ❌ From PDF: {item.product}
                                              </span>
                                              <p className="text-xs text-gray-500 mt-1">(Not being saved)</p>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">
                                              {item.sku ? (
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-semibold text-xs">
                                                  {item.sku}
                                                </span>
                                              ) : (
                                                <span className="text-gray-400 text-xs italic">No SKU found</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3">
                                              {(() => {
                                                const searchKey = `${orderIndex}|${itemIndex}`;
                                                const selectedProductId = productMapping[orderIndex]?.[itemIndex];
                                                const selectedProduct = products.find(p => p.id === selectedProductId);
                                                const searchText = productSearchText[orderIndex]?.[itemIndex] || '';
                                                const isOpen = openDropdown === searchKey;
                                                
                                                // Build dropdown results based on search text
                                                const searchLower = (searchText || '').toLowerCase().trim();
                                                const candidates = (matchedMap[orderIndex]?.matches || []).map(p => p.id);

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
                                                            className="w-full px-3 py-2 border-2 border-gray-300 rounded bg-white text-sm font-medium text-gray-700 focus:border-pink-500 focus:outline-none"
                                                          />
                                                        </PopoverTrigger>

                                                        <PopoverContent className="p-0 min-w-[400px] max-h-96 overflow-y-auto">
                                                          {filteredProducts.length > 0 ? (
                                                            filteredProducts.map((prod) => (
                                                              <div
                                                                key={prod.id}
                                                                onClick={() => {
                                                                  handleProductMapping(orderIndex, itemIndex, prod.id);
                                                                }}
                                                                className="px-4 py-3 border-b hover:bg-pink-50 cursor-pointer transition"
                                                              >
                                                                <div className="font-medium text-sm">{prod.name}</div>
                                                                <div className="text-xs text-muted-foreground">{prod.code} {prod.size ? `| Size: ${prod.size}` : ''}</div>
                                                              </div>
                                                            ))
                                                          ) : (
                                                            <div className="px-4 py-4 text-xs text-muted-foreground text-center">
                                                              No products found
                                                            </div>
                                                          )}
                                                        </PopoverContent>
                                                      </Popover>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-700">
                                              {item.qty}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-700">
                                              ₹{parseFloat(unitPrice).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600 text-base">₹{item.total.toFixed(2)}</td>
                                          </tr>
                                        );
                                      })}
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