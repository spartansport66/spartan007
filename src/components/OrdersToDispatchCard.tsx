"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Truck, Search, ChevronLeft, ChevronRight, Edit, Printer, FileText, Flame } from 'lucide-react';
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
  sales_person_name: string;
  is_urgent?: boolean;
}

interface DealerOption {
  value: string;
  label: string;
}

interface SalesPersonOption {
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
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  
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

      // Fetch all sales persons for the filter dropdown
      const { data: salesPersonData, error: salesPersonError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person')
        .order('first_name', { ascending: true });
      if (salesPersonError) {
        console.error('Error fetching sales persons for filter:', salesPersonError.message);
        setSalesPersons([]);
      } else {
        setSalesPersons((salesPersonData || []).map((p: any) => ({
          value: p.id,
          label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id,
        })));
      }

      // Build the query for orders awaiting dispatch
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, is_urgent, user_id, bill_no,
          dealers (id, name)
        `)
        .eq('dispatched', false)
        .neq('hod_status', 'disapproved')
        .neq('dealers.name', 'Online Order')
        .order('order_date', { ascending: true });

      // Apply filters
      if (filterOrderNumber) {
        query = query.eq('order_number', parseInt(filterOrderNumber));
      }
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }
      if (filterSalesPersonId) {
        query = query.eq('user_id', filterSalesPersonId);
      }
      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('order_date', startOfDay);
      }
      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('order_date', endOfDay);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) {
        console.error('Error fetching orders to dispatch:', ordersError.message);
        showError('Failed to load orders to dispatch.');
        setOrders([]);
      } else {
        const blankBillOrdersData = (ordersData || []).filter((order: any) => {
          const billNo = order.bill_no == null ? '' : String(order.bill_no).trim();
          return billNo === '';
        });

        const orderUserIds = Array.from(new Set(blankBillOrdersData
          .map((order: any) => order.user_id)
          .filter((id: string | null | undefined): id is string => Boolean(id))
        ));

        let profilesMap: Record<string, { first_name?: string; last_name?: string; user_type?: string }> = {};
        if (orderUserIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, user_type')
            .in('id', orderUserIds);

          if (profileError) {
            console.error('Error fetching profiles for orders:', profileError.message);
          } else if (profileRows) {
            profileRows.forEach((profile: any) => {
              profilesMap[profile.id] = profile;
            });
          }
        }

        const filteredOrdersData = blankBillOrdersData.filter((order: any) => {
          const profile = order.user_id ? profilesMap[order.user_id] : undefined;
          const profileName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim().toLowerCase();
          if (profile?.user_type === 'admin') return false;
          if (profileName.includes('pawan')) return false;
          if (profileName.includes('admin')) return false;
          return true;
        });

        const formattedOrders: OrderToDispatch[] = filteredOrdersData.map((order: any) => {
          const profile = order.user_id ? profilesMap[order.user_id] : undefined;
          return {
            id: order.id,
            order_number: order.order_number,
            order_date: order.order_date,
            total_amount: order.total_amount,
            dealer_name: order.dealers?.name || 'N/A',
            dealer_id: order.dealers?.id || '',
            sales_person_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown',
            is_urgent: order.is_urgent || false,
          };
        });

        setOrders(formattedOrders);
        setCurrentPage(1); // Reset to first page on new fetch
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterSalesPersonId, filterFromDate, filterToDate]);

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

  const handleToggleUrgent = async (orderId: string, currentUrgent: boolean) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          is_urgent: !currentUrgent,
          urgent_marked_at: new Date().toISOString(),
          urgent_marked_by: 'current_user', // In production, use actual user ID
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating urgent status:', error);
        showError('Failed to update urgent status');
      } else {
        showSuccess(`Order marked as ${!currentUrgent ? 'URGENT' : 'NOT URGENT'}`);
        fetchOrdersAndDealers();
      }
    } catch (err) {
      console.error('Exception updating urgent status:', err);
      showError('Failed to update urgent status');
    }
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
    setFilterSalesPersonId('');
    setFilterFromDate('');
    setFilterToDate('');
    fetchOrdersAndDealers();
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
      const { data: orderRows, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, discount_amount,
          dealers (name, address, phone, city, state),
          sales (quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code))
        `)
        .in('id', selectedOrderIds);

      if (fetchError) {
        throw new Error(fetchError.message || 'Unable to fetch selected order details.');
      }

      if (!orderRows || orderRows.length === 0) {
        showError('No selected order details were returned.');
        return;
      }

      const { data: onlineDetailsRows, error: onlineDetailsError } = await supabase
        .from('online_order_details')
        .select(`
          order_id, client_name, city, state, contact_no,
          online_platforms (name), platform_order_number
        `)
        .in('order_id', selectedOrderIds);

      if (onlineDetailsError) {
        console.error('Failed to fetch online order details:', onlineDetailsError);
      }

      const orderById = (orderRows as any[]).reduce<Record<string, any>>((acc, order) => {
        if (order?.id) acc[order.id] = order;
        return acc;
      }, {});

      const onlineDetailsByOrderId = (onlineDetailsRows || []).reduce<Record<string, any>>((acc, detail) => {
        if (detail?.order_id) acc[detail.order_id] = detail;
        return acc;
      }, {});

      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      let printedCount = 0;

      for (const orderId of selectedOrderIds) {
        const orderData = orderById[orderId];
        if (!orderData) continue;

        const onlineDetails = onlineDetailsByOrderId[orderId];
        const isOnline = (orderData.dealers as any)?.name === 'Online Order' && onlineDetails;

        if (printedCount > 0) doc.addPage();
        printedCount += 1;

        doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, 10, pageWidth, 15, 'F');
        doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        doc.text(companyName?.toUpperCase() || 'ORDER INVOICE', pageWidth / 2, 20, { align: 'center' });

        doc.setTextColor(0); doc.setFontSize(10); let y = 35;

        const partyName = isOnline ? onlineDetails.client_name : (orderData.dealers as any).name || 'N/A';
        const partyAddress = isOnline
          ? `${onlineDetails.city || ''}, ${onlineDetails.state || ''}`.trim() || 'N/A'
          : `${(orderData.dealers as any).address || 'N/A'}, ${(orderData.dealers as any).city || 'N/A'}, ${(orderData.dealers as any).state || 'N/A'}`;
        const partyPhone = isOnline ? onlineDetails.contact_no : (orderData.dealers as any).phone || 'N/A';

        doc.setFont('helvetica', 'bold'); doc.text('PARTY DETAILS:', margin, y);
        doc.setFont('helvetica', 'normal'); y += 5; doc.text(partyName, margin, y);
        y += 5;
        const addressLines = doc.splitTextToSize(partyAddress, pageWidth / 2 - margin);
        doc.text(addressLines, margin, y);

        let rightY = 35;
        const rightColX = pageWidth / 2 + 10;
        doc.setFont('helvetica', 'bold'); doc.text('ORDER SUMMARY:', rightColX, rightY);
        doc.setFont('helvetica', 'normal'); rightY += 5; doc.text(`Order No: #${orderData.order_number}`, rightColX, rightY);
        rightY += 5; doc.text(`Date: ${formatDate(orderData.order_date)}`, rightColX, rightY);
        rightY += 5; doc.text(`Phone: ${partyPhone}`, rightColX, rightY);

        if (isOnline) {
          rightY += 5; doc.text(`Platform: ${(onlineDetails.online_platforms as any)?.name || 'N/A'}`, rightColX, rightY);
          rightY += 5; doc.text(`Platform Order #: ${onlineDetails.platform_order_number || 'N/A'}`, rightColX, rightY);
        }

        y = Math.max(y + (addressLines.length * 5), rightY + 10);
        const tableRows = (orderData.sales || []).map((sale: any) => [
          sale.products?.code || 'N/A',
          sale.products?.name || 'N/A',
          (sale.quantity ?? 0).toString(),
          `Rs.${(sale.unit_price || 0).toFixed(2)}`,
          `${(sale.discount_percent || 0)}%`,
          `${(sale.gst_percent || 0)}%`,
          `Rs.${(sale.total_price || 0).toFixed(2)}`
        ]);

        autoTable(doc, {
          head: [['Code', 'Product', 'Qty', 'Unit Price', 'Disc %', 'GST %', 'Total']],
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
        const subtotal = (orderData.sales || []).reduce((sum: number, s: any) => sum + (s.total_price || 0), 0);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Subtotal: Rs.${subtotal.toFixed(2)}`, pageWidth / 2, finalY, { align: 'center' });

        let currentY = finalY;
        if ((orderData.discount_amount || 0) > 0) {
          currentY += 5;
          doc.text(`Global Discount: -Rs.${(orderData.discount_amount || 0).toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
        }

        currentY += 7;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        doc.text(`FINAL TOTAL: Rs.${orderData.total_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
      }

      if (printedCount === 0) {
        showError('Selected orders could not be loaded for printing.');
        return;
      }

      doc.save(`Bulk_Order_Details_${new Date().getTime()}.pdf`);
      showSuccess(`Generated ${printedCount} Order Detail PDF${printedCount > 1 ? 's' : ''}.`);
      setSelectedOrderIds([]);
    } catch (error: any) {
      console.error('Bulk print error:', error);
      showError(`Failed: ${error.message}`);
    } finally {
      setIsBulkPrinting(false);
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
            <Button onClick={handleBulkPrintOrderDetails} disabled={isBulkPrinting} className="bg-white text-blue-600 hover:bg-blue-50">
              {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Bulk Order Details ({selectedOrderIds.length})
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
            <Label htmlFor="filterSalesPerson">Sales Person</Label>
            <Select
              value={filterSalesPersonId || "all"}
              onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}
            >
              <SelectTrigger id="filterSalesPerson" className="w-full">
                <SelectValue placeholder="Filter by sales person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {salesPersons.map(person => (
                  <SelectItem key={person.value} value={person.value}>{person.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate">From Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate">To Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
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
                      <TableHead className="text-muted-foreground">Sales Person</TableHead>
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
                        <TableCell className="text-muted-foreground">{order.sales_person_name}</TableCell>
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
                            <Button
                              size="sm"
                              onClick={() => handleToggleUrgent(order.id, order.is_urgent || false)}
                              className={order.is_urgent ? "hover:bg-red-50" : "hover:bg-gray-100"}
                              title={order.is_urgent ? "Mark as Not Urgent" : "Mark as Urgent"}
                            >
                              <Flame className={`h-4 w-4 ${order.is_urgent ? 'text-red-600' : 'text-gray-400'}`} />
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