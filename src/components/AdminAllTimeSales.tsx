"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { Banknote, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

const AdminAllTimeSales = () => {
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAllTimeSales = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount');

      if (error) {
        throw new Error(`Failed to fetch all-time sales: ${error.message}`);
      }

      const total = (data || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);
      setTotalSales(total);

    } catch (error: any) {
      console.error('Error fetching all-time sales data:', error);
      showError(error.message || 'An unexpected error occurred while fetching sales data.');
      setTotalSales(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTimeSales();
  }, [fetchAllTimeSales]);

  return (
    <Card className="bg-card text-card-foreground shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">All-Time Sales</CardTitle>
        <Banknote className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
            <p className="text-xs text-muted-foreground">Total revenue from all orders.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAllTimeSales;