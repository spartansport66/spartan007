"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface SalesPersonSalesData {
  salesPerson: string;
  totalSales: number;
  id: string; // Include ID for internal use
}

interface SalesPersonOption {
  value: string;
  label: string;
}

interface SalesPersonPerformanceChartProps {
  data: SalesPersonSalesData[];
  salesPersonsOptions: SalesPersonOption[];
  selectedSalesPersonId: string | null;
  onSelectSalesPerson: (id: string | null) => void;
  currentMonthTarget: number | null;
  currentMonthAchieved: number | null;
  currentMonthPending: number | null;
}

const SalesPersonPerformanceChart: React.FC<SalesPersonPerformanceChartProps> = ({
  data,
  salesPersonsOptions,
  selectedSalesPersonId,
  onSelectSalesPerson,
  currentMonthTarget,
  currentMonthAchieved,
  currentMonthPending,
}) => {
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-semibold text-primary">Sales by Sales Person</CardTitle>
            <CardDescription className="text-muted-foreground">
              Current Month: {currentMonthName}
            </CardDescription>
          </div>
          <Select
            value={selectedSalesPersonId || "all"}
            onValueChange={(value) => onSelectSalesPerson(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Sales Person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sales Persons</SelectItem>
              {salesPersonsOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 10,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="salesPerson" className="text-sm text-muted-foreground" />
            <YAxis className="text-sm text-muted-foreground" />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => `₹${value.toFixed(2)}`}
            />
            <Bar dataKey="totalSales" fill="hsl(var(--accent))" />
          </BarChart>
        </ResponsiveContainer>

        {selectedSalesPersonId && (
          <div className="mt-6 p-4 border rounded-md bg-muted/50">
            <h4 className="text-lg font-semibold mb-2">
              Performance for {salesPersonsOptions.find(opt => opt.value === selectedSalesPersonId)?.label || 'Selected Sales Person'}
            </h4>
            <Separator className="my-2" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Monthly Target:</p>
                <p className="font-bold text-primary">₹{currentMonthTarget !== null ? currentMonthTarget.toFixed(2) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Achieved Sales:</p>
                <p className="font-bold text-green-600">₹{currentMonthAchieved !== null ? currentMonthAchieved.toFixed(2) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pending Sales:</p>
                <p className={`font-bold ${currentMonthPending !== null && currentMonthPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{currentMonthPending !== null ? currentMonthPending.toFixed(2) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceChart;