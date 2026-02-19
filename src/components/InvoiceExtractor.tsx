"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, FileText, AlertCircle, Eye, EyeOff, Copy } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import * as pdfjsLib from 'pdfjs-dist';

// Import the worker directly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractedInvoiceData {
  orderNo: string;
  billNo: string;
  billDate: string;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  totalAmount: number;
}

interface InvoiceExtractorProps {
  onDataExtracted: (data: ExtractedInvoiceData) => void;
}

const InvoiceExtractor: React.FC<InvoiceExtractorProps> = ({ onDataExtracted }) => {
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

  const extractDataFromText = (text: string): ExtractedInvoiceData | null => {
    const orderNoMatch = text.match(/Order Number\s*:\s*(\d+)/i);
    const billNoMatch = text.match(/Invoice Number\s*:\s*([^\n]+)/i);
    const billDateMatch = text.match(/Invoice Date\s*:\s*([^\n]+)/i);
    const totalAmountMatch = text.match(/Total Amount\s*Rs\.?\s*([\d,]+\.\d{2})/i);

    if (!orderNoMatch || !billNoMatch || !billDateMatch || !totalAmountMatch) {
      console.error("Failed to find one or more required fields: Order No, Bill No, Bill Date, Total Amount.");
      return null;
    }

    const orderNo = orderNoMatch[1].trim();
    const billNo = billNoMatch[1].trim();
    const billDate = new Date(billDateMatch[1].trim()).toISOString().split('T')[0];
    const totalAmount = parseFloat(totalAmountMatch[1].replace(/,/g, ''));

    const items: ExtractedInvoiceData['items'] = [];
    const itemBlockMatch = text.match(/GST %\s+Total\s+([\s\S]+?)\s+TOTAL \(Including GST\)/i);
    if (itemBlockMatch) {
      const itemLine = itemBlockMatch[1].trim();
      const nameMatch = itemLine.match(/^([\s\S]+?)\s+\d{4,}/);
      const name = nameMatch ? nameMatch[1].trim().replace(/\s+/g, ' ') : "Unknown Item";
      
      const numbers = itemLine.match(/(\d+\.\d{2})/g);
      if (numbers && numbers.length >= 2) {
        const quantity = 1; // Assuming 1 for now
        const unitPrice = parseFloat(numbers[0]);
        const totalPrice = parseFloat(numbers[1]);
        items.push({ name, quantity, unitPrice, totalPrice });
      }
    }

    if (items.length === 0) {
      items.push({ name: "Extracted Item (Manual Mapping Needed)", quantity: 1, unitPrice: totalAmount, totalPrice: totalAmount });
    }

    return { orderNo, billNo, billDate, items, totalAmount };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRawText("");
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullDebugText = "";
      let extractedData: ExtractedInvoiceData | null = null;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join('\n');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        if (!extractedData) { // Only extract from the first valid page
          extractedData = extractDataFromText(pageText);
        }
      }

      setRawText(fullDebugText);
      
      if (!extractedData) {
        throw new Error("Could not find a valid Spartan invoice pattern in the PDF. Check the Debug View.");
      }

      showSuccess(`Successfully extracted data for Order #${extractedData.orderNo}.`);
      onDataExtracted(extractedData);
    } catch (error: any) {
      showError(error.message || "Failed to parse PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDebugText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    showSuccess("Debug text copied to clipboard.");
  };

  return (
    <Card className="border-2 border-primary/20 shadow-xl">
      <CardHeader className="bg-gray-700 text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8" />
          <div>
            <CardTitle className="text-2xl">Process from Invoice PDF</CardTitle>
            <CardDescription className="text-gray-200">
              Upload a supplier invoice to automatically find and update the corresponding online order.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 bg-muted/5 hover:bg-muted/10 transition-colors">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select Invoice PDF</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            The system will extract the Order Number and attempt to pre-fill the details in the "Map & Dispatch" tab.
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
                {loading ? 'Processing PDF...' : 'Upload & Match'}
              </Button>
            </div>
            
            {rawText && (
              <div className="flex flex-col gap-2 mt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs text-muted-foreground"
                >
                  {showRawText ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showRawText ? 'Hide Debug View' : 'Show Debug View'}
                </Button>
                {showRawText && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyDebugText}
                    className="w-full text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Debug Text
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {showRawText && rawText && (
          <div className="mt-6 p-4 bg-slate-950 text-slate-50 rounded-md overflow-x-auto">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" /> Raw Extracted Text (Debug)
            </h4>
            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
              {rawText}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceExtractor;