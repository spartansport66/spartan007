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
  // const [todaysDueAmountOverview, setTodaysDueAmountOverview] = useState<number>(0); // Removed
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
    console.log("DEBUG: fetchPaymentOverviewData called");
    setOverviewLoading(true);
    try {
      const startOfUTCTodayISO = getStartOfUTCDayISO();
      const endOfUTCTodayISO = getEndOfUTCDayISO();

      console.log("DEBUG: Start of UTC Today:", startOfUTCTodayISO);
      console.log("DEBUG: End of UTC Today:", endOfUTCTodayISO);

      // 1. Fetch Total Pending Amount (all pending orders)
      console.log("DEBUG: Fetching Total Pending Amount...");
      const { data: allPendingOrders, error: allPendingError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending');

      if (allPendingError) {
        console.error("DEBUG: Error fetching Total Pending Amount:", allPendingError.message);
        throw allPendingError;
      }

      const totalPending = (allPendingOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      console.log("DEBUG: Total Pending Amount:", totalPending);
      setTotalPendingAmountOverview(totalPending);

      // 2. Today's Due Payments - NO FETCHING EXACT DATA
      // Setting to 0 as per user request
      // setTodaysDueAmountOverview(0); // Removed this line, will be handled by initial state

      // 3. Fetch Today Received Payments
      console.log("DEBUG: Fetching Today Received Payments...");
      let todayReceived = 0;

      const { data: todayReceivedCompletedPayments, error: todayReceivedCompletedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .or(`and(payment_date.gte.${startOfUTCTodayISO},payment_date.lte.${endOfUTCTodayISO}),and(approved_at.gte.${startOfUTCTodayISO},approved_at.lte.${endOfUTCTodayISO})`);

      if (todayReceivedCompletedError) {
        console.error("DEBUG: Error fetching Today Received Payments (completed):", todayReceivedCompletedError.message);
        throw todayReceivedCompletedError;
      }
      todayReceived += (todayReceivedCompletedPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: Today Received from completed payments:", todayReceived);

      const { data: todayReceivedApprovedPayments, error: todayReceivedApprovedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval')
        .gte('approved_at', startOfUTCTodayISO)
        .lte('approved_at', endOfUTCTodayISO);

      if (todayReceivedApprovedError) {
        console.error("DEBUG: Error fetching Today Received Payments (approved):", todayReceivedApprovedError.message);
        throw todayReceivedApprovedError;
      }
      todayReceived += (todayReceivedApprovedPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: Today Received total:", todayReceived);
      setTodayReceivedAmountOverview(todayReceived);

      // 4. Fetch Pending Approval Payments (total amount, regardless of due date)
      console.log("DEBUG: Fetching Pending Approval Payments...");
      const { data: pendingApprovalPayments, error: pendingApprovalError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');

      if (pendingApprovalError) {
        console.error("DEBUG: Error fetching Pending Approval Payments:", pendingApprovalError.message);
        throw pendingApprovalError;
      }

      const totalPendingApproval = (pendingApprovalPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: Pending Approval Amount:", totalPendingApproval);
      setPendingApprovalAmountOverview(totalPendingApproval);

    } catch (error: any) {
      console.error('Error fetching payment overview:', error.message);
      showError('Failed to load payment overview data.');
      setTotalPendingAmountOverview(0);
      // setTodaysDueAmountOverview(0); // Removed
      setTodayReceivedAmountOverview(0);
      setPendingApprovalAmountOverview(0);
    } finally {
      console.log("DEBUG: Finished fetching payment overview data.");
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("DEBUG: PaymentCard useEffect triggered");
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
              <span className="text-lg font-bold text-orange-600">₹0.00</span> {/* Hardcoded to 0.00 as per request */}
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