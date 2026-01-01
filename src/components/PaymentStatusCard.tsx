"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, CalendarDays, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Label } from '@/components/ui/label';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';

interface Order {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  dealer_phone: string;
  payment_due_date: string | null;
  payment_status: string;
}

interface DealerOption {
  value: string;
  label: string;
}

const PaymentStatusCard: React.FC = () => {
  const { user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'pending_approval' | 'todays_due'>('pending');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  // Dialog states
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<Order | null>(null);

  const getTodayDateISO = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  };

  const getEndOfTodayDateISO = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString();
  };

  const fetchOrdersAndDealers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all dealers assigned to the current user for the filter dropdown
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', user.id);

      if (assignedDealersError) {
        console.error('Error fetching assigned dealers for filter:', assignedDealersError.message);
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers((assignedDealersData || []).map((item: any) => ({ value: item.dealers.id, label: item.dealers.name })));
      }

      // Build the query for orders
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          payment_due_date,
          payment_status,
          dealers (name, phone)
        `)
        .eq('user_id', user.id) // Filter by current sales person
        .order('payment_due_date', { ascending: true });

      const todayISO = getTodayDateISO();
      const endOfTodayISO = getEndOfTodayDateISO();

      if (filterStatus === 'pending') {
        query = query.eq('payment_status', 'pending');
      } else if (filterStatus === 'paid') {
        query = query.eq('payment_status', 'paid');
      } else if (filterStatus === 'pending_approval') {
        query = query.eq('payment_status', 'pending_approval');
      } else if (filterStatus === 'overdue') {
        query = query.eq('payment_status', 'pending').lte('payment_due_date', todayISO);
      } else if (filterStatus === 'upcoming') {
        query = query.eq('payment_status', 'pending').gte('payment_due_date', endOfTodayISO);
      } else if (filterStatus === 'todays_due') {
        query = query.eq('payment_status', 'pending')
          .gte('payment_due_date', todayISO)
          .lte('payment_due_date', endOfTodayISO);
      }
      // If filterStatus is 'all', no payment_status filter is applied here.

      // Apply dealer filter
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }

      // Apply date range filter for order_date
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
        console.error('Error fetching orders:', ordersError.message);
        showError('Failed to load orders.');
        setOrders([]);
      } else {
        const formattedOrders: Order[] = (ordersData || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          dealer_phone: order.dealers?.phone || '',
          payment_due_date: order.payment_due_date,
          payment_status: order.payment_status,
        }));
        setOrders(formattedOrders);
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  }, [user, filterStatus, filterDealerId, filterFromDate, filterToDate]);

  useEffect(() => {
    fetchOrdersAndDealers();
  }, [fetchOrdersAndDealers]);

  const handleClearFilters = () => {
    setFilterStatus('pending'); // Reset to default pending
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleAddPaymentDetails = (order: Order) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handlePaymentUpdated = () => {
    fetchOrdersAndDealers(); // Refresh the list after a payment is updated
  };

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status !== 'pending') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getStatusColor = (status: string, dueDate: string | null) => {
    if (status === 'paid') return 'text-green-600 bg-green-100';
    if (status === 'pending_approval') return 'text-blue-600 bg-blue-100';
    if (isOverdue(dueDate, status)) return 'text-red-600 bg-red-100';
    if (status === 'pending') return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string, dueDate: string | null) => {
    if (status === 'paid') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'pending_approval') return <Clock className="h-4 w-4 text-blue-600" />;
    if (isOverdue(dueDate, status)) return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-600" />;
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Payment Status</CardTitle>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          View and manage the payment status of all orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterStatus">Payment Status</Label>
            <Select 
              value={filterStatus} 
              onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}
            >
              <SelectTrigger id="filterStatus" className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="todays_due">Today's Due</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
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
            <Label htmlFor="filterFromDate">From Order Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate">To Order Date</Label>
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
            <p className="text-center text-muted-foreground py-8">No orders found for the selected criteria.</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground">Order Date</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                    <TableHead className="text-muted-foreground">Payment Status</TableHead>
                    <TableHead className="text-muted-foreground">Payment Due Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className={isOverdue(order.payment_due_date, order.payment_status) ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}>
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(order.payment_status, order.payment_due_date)}`}>
                          {getStatusIcon(order.payment_status, order.payment_due_date)}
                          <span className="capitalize">{order.payment_status.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className={isOverdue(order.payment_due_date, order.payment_status) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                        {order.payment_due_date ? new Date(order.payment_due_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.payment_status === 'pending' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleAddPaymentDetails(order)} 
                            title="Add Payment Details"
                          >
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {selectedOrderForPaymentUpdate && (
        <UpdatePaymentDialog 
          orderToUpdate={selectedOrderForPaymentUpdate} 
          isOpen={isUpdatePaymentDialogOpen} 
          onOpenChange={setIsUpdatePaymentDialogOpen} 
          onPaymentUpdated={handlePaymentUpdated} 
        />
      )}
    </Card>
  );
};

export default PaymentStatusCard;