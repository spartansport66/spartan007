"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, CalendarDays, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';

interface PaymentOverviewCardProps {
  onViewReport: () => void;
}

const PaymentOverviewCard: React.FC<PaymentOverviewCardProps> = ({ onViewReport }) => {
  const [loading, setLoading] = useState(true);
  const [totalPendingAmount, setTotalPendingAmount] = useState<number>(0);
  const [totalReceivedAmount, setTotalReceivedAmount] = useState<number>(0);
  const [totalPendingApprovalAmount, setTotalPendingApprovalAmount] = useState<number>(0);
  const [todayReceivedAmount, setTodayReceivedAmount] = useState<number>(0);
  const [todayPendingApprovalAmount, setTodayPendingApprovalAmount] = useState<number>(0);
  
  // New states for individual components
  const [totalOpeningBalance, setTotalOpeningBalance] = useState<number>(0);
  const [totalOrderValue, setTotalOrderValue] = useState<number>(0);
  const [totalPaymentsReceived, setTotalPaymentsReceived] = useState<number>(0);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const startOfUTCTodayISO = getStartOfUTCDayISO();
      const endOfUTCTodayISO = getEndOfUTCDayISO();

      // --- 1. Fetch Total Pending Amount Components ---
      
      // 1a. Fetch the sum of all opening balances from the dealer_balances table.
      const { data: allDealerBalances, error: dealerBalancesError } = await supabase
        .from('dealer_balances')
        .select('opening_balance');

      if (dealerBalancesError) {
        throw dealerBalancesError;
      }
      const openingBalance = (allDealerBalances || []).reduce((sum, balance) => sum + (balance.opening_balance || 0), 0);
      setTotalOpeningBalance(openingBalance);

      // 1b. Fetch the sum of all order values (total_amount) from the orders table.
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('total_amount');
      
      if (allOrdersError) {
        throw allOrdersError;
      }
      const totalOrdersValue = (allOrders || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTotalOrderValue(totalOrdersValue);

      // 1c. Fetch the sum of all completed payments (amount) from the payments table.
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed');

      if (allPaymentsError) {
        throw allPaymentsError;
      }
      const totalPaymentsValue = (allPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      setTotalPaymentsReceived(totalPaymentsValue);

      // Final Calculation: Total Pending = OB + Orders - Payments
      const calculatedTotalPending = openingBalance + totalOrdersValue - totalPaymentsValue;
      setTotalPendingAmount(calculatedTotalPending);

      // --- 2. Fetch Other Metrics (as before) ---
      
      // Total Received (All time completed payments)
      const calculatedTotalReceived = totalPaymentsValue;
      setTotalReceivedAmount(calculatedTotalReceived);

      // Total Pending for Approval
      const { data: pendingApprovalPayments, error: pendingApprovalPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');
      if (pendingApprovalPaymentsError) throw pendingApprovalPaymentsError;
      const calculatedTotalPendingApproval = (pendingApprovalPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
      setTotalPendingApprovalAmount(calculatedTotalPendingApproval);

      // Today Received (Approved today)
      const { data: todayReceived, error: todayReceivedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .gte('approved_at', startOfUTCTodayISO)
        .lte('approved_at', endOfUTCTodayISO);
      if (todayReceivedError) throw todayReceivedError;
      const calculatedTodayReceived = (todayReceived || []).reduce((sum, payment) => sum + payment.amount, 0);
      setTodayReceivedAmount(calculatedTodayReceived);

      // Today Pending for Approval (Submitted today)
      const { data: todayPendingApproval, error: todayPendingApprovalError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval')
        .gte('payment_date', startOfUTCTodayISO)
        .lte('payment_date', endOfUTCTodayISO);
      if (todayPendingApprovalError) throw todayPendingApprovalError;
      const calculatedTodayPendingApproval = (todayPendingApproval || []).reduce((sum, payment) => sum + payment.amount, 0);
      setTodayPendingApprovalAmount(calculatedTodayPendingApproval);

    } catch (error: any) {
      console.error('Error fetching payment overview:', error.message);
      showError('Failed to load payment overview data.');
      setTotalPendingAmount(0);
      setTotalReceivedAmount(0);
      setTotalPendingApprovalAmount(0);
      setTodayReceivedAmount(0);
      setTodayPendingApprovalAmount(0);
      setTotalOpeningBalance(0);
      setTotalOrderValue(0);
      setTotalPaymentsReceived(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
            
            {/* New: Total Opening Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <span className="text-muted-foreground">Total Opening Balance:</span>
              </div>
              <span className="text-lg font-bold text-gray-600">₹{totalOpeningBalance.toFixed(2)}</span>
            </div>
            
            {/* New: Total Order Value */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <span className="text-muted-foreground">Total Order Value:</span>
              </div>
              <span className="text-lg font-bold text-blue-600">₹{totalOrderValue.toFixed(2)}</span>
            </div>
            
            {/* New: Total Payments Received */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Total Payments Received:</span>
              </div>
              <span className="text-lg font-bold text-green-600">₹{totalPaymentsReceived.toFixed(2)}</span>
            </div>
            
            <Separator />
            
            {/* Final Total Pending */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-muted-foreground font-bold">NET PENDING (Ledger):</span>
              </div>
              <span className="text-xl font-bold text-red-600">₹{totalPendingAmount.toFixed(2)}</span>
            </div>
            
            <Separator />
            
            {/* Existing Metrics */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Total Received (All Time):</span>
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