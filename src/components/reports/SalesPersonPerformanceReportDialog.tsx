"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
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
  const today = new Date();
  const [filterMonth, setFilterMonth] = useState<string>((today.getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState<string>(today.getFullYear().toString());
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      const salesPersonOptions = (profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name || ''}`.trim() }));
      setAllSalesPersons(salesPersonOptions);

      const salesPersonMap = new Map(profilesData.map(p => [p.id, `${p.first_name} ${p.last_name || ''}`.trim()]));
      const yearNum = parseInt(filterYear);
      const reportData: SalesPersonPerformance[] = [];

      const personsToReport = filterSalesPersonId ? profilesData.filter(p => p.id === filterSalesPersonId) : profilesData;

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
        (yearlyTargetsData || []).forEach(target => {
          const key = `${target.sales_person_id}-${target.target_month}`;
          monthlyTargetsByPersonAndMonth.set(key, (monthlyTargetsByPersonAndMonth.get(key) || 0) + target.target_amount);
        });

        personsToReport.forEach(person => {
          for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
            const monthDate = new Date(Date.UTC(yearNum, monthIndex, 1));
            const monthKey = monthDate.toISOString().split('T')[0];
            const displayMonthName = getMonthName((monthIndex + 1).toString());
            const key = `${person.id}-${monthKey}`;
            const achievedSales = monthlySalesByPersonAndMonth.get(key) || 0;
            const targetAmount = monthlyTargetsByPersonAndMonth.get(key) || 0;
            const pendingSales = targetAmount - achievedSales;

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
        (targetsData || []).forEach(t => {
          targetsByPerson[t.sales_person_id] = (targetsByPerson[t.sales_person_id] || 0) + t.target_amount;
        });

        personsToReport.forEach(person => {
          const achievedSales = salesByPerson[person.id] || 0;
          const targetAmount = targetsByPerson[person.id] || 0;
          const pendingSales = targetAmount - achievedSales;
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

      reportData.sort((a, b) => {
        const nameCompare = a.salesPersonName.localeCompare(b.salesPersonName);
        if (nameCompare !== 0) return nameCompare;
        if (filterMonth === "all") {
          const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
        }
        return 0;
      });

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
    }
  }, [isOpen, fetchPerformanceData]);

  const handleClearFilters = () => {
    setFilterMonth((today.getMonth() + 1).toString());
    setFilterYear(today.getFullYear().toString());
    setFilterSalesPersonId('');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = [...new Set(performanceData.map(p => p.id))];
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handlePrint = () => {
    if (selectedIds.length === 0) {
      showError("Please select at least one sales person to print.");
      return;
    }
    
    const dataToPrint = performanceData.filter(item => selectedIds.includes(item.id));

    const doc = new jsPDF({ orientation: 'landscape' });
    const reportPeriod = filterMonth === "all" ? `Year ${filterYear} - Monthly Breakdown` : `${getMonthName(filterMonth)} ${filterYear}`;
    doc.setFontSize(18);
    doc.text(`Sales Person Performance Report - ${reportPeriod}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = ["Sales Person", "Month", "Year", "Target Amount", "Achieved Sales", "Pending Sales"];
    const tableRows = dataToPrint.map(item => [
      item.salesPersonName,
      item.month,
      item.year,
      `₹${item.targetAmount.toFixed(2)}`,
      `₹${item.achievedSales.toFixed(2)}`,
      `₹${item.pendingSales.toFixed(2)}`,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      margin: { top: 25, left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' },
        5: { cellWidth: 35, halign: 'right' },
      }
    });

    doc.save(`selected_sales_performance_report.pdf`);
  };

  const allIdsInView = [...new Set(performanceData.map(p => p.id))];
  const isAllSelected = allIdsInView.length > 0 && allIdsInView.every(id => selectedIds.includes(id));

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
                {allSalesPersons.map(sp => (
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
                    <TableHead className="text-muted-foreground">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground">Month</TableHead>
                    <TableHead className="text-muted-foreground">Year</TableHead>
                    <TableHead className="text-muted-foreground text-right">Target Amount</TableHead>
                    <TableHead className="text-muted-foreground text-right">Achieved Sales</TableHead>
                    <TableHead className="text-muted-foreground text-right">Pending Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.map((item, index) => (
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
                    </TableRow>
                  ))}
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