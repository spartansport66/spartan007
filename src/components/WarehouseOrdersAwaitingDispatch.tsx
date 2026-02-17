"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Search, Printer, FileText, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface OrderToDispatch {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  dealer_id: string;
}

interface DealerOption {
  value: string;
  label: string;
}

interface WarehouseOrdersAwaitingDispatchProps {}

const WarehouseOrdersAwaitingDispatch: React.FC<WarehouseOrdersAwaitingDispatchProps> = () => {
  const [orders, setOrders] = useState<OrderToDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [viewedOrderIds, setViewedOrderIds] = useState<Set<string>>(new Set());

  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
    }
  }, []);

  const fetchOrdersAndDealers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dealersData, error: dealersError } = await supabase.from('dealers').select('id, name');
      if (dealersError) {
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers(dealersData.map(d => ({ value: d.id, label: d.name })));
      }

      let query = supabase.from('orders').select(`id, order_number, order_date, total_amount, dealers (id, name)`).eq('dispatched', false).order('order_date', { ascending: false });
      if (filterOrderNumber) query = query.eq('order_number', parseInt(filterOrderNumber));
      if (filterDealerId) query = query.eq('dealer_id', filterDealerId);
      if (filterDate) query = query.gte('order_date', `${filterDate}T00:00:00.000Z`).lte('order_date', `${filterDate}T23:59:59.999Z`);

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) {
        showError('Failed to load orders.');
        setOrders([]);
      } else {
        setOrders((ordersData || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          dealer_id: order.dealers?.id || '',
        })));
      }
    } catch (error: any) {
      showError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterDate]);

  useEffect(() => {
    fetchOrdersAndDealers();
    fetchCompanyInfo();
  }, [fetchOrdersAndDealers, fetchCompanyInfo]);

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => checked ? [...prev, orderId] : prev.filter(id => id !== orderId));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map(o => o.id) : []);
  };

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterDate('');
  };

  const handleOrderPrinted = (orderId: string) => {
    setViewedOrderIds(prev => new Set(prev).add(orderId));
  };

  const handleResetViews = () => {
    setViewedOrderIds(new Set());
    showSuccess("Viewed status has been reset for all orders.");
  };

  const handleBulkPrintGatePasses = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkPrinting(true);
    try {
      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;

      for (let i = 0; i < selectedOrderIds.length; i++) {
        const { data: orderData } = await supabase
          .from('orders')
          .select(`
            order_number, order_date, total_amount, dispatch_number, bill_no, 
            dealers (name, address, city, state), 
            online_order_details (client_name, city, state),
            sales (quantity, products (name, code))
          `)
          .eq('id', selectedOrderIds[i])
          .single();
          
        if (!orderData) continue;
        if (i > 0) doc.addPage();

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
      }
      doc.save(`Bulk_Gate_Passes_${new Date().getTime()}.pdf`);
      showSuccess(`Generated ${selectedOrderIds.length} Gate Passes.`);
      setSelectedOrderIds([]);
    } catch (error: any) { showError(`Failed: ${error.message}`); } finally { setIsBulkPrinting(false); }
  };

  const handleBulkPrintOrderDetails = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkPrinting(true);
    try {
      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;

      for (let i = 0; i < selectedOrderIds.length; i++) {
        const { data: orderData } = await supabase
          .from('orders')
          .select(`
            order_number, order_date, total_amount, discount_amount, 
            dealers (name, address, phone, city, state), 
            online_order_details (client_name, city, state, contact_no, online_platforms (name), platform_order_number),
            sales (quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code))
          `)
          .eq('id', selectedOrderIds[i])
          .single();
          
        if (!orderData) continue;
        if (i > 0) doc.addPage();

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
      }
      doc.save(`Bulk_Order_Details_${new Date().getTime()}.pdf`);
      showSuccess(`Generated ${selectedOrderIds.length} Order Detail PDFs.`);
      setSelectedOrderIds([]);
    } catch (error: any) { showError(`Failed: ${error.message}`); } finally { setIsBulkPrinting(false); }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Orders Awaiting Dispatch</CardTitle>
            <CardDescription className="text-orange-100 dark:text-orange-200">View and process orders ready for dispatch.</CardDescription>
          </div>
          <div className="flex gap-2">
            {viewedOrderIds.size > 0 && (
              <Button onClick={handleResetViews} variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white">
                <RotateCcw className="h-4 w-4 mr-2" /> Reset Views
              </Button>
            )}
            {selectedOrderIds.length > 0 && (
              <>
                <Button onClick={handleBulkPrintGatePasses} disabled={isBulkPrinting} className="bg-white text-orange-600 hover:bg-orange-50">
                  {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                  Bulk Gate Pass ({selectedOrderIds.length})
                </Button>
                <Button onClick={handleBulkPrintOrderDetails} disabled={isBulkPrinting} className="bg-white text-blue-600 hover:bg-blue-50">
                  {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Bulk Order Details ({selectedOrderIds.length})
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]"><Label>Order No.</Label><Input type="number" value={filterOrderNumber} onChange={(e) => setFilterOrderNumber(e.target.value)} /></div>
          <div className="flex-1 min-w-[150px]"><Label>Dealer</Label><Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}><SelectTrigger><SelectValue placeholder="All Dealers" /></SelectTrigger><SelectContent><SelectItem value="all">All Dealers</SelectItem>{allDealers.map(d => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent></Select></div>
          <div className="flex-1 min-w-[150px]"><Label>Date</Label><Input id="filterDate" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /></div>
          <Button onClick={fetchOrdersAndDealers} className="flex items-center gap-2"><Search className="h-4 w-4" /> Apply</Button>
          <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : orders.length === 0 ? (<p className="text-center text-muted-foreground py-8">No orders found.</p>) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted">
                    <TableHead className="w-10"><Checkbox checked={selectedOrderIds.length === orders.length && orders.length > 0} onCheckedChange={(checked) => handleSelectAll(!!checked)} /></TableHead>
                    <TableHead>Order No.</TableHead><TableHead>Dealer Name</TableHead><TableHead>Order Date</TableHead><TableHead className="text-right">Total Amount</TableHead><TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className={cn("hover:bg-accent/50", viewedOrderIds.has(order.id) && "opacity-50")}>
                      <TableCell><Checkbox checked={selectedOrderIds.includes(order.id)} onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)} /></TableCell>
                      <TableCell className="font-medium">#{order.order_number}</TableCell><TableCell>{order.dealer_name}</TableCell><TableCell>{formatDate(order.order_date)}</TableCell><TableCell className="text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-center"><div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedOrderIdForDetails(order.id); setIsOrderDetailsDialogOpen(true); }} title="View"><Eye className="h-4 w-4" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isOrderDetailsDialogOpen} onOpenChange={setIsOrderDetailsDialogOpen} onPrint={handleOrderPrinted} />
    </Card>
  );
};

export default WarehouseOrdersAwaitingDispatch;