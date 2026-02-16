"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Upload, Search, Download, Save, ListChecks, ShoppingCart, Package, User, Play, Printer, Check, ChevronsUpDown, FileText, Truck, Trash2, Eraser, AlertCircle, Eye, EyeOff, Copy } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface StagedOrder {
  id: string;
  platform_order_number: string;
  customer_name: string;
  shipping_address: string;
  flipkart_item_name: string;
  amount: number;
}

interface CreatedOrder {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  client_name: string;
  raw_item_name: string;
  platform_order_number: string;
  mapped_product_id: string | null;
  bill_no: string;
  dispatch_date: string;
  dispatch_number: number | null;
  dispatched: boolean;
}

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
  gst: string;
}

const OnlineOrderDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useSession();
  const [activeTab, setActiveTab] = useState("extract");
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data states
  const [platforms, setPlatforms] = useState<{id: string, name: string}[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>([]);
  const [createdOrders, setCreatedOrders] = useState<CreatedOrder[]>([]);
  const [selectedStagedIds, setSelectedStagedIds] = useState<string[]>([]);
  
  // UI states
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [platformsRes, productsRes, stagedRes, companyRes] = await Promise.all([
        supabase.from('online_platforms').select('*').order('name'),
        supabase.from('products').select('id, name, code, dp, gst').order('name'),
        supabase.from('online_order_staging').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('company_info').select('company_name').limit(1).single()
      ]);

      setPlatforms(platformsRes.data || []);
      setProducts(productsRes.data || []);
      setStagedOrders(stagedRes.data || []);
      setCompanyName(companyRes.data?.company_name || null);
      
      if (platformsRes.data?.length) setSelectedPlatformId(platformsRes.data[0].id);
    } catch (error: any) {
      showError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCreatedOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers!inner(name),
          online_order_details!inner(client_name, raw_item_name, platform_order_number, mapped_product_id)
        `)
        .eq('dealers.name', 'Online Order')
        .eq('dispatched', false)
        .order('order_date', { ascending: false });

      if (error) throw error;

      const formatted: CreatedOrder[] = (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        order_date: o.order_date,
        total_amount: o.total_amount,
        client_name: o.online_order_details[0].client_name,
        raw_item_name: o.online_order_details[0].raw_item_name,
        platform_order_number: o.online_order_details[0].platform_order_number,
        mapped_product_id: o.online_order_details[0].mapped_product_id,
        bill_no: o.bill_no || '',
        dispatch_date: o.dispatch_date ? o.dispatch_date.split('T')[0] : new Date().toISOString().split('T')[0],
        dispatch_number: o.dispatch_number,
        dispatched: o.dispatched
      }));
      setCreatedOrders(formatted);
    } catch (error: any) {
      showError("Failed to load created orders.");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchInitialData();
  }, [isAdmin, navigate, fetchInitialData]);

  useEffect(() => {
    if (activeTab === "process") {
      fetchCreatedOrders();
    }
  }, [activeTab, fetchCreatedOrders]);

  // --- Extraction Logic ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPlatformId) return;

    const platformName = platforms.find(p => p.id === selectedPlatformId)?.name.toLowerCase() || "";
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
        // Join with newline to preserve line structure for better parsing
        const pageText = textContent.items.map((item: any) => item.str).join('\n');
        fullDebugText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        let order: ExtractedOrder | null = null;
        
        if (platformName.includes('flipkart')) {
          order = extractFlipkart(pageText);
        } else if (platformName.includes('meesho')) {
          order = extractMeesho(pageText);
        } else if (platformName.includes('amazon')) {
          order = extractAmazon(pageText);
        }

        if (order) allExtracted.push(order);
      }

      setRawText(fullDebugText);

      if (allExtracted.length === 0) throw new Error("No orders found in PDF. Check the Debug View for extracted text.");
      setExtractedOrders(allExtracted);
      showSuccess(`Extracted ${allExtracted.length} orders.`);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const extractFlipkart = (text: string): ExtractedOrder | null => {
    const orderNoMatch = text.match(/OD\d{18}/);
    if (!orderNoMatch) return null;
    const amountMatch = text.match(/TOTAL PRICE\s*[:\s]+\s*([\d,]+\.\d{2})/i);
    const itemMatch = text.match(/Total\s*,?\s*([^|]+?)(?=\s*\||\s*IMEI|\s*HSN|\s*Qty)/i);
    const deliverToMatch = text.match(/(?:Deliver to|Shipping Address)[:\s]+([\s\S]*?)(?=\s*(?:FSSAI|Seller|Phone|Pin|Order ID)|$)/i);
    
    const parts = deliverToMatch ? deliverToMatch[1].trim().split(/,,|,/) : ["Unknown"];
    return {
      orderNo: orderNoMatch[0],
      customerName: parts[0].trim(),
      address: parts.slice(1).join(", ").trim() || "N/A",
      item: itemMatch ? itemMatch[1].trim().replace(/^,\s*/, '') : "N/A",
      amount: amountMatch ? amountMatch[1].trim().replace(/,/g, '') : "0.00"
    };
  };

  const extractMeesho = (text: string): ExtractedOrder | null => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // 1. Find Order No - Look for the distinct long number with underscore
    const orderNoMatch = text.match(/\b(\d{15,20}_\d+)\b/);
    if (!orderNoMatch) return null;
    const orderNo = orderNoMatch[0];

    // 2. Find Customer Name - Line immediately after "Customer Address"
    const custIdx = lines.findIndex(l => l.toLowerCase().includes("customer address"));
    const customerName = custIdx !== -1 && lines[custIdx + 1] ? lines[custIdx + 1] : "Unknown";

    // 3. Find Address - Text between Customer Name and "If undelivered"
    let address = "N/A";
    if (custIdx !== -1) {
      const addressLines = [];
      for (let j = custIdx + 2; j < lines.length; j++) {
        if (lines[j].toLowerCase().includes("if undelivered") || lines[j].toLowerCase().includes("return to")) break;
        addressLines.push(lines[j]);
      }
      if (addressLines.length > 0) address = addressLines.join(", ");
    }

    // 4. Find Item - Text between "Description" and the HSN code (6 digits)
    const descIdx = lines.findIndex(l => l.toLowerCase().includes("description"));
    let item = "Meesho Item";
    if (descIdx !== -1) {
      const itemLines = [];
      // Skip headers (HSN, Qty, etc)
      for (let k = descIdx + 1; k < lines.length; k++) {
        if (lines[k].match(/^\d{6}$/)) break; // Stop at HSN code
        if (lines[k].toLowerCase().includes("total")) break;
        // Skip common table headers if they appear here
        if (["hsn", "qty", "gross", "amount", "discount", "taxable", "value", "taxes"].includes(lines[k].toLowerCase())) continue;
        itemLines.push(lines[k]);
      }
      if (itemLines.length > 0) item = itemLines.join(" ");
    }

    // 5. Find Amount - The last "Rs." value appearing after the "Total" label
    let amount = "0.00";
    const totalIdx = lines.findIndex(l => l.toLowerCase() === "total");
    if (totalIdx !== -1) {
      for (let m = lines.length - 1; m >= totalIdx; m--) {
        if (lines[m].includes("Rs.")) {
          amount = lines[m].replace(/Rs\./g, "").replace(/,/g, "").trim();
          break;
        }
      }
    }

    return { orderNo, customerName, address, item, amount };
  };

  const extractAmazon = (text: string): ExtractedOrder | null => {
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
        address = lines.slice(1).join(", ").trim() || "N/A";
      }
    }

    return { orderNo, customerName, address, item, amount };
  };

  // --- Processing Logic ---
  const handleSaveToStaging = async () => {
    if (!user || extractedOrders.length === 0) return;
    setIsProcessing(true);
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

      const { error } = await supabase.from('online_order_staging').upsert(stagingData, { onConflict: 'platform_order_number' });
      if (error) throw error;

      showSuccess(`Staged ${extractedOrders.length} orders.`);
      setExtractedOrders([]);
      fetchInitialData();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearStaging = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('online_order_staging')
        .delete()
        .eq('status', 'pending');
      
      if (error) throw error;
      
      showSuccess("Staging area cleared.");
      setSelectedStagedIds([]);
      fetchInitialData();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectStagedOrder = (id: string, checked: boolean) => {
    setSelectedStagedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllStaged = (checked: boolean) => {
    setSelectedStagedIds(checked ? stagedOrders.map(o => o.id) : []);
  };

  const handleBulkCreateOrders = async () => {
    if (selectedStagedIds.length === 0 || !user) return;
    setIsProcessing(true);
    try {
      const { data: dealer } = await supabase.from('dealers').select('id').eq('name', 'Online Order').single();
      if (!dealer) throw new Error("Create 'Online Order' dealer first.");

      const ordersToProcess = stagedOrders.filter(o => selectedStagedIds.includes(o.id));

      for (const staged of ordersToProcess) {
        const { data: newOrder } = await supabase.from('orders').insert({
          dealer_id: dealer.id,
          user_id: user.id,
          total_amount: staged.amount,
          status: 'completed',
          payment_status: 'paid',
          order_date: new Date().toISOString(),
        }).select('id').single();

        if (newOrder) {
          await supabase.from('online_order_details').insert({
            order_id: newOrder.id,
            client_name: staged.customer_name,
            platform_id: selectedPlatformId,
            platform_order_number: staged.platform_order_number,
            address: staged.shipping_address,
            raw_item_name: staged.flipkart_item_name,
          });
          await supabase.from('online_order_staging').update({ status: 'processed' }).eq('id', staged.id);
        }
      }
      showSuccess(`${ordersToProcess.length} orders created. Now map products in the next tab.`);
      setSelectedStagedIds([]);
      fetchInitialData();
      setActiveTab("process");
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOrderField = (orderId: string, field: keyof CreatedOrder, value: any) => {
    setCreatedOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  };

  const handleBulkCreateGatepass = async () => {
    const ordersToProcess = createdOrders.filter(o => o.mapped_product_id && o.bill_no);
    if (ordersToProcess.length === 0) {
      showError("Select products and enter bill numbers for orders first.");
      return;
    }

    setIsProcessing(true);
    try {
      for (const order of ordersToProcess) {
        const product = products.find(p => p.id === order.mapped_product_id)!;
        const gstPercent = parseFloat(product.gst) || 0;

        await supabase.from('orders').update({
          bill_no: order.bill_no,
          dispatch_date: order.dispatch_date,
          dispatched: true
        }).eq('id', order.id);

        await supabase.from('online_order_details').update({
          mapped_product_id: order.mapped_product_id
        }).eq('order_id', order.id);

        await supabase.from('sales').insert({
          order_id: order.id,
          product_id: order.mapped_product_id,
          quantity: 1,
          unit_price: order.total_amount / (1 + gstPercent / 100),
          gst_percent: gstPercent,
          total_price: order.total_amount,
        });
      }
      showSuccess("Gatepasses generated and stock updated.");
      fetchCreatedOrders();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPrintInvoices = async () => {
    const doc = new jsPDF();
    const darkBlue: [number, number, number] = [30, 58, 138];
    
    for (let i = 0; i < createdOrders.length; i++) {
      const order = createdOrders[i];
      if (i > 0) doc.addPage();
      
      doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, 10, 210, 15, 'F');
      doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
      doc.text(companyName?.toUpperCase() || "ORDER INVOICE", 105, 20, { align: 'center' });

      doc.setTextColor(0); doc.setFontSize(10);
      doc.text(`Order No: #${order.order_number}`, 15, 40);
      doc.text(`Platform ID: ${order.platform_order_number}`, 15, 45);
      doc.text(`Customer: ${order.client_name}`, 15, 50);
      doc.text(`Item: ${order.raw_item_name}`, 15, 55);
      doc.text(`Total: Rs. ${order.total_amount.toFixed(2)}`, 15, 60);
    }
    doc.save("Bulk_Online_Invoices.pdf");
  };

  const handleBulkPrintGatepasses = async () => {
    const doc = new jsPDF();
    const darkBlue: [number, number, number] = [30, 58, 138];
    
    const dispatched = createdOrders.filter(o => o.dispatched && o.dispatch_number);
    if (dispatched.length === 0) {
      showError("No dispatched orders found to print gatepasses.");
      return;
    }

    for (let i = 0; i < dispatched.length; i++) {
      const order = dispatched[i];
      if (i > 0) doc.addPage();
      
      doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text(`Gate Pass: ${order.dispatch_number}`, 105, 15, { align: 'center' });
      doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, 22, 210, 12, 'F');
      doc.setFontSize(16); doc.setTextColor(255, 255, 255);
      doc.text(companyName?.toUpperCase() || "DISPATCH SLIP", 105, 30, { align: 'center' });
      
      doc.setTextColor(0); doc.setFontSize(10);
      doc.text(`Order: #${order.order_number}`, 15, 45);
      doc.text(`Customer: ${order.client_name}`, 15, 50);
      doc.text(`Bill No: ${order.bill_no}`, 15, 55);
      doc.text(`Amount: Rs. ${order.total_amount.toFixed(2)}`, 15, 60);
    }
    doc.save("Bulk_Gate_Passes.pdf");
  };

  const handleCopyDebugText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    showSuccess("Debug text copied to clipboard.");
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-primary">Online Order Dashboard</h1>
          <div className="w-fit"></div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="extract" className="text-lg py-3"><Upload className="mr-2 h-5 w-5" /> 1. Extract & Stage</TabsTrigger>
            <TabsTrigger value="process" className="text-lg py-3"><ListChecks className="mr-2 h-5 w-5" /> 2. Map & Dispatch</TabsTrigger>
          </TabsList>

          <TabsContent value="extract" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <CardHeader className="bg-blue-600 text-white rounded-t-lg">
                  <CardTitle>Upload Labels</CardTitle>
                  <CardDescription className="text-blue-100">Select platform and upload PDF.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
                      <SelectTrigger><SelectValue placeholder="Select Platform" /></SelectTrigger>
                      <SelectContent>
                        {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors relative">
                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={loading} />
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to upload PDF</p>
                  </div>
                  {extractedOrders.length > 0 && (
                    <Button onClick={handleSaveToStaging} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700">
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Stage {extractedOrders.length} Orders
                    </Button>
                  )}
                  {rawText && (
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowRawText(!showRawText)}
                        className="w-full text-xs text-muted-foreground"
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
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Staging Area</CardTitle>
                      <CardDescription>Orders extracted but not yet created in the system.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {stagedOrders.length > 0 && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" disabled={isProcessing} className="text-destructive border-destructive hover:bg-destructive/10">
                                <Eraser className="mr-2 h-4 w-4" /> Clear Staging
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Clear Staging Area?</AlertDialogTitle>
                                <AlertDialogDescription>This will remove all {stagedOrders.length} pending orders from the staging area. This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearStaging} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button onClick={handleBulkCreateOrders} disabled={isProcessing || selectedStagedIds.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
                            <Play className="mr-2 h-4 w-4" /> Bulk Create {selectedStagedIds.length} Orders
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {showRawText && rawText && (
                    <div className="p-4 bg-slate-950 text-slate-50 rounded-none overflow-x-auto border-b">
                      <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" /> Raw Extracted Text (Debug)
                      </h4>
                      <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                        {rawText}
                      </pre>
                    </div>
                  )}
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={selectedStagedIds.length === stagedOrders.length && stagedOrders.length > 0}
                              onCheckedChange={(checked) => handleSelectAllStaged(!!checked)}
                            />
                          </TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stagedOrders.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No orders in staging.</TableCell></TableRow>
                        ) : (
                          stagedOrders.map(o => (
                            <TableRow key={o.id}>
                              <TableCell>
                                <Checkbox 
                                  checked={selectedStagedIds.includes(o.id)}
                                  onCheckedChange={(checked) => handleSelectStagedOrder(o.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{o.platform_order_number}</TableCell>
                              <TableCell className="text-xs">{o.customer_name}</TableCell>
                              <TableCell className="text-xs">{o.flipkart_item_name}</TableCell>
                              <TableCell className="text-right font-bold">₹{o.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="process" className="space-y-6">
            <Card>
              <CardHeader className="bg-indigo-600 text-white rounded-t-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Map & Dispatch Orders</CardTitle>
                    <CardDescription className="text-indigo-100">Link online items to actual products and generate gatepasses.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleBulkPrintInvoices} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                      <Printer className="mr-2 h-4 w-4" /> Print Invoices
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkPrintGatepasses} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                      <Truck className="mr-2 h-4 w-4" /> Print Gatepasses
                    </Button>
                    <Button onClick={handleBulkCreateGatepass} disabled={isProcessing} className="bg-green-500 hover:bg-green-600">
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Generate Bulk Gatepasses
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Order #</TableHead>
                        <TableHead>Online Item</TableHead>
                        <TableHead className="w-[250px]">Map to Product</TableHead>
                        <TableHead className="w-[150px]">Bill No.</TableHead>
                        <TableHead className="w-[150px]">Bill Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {createdOrders.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No pending online orders to process.</TableCell></TableRow>
                      ) : (
                        createdOrders.map((o) => (
                          <TableRow key={o.id} className={o.dispatched ? "opacity-50" : ""}>
                            <TableCell className="font-bold">#{o.order_number}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{o.client_name}</span>
                                <span className="text-[10px] text-muted-foreground">{o.raw_item_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full justify-between text-left font-normal h-auto py-1" disabled={o.dispatched}>
                                    {o.mapped_product_id ? (
                                      <span className="text-[10px] truncate">{products.find(p => p.id === o.mapped_product_id)?.name}</span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">Select Product...</span>
                                    )}
                                    <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0">
                                  <div className="p-2 border-b"><Input placeholder="Search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="h-7 text-xs" /></div>
                                  <ScrollArea className="h-[150px]">
                                    {filteredProducts.map(p => (
                                      <Button key={p.id} variant="ghost" className="w-full justify-start text-[10px] h-auto py-1" onClick={() => { handleUpdateOrderField(o.id, 'mapped_product_id', p.id); setProductSearch(''); }}>
                                        {p.name} ({p.code})
                                      </Button>
                                    ))}
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell><Input size={1} className="h-8 text-xs" value={o.bill_no} onChange={e => handleUpdateOrderField(o.id, 'bill_no', e.target.value)} disabled={o.dispatched} placeholder="Bill #" /></TableCell>
                            <TableCell><Input type="date" className="h-8 text-xs" value={o.dispatch_date} onChange={e => handleUpdateOrderField(o.id, 'dispatch_date', e.target.value)} disabled={o.dispatched} /></TableCell>
                            <TableCell className="text-right font-bold text-xs">₹{o.total_amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default OnlineOrderDashboard;