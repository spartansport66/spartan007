"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const PaymentOverview = () => {
  const [loading, setLoading] = useState(true);
  const [totalReceivedToday, setTotalReceivedToday] = useState(0);
  const [totalPendingToday, setTotalPendingToday] = useState(0);
  const [lifetimePending, setLifetimePending] = useState(0);

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startOfToday = getStartOfUTCDayISO(today);
      const endOfToday = getEndOfUTCDayISO(today);

      // Fetch totals for "Today"
      const { data: receivedTodayData, error: receivedTodayError } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', startOfToday)
        .lte('payment_date', endOfToday);

      if (receivedTodayError) throw receivedTodayError;
      const receivedToday = (receivedTodayData || []).reduce((sum, p) => sum + p.amount, 0);
      setTotalReceivedToday(receivedToday);

      const { data: ordersTodayData, error: ordersTodayError } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('order_date', startOfToday)
        .lte('order_date', endOfToday);
      
      if (ordersTodayError) throw ordersTodayError;
      const pendingToday = (ordersTodayData || []).reduce((sum, o) => sum + o.total_amount, 0);
      setTotalPendingToday(pendingToday);

      // Fetch lifetime totals for "Total Pending"
      const { data: allOrdersData, error: allOrdersError } = await supabase
        .from('orders')
        .select('total_amount');

      if (allOrdersError) throw allOrdersError;
      const totalOrderValue = (allOrdersData || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const { data: allPaymentsData, error: allPaymentsError } = await supabase
        .from('payments')
        .select('amount');
      
      if (allPaymentsError) throw allPaymentsError;
      const totalReceivedValue = (allPaymentsData || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      const { data: companyInfo, error: companyInfoError } = await supabase
        .from('company_info')
        .select('opening_balance')
        .limit(1)
        .single();

      if (companyInfoError && companyInfoError.code !== 'PGRST116') throw companyInfoError; // PGRST116 means no rows found, which is ok.
      const openingBalance = companyInfo?.opening_balance || 0;

      const finalPending = openingBalance + totalOrderValue - totalReceivedValue;
      setLifetimePending(finalPending);

    } catch (error: any) {
      console.error("Error fetching payment overview:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total Pending (All Time)"
        value={`₹${lifetimePending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Opening Balance + Total Orders - Total Received"
        isLoading={loading}
      />
      <StatCard
        title="Value of Orders Today"
        value={`₹${totalPendingToday.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Total value of all orders placed today"
        isLoading={loading}
      />
      <StatCard
        title="Received Today"
        value={`₹${totalReceivedToday.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Total payments received today"
        isLoading={loading}
      />
    </div>
  );
};

export default PaymentOverview;