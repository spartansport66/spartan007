"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface SalesPersonSalesData {
  salesPerson: string;
  totalSales: number;
  id: string;
}

interface SalesPersonOption {
  value: string;
  label: string;
}

interface SalesPersonPerformanceTableProps {
  data: SalesPersonSalesData[];
  salesPersonsOptions: SalesPersonOption[];
  selectedSalesPersonId: string | null;
  onSelectSalesPerson: (id: string | null) => void;
  currentMonthTarget: number | null;
  currentMonthAchieved: number | null;
  currentMonthPending: number | null;
  displayMonth: string;
  displayYear: string;
  selectedChartMonth: string;
  setSelectedChartMonth: (month: string) => void;
  selectedChartYear: string;
  setSelectedChartYear: (year: string) => void;
  getMonthName: (monthNum: string) => string;
  generateYears: () => string[];
}

const SalesPersonPerformanceTable: React.FC<SalesPersonPerformanceTableProps> = ({
  data,
  salesPersonsOptions,
  selectedSalesPersonId,
  onSelectSalesPerson,
  currentMonthTarget,
  currentMonthAchieved,
  currentMonthPending,
  displayMonth,
  displayYear,
  selectedChartMonth,
  setSelectedChartMonth,
  selectedChartYear,
  setSelectedChartYear,
  getMonthName,
  generateYears,
}) => {
  const currentMonthName = `${displayMonth} ${displayYear}`;

  // Sort data by totalSales in ascending order (least sales at the top)
  const sortedData = [...data].sort((a, b) => a.totalSales - b.totalSales);

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-pink-500 dark:bg-pink-700 text-white rounded-t-lg p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <CardTitle className="text-xl font-semibold">Sales Person Performance</CardTitle>
            <CardDescription className="text-pink-100 dark:text-pink-200">
              Selected Month: {currentMonthName}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedChartMonth} onValueChange={setSelectedChartMonth}>
              <SelectTrigger className="w-[120px] text-foreground"> {/* Added text-foreground */}
                <SelectValue placeholder="Month" className="text-foreground" /> {/* Added text-foreground */}
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map((monthNum) => (
                  <SelectItem key={monthNum} value={monthNum}>
                    {getMonthName(monthNum)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedChartYear} onValueChange={setSelectedChartYear}>
              <SelectTrigger className="w-[100px] text-foreground"> {/* Added text-foreground */}
                <SelectValue placeholder="Year" className="text-foreground" /> {/* Added text-foreground */}
              </SelectTrigger>
              <SelectContent>
                {generateYears().map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedSalesPersonId || "all"}
              onValueChange={(value) => onSelectSalesPerson(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-[180px] text-foreground"> {/* Added text-foreground */}
                <SelectValue placeholder="All Sales Persons" className="text-foreground" /> {/* Added text-foreground */}
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
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {data.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales data available for this month.</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md"> {/* Fixed height for 5 rows + header */}
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-muted-foreground">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((item) => ( // Use sortedData to allow scrolling through all
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.salesPerson}</TableCell>
                      <TableCell className="text-right">₹{item.totalSales.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

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

export default SalesPersonPerformanceTable;