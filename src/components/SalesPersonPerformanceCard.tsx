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
      setLoading(false);
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
    if (user) {
      fetchPerformanceData();
    } else {
      setLoading(false);
    }
  }, [fetchPerformanceData, user]);

  const progressPercentage = salesTarget > 0 ? (totalBilledOrders / salesTarget) * 100 : 0;
  const pendingTarget = Math.max(0, salesTarget - totalBilledOrders);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-1.5">
        <CardTitle className="text-sm font-semibold">This Month's Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-1.5">
        {loading ? (
          <div className="flex items-center justify-center h-12">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Target className="h-2.5 w-2.5" />
                <span>Target:</span>
              </div>
              <span className="font-bold text-xs text-blue-600 dark:text-blue-400">{formatCurrency(salesTarget)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-2.5 w-2.5" />
                <span>Received:</span>
              </div>
              <span className="font-bold text-xs text-cyan-600 dark:text-cyan-400">{formatCurrency(totalOrdersReceived)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-2.5 w-2.5" />
                <span>Billed:</span>
              </div>
              <span className="font-bold text-xs text-green-600 dark:text-green-400">{formatCurrency(totalBilledOrders)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Hourglass className="h-2.5 w-2.5" />
                <span>Pending:</span>
              </div>
              <span className="font-bold text-xs text-orange-600 dark:text-orange-400">{formatCurrency(pendingTarget)}</span>
            </div>
            <div>
              <Progress value={progressPercentage} className="w-full h-1" />
              <p className="text-xs text-right text-muted-foreground mt-0.5">
                {progressPercentage.toFixed(2)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceCard;