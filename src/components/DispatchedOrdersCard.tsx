"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Search, ChevronLeft, ChevronRight, Edit, Trash2, Printer, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import { Label } from '@/components/ui/label';
import { useSession } from '@/contexts/SessionContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DispatchedOrder {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  gate_pass_dispatch_time: string | null;
  dispatch_number: number;
  bill_no: string;
  dispatch_date: string | null;
  delivery_location: string;
  transport_name: string;
  booking_destination: string;
  date_of_dispatch: string;
}

interface DealerOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 5;

const DispatchedOrdersCard: React.FC = () => {
  const { isAdmin } = useSession();
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<string | null>(null);
  const [transportName, setTransportName] = useState<string | null>(null);
  const [bookingDestination, setBookingDestination] = useState<string | null>(null);
  const [dateOfDispatch, setDateOfDispatch] = useState<string | null>(null);

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDispatchNumber, setFilterDispatchNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterDispatchDate, setFilterDispatchDate] = useState<string>('');
  const [filterGatePassNull, setFilterGatePassNull] = useState<boolean>(false);

  // Dialog states
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

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

      // Build the base query for dispatched orders
      // We use dispatch_number not null to identify dispatched orders
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, gate_pass_dispatch_time, dispatch_number, bill_no, dispatch_date,
          dealers (id, name),
          delivery_location, transport_name, booking_destination, date_of_dispatch
        `)
        .not('dispatch_number', 'is', null) 
        .order('dispatch_number', { ascending: false });

      // Apply filters
      if (filterOrderNumber) {
        query = query.eq('order_number', parseInt(filterOrderNumber));
      }
      if (filterDispatchNumber) {
        query = query.eq('dispatch_number', parseInt(filterDispatchNumber));
      }
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }
      if (filterDispatchDate) {
        const startOfDay = `${filterDispatchDate}T00:00:00.000Z`;
        const endOfDay = `${filterDispatchDate}T23:59:59.999Z`;
        query = query.gte('dispatch_date', startOfDay).lte('dispatch_date', endOfDay);
      }
      if (filterGatePassNull) {
        query = query.is('gate_pass_dispatch_time', null);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) {
        console.error('Error fetching dispatched orders:', ordersError.message);
        showError('Failed to load dispatched orders.');
        setOrders([]);
      } else {
        const formattedOrders: DispatchedOrder[] = (ordersData || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'Unknown',
          gate_pass_dispatch_time: order.gate_pass_dispatch_time,
          dispatch_number: order.dispatch_number,
          bill_no: order.bill_no,
          dispatch_date: order.dispatch_date,
          delivery_location: order.deliveryLocation || null,
          transport_name: order.transportName || null,
          booking_destination: order.bookingDestination || null,
          date_of_dispatch: order.dateOfDispatch || null,
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
  }, [filterOrderNumber, filterDispatchNumber, filterDealerId, filterDispatchDate, filterGatePassNull]);

  useEffect(() => {
    fetchOrdersAndDealers();
    fetchCompanyInfo();
  }, [fetchOrdersAndDealers, fetchCompanyInfo]);

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
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
    setFilterDispatchNumber('');
    setFilterDealerId('');
    setFilterDispatchDate('');
    setFilterGatePassNull(false);
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: number) => {
    setIsDeleting(true);
    try {
      // Step 1: Delete associated payments
      const { error: paymentError } = await supabase
        .from('payments')
        .delete()
        .eq('order_id', orderId);

      if (paymentError) {
        throw new Error(`Failed to delete associated payments: ${paymentError.message}`);
      }

      // Step 2: Delete the order. This will cascade to 'sales' table, which will trigger stock restoration.
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) {
        throw new Error(`Failed to delete order: ${orderError.message}`);
      }

      showSuccess(`Order #${orderNumber} and its associated payments have been deleted.`);
      fetchOrdersAndDealers(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting order:', error);
      showError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => checked ? [...prev, orderId] : prev.filter(id => id !== orderId));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map(o => o.id) : []);
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

  // Pagination logic
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const displayedOrders = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Dispatched Orders</CardTitle>
            <CardDescription className="text-teal-100 dark:text-teal-200">
              View all orders that have been processed for dispatch.
            </CardDescription>
          </div>
          {selectedOrderIds.length > 0 && (
            <Button onClick={handleBulkPrintGatePasses} disabled={isBulkPrinting} className="bg-white text-teal-600 hover:bg-teal-50">
              {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
              Print Bulk Gatepass ({selectedOrderIds.length})
            </Button>
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
            <Label htmlFor="filterDispatchNumber">Gate Pass / Dispatch No.</Label>
            <Input
              id="filterDispatchNumber"
              type="number"
              placeholder="Filter by dispatch no."
              value={filterDispatchNumber}
              onChange={(e) => setFilterDispatchNumber(e.target.value)}
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
            <Label htmlFor="filterDispatchDate">Dispatch Date</Label>
            <Input
              id="filterDispatchDate"
              type="date"
              value={filterDispatchDate}
              onChange={(e) => setFilterDispatchDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center space-x-2 self-center pt-6">
            <Checkbox
              id="filterGatePassNull"
              checked={filterGatePassNull}
              onCheckedChange={(checked) => setFilterGatePassNull(!!checked)}
            />
            <Label htmlFor="filterGatePassNull">Awaiting Gate Pass</Label>
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
            <p className="text-center text-muted-foreground py-8">No dispatched orders found matching your criteria.</p>
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
                      <TableHead className="text-muted-foreground">Dispatch No.</TableHead>
                      <TableHead className="text-muted-foreground">Bill No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                      <TableHead className="text-muted-foreground">Dispatch Date</TableHead>
                      <TableHead className="text-muted-foreground">Gate Pass</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                      {isAdmin && <TableHead className="text-muted-foreground text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell>
                          <Checkbox checked={selectedOrderIds.includes(order.id)} onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dispatch_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.bill_no}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.dispatch_date)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.gate_pass_dispatch_time)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                        {isAdmin && (
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
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" title="Delete Order" disabled={isDeleting}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete Order #{order.order_number}, its associated payments, and restore stock. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteOrder(order.id, order.order_number)} disabled={isDeleting}>
                                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
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
      <EditOrderDialog
        orderId={selectedOrderIdForEdit}
        isOpen={isEditOrderDialogOpen}
        onOpenChange={setIsEditOrderDialogOpen}
        onOrderUpdated={handleOrderUpdated}
        deliveryLocation={deliveryLocation}
        transportName={transportName}
        bookingDestination={bookingDestination}
        dispatchDate={dateOfDispatch}
      />
    </Card>
  );
};

export default DispatchedOrdersCard;