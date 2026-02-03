"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/integrations/supabase/client';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { Loader2 } from 'lucide-react';

const StatCard = ({ title, value, description, isLoading }: { title: string, value: string, description: string, isLoading: boolean }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </CardContent>
  </Card>
);

const PaymentOverviewCard = () => {
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(0);
  const [todayReceived, setTodayReceived] = useState(0);
  const [todayPendingApproval, setTodayPendingApproval] = useState(0);

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startOfToday = getStartOfUTCDayISO(today);
      const endOfToday = getEndOfUTCDayISO(today);

      // Fetch Total Pending (All Time)
      const { data: pendingOrders, error: pendingOrdersError } = await supabase
        .from('orders')
        .select('total_amount');
      if (pendingOrdersError) throw pendingOrdersError;
      const totalOrderValue = (pendingOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

      // Fetch Total Received (All Time)
      const { data: receivedPayments, error: receivedPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'approved');
      if (receivedPaymentsError) throw receivedPaymentsError;
      const totalReceivedValue = (receivedPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      
      setTotalPending(totalOrderValue - totalReceivedValue);
      setTotalReceived(totalReceivedValue);

      // Fetch Pending Approval (All Time)
      const { data: pendingApprovalPayments, error: pendingApprovalError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');
      if (pendingApprovalError) throw pendingApprovalError;
      const totalPendingApproval = (pendingApprovalPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      setPendingApproval(totalPendingApproval);

      // Fetch Today's Received
      const { data: todayReceivedData, error: todayReceivedError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'approved')
        .gte('approved_at', startOfToday)
        .lte('approved_at', endOfToday);
      if (todayReceivedError) throw todayReceivedError;
      const todayReceivedAmount = (todayReceivedData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      setTodayReceived(todayReceivedAmount);

      // Fetch Today's Pending Approval
      const { data: todayPendingData, error: todayPendingError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval')
        .gte('payment_date', startOfToday)
        .lte('payment_date', endOfToday);
      if (todayPendingError) throw todayPendingError;
      const todayPendingAmount = (todayPendingData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      setTodayPendingApproval(todayPendingAmount);

    } catch (error: any) {
      console.error("Error fetching payment overview:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard title="Total Pending" value={formatCurrency(totalPending)} description="Total Orders - Total Received" isLoading={loading} />
      <StatCard title="Total Received" value={formatCurrency(totalReceived)} description="All approved payments" isLoading={loading} />
      <StatCard title="Pending for Approval" value={formatCurrency(pendingApproval)} description="All payments not yet approved" isLoading={loading} />
      <StatCard title="Today Received" value={formatCurrency(todayReceived)} description="Payments approved today" isLoading={loading} />
      <StatCard title="Today Pending Approval" value={formatCurrency(todayPendingApproval)} description="Payments submitted today" isLoading={loading} />
    </div>
  );
};

export default PaymentOverviewCard;