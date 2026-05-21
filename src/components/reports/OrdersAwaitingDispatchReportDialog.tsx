"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface OrderToDispatch {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  sales_person_name: string;
}

interface DealerOption {
  value: string;
  label: string;
}

interface SalesPersonOption {
  value: string;
  label: string;
}

interface OrdersAwaitingDispatchReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrdersAwaitingDispatchReportDialog: React.FC<OrdersAwaitingDispatchReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [orders, setOrders] = useState<OrderToDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterFromOrderDate, setFilterFromOrderDate] = useState<string>('');
  const [filterToOrderDate, setFilterToOrderDate] = useState<string>('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const totalAmount = orders.reduce((sum, order) => sum + order.total_amount, 0);

  const formatOrderDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const daysSinceOrder = (dateString: string) => {
    if (!dateString) return 0;
    const orderDate = new Date(dateString);
    const diffMs = new Date().getTime() - orderDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const selectedOrders = orders
    .filter((order) => selectedOrderIds.includes(order.id))
    .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) => (checked ? [...prev, orderId] : prev.filter((id) => id !== orderId)));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map((order) => order.id) : []);
  };

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
        setAllDealers((dealersData || []).map(d => ({ value: d.id, label: d.name })));
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
          id, order_number, order_date, total_amount, user_id,
          dealers (id, name),
          profiles!left(first_name, last_name, user_type)
        `)
        .is('bill_no', null)
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
      if (filterFromOrderDate) {
        const startOfDay = `${filterFromOrderDate}T00:00:00.000Z`;
        query = query.gte('order_date', startOfDay);
      }
      if (filterToOrderDate) {
        const endOfDay = `${filterToOrderDate}T23:59:59.999Z`;
        query = query.lte('order_date', endOfDay);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) {
        console.error('Error fetching orders to dispatch:', ordersError.message);
        showError('Failed to load orders to dispatch.');
        setOrders([]);
      } else {
        const filteredOrders = (ordersData || []).filter((order: any) => {
          const profileName = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim().toLowerCase();
          if (order.profiles?.user_type === 'admin') return false;
          if (profileName.includes('pawan')) return false;
          if (profileName.includes('admin')) return false;
          return true;
        });

        const formattedOrders: OrderToDispatch[] = filteredOrders.map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          sales_person_name: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Unknown',
        }));
        setOrders(formattedOrders);
        setSelectedOrderIds([]);
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterSalesPersonId, filterFromOrderDate, filterToOrderDate]);

  useEffect(() => {
    if (isOpen) {
      fetchOrdersAndDealers();
    }
  }, [isOpen, fetchOrdersAndDealers]);

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterSalesPersonId('');
    setFilterFromOrderDate('');
    setFilterToOrderDate('');
    fetchOrdersAndDealers();
  };

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Orders Awaiting Dispatch Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = ['Order No.', 'Dealer Name', 'Sales Person', 'Order Date', 'Total Amount'];
    const tableRows = orders.map(order => [
      order.order_number,
      order.dealer_name,
      order.sales_person_name,
      new Date(order.order_date).toLocaleDateString(),
      `₹${order.total_amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: {
        fontSize: 8
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      margin: { top: 25 },
    });

    // Add total at the bottom
    const finalY = (doc as any).lastAutoTable.finalY || 30;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Order Value: ₹${totalAmount.toFixed(2)}`, 14, finalY + 10);

    doc.save('orders_awaiting_dispatch_report.pdf');
  };

  const handlePrintSelectedJpg = () => {
    if (selectedOrderIds.length === 0) {
      showError('Please select one or more orders to print as JPG.');
      return;
    }

    try {
      const selected = selectedOrders;
      const width = 1200;
      const rowHeight = 48;
      const headerHeight = 140;
      const footerHeight = 80;
      const contentHeight = selected.length * rowHeight;
      const height = Math.max(headerHeight + contentHeight + footerHeight, 420);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to create canvas context');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, width, 100);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ORDERS AWAITING DISPATCH', width / 2, 40);
      ctx.font = 'bold 20px Arial';
      ctx.fillText('Selected Orders', width / 2, 72);

      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000000';
      ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 120);
      ctx.fillText(`Total selected orders: ${selected.length}`, 40, 142);

      const tableTop = 170;
      const colX = [40, 110, 320, 560, 780];
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, tableTop - 18);
      ctx.lineTo(width - 40, tableTop - 18);
      ctx.stroke();

      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('S.No', colX[0], tableTop);
      ctx.fillText('Order No.', colX[1], tableTop);
      ctx.fillText('Order Date', colX[2], tableTop);
      ctx.fillText('Days', colX[3], tableTop);
      ctx.textAlign = 'right';
      ctx.fillText('Amount', width - 40, tableTop);

      ctx.beginPath();
      ctx.moveTo(40, tableTop + 8);
      ctx.lineTo(width - 40, tableTop + 8);
      ctx.stroke();

      let y = tableTop + 40;
      ctx.font = '16px Arial';
      selected.forEach((order, index) => {
        if (y > height - footerHeight - 20) {
          return;
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000000';
        ctx.fillText(`${index + 1}`, colX[0], y);
        ctx.fillText(`#${order.order_number}`, colX[1], y);
        ctx.fillText(formatOrderDate(order.order_date), colX[2], y);
        ctx.fillText(`${daysSinceOrder(order.order_date)}d`, colX[3], y);
        ctx.textAlign = 'right';
        ctx.fillText(`₹${order.total_amount.toFixed(2)}`, width - 40, y);
        y += rowHeight;
      });

      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Total: ₹${selected.reduce((sum, order) => sum + order.total_amount, 0).toFixed(2)}`, width - 40, height - 28);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.download = `selected_orders_awaiting_dispatch_${Date.now()}.jpg`;
      link.click();
      setSelectedOrderIds([]);
      showSuccess('Selected orders exported as JPG.');
    } catch (error: any) {
      showError(`Failed to generate JPG: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Orders Awaiting Dispatch Report</DialogTitle>
          <DialogDescription>
            Generate a report of all orders that are awaiting dispatch.
          </DialogDescription>
        </DialogHeader>

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
            <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
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
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}>
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
            <Label htmlFor="filterFromOrderDate">From Order Date</Label>
            <Input
              id="filterFromOrderDate"
              type="date"
              value={filterFromOrderDate}
              onChange={(e) => setFilterFromOrderDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToOrderDate">To Order Date</Label>
            <Input
              id="filterToOrderDate"
              type="date"
              value={filterToOrderDate}
              onChange={(e) => setFilterToOrderDate(e.target.value)}
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
            <div>
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        />
                      </TableHead>
                      <TableHead className="text-muted-foreground">Order No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                      <TableHead className="text-muted-foreground">Sales Person</TableHead>
                      <TableHead className="text-muted-foreground">Order Date</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
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
                        <TableCell className="text-muted-foreground">{order.sales_person_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatOrderDate(order.order_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-md border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Order Value:</span>
                  <span className="text-lg font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={handlePrintSelectedJpg} disabled={selectedOrderIds.length === 0}>
            <ImageIcon className="mr-2 h-4 w-4" /> Print Selected JPG
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={orders.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrdersAwaitingDispatchReportDialog;