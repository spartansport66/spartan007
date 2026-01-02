"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Target, Activity, Users } from 'lucide-react'; // Added Users icon
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface SalesPersonPerformanceOverviewCardProps {
  onViewDetails: () => void; // Function to open the detailed report dialog
}

const SalesPersonPerformanceOverviewCard: React.FC<SalesPersonPerformanceOverviewCardProps> = ({ onViewDetails }) => {
  const [loading, setLoading] = useState(true);
  const [activeSalesmenCount, setActiveSalesmenCount] = useState<number>(0); // New state
  const [combinedAchievedSales, setCombinedAchievedSales] = useState<number>(0); // Renamed
  const [combinedTargetAmount, setCombinedTargetAmount] = useState<number>(0); // Renamed
  const [combinedPerformancePercentage, setCombinedPerformancePercentage] = useState<number>(0); // Renamed

  const getStartOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
  };

  const getEndOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
  };

  const fetchPerformanceOverview = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed

      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString();
      const targetMonthFilterDate = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];

      // Fetch active sales persons count
      const { data: salesProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', 'sales_person');

      if (profilesError) {
        throw new Error(`Failed to fetch sales profiles: ${profilesError.message}`);
      }

      const salesPersonIds = salesProfiles.map(p => p.id);

      const { data: authUsers, error: authUsersError } = await supabase
        .from('users') // This is the auth.users table
        .select('id, banned_until')
        .in('id', salesPersonIds);

      if (authUsersError) {
        throw new Error(`Failed to fetch auth users: ${authUsersError.message}`);
      }

      const activeSalesmen = authUsers.filter(u => !u.banned_until);
      setActiveSalesmenCount(activeSalesmen.length);

      // Fetch total sales for the current month across all sales persons
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price, orders(user_id)')
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth);

      if (salesError) {
        throw new Error(`Failed to fetch sales data: ${salesError.message}`);
      }

      const achievedSales = (salesData || []).reduce((sum, sale) => sum + sale.total_price, 0);
      setCombinedAchievedSales(achievedSales);

      // Fetch total targets for the current month across all sales persons
      const { data: targetsData, error: targetsError } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('target_month', targetMonthFilterDate);

      if (targetsError) {
        throw new Error(`Failed to fetch targets data: ${targetsError.message}`);
      }

      const targetAmount = (targetsData || []).reduce((sum, target) => sum + target.target_amount, 0);
      setCombinedTargetAmount(targetAmount);

      if (targetAmount > 0) {
        setCombinedPerformancePercentage((achievedSales / targetAmount) * 100);
      } else {
        setCombinedPerformancePercentage(0); // Avoid division by zero
      }

    } catch (error: any) {
      console.error('Error fetching sales person performance overview:', error.message);
      showError('Failed to load sales person performance overview.');
      setActiveSalesmenCount(0);
      setCombinedAchievedSales(0);
      setCombinedTargetAmount(0);
      setCombinedPerformancePercentage(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformanceOverview();
  }, [fetchPerformanceOverview]);

  const getMonthName = (monthNum: number) => {
    const date = new Date(Date.UTC(2000, monthNum - 1, 1));
    return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  };

  const currentMonthName = getMonthName(new Date().getMonth() + 1);
  const currentYear = new Date().getFullYear();

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Sales Person Performance</CardTitle>
        <CardDescription className="text-purple-100 dark:text-purple-200">
          Overview for {currentMonthName} {currentYear}
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
                <span className="text-muted-foreground">Total Combined Performance:</span>
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