"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Truck, Search, ChevronLeft, ChevronRight, Edit, Printer, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import DispatchOrderDialog from '@/components/DispatchOrderDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/utils/format';

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

interface OrdersToDispatchCardProps {
  onDispatchSuccess: (dispatchedOrderId: string) => void;
}

const PAGE_SIZE = 5;

const OrdersToDispatchCard: React.FC<OrdersToDispatchCardProps> = ({ onDispatchSuccess }) => {
  const [orders, setOrders] = useState<OrderToDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  
  // Dialog states
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [selectedOrderIdForDispatch, setSelectedOrderIdForDispatch] = useState<string | null>(null);
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

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
      // Fetch all dealers for the filter dropdown
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name');
      if (dealersError) {
        console.error('Error fetching dealers for filter:', dealersError.message);
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers(dealersData.map(d => ({ value: d.id, label: d.name })));
      }

      // Build the query for orders awaiting dispatch
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount,
          dealers (id, name)
        `)
        .eq('dispatched', false)
        .order('order_date', { ascending: true });

      // Apply filters
      if (filterOrderNumber) {
        query = query.eq('order_number', parseInt(filterOrderNumber));
      }
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }
      if (filterDate) {
        const startOfDay = `${filterDate}T00:00:00.000Z`;
        const endOfDay = `${filterDate}T23:59:59.999Z`;
        query = query.gte('order_date', startOfDay).lte('order_date', endOfDay);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) {
        console.error('Error fetching orders to dispatch:', ordersError.message);
        showError('Failed to load orders to dispatch.');
        setOrders([]);
      } else {
        const formattedOrders: OrderToDispatch[] = (ordersData || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          dealer_id: order.dealers?.id || '',
        }));
        setOrders(formattedOrders);
        setCurrentPage(1); // Reset to first page on new fetch
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterDate]);

  useEffect(() => {
    fetchOrdersAndDealers();
    fetchCompanyInfo();
  }, [fetchOrdersAndDealers, fetchCompanyInfo]);

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleDispatchClick = (order: OrderToDispatch) => {
    if (order.dealer_name === 'Online Order') {
      showError("Online orders must be dispatched from the 'Online Order Dispatch' dashboard to map products correctly.");
      return;
    }
    setSelectedOrderIdForDispatch(order.id);
    setIsDispatchDialogOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    setSelectedOrderIdForEdit(orderId);
    setIsEditOrderDialogOpen(true);
  };

  const handleOrderUpdated = () => {
    fetchOrdersAndDealers();
  };

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterDate('');
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => checked ? [...prev, orderId] : prev.filter(id => id !== orderId));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map(o => o.id) : []);
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
          `Rs.${(sale.unit_price || 0).toFixed(2)}`, 
          `${(sale.discount_percent || 0)}%`, 
          `${(sale.gst_percent || 0)}%`, 
          `Rs.${(sale.total_price || 0).toFixed(2)}`
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
        doc.text(`Subtotal: Rs.${subtotal.toFixed(2)}`, pageWidth / 2, finalY, { align: 'center' });
        
        let currentY = finalY;
        if (orderData.discount_amount > 0) {
          currentY += 5;
          doc.text(`Global Discount: -Rs.${orderData.discount_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
        }
        
        currentY += 7;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text(`FINAL TOTAL: Rs.${orderData.total_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
      }
      doc.save(`Bulk_Order_Details_${new Date().getTime()}.pdf`);
      showSuccess(`Generated ${selectedOrderIds.length} Order Detail PDFs.`);
      setSelectedOrderIds([]);
    } catch (error: any) { showError(`Failed: ${error.message}`); } finally { setIsBulkPrinting(false); }
  };

  const handlePrintSelectedSummary = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkPrinting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(14);
      doc.text(companyName?.toUpperCase() || 'SELECTED ORDERS', pageWidth / 2, 15, { align: 'center' });

      const selected = orders
        .filter(o => selectedOrderIds.includes(o.id))
        .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

      const tableColumn = ['Order No.', 'Dealer Name', 'Order Date', 'Amount'];
      const tableRows = selected.map(o => [
        `#${o.order_number}`,
        o.dealer_name,
        formatDate(o.order_date),
        formatCurrency(o.total_amount),
      ]);

      const total = selected.reduce((sum, o) => sum + (o.total_amount || 0), 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, formatCurrency(total)]],
        startY: 30,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 70 },
          2: { cellWidth: 40, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
        }
      });

      doc.save(`Selected_Orders_${new Date().getTime()}.pdf`);
      showSuccess(`Printed ${selected.length} selected orders.`);
      setSelectedOrderIds([]);
    } catch (error: any) {
      showError(`Failed to print: ${error.message}`);
    } finally {
      setIsBulkPrinting(false);
    }
  };

  const handleDownloadSelectedJpg = (quality = 0.9) => {
    if (selectedOrderIds.length === 0) return;
    try {
      const selected = orders
        .filter(o => selectedOrderIds.includes(o.id))
        .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

      const width = 1200;
      const rowHeight = 44;
      const headerHeight = 130;
      const footerHeight = 70;
      const height = headerHeight + (selected.length * rowHeight) + footerHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, width, headerHeight - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(companyName?.toUpperCase() || 'SELECTED ORDERS', width / 2, 50);
      ctx.font = '18px Arial';
      ctx.fillStyle = '#333333';
      ctx.fillText('Selected Orders Summary', width / 2, 82);
      ctx.fillStyle = '#000000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, headerHeight - 30);

      let y = headerHeight;
      const colPositions = [60, 260, 820, 1060];
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Order No.', colPositions[0], y);
      ctx.fillText('Dealer', colPositions[1], y);
      ctx.textAlign = 'center';
      ctx.fillText('Order Date', colPositions[2], y);
      ctx.textAlign = 'right';
      ctx.fillText('Amount', colPositions[3], y);
      y += 20;
      ctx.strokeStyle = '#dddddd'; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(width - 40, y); ctx.stroke();
      y += 24;

      ctx.font = '14px Arial';
      selected.forEach(item => {
        ctx.textAlign = 'left';
        ctx.fillText(`#${item.order_number}`, colPositions[0], y);
        ctx.fillText(item.dealer_name, colPositions[1], y);
        ctx.textAlign = 'center';
        ctx.fillText(formatDate(item.order_date), colPositions[2], y);
        ctx.textAlign = 'right';
        ctx.fillText(formatCurrency(item.total_amount), colPositions[3], y);
        y += rowHeight;
      });

      const total = selected.reduce((s, o) => s + (o.total_amount || 0), 0);
      ctx.font = 'bold 16px Arial'; ctx.textAlign = 'right'; ctx.fillText(`Total: ${formatCurrency(total)}`, width - 60, y + 8);

      const link = document.createElement('a');
      link.download = `Selected_Orders_${new Date().getTime()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', quality);
      link.click();
      setSelectedOrderIds([]);
      showSuccess(`Downloaded ${selected.length} orders as JPG.`);
    } catch (error: any) {
      showError(`Failed to generate JPG: ${error.message}`);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const displayedOrders = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Orders Awaiting Dispatch</CardTitle>
            <CardDescription className="text-orange-100 dark:text-orange-200">
              Manage orders ready for dispatch.
            </CardDescription>
          </div>
          {selectedOrderIds.length > 0 && (
            <>
              <Button onClick={handlePrintSelectedSummary} disabled={isBulkPrinting} className="bg-white text-blue-600 hover:bg-blue-50">
                {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Print Selected ({selectedOrderIds.length})
              </Button>
              <Button onClick={() => handleDownloadSelectedJpg()} disabled={isBulkPrinting} className="bg-white text-blue-600 hover:bg-blue-50">
                <ImageIcon className="h-4 w-4 mr-2" /> JPG ({selectedOrderIds.length})
              </Button>
              <Button onClick={handleBulkPrintOrderDetails} disabled={isBulkPrinting} className="bg-white text-blue-600 hover:bg-blue-50">
                {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Bulk Order Details ({selectedOrderIds.length})
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterOrderNumber">Order No.</Label>
            <Input
              id="filterOrderNumber"
              type="number"
              placeholder="Filter by order no."
              value={filterOrderNumber}
              onChange={(e) => setFilterOrderNumber(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealer">Dealer</Label>
            <Select
              value={filterDealerId || "all"}
              onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}
            >
              <SelectTrigger id="filterDealer" className="w-full">
                <SelectValue placeholder="Filter by dealer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {allDealers.map(dealer => (
                  <SelectItem key={dealer.value} value={dealer.value}>{dealer.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDate">Date</Label>
            <Input
              id="filterDate"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchOrdersAndDealers} className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders awaiting dispatch found matching your criteria.</p>
          ) : (
            <>
              <div className="border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                      </TableHead>
                      <TableHead className="text-muted-foreground">Order No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                      <TableHead className="text-muted-foreground">Order Date</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                      <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell>
                          <Checkbox checked={selectedOrderIds.includes(order.id)} onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">#{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewOrderDetails(order.id)}
                              title="View Order Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditOrder(order.id)}
                              title="Edit Order"
                            >
                              <Edit className="h-4 w-4 text-orange-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDispatchClick(order)}
                              title="Dispatch Order"
                            >
                              <Truck className="h-4 w-4 text-green-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <p className="text-sm text-muted-foreground">
                    Showing page {currentPage} of {totalPages} ({orders.length} total orders)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
      <DispatchOrderDialog
        orderId={selectedOrderIdForDispatch}
        isOpen={isDispatchDialogOpen}
        onOpenChange={setIsDispatchDialogOpen}
        onDispatchSuccess={onDispatchSuccess}
      />
      <EditOrderDialog
        orderId={selectedOrderIdForEdit}
        isOpen={isEditOrderDialogOpen}
        onOpenChange={setIsEditOrderDialogOpen}
        onOrderUpdated={handleOrderUpdated}
      />
    </Card>
  );
};

export default OrdersToDispatchCard;