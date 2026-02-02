"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { formatCurrency } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesDataPoint {
  name: string; // Month name
  sales: number;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i); // Last 5 years

const getMonthName = (monthIndex: number) => {
  const date = new Date(2000, monthIndex, 1);
  return date.toLocaleString('default', { month: 'short' });
};

const CompanySalesTrendChart: React.FC = () => {
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const fetchSalesData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all orders for the selected year
      const startOfYear = `${selectedYear}-01-01T00:00:00.000Z`;
      const endOfYear = `${selectedYear}-12-31T23:59:59.999Z`;
      
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, order_date')
        .gte('order_date', startOfYear)
        .lte('order_date', endOfYear);

      if (error) {
        throw error;
      }

      // Aggregate by month
      const monthlySales = (data || []).reduce((acc, order) => {
        const date = new Date(order.order_date);
        const month = date.getMonth(); // 0-indexed month
        acc[month] = (acc[month] || 0) + order.total_amount;
        return acc;
      }, {} as { [month: number]: number });

      // Format for chart (ensure all 12 months are present, even if sales are 0)
      const aggregatedData: SalesDataPoint[] = Array.from({ length: 12 }, (_, i) => {
        const monthSales = monthlySales[i] || 0;
        return {
          name: getMonthName(i),
          sales: monthSales,
        };
      });

      setSalesData(aggregatedData);
    } catch (error: any) {
      console.error('Error fetching sales data:', error);
      showError(error.message || 'Failed to fetch sales data.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const handleYearChange = (year: string) => {
    setSelectedYear(Number(year));
  };
  
  const totalSalesForYear = salesData.reduce((sum, point) => sum + point.sales, 0);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full lg:col-span-2">
      <CardHeader className="bg-pink-500 dark:bg-pink-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Company Sales Trend</CardTitle>
            <CardDescription className="text-pink-100 dark:text-pink-200">
              Monthly sales performance for {selectedYear}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={handleYearChange} disabled={loading}>
              <SelectTrigger className="w-[100px] text-foreground bg-white/10 hover:bg-white/20">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading sales data...</p>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-primary">
              Total Sales: {formatCurrency(totalSalesForYear)}
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesData}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-sm text-muted-foreground" />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value).replace('₹', '')} 
                    className="text-sm text-muted-foreground" 
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanySalesTrendChart;