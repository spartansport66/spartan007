"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Target, TrendingUp, Hourglass, Package } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { showError } from '@/utils/toast';

const SalesPersonPerformanceCard = () => {
  const [loading, setLoading] = useState(true);
  const [salesTarget, setSalesTarget] = useState<number>(0);
  const [totalOrdersReceived, setTotalOrdersReceived] = useState<number>(0);
  const [totalBilledOrders, setTotalBilledOrders] = useState<number>(0);
  const { user } = useSession();

  const fetchPerformanceData = useCallback(async () => {
    if (!user) {
      console.warn('⚠️ No user session found');
      return;
    }
    setLoading(true);

    try {
      const today = new Date();
      
      // Format date in local timezone to avoid UTC conversion issues
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = '01';
      const targetMonthDate = `${year}-${month}-${day}`;
      
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      
      console.log('🔍 Fetching target for:', { userId: user.id, targetMonthDate });
      
      const { data: targetData, error: targetError } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('sales_person_id', user.id)
        .eq('target_month', targetMonthDate);

      if (targetError) {
        console.error('❌ Target fetch error:', targetError);
        throw new Error(`Failed to fetch sales target: ${targetError.message}`);
      }
      
      console.log('✅ Target fetched:', targetData?.[0]?.target_amount);
      
      // Safely get the target from the first result, or default to 0.
      const firstTarget = targetData?.[0]?.target_amount || 0;
      setSalesTarget(firstTarget);

      // 2. Fetch total amount of orders received for the current month
      const { data: allOrdersData, error: allOrdersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', user.id)
        .gte('order_date', firstDayOfMonth)
        .lte('order_date', lastDayOfMonth);

      if (allOrdersError) {
        throw new Error(`Failed to fetch orders received: ${allOrdersError.message}`);
      }

      const totalOrdersAmount = (allOrdersData || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTotalOrdersReceived(totalOrdersAmount);

      // 3. Fetch total amount of billed orders (where bill_no is not empty/null) for the current month
      const { data: billedOrdersData, error: billedOrdersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', user.id)
        .not('bill_no', 'is', null)
        .gt('bill_no', '')
        .gte('order_date', firstDayOfMonth)
        .lte('order_date', lastDayOfMonth);

      if (billedOrdersError) {
        throw new Error(`Failed to fetch billed orders: ${billedOrdersError.message}`);
      }

      const totalBilledAmount = (billedOrdersData || []).reduce((sum, order) => sum + order.total_amount, 0);
      setTotalBilledOrders(totalBilledAmount);

    } catch (error: any) {
      console.error('Error fetching performance data:', error);
      showError(error.message || 'An unexpected error occurred while fetching performance data.');
      setSalesTarget(0);
      setTotalOrdersReceived(0);
      setTotalBilledOrders(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const progressPercentage = salesTarget > 0 ? (totalBilledOrders / salesTarget) * 100 : 0;
  const pendingTarget = Math.max(0, salesTarget - totalBilledOrders);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">This Month's Performance</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Your sales progress for the current month.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-5 w-5" />
                <span>Monthly Target:</span>
              </div>
              <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(salesTarget)}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-5 w-5" />
                <span>Order Received:</span>
              </div>
              <span className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{formatCurrency(totalOrdersReceived)}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-5 w-5" />
                <span>Billed Orders:</span>
              </div>
              <span className="font-bold text-lg text-green-600 dark:text-green-400">{formatCurrency(totalBilledOrders)}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hourglass className="h-5 w-5" />
                <span>Pending Target:</span>
              </div>
              <span className="font-bold text-lg text-orange-600 dark:text-orange-400">{formatCurrency(pendingTarget)}</span>
            </div>
            <div>
              <Progress value={progressPercentage} className="w-full h-3" />
              <p className="text-sm text-right text-muted-foreground mt-1">
                {progressPercentage.toFixed(2)}% of target achieved
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceCard;