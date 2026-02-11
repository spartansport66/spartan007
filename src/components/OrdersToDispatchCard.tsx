"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Truck, Search, CalendarDays, Edit, Printer, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import DispatchOrderDialog from '@/components/DispatchOrderDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const OrdersToDispatchCard: React.FC<OrdersToDispatchCardProps> = ({ onDispatchSuccess }) => {
  const [orders, setOrders] = useState<OrderToDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
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

      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          dealers (id, name)
        `)
        .eq('dispatched', false)
        .order('order_date', { ascending: true });

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
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterDate]);

  useEffect(() => {
    fetchOrdersAndDealers();
    fetchCompanyInfo();
  }, [fetchOrdersAndDealers, fetchCompanyInfo]);

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => 
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(orders.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedOrderIds.length === 0) {
      showError('Please select at least one order to print.');
      return;
    }

    setIsBulkPrinting(true);
    try {
      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;

      for (let i = 0; i < selectedOrderIds.length; i++) {
        const orderId = selectedOrderIds[i];
        
        // Fetch full details for each order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(`
            id, order_number, order_date, total_amount, discount_amount, bill_no, dispatch_number,
            dealers (name, address, phone, city, state),
            sales (quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code))
          `)
          .eq('id', orderId)
          .single();

        if (orderError || !orderData) continue;

        if (i > 0) doc.addPage();

        // 1. Header
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        const dispatchText = `Gate Pass: ${orderData.dispatch_number || 'N/A'}`;
        doc.text(dispatchText, pageWidth / 2, 15, { align: 'center' });

        doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
        doc.rect(0, 22, pageWidth, 12, 'F');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(companyName?.toUpperCase() || "DISPATCH SLIP", pageWidth / 2, 30, { align: 'center' });

        // 2. Details
        doc.setTextColor(0);
        doc.setFontSize(10);
        let y = 45;
        
        doc.setFont("helvetica", "bold");
        doc.text("PARTY DETAILS:", margin, y);
        doc.setFont("helvetica", "normal");
        y += 5;
        doc.text((orderData.dealers as any)?.name || 'N/A', margin, y);
        y += 5;
        const addressLines = doc.splitTextToSize(
          `${(orderData.dealers as any)?.address || ''}, ${(orderData.dealers as any)?.city || ''}, ${(orderData.dealers as any)?.state || ''}`,
          pageWidth / 2 - margin
        );
        doc.text(addressLines, margin, y);
        
        let rightY = 45;
        const rightColX = pageWidth / 2 + 10;
        doc.setFont("helvetica", "bold");
        doc.text("ORDER DETAILS:", rightColX, rightY);
        doc.setFont("helvetica", "normal");
        rightY += 5;
        doc.text(`Order No: #${orderData.order_number}`, rightColX, rightY);
        rightY += 5;
        doc.text(`Bill No: ${orderData.bill_no || 'N/A'}`, rightColX, rightY);
        rightY += 5;
        doc.text(`Date: ${formatDate(orderData.order_date)}`, rightColX, rightY);

        y = Math.max(y + (addressLines.length * 5), rightY + 10);

        // 3. Items Table
        const tableColumn = ["Code", "Product Name", "Quantity"];
        const tableRows = (orderData.sales || []).map((sale: any) => [
          sale.products?.code || 'N/A',
          sale.products?.name || 'N/A',
          sale.quantity.toString()
        ]);

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: y,
          headStyles: { fillColor: darkBlue, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 40, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 30, halign: 'center' }
          },
          styles: { fontSize: 9, cellPadding: 3 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`TOTAL BILL AMOUNT: Rs. ${orderData.total_amount.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });
      }

      doc.save(`Bulk_Orders_${new Date().getTime()}.pdf`);
      showSuccess(`Successfully generated PDF for ${selectedOrderIds.length} orders.`);
      setSelectedOrderIds([]);
    } catch (error: any) {
      console.error('Bulk Print Error:', error);
      showError(`Failed to generate bulk PDF: ${error.message}`);
    } finally {
      setIsBulkPrinting(false);
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleDispatchOrder = (orderId: string) => {
    setSelectedOrderIdForDispatch(orderId);
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

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Orders Awaiting Dispatch</CardTitle>
            <CardDescription className="text-orange-100 dark:text-orange-200">
              Manage orders that are ready to be dispatched.
            </CardDescription>
          </div>
          {selectedOrderIds.length > 0 && (
            <Button 
              onClick={handleBulkPrint} 
              disabled={isBulkPrinting}
              className="bg-white text-orange-600 hover:bg-orange-50"
            >
              {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
              Bulk Print ({selectedOrderIds.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterOrderNumber">Order Number</Label>
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
            <Label htmlFor="filterDealer">Dealer Name</Label>
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
            <Label htmlFor="filterDate">Order Date</Label>
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
            <p className="text-center text-muted-foreground py-8">No orders awaiting dispatch found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedOrderIds.length === orders.length && orders.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground">Order Date</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-accent/50">
                      <TableCell>
                        <Checkbox 
                          checked={selectedOrderIds.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
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
                            onClick={() => handleDispatchOrder(order.id)}
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