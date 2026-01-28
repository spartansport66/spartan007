"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Target, TrendingUp, Activity, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Separator } from '@/components/ui/separator';

const SalesPersonPerformanceCard: React.FC = () => {
  const { user, loading: sessionLoading } = useSession();
  const [loading, setLoading] = useState(true);
  const [targetAmount, setTargetAmount] = useState<number | null>(null);
  const [achievedSales, setAchievedSales] = useState<number | null>(null);
  const [pendingSales, setPendingSales] = useState<number | null>(null);
  const [totalOverdueAmount, setTotalOverdueAmount] = useState<number | null>(null);
  const [totalCurrentDealerBalance, setTotalCurrentDealerBalance] = useState<number | null>(null); // NEW STATE

  const fetchPerformanceData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today to start of day UTC
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed

      // Format target_month to YYYY-MM-DD for the first day of the current month
      const targetMonthFilterDate = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];
      
      // Fetch sales target for the current month
      const { data: targetData, error: targetError } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('sales_person_id', user.id)
        .eq('target_month', targetMonthFilterDate)
        .single();

      if (targetError && targetError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw new Error(`Failed to fetch sales target: ${targetError.message}`);
      }
      const currentTarget = targetData?.target_amount || 0;
      setTargetAmount(currentTarget);

      // Fetch achieved sales for the current month
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString();

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price, orders(user_id)')
        .eq('orders.user_id', user.id)
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth);

      if (salesError) {
        throw new Error(`Failed to fetch achieved sales: ${salesError.message}`);
      }
      const currentAchievedSales = (salesData || []).reduce((sum, sale) => sum + sale.total_price, 0);
      setAchievedSales(currentAchievedSales);

      setPendingSales(currentTarget - currentAchievedSales);

      // --- Fetch Dealer Balances and Overdue Amounts ---
      let calculatedTotalOverdue = 0;
      let calculatedTotalCurrentDealerBalance = 0; // NEW METRIC

      // 1. Fetch all dealers assigned to the current sales person
      const { data: assignedDealers, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealer_id')
        .eq('sales_person_id', user.id);

      if (assignedDealersError) {
        throw new Error(`Failed to fetch assigned dealers: ${assignedDealersError.message}`);
      }

      const dealerIds = (assignedDealers || []).map(d => d.dealer_id);

      if (dealerIds.length > 0) {
        // 2. Fetch opening balances for these dealers
        const { data: dealerBalances, error: balancesError } = await supabase
          .from('dealer_balances')
          .select('dealer_id, opening_balance')
          .in('dealer_id', dealerIds);

        if (balancesError) {
          throw new Error(`Failed to fetch dealer balances: ${balancesError.message}`);
        }
        const openingBalancesMap = new Map((dealerBalances || []).map(b => [b.dealer_id, b.opening_balance || 0]));

        // Initialize balances with opening balances
        dealerIds.forEach(dealerId => {
          const openingBalance = openingBalancesMap.get(dealerId) || 0;
          calculatedTotalCurrentDealerBalance += openingBalance;
        });

        // 3. Fetch ALL orders and ALL completed payments for these dealers
        const { data: dealerTransactions, error: transactionsError } = await supabase
          .from('orders')
          .select(`
            total_amount,
            dealer_id,
            payment_due_date,
            payment_status,
            payments(amount, status)
          `)
          .in('dealer_id', dealerIds);

        if (transactionsError) {
          throw new Error(`Failed to fetch dealer transactions: ${transactionsError.message}`);
        }

        // 4. Process transactions to calculate Total Overdue and Total Current Dealer Balance
        (dealerTransactions || []).forEach(order => {
          // Add order amount to Total Current Dealer Balance (Debit)
          calculatedTotalCurrentDealerBalance += order.total_amount;

          // Check if order is overdue (for existing calculatedTotalOverdue metric)
          if (order.payment_status === 'pending' && order.payment_due_date) {
            const dueDate = new Date(order.payment_due_date);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate <= today) {
              calculatedTotalOverdue += order.total_amount;
            }
          }

          // Subtract completed payments (Credit)
          (order.payments || []).forEach(payment => {
            if (payment.status === 'completed') {
              calculatedTotalCurrentDealerBalance -= payment.amount;
            }
          });
        });
      }
      
      setTotalOverdueAmount(calculatedTotalOverdue);
      setTotalCurrentDealerBalance(calculatedTotalCurrentDealerBalance); // SET NEW STATE

    } catch (error: any) {
      console.error('Error fetching sales person performance:', error.message);
      showError(`Failed to load performance data: ${error.message}`);
      setTargetAmount(null);
      setAchievedSales(null);
      setPendingSales(null);
      setTotalOverdueAmount(null);
      setTotalCurrentDealerBalance(null); // Reset new state on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchPerformanceData();
    }
  }, [sessionLoading, user, fetchPerformanceData]);

  const getMonthName = (monthIndex: number) => {
    // Create a date object for the first day of the specified month in UTC
    const date = new Date(Date.UTC(2000, monthIndex, 1));
    // Use toLocaleString to get the full month name, ensuring UTC timezone
    return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  };

  const currentMonthName = getMonthName(new Date().getMonth());
  const currentYear = new Date().getFullYear();

  if (loading || sessionLoading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-pink-500 dark:bg-pink-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">My Monthly Performance</CardTitle>
          <CardDescription className="text-pink-100 dark:text-pink-200">
            Overview for {currentMonthName} {currentYear}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading performance...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-pink-500 dark:bg-pink-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">My Monthly Performance</CardTitle>
        <CardDescription className="text-pink-100 dark:text-pink-200">
          Overview for {currentMonthName} {currentYear}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            <span className="text-muted-foreground">Monthly Target:</span>
          </div>
          <span className="text-lg font-bold text-blue-600">₹{targetAmount !== null ? targetAmount.toFixed(2) : 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-muted-foreground">Achieved Sales:</span>
          </div>
          <span className="text-lg font-bold text-green-600">₹{achievedSales !== null ? achievedSales.toFixed(2) : 'N/A'}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-600" />
            <span className="text-muted-foreground">Pending Target:</span>
          </div>
          <span className={`text-lg font-bold ${pendingSales !== null && pendingSales > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ₹{pendingSales !== null ? pendingSales.toFixed(2) : 'N/A'}
          </span>
        </div>
        <Separator />
        {/* NEW METRIC: Total Current Dealer Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-red-600" />
            <span className="text-muted-foreground">Total Dealer Balance:</span>
          </div>
          <span className="text-lg font-bold text-red-600">
            ₹{totalCurrentDealerBalance !== null ? totalCurrentDealerBalance.toFixed(2) : 'N/A'}
          </span>
        </div>
        {/* EXISTING METRIC: Total Overdue Amount */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-red-600" />
            <span className="text-muted-foreground">Total Overdue (Orders Due):</span>
          </div>
          <span className="text-lg font-bold text-red-600">
            ₹{totalOverdueAmount !== null ? totalOverdueAmount.toFixed(2) : 'N/A'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceCard;