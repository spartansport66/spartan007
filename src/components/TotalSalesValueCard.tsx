"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { DollarSign, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

const TotalSalesValueCard = () => {
  const [monthlySales, setMonthlySales] = useState(0);
  const [percentageChange, setPercentageChange] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSalesData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      // Helper to calculate post-discount total from a set of orders
      const calculatePostDiscountTotal = (orders: { subtotal: number | null; discount: number | null; }[]) => {
        return (orders || []).reduce((sum, order) => {
          const subtotal = order.subtotal || 0;
          const discount = order.discount || 0;
          return sum + (subtotal - discount);
        }, 0);
      };

      // Fetch current month's sales
      const { data: currentMonthData, error: currentMonthError } = await supabase
        .from('orders')
        .select('subtotal, discount')
        .gte('created_at', currentMonthStart);

      if (currentMonthError) throw new Error(`Failed to fetch current month sales: ${currentMonthError.message}`);
      
      const currentMonthTotal = calculatePostDiscountTotal(currentMonthData);
      setMonthlySales(currentMonthTotal);

      // Fetch last month's sales
      const { data: lastMonthData, error: lastMonthError } = await supabase
        .from('orders')
        .select('subtotal, discount')
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd);

      if (lastMonthError) throw new Error(`Failed to fetch last month sales: ${lastMonthError.message}`);

      const lastMonthTotal = calculatePostDiscountTotal(lastMonthData);

      // Calculate percentage change
      if (lastMonthTotal > 0) {
        const change = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
        setPercentageChange(change);
      } else if (currentMonthTotal > 0) {
        setPercentageChange(100); 
      } else {
        setPercentageChange(0);
      }

    } catch (error: any) {
      console.error('Error fetching sales data:', error);
      showError(error.message || 'An unexpected error occurred while fetching sales data.');
      setMonthlySales(0);
      setPercentageChange(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  return (
    <Card className="bg-card text-card-foreground shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Sales (Current Month)</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{formatCurrency(monthlySales)}</div>
            <p className="text-xs text-muted-foreground">
              {percentageChange >= 0 ? '+' : ''}
              {percentageChange.toFixed(1)}% from last month
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalSalesValueCard;