"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface DispatchedOrder {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  dispatch_date: string;
  dispatch_number: number;
  bill_no: string;
}

interface DealerOption {
  value: string;
  label: string;
}

interface DispatchedOrdersReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DispatchedOrdersReportDialog: React.FC<DispatchedOrdersReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { isAdmin } = useSession();
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDispatchDate, setFilterFromDispatchDate] = useState<string>('');
  const [filterToDispatchDate, setFilterToDispatchDate] = useState<string>('');

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

      // Build the query for dispatched orders
      // We use dispatch_number not null to identify dispatched orders
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, dispatch_date, dispatch_number, bill_no,
          dealers (id, name)
        `)
        .not('dispatch_number', 'is', null)
        .order('dispatch_number', { ascending: false });

      // Apply filters
      if (filterOrderNumber) {
        query = query.eq('order_number', parseInt(filterOrderNumber));
      }
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }
      if (filterFromDispatchDate) {
        const startOfDay = `${filterFromDispatchDate}T00:00:00.000Z`;
        query = query.gte('dispatch_date', startOfDay);
      }
      if (filterToDispatchDate) {
        const endOfDay = `${filterToDispatchDate}T23:59:59.999Z`;
        query = query.lte('dispatch_date', endOfDay);
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
          dealer_name: order.dealers?.name || 'N/A',
          dispatch_date: order.dispatch_date,
          dispatch_number: order.dispatch_number,
          bill_no: order.bill_no,
        }));
        setOrders(formattedOrders);
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterFromDispatchDate, filterToDispatchDate]);

  useEffect(() => {
    if (isOpen) {
      fetchOrdersAndDealers();
    }
  }, [isOpen, fetchOrdersAndDealers]);

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterFromDispatchDate('');
    setFilterToDispatchDate('');
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

  const totalAmount = orders.reduce((sum, order) => sum + order.total_amount, 0);

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Dispatched Orders Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = ["Order No.", "Dispatch No.", "Bill No.", "Dealer Name", "Dispatch Date", "Total Amount"];
    const tableRows = orders.map(order => [
      order.order_number,
      order.dispatch_number || '-',
      order.bill_no || '-',
      order.dealer_name,
      order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString() : '-',
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

    doc.save('dispatched_orders_report.pdf');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dispatched Orders Report</DialogTitle>
          <DialogDescription>
            Generate a report of all orders that have been successfully dispatched.
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
            <Label htmlFor="filterFromDispatchDate">From Dispatch Date</Label>
            <Input
              id="filterFromDispatchDate"
              type="date"
              value={filterFromDispatchDate}
              onChange={(e) => setFilterFromDispatchDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDispatchDate">To Dispatch Date</Label>
            <Input
              id="filterToDispatchDate"
              type="date"
              value={filterToDispatchDate}
              onChange={(e) => setFilterToDispatchDate(e.target.value)}
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
            <p className="text-center text-muted-foreground py-8">No dispatched orders found matching your criteria.</p>
          ) : (
            <div>
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Order No.</TableHead>
                      <TableHead className="text-muted-foreground">Dispatch No.</TableHead>
                      <TableHead className="text-muted-foreground">Bill No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                      <TableHead className="text-muted-foreground">Dispatch Date</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                      {isAdmin && <TableHead className="text-muted-foreground text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dispatch_number || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{order.bill_no || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
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
                          </TableCell>
                        )}
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
          <Button variant="outline" onClick={handlePrint} disabled={orders.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DispatchedOrdersReportDialog;