"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, CalendarDays, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';

interface PaymentCardProps {
  onViewDetails: () => void; // New prop to open the detailed report dialog
}

const PaymentCard: React.FC<PaymentCardProps> = ({ onViewDetails }) => {
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Overview metrics states
  const [totalPendingAmountOverview, setTotalPendingAmountOverview] = useState<number>(0);
  const [todaysDueAmountOverview, setTodaysDueAmountOverview] = useState<number>(0); // Changed state name
  const [todayReceivedAmountOverview, setTodayReceivedAmountOverview] = useState<number>(0);

  const getTodayDateISO = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  };

  const getEndOfTodayDateISO = () => { // New helper function
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString();
  };

  const fetchPaymentOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const todayISO = getTodayDateISO();
      const endOfTodayISO = getEndOfTodayDateISO(); // Use end of today

      // 1. Fetch Total Pending Amount (all pending orders)
      const { data: allPendingOrders, error: allPendingError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending');

      if (allPendingError) throw allPendingError;
      const totalPending = (allPendingOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTotalPendingAmountOverview(totalPending);

      // 2. Fetch Today's Due Payments (payments due today)
      const { data: todaysDueOrders, error: todaysDueError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending')
        .gte('payment_due_date', todayISO)
        .lte('payment_due_date', endOfTodayISO); // Filter for today's date range

      if (todaysDueError) throw todaysDueError;
      const todaysDue = (todaysDueOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTodaysDueAmountOverview(todaysDue); // Set to new state

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
      setTodaysDueAmountOverview(0); // Reset new state
      setTodayReceivedAmountOverview(0);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentOverviewData();
  }, [fetchPaymentOverviewData]);

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
                <span className="text-muted-foreground">Today's Due:</span> {/* Changed label */}
              </div>
              <span className="text-lg font-bold text-orange-600">₹{todaysDueAmountOverview.toFixed(2)}</span> {/* Display new state */}
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

        <Button onClick={onViewDetails} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
          View Detailed Report
        </Button>
      </CardContent>
    </Card>
  );
};

export default PaymentCard;