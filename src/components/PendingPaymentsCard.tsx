"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, CalendarDays, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Label } from '@/components/ui/label';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog'; // New import

interface Order {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  dealer_phone: string; // Added for WhatsApp
  payment_due_date: string | null;
  payment_status: string; // Added
}

interface DealerOption {
  value: string;
  label: string;
}

const PendingPaymentsCard: React.FC = () => {
  const { user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filter states, default to today's date for due date
  const [filterDueDate, setFilterDueDate] = useState<string>(getTodayDate());
  const [filterDealerId, setFilterDealerId] = useState<string>('');

  // Dialog states
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<Order | null>(null);

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

      // Build the query for pending orders due till today
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
        .eq('payment_status', 'pending') // Only pending payments
        .lte('payment_due_date', `${filterDueDate}T23:59:59.999Z`) // Due till today (inclusive)
        .order('payment_due_date', { ascending: true });

      // Apply dealer filter
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        console.error('Error fetching pending orders:', ordersError.message);
        showError('Failed to load pending orders.');
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
  }, [user, filterDueDate, filterDealerId]);

  useEffect(() => {
    fetchOrdersAndDealers();
  }, [fetchOrdersAndDealers]);

  const handleClearFilters = () => {
    setFilterDueDate(getTodayDate()); // Reset to today's date
    setFilterDealerId('');
  };

  const handleAddPaymentDetails = (order: Order) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handlePaymentUpdated = () => {
    fetchOrdersAndDealers(); // Refresh the list after a payment is updated
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-red-500 dark:bg-red-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Pending Payments (Due Till Today)</CardTitle>
        <CardDescription className="text-red-100 dark:text-red-200">
          Orders with payments due up to and including today.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDueDate">Due Date Till</Label>
            <Input
              id="filterDueDate"
              type="date"
              value={filterDueDate}
              onChange={(e) => setFilterDueDate(e.target.value)}
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
            <p className="text-center text-muted-foreground py-8">No pending payments due till today found.</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground">Order Date</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                    <TableHead className="text-muted-foreground">Payment Due Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className={isOverdue(order.payment_due_date) ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}>
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell className={isOverdue(order.payment_due_date) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                        {order.payment_due_date ? new Date(order.payment_due_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleAddPaymentDetails(order)} 
                          title="Add Payment Details"
                        >
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </Button>
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

export default PendingPaymentsCard;