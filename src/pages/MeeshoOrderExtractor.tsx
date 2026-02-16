"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, Search, Download, AlertCircle, Eye, EyeOff, Save, ListChecks } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
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
}

const MeeshoOrderExtractor = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

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

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        const order = extractDataFromPageText(pageText);
        if (order) {
          allExtracted.push(order);
        }
      }

      setRawText(fullDebugText);
      
      if (allExtracted.length === 0) {
        throw new Error("No valid Meesho order patterns found. Please check the 'Debug View' to see the extracted text.");
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
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                      <TableHead className="font-bold text-right">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedOrders.map((order, index) => (
                      <TableRow key={index} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-semibold text-pink-600">{order.orderNo}</TableCell>
                        <TableCell className="font-medium">{order.customerName}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={order.address}>
                          {order.address}
                        </TableCell>
                        <TableCell className="text-sm">{order.item}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">₹{order.amount}</TableCell>
                      </TableRow>
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