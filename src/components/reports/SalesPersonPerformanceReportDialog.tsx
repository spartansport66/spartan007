"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Checkbox } from '@/components/ui/checkbox';

interface SalesPersonPerformance {
  id: string; // Sales person ID
  salesPersonName: string;
  month: string; // e.g., "January", "February", or "Yearly Total" if aggregated
  year: string;
  targetAmount: number;
  achievedSales: number;
  pendingSales: number;
}

type SortKey = keyof SalesPersonPerformance | 'performance';

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonPerformanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const getMonthName = (monthNum: string) => {
  if (monthNum === "all") return "Yearly Total";
  const date = new Date(Date.UTC(2000, parseInt(monthNum) - 1, 1));
  return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
};

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 5; i++) {
    years.push(i.toString());
  }
  return years;
};

const SalesPersonPerformanceReportDialog: React.FC<SalesPersonPerformanceReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [performanceData, setPerformanceData] = useState<SalesPersonPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const today = new Date();
  const [filterMonth, setFilterMonth] = useState<string>((today.getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState<string>(today.getFullYear().toString());
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('salesPersonName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchPerformanceData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      if (profilesError) {
        console.error('Error fetching sales persons:', profilesError.message);
        showError('Failed to load sales persons for report.');
        setAllSalesPersons([]);
        setPerformanceData([]);
        setLoading(false);
        return;
      }
      const salesPersonOptions = (profilesData || []).map((p: { id: string; first_name: string; last_name: string | null; }) => ({ value: p.id, label: `${p.first_name} ${p.last_name || ''}`.trim() }));
      setAllSalesPersons(salesPersonOptions);

      const salesPersonMap = new Map(profilesData.map((p: { id: string; first_name: string; last_name: string | null; }) => [p.id, `${p.first_name} ${p.last_name || ''}`.trim()]));
      const yearNum = parseInt(filterYear);
      const reportData: SalesPersonPerformance[] = [];

      const personsToReport = filterSalesPersonId ? profilesData.filter((p: { id: string; }) => p.id === filterSalesPersonId) : profilesData;

      if (filterMonth === "all") {
        const startOfYear = new Date(Date.UTC(yearNum, 0, 1)).toISOString();
        const endOfYear = new Date(Date.UTC(yearNum + 1, 0, 0, 23, 59, 59, 999)).toISOString();

        const { data: yearlySalesData, error: yearlySalesError } = await supabase
          .from('sales')
          .select(`total_price, sale_date, orders (user_id)`)
          .gte('sale_date', startOfYear)
          .lte('sale_date', endOfYear);
        if (yearlySalesError) throw new Error(`Failed to fetch yearly sales data: ${yearlySalesError.message}`);

        const { data: yearlyTargetsData, error: yearlyTargetsError } = await supabase
          .from('sales_targets')
          .select('sales_person_id, target_amount, target_month')
          .gte('target_month', new Date(Date.UTC(yearNum, 0, 1)).toISOString().split('T')[0])
          .lte('target_month', new Date(Date.UTC(yearNum, 11, 1)).toISOString().split('T')[0]);
        if (yearlyTargetsError) throw new Error(`Failed to fetch yearly targets data: ${yearlyTargetsError.message}`);

        const monthlySalesByPersonAndMonth = new Map<string, number>();
        (yearlySalesData || []).forEach((sale: any) => {
          const userId = sale.orders?.user_id;
          if (userId) {
            const saleDate = new Date(sale.sale_date);
            const monthKey = new Date(Date.UTC(saleDate.getFullYear(), saleDate.getMonth(), 1)).toISOString().split('T')[0];
            const key = `${userId}-${monthKey}`;
            monthlySalesByPersonAndMonth.set(key, (monthlySalesByPersonAndMonth.get(key) || 0) + sale.total_price);
          }
        });

        const monthlyTargetsByPersonAndMonth = new Map<string, number>();
        (yearlyTargetsData || []).forEach((target: { sales_person_id: string; target_month: string; target_amount: number; }) => {
          const key = `${target.sales_person_id}-${target.target_month}`;
          monthlyTargetsByPersonAndMonth.set(key, (monthlyTargetsByPersonAndMonth.get(key) || 0) + target.target_amount);
        });

        personsToReport.forEach((person: { id: string; }) => {
          for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
            const monthDate = new Date(Date.UTC(yearNum, monthIndex, 1));
            const monthKey = monthDate.toISOString().split('T')[0];
            const displayMonthName = getMonthName((monthIndex + 1).toString());
            const key = `${person.id}-${monthKey}`;
            const achievedSales = monthlySalesByPersonAndMonth.get(key) || 0;
            const targetAmount = monthlyTargetsByPersonAndMonth.get(key) || 0;
            const pendingSales = Math.max(0, targetAmount - achievedSales);

            reportData.push({
              id: person.id,
              salesPersonName: salesPersonMap.get(person.id) || 'Unknown',
              month: displayMonthName,
              year: filterYear,
              targetAmount: targetAmount,
              achievedSales: achievedSales,
              pendingSales: pendingSales,
            });
          }
        });
      } else {
        const monthNum = parseInt(filterMonth);
        const startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString();
        const endOfMonth = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999)).toISOString();
        const targetMonthFilterDate = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString().split('T')[0];

        let salesQuery = supabase
          .from('sales')
          .select(`total_price, orders (user_id)`)
          .gte('sale_date', startOfMonth)
          .lte('sale_date', endOfMonth);
        if (filterSalesPersonId) salesQuery = salesQuery.eq('orders.user_id', filterSalesPersonId);
        const { data: salesData, error: salesError } = await salesQuery;
        if (salesError) throw new Error(`Failed to fetch sales data: ${salesError.message}`);

        const salesByPerson: { [key: string]: number } = {};
        (salesData || []).forEach((sale: any) => {
          const userId = sale.orders?.user_id;
          if (userId) salesByPerson[userId] = (salesByPerson[userId] || 0) + sale.total_price;
        });

        let targetsQuery = supabase
          .from('sales_targets')
          .select('sales_person_id, target_amount')
          .eq('target_month', targetMonthFilterDate);
        if (filterSalesPersonId) targetsQuery = targetsQuery.eq('sales_person_id', filterSalesPersonId);
        const { data: targetsData, error: targetsError } = await targetsQuery;
        if (targetsError) throw new Error(`Failed to fetch targets data: ${targetsError.message}`);

        const targetsByPerson: { [key: string]: number } = {};
        (targetsData || []).forEach((t: { sales_person_id: string; target_amount: number; }) => {
          targetsByPerson[t.sales_person_id] = (targetsByPerson[t.sales_person_id] || 0) + t.target_amount;
        });

        personsToReport.forEach((person: { id: string; }) => {
          const achievedSales = salesByPerson[person.id] || 0;
          const targetAmount = targetsByPerson[person.id] || 0;
          const pendingSales = Math.max(0, targetAmount - achievedSales);
          reportData.push({
            id: person.id,
            salesPersonName: salesPersonMap.get(person.id) || 'Unknown',
            month: getMonthName(filterMonth),
            year: filterYear,
            targetAmount: targetAmount,
            achievedSales: achievedSales,
            pendingSales: pendingSales,
          });
        });
      }

      setPerformanceData(reportData);
    } catch (error: any) {
      console.error('Error in fetchPerformanceData:', error.message);
      showError('An unexpected error occurred while fetching performance data.');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterSalesPersonId]);

  useEffect(() => {
    if (isOpen) {
      fetchPerformanceData();
      fetchCompanyInfo();
    }
  }, [isOpen, fetchPerformanceData, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterMonth((today.getMonth() + 1).toString());
    setFilterYear(today.getFullYear().toString());
    setFilterSalesPersonId('');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = [...new Set(performanceData.map((p: SalesPersonPerformance) => p.id))];
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev: string[]) => [...prev, id]);
    } else {
      setSelectedIds((prev: string[]) => prev.filter((selectedId: string) => selectedId !== id));
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedPerformanceData = useMemo(() => {
    if (performanceData.length === 0) return [];
    return [...performanceData].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortKey === 'month') {
        const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Yearly Total"];
        valA = monthOrder.indexOf(a.month);
        valB = monthOrder.indexOf(b.month);
      } else if (sortKey === 'performance') {
        valA = a.targetAmount > 0 ? (a.achievedSales / a.targetAmount) * 100 : 0;
        valB = b.targetAmount > 0 ? (b.achievedSales / b.targetAmount) * 100 : 0;
      } else {
        valA = a[sortKey as keyof SalesPersonPerformance];
        valB = b[sortKey as keyof SalesPersonPerformance];
      }

      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [performanceData, sortKey, sortDirection]);

  const handlePrint = () => {
    if (selectedIds.length === 0) {
      showError("Please select at least one sales person to print.");
      return;
    }
    
    const dataToPrint = sortedPerformanceData.filter((item: SalesPersonPerformance) => selectedIds.includes(item.id));

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      let yPos = 15;

      const companyNameText = companyName ? companyName.toUpperCase() : "PERFORMANCE REPORT";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(companyNameText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      
      const reportPeriod = filterMonth === "all" ? `Year ${filterYear} - Monthly Breakdown` : `${getMonthName(filterMonth)} ${filterYear}`;
      doc.setFontSize(14);
      doc.text(`Sales Person Performance - ${reportPeriod}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      doc.setTextColor(0);

      // --- START: GRAPH GENERATION ---
      const performanceSummary = dataToPrint.reduce((acc: Record<string, { target: number; achieved: number }>, item: SalesPersonPerformance) => {
        if (!acc[item.salesPersonName]) {
          acc[item.salesPersonName] = { target: 0, achieved: 0 };
        }
        acc[item.salesPersonName].target += item.targetAmount;
        acc[item.salesPersonName].achieved += item.achievedSales;
        return acc;
      }, {} as Record<string, { target: number; achieved: number }>);

      const chartData = Object.entries(performanceSummary).map(([name, data]: [string, { target: number; achieved: number }]) => ({
        name,
        performance: data.target > 0 ? Math.min(100, (data.achieved / data.target) * 100) : 0,
      })).sort((a, b) => b.performance - a.performance);

      doc.setFontSize(12);
      doc.text("Performance Overview", margin, yPos);
      yPos += 8;

      const chartX = margin;
      const chartY = yPos;
      const chartWidth = pageWidth - margin * 2;
      const maxBarWidth = chartWidth - 50; // Space for labels
      const barHeight = 10;
      const barSpacing = 5;

      doc.setFontSize(8);
      doc.setDrawColor(200);
      doc.line(chartX + 50, chartY - 2, chartX + 50, chartY + chartData.length * (barHeight + barSpacing)); // Y-axis
      doc.line(chartX + 50, chartY + chartData.length * (barHeight + barSpacing), chartX + 50 + maxBarWidth, chartY + chartData.length * (barHeight + barSpacing)); // X-axis

      for (let i = 0; i <= 10; i++) {
        const x = chartX + 50 + (i * (maxBarWidth / 10));
        doc.setDrawColor(220);
        doc.line(x, chartY - 2, x, chartY + chartData.length * (barHeight + barSpacing));
        doc.text(`${i * 10}%`, x, chartY + chartData.length * (barHeight + barSpacing) + 4, { align: 'center' });
      }

      chartData.forEach((data, index) => {
        const barY = chartY + index * (barHeight + barSpacing);
        const barWidth = (data.performance / 100) * maxBarWidth;
        
        doc.setFont("helvetica", "bold");
        doc.text(data.name, chartX + 48, barY + barHeight / 2 + 2, { align: 'right' });

        doc.setFillColor(30, 58, 138);
        doc.rect(chartX + 50, barY, barWidth, barHeight, 'F');

        doc.setTextColor(255);
        doc.text(`${data.performance.toFixed(1)}%`, chartX + 50 + barWidth - 3, barY + barHeight / 2 + 2, { align: 'right' });
        doc.setTextColor(0);
      });
      // --- END: GRAPH GENERATION ---

      doc.addPage();
      yPos = 15; // Reset yPos for the new page

      const tableColumn = ["Sales Person", "Month", "Year", "Target Amount", "Achieved Sales", "Pending Sales", "Performance %"];
      const tableRows = dataToPrint.map((item: SalesPersonPerformance) => {
        const performance = item.targetAmount > 0 ? (item.achievedSales / item.targetAmount) * 100 : 0;
        return [
          item.salesPersonName,
          item.month,
          item.year,
          `Rs. ${item.targetAmount.toFixed(2)}`,
          `Rs. ${item.achievedSales.toFixed(2)}`,
          `Rs. ${item.pendingSales.toFixed(2)}`,
          `${performance.toFixed(2)}%`,
        ];
      });

      const totalTarget = dataToPrint.reduce((sum: number, item: SalesPersonPerformance) => sum + item.targetAmount, 0);
      const totalAchieved = dataToPrint.reduce((sum: number, item: SalesPersonPerformance) => sum + item.achievedSales, 0);
      const totalPending = Math.max(0, totalTarget - totalAchieved);
      const overallPerformance = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Totals', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
            `Rs. ${totalTarget.toFixed(2)}`,
            `Rs. ${totalAchieved.toFixed(2)}`,
            `Rs. ${totalPending.toFixed(2)}`,
            `${overallPerformance.toFixed(2)}%`,
          ]
        ],
        startY: yPos,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 138], // Dark blue
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        footStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        bodyStyles: {
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle',
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Sales Person
          1: { cellWidth: 25 }, // Month
          2: { cellWidth: 20, halign: 'center' }, // Year
          3: { cellWidth: 30, halign: 'right' }, // Target
          4: { cellWidth: 30, halign: 'right' }, // Achieved
          5: { cellWidth: 30, halign: 'right' }, // Pending
          6: { cellWidth: 30, halign: 'right' }, // Performance %
        }
      });

      doc.save(`selected_sales_performance_report.pdf`);
      showSuccess('Report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  const allIdsInView = [...new Set(performanceData.map((p: SalesPersonPerformance) => p.id))];
  const isAllSelected = allIdsInView.length > 0 && allIdsInView.every(id => selectedIds.includes(id));

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sales Person Performance Report</DialogTitle>
          <DialogDescription>
            Generate a report on sales person performance, targets, and achievements for a selected month or year.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[120px]">
            <Label htmlFor="filterMonth">Month</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger id="filterMonth" className="w-full">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map((monthNum) => (
                  <SelectItem key={monthNum} value={monthNum}>
                    {getMonthName(monthNum)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterYear">Year</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger id="filterYear" className="w-full">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {generateYears().map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterSalesPerson">Sales Person</Label>
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterSalesPerson" className="w-full">
                <SelectValue placeholder="All Sales Persons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {allSalesPersons.map((sp: FilterOption) => (
                  <SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchPerformanceData} className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading performance data...</p>
            </div>
          ) : performanceData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No performance data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead>
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:bg-muted/80" onClick={() => handleSort('salesPersonName')}><div className="flex items-center">Sales Person <SortIcon column="salesPersonName" /></div></TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:bg-muted/80" onClick={() => handleSort('month')}><div className="flex items-center">Month <SortIcon column="month" /></div></TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer hover:bg-muted/80" onClick={() => handleSort('year')}><div className="flex items-center">Year <SortIcon column="year" /></div></TableHead>
                    <TableHead className="text-muted-foreground text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('targetAmount')}><div className="flex items-center justify-end">Target Amount <SortIcon column="targetAmount" /></div></TableHead>
                    <TableHead className="text-muted-foreground text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('achievedSales')}><div className="flex items-center justify-end">Achieved Sales <SortIcon column="achievedSales" /></div></TableHead>
                    <TableHead className="text-muted-foreground text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('pendingSales')}><div className="flex items-center justify-end">Pending Sales <SortIcon column="pendingSales" /></div></TableHead>
                    <TableHead className="text-muted-foreground text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('performance')}><div className="flex items-center justify-end">Performance % <SortIcon column="performance" /></div></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPerformanceData.map((item: SalesPersonPerformance, index: number) => {
                    const performance = item.targetAmount > 0 ? (item.achievedSales / item.targetAmount) * 100 : 0;
                    return (
                      <TableRow key={`${item.id}-${item.month}-${index}`} className="hover:bg-accent/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                            aria-label={`Select row for ${item.salesPersonName}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{item.salesPersonName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.month}</TableCell>
                        <TableCell className="text-muted-foreground">{item.year}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{item.targetAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{item.achievedSales.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{item.pendingSales.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground text-right font-bold">{performance.toFixed(2)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={selectedIds.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Selected ({selectedIds.length})
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonPerformanceReportDialog;