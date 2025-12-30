"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Truck, Search, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import DispatchOrderDialog from '@/components/DispatchOrderDialog';
import { Label } from '@/components/ui/label'; // Added import for Label

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
  onDispatchSuccess: (dispatchedOrderId: string) => void; // New prop to handle dispatch and print
}

const OrdersToDispatchCard: React.FC<OrdersToDispatchCardProps> = ({ onDispatchSuccess }) => {
  const [orders, setOrders] = useState<OrderToDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);

  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  // Dialog states
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [selectedOrderIdForDispatch, setSelectedOrderIdForDispatch] = useState<string | null>(null);

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
          id,
          order_number,
          order_date,
          total_amount,
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
        // Filter by date (assuming filterDate is YYYY-MM-DD)
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
  }, [fetchOrdersAndDealers]);

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleDispatchOrder = (orderId: string) => {
    setSelectedOrderIdForDispatch(orderId);
    setIsDispatchDialogOpen(true);
  };

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterDate('');
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Orders Awaiting Dispatch</CardTitle>
        <CardDescription className="text-orange-100 dark:text-orange-200">
          Manage orders that are ready to be dispatched.
        </CardDescription>
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
              value={filterDealerId || "all"} // Set default value for Select
              onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)} // Handle "all" value
            >
              <SelectTrigger id="filterDealer" className="w-full">
                <SelectValue placeholder="Filter by dealer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem> {/* Changed value to "all" */}
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
            <div className="max-h-[250px] overflow-y-auto border rounded-md"> {/* Added max-h and overflow */}
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10"> {/* Made header sticky */}
                  <TableRow className="bg-muted hover:bg-muted/90">
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
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleViewOrderDetails(order.id)} title="View Order Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDispatchOrder(order.id)} title="Dispatch Order">
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
        onDispatchSuccess={onDispatchSuccess} // Pass the prop from parent
      />
    </Card>
  );
};

export default OrdersToDispatchCard;