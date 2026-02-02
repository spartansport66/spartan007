import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency, formatLakhs } from '@/utils/formatters';

interface SalesDataPoint {
  month: string;
  sales: number;
}

interface MonthlyBarChartProps {
  data: SalesDataPoint[];
}

// Define a multi-color palette
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ data }) => {
  // Sort data by month/year if possible, or just use the provided order
  const sortedData = [...data].sort((a, b) => {
    // Simple sorting logic based on month string, might need refinement for complex date ranges
    const dateA = new Date(a.month.replace(' ', ' 1, '));
    const dateB = new Date(b.month.replace(' ', ' 1, '));
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={sortedData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="month" stroke="#6b7280" />
        <YAxis 
          stroke="#6b7280"
          // Use formatLakhs to display amounts in lakhs with 2 decimal places
          tickFormatter={(value) => formatLakhs(value)}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          // Keep formatCurrency for the tooltip for full precision
          formatter={(value: number) => [formatCurrency(value), 'Sales']}
        />
        {/* Use Cell component to apply multi-color based on index */}
        <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyBarChart;