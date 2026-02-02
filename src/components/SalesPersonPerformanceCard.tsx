"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Target, TrendingUp, Hourglass } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { showError } from '@/utils/toast';

const SalesPersonPerformanceCard = () => {
  const [loading, setLoading] = useState(true);
  const [salesTarget, setSalesTarget] = useState<number>(0);
  const [achievedSales, setAchievedSales] = useState<number>(0);
  const { user } = useSession();

  const fetchPerformanceData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      // --- START DIAGNOSTIC LOGGING ---
      console.log('[Performance Card] Fetching data for user ID:', user.id);
      // --- END DIAGNOSTIC LOGGING ---

      // 1. Fetch sales target for the current user
      const { data: targetData, error: targetError } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('sales_person_id', user.id)
        .single();

      // --- START DIAGNOSTIC LOGGING ---
      console.log('[Performance Card] Sales Target Query Result:', { targetData, targetError });
      // --- END DIAGNOSTIC LOGGING ---

      if (targetError && targetError.code !== 'PGRST116') { // Ignore 'no rows found' error
        throw new Error(`Failed to fetch sales target: ${targetError.message}`);
      }
      setSalesTarget(targetData?.target_amount || 0);

      // 2. Fetch total achieved sales (post-discount) for the current month
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', user.id)
        .gte('order_date', firstDayOfMonth)
        .lte('order_date', lastDayOfMonth);

      if (ordersError) {
        throw new Error(`Failed to fetch achieved sales: ${ordersError.message}`);
      }

      const totalAchievedSales = (ordersData || []).reduce((sum, order) => sum + order.total_amount, 0);
      setAchievedSales(totalAchievedSales);

    } catch (error: any) {
      console.error('Error fetching performance data:', error);
      showError(error.message || 'An unexpected error occurred while fetching performance data.');
      setSalesTarget(0);
      setAchievedSales(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const progressPercentage = salesTarget > 0 ? (achievedSales / salesTarget) * 100 : 0;
  const pendingTarget = Math.max(0, salesTarget - achievedSales);

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
              <span className="font-bold text-foreground">{formatCurrency(salesTarget)}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-5 w-5" />
                <span>Achieved Sales:</span>
              </div>
              <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(achievedSales)}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hourglass className="h-5 w-5" />
                <span>Pending Target:</span>
              </div>
              <span className="font-bold text-orange-500 dark:text-orange-400">{formatCurrency(pendingTarget)}</span>
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