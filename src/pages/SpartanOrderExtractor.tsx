"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, AlertCircle, Eye, EyeOff, Save, ListChecks } from 'lucide-react';
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
}

const SpartanOrderExtractor = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

  const extractSpartan = (text: string): ExtractedOrder | null => {
    // Match "Invoice Number - #1461"
    const orderNoMatch = text.match(/(?:Invoice Number)\s*-\s*#(\d+)/i);
    if (!orderNoMatch) return null;
    const orderNo = orderNoMatch[1];

    // Match "Total Amount Rs. 1002" or "Total Amount Rs. 1092"
    const amountMatch = text.match(/Total Amount\s+Rs\.\s*([\d,]+(?:\.\d{2})?)/i);
    const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : "0.00";

    // Match the product name which appears after the table headers
    // The headers end with "TOTAL (Including GST)"
    const itemMatch = text.match(/TOTAL \(Including GST\)\s*\n\s*([\s\S]+?)\n/i);
    const item = itemMatch ? itemMatch[1].trim() : "N/A";

    let customerName = "Unknown";
    let address = "N/A";
    // Match the "Bill To:" block
    const billToMatch = text.match(/Bill To:\s*\n\s*([^\n]+)\n([\s\S]+?)(?=GST No|State Code)/i);
    if (billToMatch) {
        customerName = billToMatch[1].trim();
        // Clean up address, removing extra spaces and joining with commas
        address = billToMatch[2].trim().replace(/\s*\n\s*/g, ', ');
    }

    // If core details are missing, it's not a valid entry
    if (item === "N/A" || customerName === "Unknown" || amount === "0.00") {
        return null;
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
        const pageText = textContent.items.map((item: any) => item.str).join('\n');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        const order = extractSpartan(pageText);
        if (order) {
          allExtracted.push(order);
        }
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
                      <TableHead className="font-bold text-right">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedOrders.map((order, index) => (
                      <TableRow key={index} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-semibold text-gray-600">{order.orderNo}</TableCell>
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

export default SpartanOrderExtractor;