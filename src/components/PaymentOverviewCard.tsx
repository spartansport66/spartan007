"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, CalendarDays, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';

interface PaymentOverviewCardProps {
  onViewReport: (status: 'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval', fromDate?: string, toDate?: string) => void;
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
      const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for date filters

      // 1. Total Pending Amount (from orders table, payment_status = 'pending')
      const { data: pendingOrders, error: pendingOrdersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'pending');
      if (pendingOrdersError) throw pendingOrdersError;
      setTotalPendingAmount((pendingOrders || []).reduce((sum, order) => sum + order.total_amount, 0));

      // 2. Total Received Amount (from payments table, status = 'completed')
      const { data: receivedPayments, error: receivedPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed');
      if (receivedPaymentsError) throw receivedPaymentsError;
      setTotalReceivedAmount((receivedPayments || []).reduce((sum, payment) => sum + payment.amount, 0));

      // 3. Total Pending for Approval Amount (from payments table, status = 'pending_approval')
      const { data: pendingApprovalPayments, error: pendingApprovalPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');
      if (pendingApprovalPaymentsError) throw pendingApprovalPaymentsError;
      setTotalPendingApprovalAmount((pendingApprovalPayments || []).reduce((sum, payment) => sum + payment.amount, 0));

      // 4. Today Received Amount (from payments table, status = 'completed', approved_at is today)
      const { data: todayReceived, error: todayReceivedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .gte('approved_at', startOfUTCTodayISO)
        .lte('approved_at', endOfUTCTodayISO);
      if (todayReceivedError) throw todayReceivedError;
      setTodayReceivedAmount((todayReceived || []).reduce((sum, payment) => sum + payment.amount, 0));

      // 5. Today Pending for Approval Amount (from payments table, status = 'pending_approval', payment_date is today)
      const { data: todayPendingApproval, error: todayPendingApprovalError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval')
        .gte('payment_date', startOfUTCTodayISO)
        .lte('payment_date', endOfUTCTodayISO);
      if (todayPendingApprovalError) throw todayPendingApprovalError;
      setTodayPendingApprovalAmount((todayPendingApproval || []).reduce((sum, payment) => sum + payment.amount, 0));

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
    fetchOverviewData();
  }, [fetchOverviewData]);

  const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for date filters

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
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-red-600">₹{totalPendingAmount.toFixed(2)}</span>
                <Button variant="link" size="sm" onClick={() => onViewReport('pending')}>View All</Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Total Received:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-green-600">₹{totalReceivedAmount.toFixed(2)}</span>
                <Button variant="link" size="sm" onClick={() => onViewReport('paid')}>View All</Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="text-muted-foreground">Total Pending for Approval:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-blue-600">₹{totalPendingApprovalAmount.toFixed(2)}</span>
                <Button variant="link" size="sm" onClick={() => onViewReport('pending_approval')}>View All</Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Today Received:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-green-600">₹{todayReceivedAmount.toFixed(2)}</span>
                <Button variant="link" size="sm" onClick={() => onViewReport('paid', todayDateOnly, todayDateOnly)}>View All</Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <span className="text-muted-foreground">Today Pending for Approval:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-orange-600">₹{todayPendingApprovalAmount.toFixed(2)}</span>
                <Button variant="link" size="sm" onClick={() => onViewReport('pending_approval', todayDateOnly, todayDateOnly)}>View All</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentOverviewCard;