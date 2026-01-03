"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Target, Activity, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator'; // Added Separator for better visual separation

interface SalesPersonPerformanceOverviewCardProps {
  onViewDetails: () => void;
}

const SalesPersonPerformanceOverviewCard: React.FC<SalesPersonPerformanceOverviewCardProps> = ({ onViewDetails }) => {
  const [loading, setLoading] = useState(true);
  const [activeSalesmenCount, setActiveSalesmenCount] = useState<number>(0);
  const [combinedAchievedSales, setCombinedAchievedSales] = useState<number>(0);
  const [combinedTargetAmount, setCombinedTargetAmount] = useState<number>(0);
  const [combinedPendingSales, setCombinedPendingSales] = useState<number>(0); // New state for pending sales
  const [combinedPerformancePercentage, setCombinedPerformancePercentage] = useState<number>(0);

  const fetchPerformanceOverview = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed

      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString();
      const targetMonthFilterDate = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];

      // 1. Fetch all sales persons (from public.profiles)
      const { data: salesProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', 'sales_person');

      if (profilesError) {
        throw new Error(`Failed to fetch sales profiles: ${profilesError.message}`);
      }

      const salesPersonIds = salesProfiles.map(p => p.id);
      setActiveSalesmenCount(salesPersonIds.length);

      if (salesPersonIds.length === 0) {
        setCombinedAchievedSales(0);
        setCombinedTargetAmount(0);
        setCombinedPendingSales(0); // Reset pending sales
        setCombinedPerformancePercentage(0);
        setLoading(false);
        return;
      }

      // 2. Fetch total sales for the current month across all sales persons
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price, orders(user_id)')
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth)
        .in('orders.user_id', salesPersonIds);

      if (salesError) {
        throw new Error(`Failed to fetch sales data: ${salesError.message}`);
      }

      const achievedSales = (salesData || []).reduce((sum, sale) => sum + sale.total_price, 0);
      setCombinedAchievedSales(achievedSales);

      // 3. Fetch total targets for the current month across all sales persons
      const { data: targetsData, error: targetsError } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('target_month', targetMonthFilterDate)
        .in('sales_person_id', salesPersonIds);

      if (targetsError) {
        throw new Error(`Failed to fetch targets data: ${targetsError.message}`);
      }

      const targetAmount = (targetsData || []).reduce((sum, target) => sum + target.target_amount, 0);
      setCombinedTargetAmount(targetAmount);

      const pendingSales = targetAmount - achievedSales; // Calculate pending sales
      setCombinedPendingSales(pendingSales);

      let calculatedPerformancePercentage = 0;
      if (targetAmount > 0) {
        calculatedPerformancePercentage = (achievedSales / targetAmount) * 100;
      }
      setCombinedPerformancePercentage(calculatedPerformancePercentage);

    } catch (error: any) {
      console.error('Error fetching sales person performance overview:', error.message);
      showError('Failed to load sales person performance overview.');
      setActiveSalesmenCount(0);
      setCombinedAchievedSales(0);
      setCombinedTargetAmount(0);
      setCombinedPendingSales(0); // Reset pending sales on error
      setCombinedPerformancePercentage(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformanceOverview();
  }, [fetchPerformanceOverview]);

  const getMonthName = (monthIndex: number) => {
    const date = new Date(Date.UTC(2000, monthIndex, 1));
    return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  };

  const currentMonthName = getMonthName(new Date().getMonth());
  const currentYear = new Date().getFullYear();

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Sales Person Performance Overview</CardTitle>
        <CardDescription className="text-purple-100 dark:text-purple-200">
          Combined performance for {currentMonthName} {currentYear}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading performance data...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-muted-foreground">Total Active Salesmen:</span>
              </div>
              <span className="text-lg font-bold text-gray-600">{activeSalesmenCount}</span>
            </div>
            <Separator /> {/* Added separator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span className="text-muted-foreground">Total Combined Target:</span>
              </div>
              <span className="text-lg font-bold text-blue-600">₹{combinedTargetAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Total Combined Achieved Sales:</span>
              </div>
              <span className="text-lg font-bold text-green-600">₹{combinedAchievedSales.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-600" />
                <span className="text-muted-foreground">Total Combined Pending:</span>
              </div>
              <span className={`text-lg font-bold ${combinedPendingSales > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{combinedPendingSales.toFixed(2)}
              </span>
            </div>
            <Separator /> {/* Added separator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <span className="text-muted-foreground">Overall Performance:</span>
              </div>
              <span className={`text-lg font-bold ${combinedPerformancePercentage >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                {combinedPerformancePercentage.toFixed(2)}%
              </span>
            </div>
            <Button onClick={onViewDetails} className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white">
              View Detailed Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceOverviewCard;