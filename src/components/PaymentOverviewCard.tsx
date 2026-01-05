"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, CalendarDays, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';

interface PaymentOverviewCardProps {
  onViewReport: () => void; // Simplified to a simple callback
}

const PaymentOverviewCard: React.FC<PaymentOverviewCardProps> = ({ onViewReport }) => {
  const [loading, setLoading] = useState(true);
  const [totalPendingAmount, setTotalPendingAmount] = useState<number>(0);
  const [totalReceivedAmount, setTotalReceivedAmount] = useState<number>(0);
  const [totalPendingApprovalAmount, setTotalPendingApprovalAmount] = useState<number>(0);
  const [todayReceivedAmount, setTodayReceivedAmount] = useState<number>(0);
  const [todayPendingApprovalAmount, setTodayPendingApprovalAmount] = useState<number>(0);

  // Helper to get start of current UTC day
  const getStartOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
  };

  // Helper to get end of current UTC day
  const getEndOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
  };

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const startOfUTCTodayISO = getStartOfUTCDayISO();
      const endOfUTCTodayISO = getEndOfUTCDayISO();

      console.log("DEBUG: PaymentOverviewCard - Start of UTC Today:", startOfUTCTodayISO);
      console.log("DEBUG: PaymentOverviewCard - End of UTC Today:", endOfUTCTodayISO);

      // 1. Total Pending Amount (from orders table, payment_status = 'pending')
      console.log("DEBUG: PaymentOverviewCard - Querying for total pending orders...");
      const { data: pendingOrders, error: pendingOrdersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending');

      if (pendingOrdersError) throw pendingOrdersError;

      const calculatedTotalPending = (pendingOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      console.log("DEBUG: PaymentOverviewCard - Raw pendingOrders data:", pendingOrders);
      console.log("DEBUG: PaymentOverviewCard - Calculated Total Pending Amount:", calculatedTotalPending);
      setTotalPendingAmount(calculatedTotalPending);

      // 2. Total Received Amount (from payments table, status = 'completed')
      console.log("DEBUG: PaymentOverviewCard - Querying for total received payments...");
      const { data: receivedPayments, error: receivedPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed');

      if (receivedPaymentsError) throw receivedPaymentsError;

      const calculatedTotalReceived = (receivedPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: PaymentOverviewCard - Raw receivedPayments data:", receivedPayments);
      console.log("DEBUG: PaymentOverviewCard - Calculated Total Received Amount:", calculatedTotalReceived);
      setTotalReceivedAmount(calculatedTotalReceived);

      // 3. Total Pending for Approval Amount (from payments table, status = 'pending_approval')
      console.log("DEBUG: PaymentOverviewCard - Querying for total pending_approval payments...");
      const { data: pendingApprovalPayments, error: pendingApprovalPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');

      console.log("DEBUG: PaymentOverviewCard - Raw pendingApprovalPayments data:", pendingApprovalPayments);
      if (pendingApprovalPaymentsError) throw pendingApprovalPaymentsError;

      const calculatedTotalPendingApproval = (pendingApprovalPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: PaymentOverviewCard - Calculated Total Pending for Approval Amount:", calculatedTotalPendingApproval);
      setTotalPendingApprovalAmount(calculatedTotalPendingApproval);

      // 4. Today Received Amount (from payments table, status = 'completed', approved_at is today)
      console.log("DEBUG: PaymentOverviewCard - Querying for today received payments (approved_at)...");
      const { data: todayReceived, error: todayReceivedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .gte('approved_at', startOfUTCTodayISO)
        .lte('approved_at', endOfUTCTodayISO);

      console.log("DEBUG: PaymentOverviewCard - Raw todayReceived data (approved_at):", todayReceived);
      if (todayReceivedError) throw todayReceivedError;

      const calculatedTodayReceived = (todayReceived || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: PaymentOverviewCard - Calculated Today Received Amount:", calculatedTodayReceived);
      setTodayReceivedAmount(calculatedTodayReceived);

      // 5. Today Pending for Approval Amount (from payments table, status = 'pending_approval', payment_date is today)
      console.log("DEBUG: PaymentOverviewCard - Querying for today pending approval payments (payment_date)...");
      const { data: todayPendingApproval, error: todayPendingApprovalError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval')
        .gte('payment_date', startOfUTCTodayISO)
        .lte('payment_date', endOfUTCTodayISO);

      console.log("DEBUG: PaymentOverviewCard - Raw todayPendingApproval data (payment_date):", todayPendingApproval);
      if (todayPendingApprovalError) throw todayPendingApprovalError;

      const calculatedTodayPendingApproval = (todayPendingApproval || []).reduce((sum, payment) => sum + payment.amount, 0);
      console.log("DEBUG: PaymentOverviewCard - Calculated Today Pending for Approval Amount (payment_date):", calculatedTodayPendingApproval);
      setTodayPendingApprovalAmount(calculatedTodayPendingApproval);

    } catch (error: any) {
      console.error('Error fetching payment overview:', error.message);
      showError('Failed to load payment overview data.');
      setTotalPendingAmount(0);
      setTotalReceivedAmount(0);
      setTotalPendingApprovalAmount(0);
      setTodayReceivedAmount(0);
      setTodayPendingApprovalAmount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("DEBUG: PaymentOverviewCard - useEffect triggered");
    fetchOverviewData();
  }, [fetchOverviewData]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Payment Overview</CardTitle>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          Summary of all payment statuses across the system.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payment overview...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-muted-foreground">Total Pending:</span>
              </div>
              <span className="text-lg font-bold text-red-600">₹{totalPendingAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Total Received:</span>
              </div>
              <span className="text-lg font-bold text-green-600">₹{totalReceivedAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="text-muted-foreground">Total Pending for Approval:</span>
              </div>
              <span className="text-lg font-bold text-blue-600">₹{totalPendingApprovalAmount.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Today Received:</span>
              </div>
              <span className="text-lg font-bold text-green-600">₹{todayReceivedAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <span className="text-muted-foreground">Today Pending for Approval:</span>
              </div>
              <span className="text-lg font-bold text-orange-600">₹{todayPendingApprovalAmount.toFixed(2)}</span>
            </div>
            <Button onClick={onViewReport} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
              View Detailed Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentOverviewCard;