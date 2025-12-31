"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, CalendarDays, TrendingUp } from 'lucide-react'; // Added CalendarDays, TrendingUp
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog'; // Import the new dialog
import { Separator } from '@/components/ui/separator'; // Added Separator

interface PendingOrderPayment {
  id: string; // Order ID
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  payment_status: string; // From orders table
  payment_due_date: string | null; // From orders table
  dealer_id: string; // For fetching total spent
}

interface PaymentCardProps {
  onViewDetails: () => void; // New prop to open the detailed report dialog
}

const PaymentCard: React.FC<PaymentCardProps> = ({ onViewDetails }) => {
  const [pendingOrderPayments, setPendingOrderPayments] = useState<PendingOrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true); // New loading state for overview

  // Overview metrics states
  const [totalPendingAmountOverview, setTotalPendingAmountOverview] = useState<number>(0);
  const [upcoming7DaysAmountOverview, setUpcoming7DaysAmountOverview] = useState<number>(0);
  const [todayReceivedAmountOverview, setTodayReceivedAmountOverview] = useState<number>(0);

  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<'pending_today' | 'upcoming' | '7_days' | '15_days' | '30_days' | '60_days'>('pending_today');

  // Dialog states for updating payment
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PendingOrderPayment | null>(null);

  const getTodayDateISO = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  };

  const getTomorrowDateISO = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  };

  const getSevenDaysFromTomorrowISO = () => {
    const sevenDaysFromTomorrow = new Date();
    sevenDaysFromTomorrow.setDate(sevenDaysFromTomorrow.getDate() + 7);
    sevenDaysFromTomorrow.setHours(23, 59, 59, 999);
    return sevenDaysFromTomorrow.toISOString();
  };

  const fetchPaymentOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const todayISO = getTodayDateISO();
      const tomorrowISO = getTomorrowDateISO();
      const sevenDaysFromTomorrowISO = getSevenDaysFromTomorrowISO();

      // 1. Fetch Total Pending Amount (all pending orders)
      const { data: allPendingOrders, error: allPendingError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending');

      if (allPendingError) throw allPendingError;
      const totalPending = (allPendingOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTotalPendingAmountOverview(totalPending);

      // 2. Fetch Upcoming Payments (within next 7 days, excluding today)
      const { data: upcoming7DaysOrders, error: upcoming7DaysError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending')
        .gte('payment_due_date', tomorrowISO)
        .lte('payment_due_date', sevenDaysFromTomorrowISO);

      if (upcoming7DaysError) throw upcoming7DaysError;
      const upcoming7Days = (upcoming7DaysOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      setUpcoming7DaysAmountOverview(upcoming7Days);

      // 3. Fetch Today Received Payments
      const { data: todayPayments, error: todayPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', todayISO)
        .lte('payment_date', new Date().toISOString()); // Up to current moment

      if (todayPaymentsError) throw todayPaymentsError;
      const todayReceived = (todayPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      setTodayReceivedAmountOverview(todayReceived);

    } catch (error: any) {
      console.error('Error fetching payment overview:', error.message);
      showError('Failed to load payment overview data.');
      setTotalPendingAmountOverview(0);
      setUpcoming7DaysAmountOverview(0);
      setTodayReceivedAmountOverview(0);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchPendingOrderPayments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          payment_status,
          payment_due_date,
          dealers (id, name)
        `)
        .eq('payment_status', 'pending') // Only pending payments
        .order('payment_due_date', { ascending: true }); // Order by due date

      const todayISO = getTodayDateISO();

      if (filterPeriod === 'pending_today') {
        query = query.lte('payment_due_date', todayISO);
      } else if (filterPeriod === 'upcoming') {
        // Upcoming payments (due date in the future)
        query = query.gte('payment_due_date', todayISO);
      } else if (filterPeriod === '7_days') {
        const sevenDaysFromNow = new Date(new Date(todayISO));
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        sevenDaysFromNow.setHours(23, 59, 59, 999);
        query = query.gte('payment_due_date', todayISO).lte('payment_due_date', sevenDaysFromNow.toISOString());
      } else if (filterPeriod === '15_days') {
        const fifteenDaysFromNow = new Date(new Date(todayISO));
        fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
        fifteenDaysFromNow.setHours(23, 59, 59, 999);
        query = query.gte('payment_due_date', todayISO).lte('payment_due_date', fifteenDaysFromNow.toISOString());
      } else if (filterPeriod === '30_days') {
        const thirtyDaysFromNow = new Date(new Date(todayISO));
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999);
        query = query.gte('payment_due_date', todayISO).lte('payment_due_date', thirtyDaysFromNow.toISOString());
      } else if (filterPeriod === '60_days') {
        const sixtyDaysFromNow = new Date(new Date(todayISO));
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
        sixtyDaysFromNow.setHours(23, 59, 59, 999);
        query = query.gte('payment_due_date', todayISO).lte('payment_due_date', sixtyDaysFromNow.toISOString());
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        console.error('Error fetching pending orders:', ordersError.message);
        showError('Failed to load pending payments.');
        setPendingOrderPayments([]);
      } else {
        const formattedOrders: PendingOrderPayment[] = (ordersData || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          payment_status: order.payment_status,
          payment_due_date: order.payment_due_date,
          dealer_id: order.dealers?.id || '',
        }));
        setPendingOrderPayments(formattedOrders);
      }
    } catch (error: any) {
      console.error('Error in fetchPendingOrderPayments:', error.message);
      showError('An unexpected error occurred while fetching pending payments.');
    } finally {
      setLoading(false);
    }
  }, [filterPeriod]);

  useEffect(() => {
    fetchPaymentOverviewData();
    fetchPendingOrderPayments();
  }, [fetchPaymentOverviewData, fetchPendingOrderPayments]);

  const handleUpdatePaymentClick = (order: PendingOrderPayment) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handlePaymentUpdated = () => {
    fetchPendingOrderPayments(); // Refresh the list of pending payments
    fetchPaymentOverviewData(); // Refresh the overview data
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Payment Overview</CardTitle>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          Summary of payment statuses.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {overviewLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payment overview...</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                <span className="text-muted-foreground">Total Pending:</span>
              </div>
              <span className="text-lg font-bold text-red-600">₹{totalPendingAmountOverview.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <span className="text-muted-foreground">Upcoming (7 Days):</span>
              </div>
              <span className="text-lg font-bold text-orange-600">₹{upcoming7DaysAmountOverview.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Today Received:</span>
              </div>
              <span className="text-lg font-bold text-green-600">₹{todayReceivedAmountOverview.toFixed(2)}</span>
            </div>
          </div>
        )}

        <Separator className="my-6" />

        <h3 className="text-lg font-semibold text-primary mb-4">Pending Payments List</h3>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterPeriod">Filter by Due Date</Label>
            <Select 
              value={filterPeriod}
              onValueChange={(value) => setFilterPeriod(value as typeof filterPeriod)}
            >
              <SelectTrigger id="filterPeriod" className="w-full">
                <SelectValue placeholder="Select filter period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_today">Pending till Today</SelectItem>
                <SelectItem value="upcoming">Upcoming Payments</SelectItem>
                <SelectItem value="7_days">Within 7 Days</SelectItem>
                <SelectItem value="15_days">Within 15 Days</SelectItem>
                <SelectItem value="30_days">Within 30 Days</SelectItem>
                <SelectItem value="60_days">Within 60 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading pending payments...</p>
            </div>
          ) : pendingOrderPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending payments found matching your criteria.</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount Due</TableHead>
                    <TableHead className="text-muted-foreground">Due Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrderPayments.map((order) => (
                    <TableRow key={order.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.payment_due_date ? new Date(order.payment_due_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleUpdatePaymentClick(order)} 
                          title="Update Payment"
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
        <Button onClick={onViewDetails} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
          View Detailed Report
        </Button>
      </CardContent>

      <UpdatePaymentDialog
        orderToUpdate={selectedOrderForPaymentUpdate}
        isOpen={isUpdatePaymentDialogOpen}
        onOpenChange={setIsUpdatePaymentDialogOpen}
        onPaymentUpdated={handlePaymentUpdated}
      />
    </Card>
  );
};

export default PaymentCard;