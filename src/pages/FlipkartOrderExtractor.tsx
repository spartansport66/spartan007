"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileText, Upload, Search, Download, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
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

const FlipkartOrderExtractor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

  const extractDataFromPageText = (text: string): ExtractedOrder | null => {
    // 1. Extract Order ID (Standard Flipkart format is OD followed by 18 digits)
    const orderNoMatch = text.match(/OD\d{18}/);
    if (!orderNoMatch) return null;

    const orderNo = orderNoMatch[0];

    // 2. Extract Amount
    // Specifically target "TOTAL PRICE: XXX.XX" which appears at the end of the invoice table
    const amountMatch = text.match(/TOTAL PRICE:\s*([\d,]+\.\d{2})/i);
    const amount = amountMatch ? amountMatch[1].trim() : "0.00";

    // 3. Extract Item/Product
    // In Flipkart invoices, the product name follows the "Total" column header
    // Pattern: Total, [PRODUCT NAME], |
    const itemMatch = text.match(/Total,\s*([^|]+)/i);
    const item = itemMatch ? itemMatch[1].trim().replace(/^,\s*/, '') : "N/A";

    // 4. Extract Customer Name and Address
    let customerName = "Unknown";
    let address = "N/A";

    // Try to find "Deliver to:" or "Shipping Address:"
    const deliverToMatch = text.match(/(?:Deliver to|Shipping Address)[:\s]+([\s\S]*?)(?=\s*(?:FSSAI|Seller|Phone|Pin|Order ID|Invoice)|$)/i);
    
    if (deliverToMatch) {
      const fullText = deliverToMatch[1].trim();
      const parts = fullText.split(/,,|,/);
      customerName = parts[0].trim();
      address = parts.slice(1).join(", ").trim() || "N/A";
    } else {
      // Fallback: Look for text immediately following the Order ID if "Deliver to" is missing
      const fallbackMatch = text.match(new RegExp(`${orderNo}\\s+([\\s\\S]*?)(?=\\s*(?:Product|Description|Qty|FSSAI|Seller|Invoice)|$)`, 'i'));
      if (fallbackMatch) {
        const fullText = fallbackMatch[1].trim();
        const parts = fullText.split(/,,|,/);
        customerName = parts[0].trim();
        address = parts.slice(1).join(", ").trim() || "N/A";
      }
    }

    return {
      orderNo,
      customerName,
      address,
      item,
      amount
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

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Join text items with spaces to preserve word boundaries
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        const order = extractDataFromPageText(pageText);
        if (order) {
          allExtracted.push(order);
        }
      }

      setRawText(fullDebugText);
      
      if (allExtracted.length === 0) {
        throw new Error("No valid Flipkart order patterns found in the PDF. Please check the Debug View.");
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

  const handleExport = () => {
    const headers = ["Order No", "Customer Name", "Address", "Item", "Amount"];
    const csvContent = [
      headers.join(","),
      ...extractedOrders.map(o => `"${o.orderNo}","${o.customerName}","${o.address.replace(/"/g, '""')}","${o.item.replace(/"/g, '""')}","${o.amount}"`)
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.body.appendChild(document.createElement("a"));
    link.href = URL.createObjectURL(blob);
    link.download = `Flipkart_Orders_${new Date().getTime()}.csv`;
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>

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
                The system processes the file locally in your browser. No data is sent to any external server.
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
                <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> Export to CSV
                </Button>
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
                        <TableCell className="font-mono text-xs font-semibold text-blue-600">{order.orderNo}</TableCell>
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

export default FlipkartOrderExtractor;