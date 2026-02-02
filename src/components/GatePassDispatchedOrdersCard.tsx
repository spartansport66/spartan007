"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Truck, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Label } from '@/components/ui/label';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

interface DispatchedOrder {
  id: string;
  order_number: number;
  bill_no: string;
  dispatch_number: number;
  gate_pass_dispatch_time: string;
  dealer_name: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const GatePassDispatchedOrdersCard: React.FC = () => {
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterDispatchNumber, setFilterDispatchNumber] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  // Dialog states
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const fetchDispatchedOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          bill_no,
          dispatch_number,
          gate_pass_dispatch_time,
          dealers (name)
        `)
        .not('gate_pass_dispatch_time', 'is', null) // Filter for fully dispatched orders
        .order('gate_pass_dispatch_time', { ascending: false });

      // Apply filters
      if (filterDispatchNumber) {
        const dispatchNum = parseInt(filterDispatchNumber);
        if (!isNaN(dispatchNum)) {
          query = query.eq('dispatch_number', dispatchNum);
        }
      }

      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('gate_pass_dispatch_time', startOfDay);
      }

      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('gate_pass_dispatch_time', endOfDay);
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
          bill_no: order.bill_no || 'N/A',
          dispatch_number: order.dispatch_number,
          gate_pass_dispatch_time: order.gate_pass_dispatch_time,
          dealer_name: order.dealers?.name || 'N/A',
        }));
        setOrders(formattedOrders);
      }
    } catch (error: any) {
      console.error('Error in fetchDispatchedOrders:', error.message);
      showError('An unexpected error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  }, [filterDispatchNumber, filterFromDate, filterToDate]);

  useEffect(() => {
    fetchDispatchedOrders();
  }, [fetchDispatchedOrders]);

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleClearFilters = () => {
    setFilterDispatchNumber('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Fully Dispatched Orders (Gate Pass OUT)</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          List of orders authorized for physical dispatch by the Gate Keeper.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDispatchNumber">Dispatch No.</Label>
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
            <Label htmlFor="filterFromDate">From Date (Gate Pass)</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate">To Date (Gate Pass)</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchDispatchedOrders} className="flex items-center gap-2">
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
            <p className="text-center text-muted-foreground py-8">No fully dispatched orders found matching your criteria.</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dispatch No.</TableHead>
                    <TableHead className="text-muted-foreground">Bill No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground">Gate Pass Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-accent/50">
                      <TableCell 
                        className="font-medium text-foreground cursor-pointer hover:underline"
                        onClick={() => handleViewOrderDetails(order.id)}
                      >
                        {order.order_number}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.dispatch_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.bill_no}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(order.gate_pass_dispatch_time).toLocaleString()}</TableCell>
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
    </Card>
  );
};

export default GatePassDispatchedOrdersCard;