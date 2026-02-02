import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

interface SalesDataPoint {
  month: string;
  sales: number;
}

interface SalesPersonMonthlySalesChartProps {
  data: SalesDataPoint[];
  salesPersonName: string;
  loading: boolean;
}

// Custom formatter function to convert value to lakhs (100,000) and round to 2 decimal places
const formatLakhs = (value: number) => {
  if (value === 0) return '0 L';
  const lakhs = value / 100000;
  return `${lakhs.toFixed(2)} L`;
};

const SalesPersonMonthlySalesChart: React.FC<SalesPersonMonthlySalesChartProps> = ({ data, salesPersonName, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No sales data available for {salesPersonName} in the selected period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 5,
          right: 10,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis dataKey="month" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="hsl(var(--foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatLakhs} // Apply lakhs formatter here
        />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
          formatter={(value: number) => [formatLakhs(value), 'Sales']} // Apply lakhs formatter here
          labelFormatter={(label) => `Month: ${label}`}
        />
        <Legend />
        <Bar dataKey="sales" fill="hsl(var(--indigo-500))" name="Sales Value" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SalesPersonMonthlySalesChart;