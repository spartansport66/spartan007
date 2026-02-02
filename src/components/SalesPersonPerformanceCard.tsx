"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { showError } from '@/utils/toast';

interface PerformanceData {
  totalSales: number;      // This will now be Gross Sales
  totalOrders: number;
  conversionRate: string;
  avgOrderValue: number;
  totalDiscount: number;   // New: Total discount given
  achievedSales: number;   // New: Sales after discount
}

const SalesPersonPerformanceCard = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<PerformanceData>({
    totalSales: 0,
    totalOrders: 0,
    conversionRate: 'N/A',
    avgOrderValue: 0,
    totalDiscount: 0,
    achievedSales: 0,
  });

  const fetchPerformanceData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('total_amount, discount_amount')
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      if (ordersData) {
        const totalGrossSales = ordersData.reduce((acc, order) => acc + order.total_amount + (order.discount_amount || 0), 0);
        const totalAchievedSales = ordersData.reduce((acc, order) => acc + order.total_amount, 0);
        const totalDiscountAmount = ordersData.reduce((acc, order) => acc + (order.discount_amount || 0), 0);
        const numOrders = ordersData.length;

        setPerformance({
          totalSales: totalGrossSales,
          totalOrders: numOrders,
          conversionRate: 'N/A', // Placeholder as before
          avgOrderValue: numOrders > 0 ? totalGrossSales / numOrders : 0,
          totalDiscount: totalDiscountAmount,
          achievedSales: totalAchievedSales,
        });
      }
    } catch (error: any) {
      console.error("Error fetching performance data:", error);
      showError("Failed to load performance data: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          My Performance Overview
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Your all-time sales and order statistics.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Gross Sales</p>
              <p className="font-bold text-lg">{formatCurrency(performance.totalSales)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Discount</p>
              <p className="font-bold text-lg text-orange-600">{formatCurrency(performance.totalDiscount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Achieved Sales</p>
              <p className="font-bold text-lg text-green-600">{formatCurrency(performance.achievedSales)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Orders</p>
              <p className="font-bold text-lg">{performance.totalOrders}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg. Order Value</p>
              <p className="font-bold text-lg">{formatCurrency(performance.avgOrderValue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Conversion Rate</p>
              <p className="font-bold text-lg">{performance.conversionRate}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceCard;