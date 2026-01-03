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
  const [todaysDueAmountOverview, setTodaysDueAmountOverview] = useState<number>(0);
  const [todayReceivedAmountOverview, setTodayReceivedAmountOverview] = useState<number>(0);
  const [pendingApprovalAmountOverview, setPendingApprovalAmountOverview] = useState<number>(0); // New state

  // Helper to get start of current UTC day
  const getStartOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    // Ensure the string ends with 'Z' for UTC
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
  };

  // Helper to get end of current UTC day
  const getEndOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    // Ensure the string ends with 'Z' for UTC
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
  };

  const fetchPaymentOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const startOfUTCTodayISO = getStartOfUTCDayISO();
      const endOfUTCTodayISO = getEndOfUTCDayISO();

      console.log("DEBUG: Calculated Start of UTC Today (ISO):", startOfUTCTodayISO);
      console.log("DEBUG: Calculated End of UTC Today (ISO):", endOfUTCTodayISO);

      // 1. Fetch Total Pending Amount (all pending orders)
      const { data: allPendingOrders, error: allPendingError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending');

      if (allPendingError) throw allPendingError;

      const totalPending = (allPendingOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTotalPendingAmountOverview(totalPending);

      // --- Enhanced Debugging for Today's Due ---
      // First, fetch ALL orders due today to see what's there
      console.log("DEBUG: Fetching ALL orders due today (regardless of status)...");
      const { data: allOrdersDueToday, error: allOrdersDueTodayError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_due_date, payment_status')
        .gte('payment_due_date', startOfUTCTodayISO)
        .lte('payment_due_date', endOfUTCTodayISO);

      if (allOrdersDueTodayError) {
        console.error("DEBUG: Error fetching ALL orders due today:", allOrdersDueTodayError.message);
      } else {
        console.log("DEBUG: ALL orders due today (raw data):", allOrdersDueToday);
        if (allOrdersDueToday && allOrdersDueToday.length > 0) {
           console.log("DEBUG: Sample order payment_due_date:", allOrdersDueToday[0].payment_due_date);
           console.log("DEBUG: Sample order payment_status:", allOrdersDueToday[0].payment_status);
        }
      }
      // --- End Enhanced Debugging ---

      // 2. Fetch Today's Due Payments (orders with specific statuses and due date today)
      console.log("DEBUG: Fetching Today's Due Payments (pending OR pending_approval)...");
      const { data: todaysDueOrders, error: todaysDueError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_due_date, payment_status') // Include more fields for debugging
        .gte('payment_due_date', startOfUTCTodayISO)
        .lte('payment_due_date', endOfUTCTodayISO)
        .in('payment_status', ['pending', 'pending_approval']);

      if (todaysDueError) {
        console.error("DEBUG: Error fetching Today's Due Payments:", todaysDueError.message);
        throw todaysDueError;
      }

      console.log("DEBUG: Raw data for Today's Due Payments:", todaysDueOrders);
      const todaysDue = (todaysDueOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      console.log("DEBUG: Calculated Today's Due Amount:", todaysDue);
      setTodaysDueAmountOverview(todaysDue);

      // 3. Fetch Today Received Payments
      let todayReceived = 0;

      const { data: todayReceivedCompletedPayments, error: todayReceivedCompletedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .or(`and(payment_date.gte.${startOfUTCTodayISO},payment_date.lte.${endOfUTCTodayISO}),and(approved_at.gte.${startOfUTCTodayISO},approved_at.lte.${endOfUTCTodayISO})`);

      if (todayReceivedCompletedError) throw todayReceivedCompletedError;
      todayReceived += (todayReceivedCompletedPayments || []).reduce((sum, payment) => sum + payment.amount, 0);

      const { data: todayReceivedApprovedPayments, error: todayReceivedApprovedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval')
        .gte('approved_at', startOfUTCTodayISO)
        .lte('approved_at', endOfUTCTodayISO);

      if (todayReceivedApprovedError) throw todayReceivedApprovedError;
      todayReceived += (todayReceivedApprovedPayments || []).reduce((sum, payment) => sum + payment.amount, 0);

      setTodayReceivedAmountOverview(todayReceived);

      // 4. Fetch Pending Approval Payments (total amount, regardless of due date)
      const { data: pendingApprovalPayments, error: pendingApprovalError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');

      if (pendingApprovalError) throw pendingApprovalError;

      const totalPendingApproval = (pendingApprovalPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      setPendingApprovalAmountOverview(totalPendingApproval);

    } catch (error: any) {
      console.error('Error fetching payment overview:', error.message);
      showError('Failed to load payment overview data.');
      setTotalPendingAmountOverview(0);
      setTodaysDueAmountOverview(0);
      setTodayReceivedAmountOverview(0);
      setPendingApprovalAmountOverview(0);
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
          <div className="space-y-4">
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
                <span className="text-muted-foreground">Today's Due:</span>
              </div>
              <span className="text-lg font-bold text-orange-600">₹{todaysDueAmountOverview.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Today Received:</span>
              </div>
              <span className="text-lg font-bold text-green-600">₹{todayReceivedAmountOverview.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <span className="text-muted-foreground">Pending Approval:</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">₹{pendingApprovalAmountOverview.toFixed(2)}</span>
            </div>
            <Button onClick={onViewDetails} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
              View Detailed Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentCard;