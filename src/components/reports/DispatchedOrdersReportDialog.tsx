"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

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
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
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
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, dispatch_date, dispatch_number, bill_no,
          dealers (id, name)
        `)
        .eq('dispatched', true)
        .order('dispatch_date', { ascending: false });

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

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Dispatched Orders Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = ["Order No.", "Dispatch No.", "Bill No.", "Dealer Name", "Dispatch Date", "Total Amount"];
    const tableRows = orders.map(order => [
      order.order_number,
      order.dispatch_number,
      order.bill_no,
      order.dealer_name,
      new Date(order.dispatch_date).toLocaleDateString(),
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dispatch_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.bill_no}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(order.dispatch_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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