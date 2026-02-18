"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Check, Trash2, ListChecks, Package, User, Play, Printer, ChevronsUpDown, FileText, Truck, Eraser, AlertCircle, Eye, EyeOff, Copy, X, Edit, Search, LogOut } from 'lucide-react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OnlineOrder {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  client_name: string;
  raw_item_name: string;
  platform_order_number: string;
  mapped_product_id: string | null;
  bill_no: string | null;
  dispatch_date: string | null;
  dispatch_number: number | null;
  dispatched: boolean;
  gate_pass_dispatch_time?: string | null;
}

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
  gst: string;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const OnlineOrderDispatchDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, userType, loading: sessionLoading } = useSession();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [createdOrders, setCreatedOrders] = useState<OnlineOrder[]>([]);
  const [gatepassCreatedOrders, setGatepassCreatedOrders] = useState<OnlineOrder[]>([]);
  const [selectedCreatedIds, setSelectedCreatedIds] = useState<string[]>([]);
  const [selectedGatepassCreatedIds, setSelectedGatepassCreatedIds] = useState<string[]>([]);
  
  const [productSearch, setProductSearch] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  const [filterOrderNumberProcess, setFilterOrderNumberProcess] = useState("");
  const [filterOrderDate, setFilterOrderDate] = useState("");
  const [filterGatepassDate, setFilterGatepassDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterGatepassOrderNumber, setFilterGatepassOrderNumber] = useState<string>('');
  const [filterGatepassDispatchNumber, setFilterGatepassDispatchNumber] = useState<string>('');

  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, companyRes] = await Promise.all([
        supabase.from('products').select('id, name, code, dp, gst').order('name'),
        supabase.from('company_info').select('company_name').limit(1).single()
      ]);

      if (productsRes.error) throw productsRes.error;
      setProducts(productsRes.data || []);
      setCompanyName(companyRes.data?.company_name || null);
    } catch (error: any) {
      showError("Failed to load initial dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCreatedOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers!inner(name),
          online_order_details!inner(client_name, raw_item_name, platform_order_number, mapped_product_id)
        `)
        .eq('dealers.name', 'Online Order')
        .eq('dispatched', false)
        .order('order_number', { ascending: false });

      if (filterOrderDate) {
        const startOfDay = `${filterOrderDate}T00:00:00.000Z`;
        const endOfDay = `${filterOrderDate}T23:59:59.999Z`;
        query = query.gte('order_date', startOfDay).lte('order_date', endOfDay);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: OnlineOrder[] = (data || []).map((o: any) => ({
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
    } finally {
      setLoading(false);
    }
  }, [filterOrderDate]);

  const fetchGatepassCreatedOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, dispatched, gate_pass_dispatch_time,
          dealers!inner(name),
          online_order_details!inner(client_name, raw_item_name, platform_order_number, mapped_product_id, products(name, code))
        `)
        .eq('dealers.name', 'Online Order')
        .not('gate_pass_dispatch_time', 'is', null)
        .order('gate_pass_dispatch_time', { ascending: false });

      if (filterGatepassDate) {
        const startOfDay = `${filterGatepassDate}T00:00:00.000Z`;
        const endOfDay = `${filterGatepassDate}T23:59:59.999Z`;
        query = query.gte('gate_pass_dispatch_time', startOfDay).lte('gate_pass_dispatch_time', endOfDay);
      }

      if (filterGatepassOrderNumber) {
        query = query.eq('order_number', parseInt(filterGatepassOrderNumber));
      }

      if (filterGatepassDispatchNumber) {
        query = query.eq('dispatch_number', parseInt(filterGatepassDispatchNumber));
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: OnlineOrder[] = (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        order_date: o.order_date,
        total_amount: o.total_amount,
        client_name: o.online_order_details[0].client_name,
        raw_item_name: o.online_order_details[0].raw_item_name,
        platform_order_number: o.online_order_details[0].platform_order_number,
        mapped_product_id: o.online_order_details[0].mapped_product_id,
        bill_no: o.bill_no || '',
        dispatch_date: o.dispatch_date ? o.dispatch_date.split('T')[0] : '',
        dispatch_number: o.dispatch_number,
        dispatched: o.dispatched,
        gate_pass_dispatch_time: o.gate_pass_dispatch_time,
      }));
      setGatepassCreatedOrders(formatted);
    } catch (error: any) {
      showError("Failed to load gatepass created orders.");
    } finally {
      setLoading(false);
    }
  }, [filterGatepassDate, filterGatepassOrderNumber, filterGatepassDispatchNumber]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'online_orders' && !isAdmin) {
        showError('Access Denied.');
        navigate('/dashboard');
      } else {
        fetchInitialData();
      }
    }
  }, [sessionLoading, user, userType, isAdmin, navigate, fetchInitialData]);

  useEffect(() => {
    if (user) {
      fetchCreatedOrders();
      fetchGatepassCreatedOrders();
    }
  }, [user, fetchCreatedOrders, fetchGatepassCreatedOrders]);

  const handleUpdateOrderField = (orderId: string, field: keyof OnlineOrder, value: any) => {
    setCreatedOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  };

  const handleBulkCreateGatepass = async () => {
    const ordersToProcess = createdOrders.filter(o => selectedCreatedIds.includes(o.id) && o.mapped_product_id && o.bill_no);
    if (ordersToProcess.length === 0) {
      showError("Select products and enter bill numbers for the selected orders first.");
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
          mapped_product_id: order.mapped_product_id,
          client_name: order.client_name
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
      showSuccess("Gatepasses generated and stock updated for selected orders.");
      setSelectedCreatedIds([]);
      fetchCreatedOrders();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCreatedOrder = (id: string, checked: boolean) => {
    setSelectedCreatedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllCreated = (checked: boolean) => {
    const filteredIds = filteredCreatedOrders.map(o => o.id);
    setSelectedCreatedIds(checked ? filteredIds : []);
  };

  const handleSelectGatepassCreated = (id: string, checked: boolean) => {
    setSelectedGatepassCreatedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllGatepassCreated = (checked: boolean) => {
    setSelectedGatepassCreatedIds(checked ? gatepassCreatedOrders.map(o => o.id) : []);
  };

  const handleViewOrder = (id: string) => {
    setSelectedOrderIdForDetails(id);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleEditOrder = (id: string) => {
    setSelectedOrderIdForEdit(id);
    setIsEditOrderDialogOpen(true);
  };

  const handleDeleteOrder = async (order: OnlineOrder) => {
    setIsProcessing(true);
    try {
      await supabase.from('payments').delete().eq('order_id', order.id);
      await supabase.from('sales').delete().eq('order_id', order.id);
      await supabase.from('online_order_details').delete().eq('order_id', order.id);
      
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;

      showSuccess(`Order #${order.order_number} deleted.`);
      fetchCreatedOrders();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const filteredCreatedOrders = useMemo(() => {
    if (!filterOrderNumberProcess) return createdOrders;
    return createdOrders.filter(o => o.order_number.toString().includes(filterOrderNumberProcess) || o.platform_order_number.toLowerCase().includes(filterOrderNumberProcess.toLowerCase()));
  }, [createdOrders, filterOrderNumberProcess]);

  const handlePrintSingleOrderDetails = async (order: OnlineOrder) => {
    if (!order) return;
    setIsProcessing(true);
    try {
      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;

      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          order_number, order_date, total_amount, discount_amount, 
          dealers (name, address, phone, city, state), 
          online_order_details (client_name, city, state, contact_no, online_platforms (name), platform_order_number),
          sales (quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code))
        `)
        .eq('id', order.id)
        .single();
        
      if (!orderData) throw new Error("Order not found");

      doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, 10, pageWidth, 15, 'F');
      doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
      doc.text(companyName?.toUpperCase() || "ORDER INVOICE", pageWidth / 2, 20, { align: 'center' });

      doc.setTextColor(0); doc.setFontSize(10); let y = 35;
      
      const onlineDetails = orderData.online_order_details?.[0];
      const isOnline = (orderData.dealers as any)?.name === 'Online Order' && onlineDetails;
      
      const partyName = isOnline ? onlineDetails.client_name : (orderData.dealers as any).name;
      const partyAddress = isOnline 
        ? `${onlineDetails.city || ''}, ${onlineDetails.state || ''}`.trim() || 'N/A'
        : `${(orderData.dealers as any).address}, ${(orderData.dealers as any).city}, ${(orderData.dealers as any).state}`;
      const partyPhone = isOnline ? onlineDetails.contact_no : (orderData.dealers as any).phone;

      doc.setFont("helvetica", "bold"); doc.text("PARTY DETAILS:", margin, y);
      doc.setFont("helvetica", "normal"); y += 5; doc.text(partyName, margin, y);
      y += 5; const addressLines = doc.splitTextToSize(partyAddress, pageWidth / 2 - margin);
      doc.text(addressLines, margin, y);
      
      let rightY = 35; const rightColX = pageWidth / 2 + 10;
      doc.setFont("helvetica", "bold"); doc.text("ORDER SUMMARY:", rightColX, rightY);
      doc.setFont("helvetica", "normal"); rightY += 5; doc.text(`Order No: #${orderData.order_number}`, rightColX, rightY);
      rightY += 5; doc.text(`Date: ${formatDate(orderData.order_date)}`, rightColX, rightY);
      rightY += 5; doc.text(`Phone: ${partyPhone || 'N/A'}`, rightColX, rightY);

      if (isOnline) {
        rightY += 5; doc.text(`Platform: ${(onlineDetails.online_platforms as any)?.name || 'N/A'}`, rightColX, rightY);
        rightY += 5; doc.text(`Platform Order #: ${onlineDetails.platform_order_number || 'N/A'}`, rightColX, rightY);
      }

      y = Math.max(y + (addressLines.length * 5), rightY + 10);
      const tableRows = (orderData.sales || []).map((sale: any) => [
        sale.products?.code || 'N/A', 
        sale.products?.name || 'N/A', 
        sale.quantity.toString(), 
        `₹${(sale.unit_price || 0).toFixed(2)}`, 
        `${(sale.discount_percent || 0)}%`, 
        `${(sale.gst_percent || 0)}%`, 
        `₹${(sale.total_price || 0).toFixed(2)}`
      ]);

      autoTable(doc, { 
        head: [["Code", "Product", "Qty", "Unit Price", "Disc %", "GST %", "Total"]], 
        body: tableRows, 
        startY: y, 
        headStyles: { fillColor: darkBlue, halign: 'center', fontSize: 8 }, 
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 15, halign: 'center' },
          6: { cellWidth: 25, halign: 'right' }
        },
        styles: { fontSize: 8, cellPadding: 2 } 
      });
      
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      const subtotal = (orderData.sales || []).reduce((sum: number, s: any) => sum + s.total_price, 0);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, pageWidth / 2, finalY, { align: 'center' });
      
      let currentY = finalY;
      if (orderData.discount_amount > 0) {
        currentY += 5;
        doc.text(`Global Discount: -₹${orderData.discount_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
      }
      
      currentY += 7;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(`FINAL TOTAL: ₹${orderData.total_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
      
      doc.save(`Order_Details_${order.order_number}.pdf`);
      showSuccess("Order details PDF generated.");
    } catch (error: any) {
      showError(`Failed to print order details: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintSingleGatepass = async (order: OnlineOrder) => {
    if (!order) return;
    setIsProcessing(true);
    try {
      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;

      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          order_number, order_date, total_amount, dispatch_number, bill_no, 
          dealers (name, address, city, state), 
          online_order_details (client_name, city, state),
          sales (quantity, products (name, code))
        `)
        .eq('id', order.id)
        .single();
        
      if (!orderData) throw new Error("Order not found");

      doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text(`Gate Pass: ${orderData.dispatch_number || 'N/A'}`, pageWidth / 2, 15, { align: 'center' });
      doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, 22, pageWidth, 12, 'F');
      doc.setFontSize(16); doc.setTextColor(255, 255, 255);
      doc.text(companyName?.toUpperCase() || "DISPATCH SLIP", pageWidth / 2, 30, { align: 'center' });
      
      doc.setTextColor(0); doc.setFontSize(10); let y = 45;
      
      const onlineDetails = orderData.online_order_details?.[0];
      const isOnline = (orderData.dealers as any)?.name === 'Online Order' && onlineDetails;
      
      const partyName = isOnline ? onlineDetails.client_name : (orderData.dealers as any).name;
      const partyAddress = isOnline 
        ? `${onlineDetails.city || ''}, ${onlineDetails.state || ''}`.trim() || 'N/A'
        : `${(orderData.dealers as any).address}, ${(orderData.dealers as any).city}, ${(orderData.dealers as any).state}`;

      doc.setFont("helvetica", "bold"); doc.text("PARTY DETAILS:", margin, y);
      doc.setFont("helvetica", "normal"); y += 5; doc.text(partyName, margin, y);
      y += 5; const addressLines = doc.splitTextToSize(partyAddress, pageWidth / 2 - margin);
      doc.text(addressLines, margin, y);
      
      let rightY = 45; const rightColX = pageWidth / 2 + 10;
      doc.setFont("helvetica", "bold"); doc.text("ORDER DETAILS:", rightColX, rightY);
      doc.setFont("helvetica", "normal"); rightY += 5; doc.text(`Order No: #${orderData.order_number}`, rightColX, rightY);
      rightY += 5; doc.text(`Bill No: ${orderData.bill_no || 'N/A'}`, rightColX, rightY);
      rightY += 5; doc.text(`Date: ${formatDate(orderData.order_date)}`, rightColX, rightY);

      y = Math.max(y + (addressLines.length * 5), rightY + 10);
      const tableRows = (orderData.sales || []).map((sale: any) => [sale.products?.code || 'N/A', sale.products?.name || 'N/A', sale.quantity.toString()]);
      autoTable(doc, { head: [["Code", "Product Name", "Quantity"]], body: tableRows, startY: y, headStyles: { fillColor: darkBlue, halign: 'center' }, styles: { fontSize: 9, cellPadding: 3 } });
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(`TOTAL BILL AMOUNT: Rs. ${orderData.total_amount.toFixed(2)}`, pageWidth / 2, (doc as any).lastAutoTable.finalY + 15, { align: 'center' });
      
      doc.save(`GatePass_${order.dispatch_number}.pdf`);
      showSuccess("Gate Pass PDF generated.");
    } catch (error: any) {
      showError(`Failed to print Gate Pass: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-primary">Online Order Dispatch</h1>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader className="bg-indigo-600 text-white rounded-t-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Map & Dispatch Orders</CardTitle>
                  <CardDescription className="text-indigo-100">Link online items to actual products and generate gatepasses.</CardDescription>
                </div>
                <Button onClick={handleBulkCreateGatepass} disabled={isProcessing || selectedCreatedIds.length === 0} className="bg-green-500 hover:bg-green-600">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Generate Gatepasses for Selected
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-end gap-4">
                <div className="relative flex-grow max-w-xs">
                  <Label>Search Order # or Platform ID</Label>
                  <Search className="absolute left-2 top-8 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." value={filterOrderNumberProcess} onChange={(e) => setFilterOrderNumberProcess(e.target.value)} className="pl-8" />
                </div>
                <div className="flex-grow max-w-xs">
                  <Label>Filter by Order Date</Label>
                  <Input type="date" value={filterOrderDate} onChange={(e) => setFilterOrderDate(e.target.value)} />
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12"><Checkbox checked={selectedCreatedIds.length === filteredCreatedOrders.length && filteredCreatedOrders.length > 0} onCheckedChange={(checked) => handleSelectAllCreated(!!checked)} /></TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Platform Order #</TableHead>
                      <TableHead className="w-[200px]">Customer Name</TableHead>
                      <TableHead>Online Item (Raw)</TableHead>
                      <TableHead className="w-[250px]">Map to Product</TableHead>
                      <TableHead className="w-[150px]">Bill No.</TableHead>
                      <TableHead className="w-[150px]">Bill Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCreatedOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No pending online orders found.</TableCell></TableRow>
                    ) : (
                      filteredCreatedOrders.map((o) => (
                        <TableRow key={o.id} className={o.dispatched ? "opacity-50" : ""}>
                          <TableCell><Checkbox checked={selectedCreatedIds.includes(o.id)} onCheckedChange={(checked) => handleSelectCreatedOrder(o.id, !!checked)} disabled={o.dispatched} /></TableCell>
                          <TableCell className="font-bold">#{o.order_number}</TableCell>
                          <TableCell className="font-mono text-xs">{o.platform_order_number}</TableCell>
                          <TableCell><Input className="h-8 text-xs font-medium" value={o.client_name} onChange={(e) => handleUpdateOrderField(o.id, 'client_name', e.target.value)} disabled={o.dispatched} placeholder="Customer Name" /></TableCell>
                          <TableCell><span className="text-[10px] text-muted-foreground italic">{o.raw_item_name}</span></TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-between text-left font-normal h-auto py-1" disabled={o.dispatched}>
                                  {o.mapped_product_id ? (<span className="text-[10px] truncate">{products.find(p => p.id === o.mapped_product_id)?.name}</span>) : (<span className="text-[10px] text-muted-foreground">Select Product...</span>)}
                                  <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[250px] p-0">
                                <div className="p-2 border-b"><Input placeholder="Search..." value={productSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)} className="h-7 text-xs" /></div>
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
                          <TableCell><Input size={1} className="h-8 text-xs" value={o.bill_no || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateOrderField(o.id, 'bill_no', e.target.value)} disabled={o.dispatched} placeholder="Bill #" /></TableCell>
                          <TableCell><Input type="date" className="h-8 text-xs" value={o.dispatch_date || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateOrderField(o.id, 'dispatch_date', e.target.value)} disabled={o.dispatched} /></TableCell>
                          <TableCell className="text-right font-bold text-xs">₹{o.total_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleViewOrder(o.id)} title="View Details"><Eye className="h-4 w-4 text-blue-500" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEditOrder(o.id)} title="Edit Order"><Edit className="h-4 w-4 text-orange-500" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete Order"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete Order #{o.order_number}?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the order and its details. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOrder(o)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-green-600 text-white rounded-t-lg">
              <div className="flex justify-between items-center">
                <CardTitle>Gatepass Created Orders</CardTitle>
                <Button variant="outline" size="sm" disabled={selectedGatepassCreatedIds.length === 0} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                  <Printer className="mr-2 h-4 w-4" /> Print Selected Gatepasses ({selectedGatepassCreatedIds.length})
                </Button>
              </div>
              <CardDescription className="text-green-100">Showing all gatepasses created for online orders.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-grow max-w-xs">
                  <Label>Filter by Gatepass Date</Label>
                  <Input type="date" value={filterGatepassDate} onChange={(e) => setFilterGatepassDate(e.target.value)} />
                </div>
                <div className="flex-grow max-w-xs">
                  <Label>Search by Order No.</Label>
                  <Input type="number" placeholder="e.g., 12345" value={filterGatepassOrderNumber} onChange={(e) => setFilterGatepassOrderNumber(e.target.value)} />
                </div>
                <div className="flex-grow max-w-xs">
                  <Label>Search by Gatepass No.</Label>
                  <Input type="number" placeholder="e.g., 67890" value={filterGatepassDispatchNumber} onChange={(e) => setFilterGatepassDispatchNumber(e.target.value)} />
                </div>
              </div>
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"><Checkbox checked={selectedGatepassCreatedIds.length === gatepassCreatedOrders.length && gatepassCreatedOrders.length > 0} onCheckedChange={(checked) => handleSelectAllGatepassCreated(!!checked)} /></TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Bill No.</TableHead>
                      <TableHead>Gatepass Time</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gatepassCreatedOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No gatepass created orders found.</TableCell></TableRow>
                    ) : (
                      gatepassCreatedOrders.map(o => (
                        <TableRow key={o.id}>
                          <TableCell><Checkbox checked={selectedGatepassCreatedIds.includes(o.id)} onCheckedChange={(checked) => handleSelectGatepassCreated(o.id, !!checked)} /></TableCell>
                          <TableCell>#{o.order_number}</TableCell>
                          <TableCell>{o.client_name}</TableCell>
                          <TableCell>{o.bill_no}</TableCell>
                          <TableCell>{o.gate_pass_dispatch_time ? new Date(o.gate_pass_dispatch_time).toLocaleString() : 'N/A'}</TableCell>
                          <TableCell className="text-right">₹{o.total_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleViewOrder(o.id)} title="View Details"><Eye className="h-4 w-4 text-blue-500" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handlePrintSingleOrderDetails(o)} title="Print Order"><FileText className="h-4 w-4 text-green-500" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handlePrintSingleGatepass(o)} title="Print Gate Pass"><Printer className="h-4 w-4 text-gray-500" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
      <MadeWithDyad />
      
      <OrderDetailsDialog 
        orderId={selectedOrderIdForDetails} 
        isOpen={isOrderDetailsDialogOpen} 
        onOpenChange={setIsOrderDetailsDialogOpen} 
        showGatePassButton={false}
      />
      
      <EditOrderDialog 
        orderId={selectedOrderIdForEdit} 
        isOpen={isEditOrderDialogOpen} 
        onOpenChange={setIsEditOrderDialogOpen} 
        onOrderUpdated={fetchCreatedOrders}
      />
    </div>
  );
};

export default OnlineOrderDispatchDashboard;