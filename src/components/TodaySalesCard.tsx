"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/formatters';

const TodaySalesCard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [grossSales, setGrossSales] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSalesForDate = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const targetDate = new Date(date);
      // Adjust for timezone to ensure we get the full local day
      const localDate = new Date(targetDate.valueOf() + targetDate.getTimezoneOffset() * 60 * 1000);
      const startOfDay = getStartOfUTCDayISO(localDate);
      const endOfDay = getEndOfUTCDayISO(localDate);

      const { data, error } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('order_date', startOfDay)
        .lte('order_date', endOfDay);

      if (error) throw error;

      const total = (data || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);
      setGrossSales(total);
    } catch (error: any) {
      console.error('Error fetching sales for date:', error.message);
      showError(`Failed to load sales data: ${error.message}`);
      setGrossSales(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesForDate(selectedDate);
  }, [selectedDate, fetchSalesForDate]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Gross Sales</CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          Total sales value for the selected date.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-grow">
            <Label htmlFor="sales-date">Select Date</Label>
            <Input
              id="sales-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <span className="text-4xl font-bold text-green-600">{formatCurrency(grossSales)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaySalesCard;