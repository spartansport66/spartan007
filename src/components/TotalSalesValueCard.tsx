"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { DollarSign, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

const TotalSalesValueCard = () => {
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTotalSales = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all orders and select the 'total_amount' column.
      // This column represents the final sale value after discounts.
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount');

      if (error) {
        throw new Error(`Failed to fetch total sales: ${error.message}`);
      }

      // Sum the post-discount 'total_amount' for all orders.
      const calculatedTotal = (data || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);
      setTotalSales(calculatedTotal);

    } catch (error: any) {
      console.error('Error fetching total sales value:', error);
      showError(error.message || 'An unexpected error occurred while fetching total sales.');
      setTotalSales(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotalSales();
  }, [fetchTotalSales]);

  return (
    <Card className="bg-card text-card-foreground shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Sales Value</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
        )}
        <p className="text-xs text-muted-foreground">
          Total revenue from all sales (post-discount).
        </p>
      </CardContent>
    </Card>
  );
};

export default TotalSalesValueCard;