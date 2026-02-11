"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import { Label } from '@/components/ui/label';

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
}

interface DealerOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 5;

const DispatchedOrdersCard: React.FC = () => {
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

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
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterDispatchDate, setFilterDispatchDate] = useState<string>('');

  // Dialog states
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

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
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          gate_pass_dispatch_time,
          dispatch_number,
          bill_no,
          dispatch_date,
          dealers (id, name)
        `)
        .not('dispatch_number', 'is', null) 
        .order('dispatch_number', { ascending: false });

      if (filterOrderNumber) {
        const orderNum = parseInt(filterOrderNumber);
        if (!isNaN(orderNum)) {
          query = query.eq('order_number', orderNum);
        }
      }

      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }

      if (filterDispatchDate) {
        const startOfDay = `${filterDispatchDate}T00:00:00.000Z`;
        const endOfDay = `${filterDispatchDate}T23:59:59.999Z`;
        query = query.gte('dispatch_date', startOfDay).lte('dispatch_date', endOfDay);
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
          gate_pass_dispatch_time: order.gate_pass_dispatch_time,
          dispatch_number: order.dispatch_number,
          bill_no: order.bill_no,
          dispatch_date: order.dispatch_date,
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
  }, [filterOrderNumber, filterDealerId, filterDispatchDate]);

  useEffect(() => {
    fetchOrdersAndDealers();
  }, [fetchOrdersAndDealers]);

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterDispatchDate('');
  };

  // Pagination logic
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const displayedOrders = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Dispatched Orders</CardTitle>
        <CardDescription className="text-teal-100 dark:text-teal-200">
          View all orders that have been processed for dispatch.
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
                      <TableHead className="text-muted-foreground">Order No.</TableHead>
                      <TableHead className="text-muted-foreground">Dispatch No.</TableHead>
                      <TableHead className="text-muted-foreground">Bill No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                      <TableHead className="text-muted-foreground">Dispatch Date</TableHead>
                      <TableHead className="text-muted-foreground">Gate Pass</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                      <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dispatch_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.bill_no}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.dispatch_date)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.gate_pass_dispatch_time)}</TableCell>
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
    </Card>
  );
};

export default DispatchedOrdersCard;