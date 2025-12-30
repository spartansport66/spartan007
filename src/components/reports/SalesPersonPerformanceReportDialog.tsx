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
import { showError } from '@/utils/toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface SalesPersonPerformance {
  id: string;
  salesPersonName: string;
  totalSales: number;
  monthlyTarget: number; // This will be yearly target if 'all months' is selected
  achievedSales: number; // This will be yearly achieved if 'all months' is selected
  pendingSales: number; // This will be yearly pending if 'all months' is selected
}

interface SalesPersonOption {
  value: string;
  label: string;
}

interface SalesPersonPerformanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const getMonthName = (monthNum: string) => {
  if (monthNum === "all") return "All Months";
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
  const [allSalesPersons, setAllSalesPersons] = useState<SalesPersonOption[]>([]);

  const today = new Date();
  const [filterMonth, setFilterMonth] = useState<string>((today.getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState<string>(today.getFullYear().toString());
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');

  const fetchPerformanceData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all sales persons
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
      const salesPersonOptions = (profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }));
      setAllSalesPersons(salesPersonOptions);

      const salesPersonMap = new Map(profilesData.map(p => [p.id, `${p.first_name} ${p.last_name}`]));
      const salesPersonIds = profilesData.map(p => p.id);

      // Determine date range based on filterMonth and filterYear
      let startPeriod: string;
      let endPeriod: string;
      let targetMonthFilter: string | null = null;

      const yearNum = parseInt(filterYear);

      if (filterMonth === "all") {
        startPeriod = new Date(Date.UTC(yearNum, 0, 1)).toISOString(); // January 1st of the selected year
        endPeriod = new Date(Date.UTC(yearNum + 1, 0, 0, 23, 59, 59, 999)).toISOString(); // Last day of December of the selected year
      } else {
        const monthNum = parseInt(filterMonth);
        startPeriod = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString();
        endPeriod = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999)).toISOString();
        targetMonthFilter = new Date(Date.UTC(yearNum, monthNum - 1, 1)).toISOString().split('T')[0];
      }

      // Fetch all sales for the selected period
      let salesQuery = supabase
        .from('sales')
        .select(`
          total_price,
          orders (user_id)
        `)
        .gte('sale_date', startPeriod)
        .lte('sale_date', endPeriod);

      if (filterSalesPersonId) {
        salesQuery = salesQuery.eq('orders.user_id', filterSalesPersonId);
      }

      const { data: salesData, error: salesError } = await salesQuery;

      if (salesError) {
        console.error('Error fetching sales data:', salesError.message);
        showError('Failed to load sales data for report.');
        setPerformanceData([]);
        setLoading(false);
        return;
      }

      // Aggregate sales by sales person
      const salesByPerson: { [key: string]: number } = {};
      (salesData || []).forEach((sale: any) => {
        const userId = sale.orders?.user_id;
        if (userId) {
          salesByPerson[userId] = (salesByPerson[userId] || 0) + sale.total_price;
        }
      });

      // Fetch targets for the selected period
      let targetsQuery = supabase
        .from('sales_targets')
        .select('sales_person_id, target_amount');

      if (filterMonth === "all") {
        // For "All Months", fetch all targets within the year and sum them up
        targetsQuery = targetsQuery
          .gte('target_month', new Date(Date.UTC(yearNum, 0, 1)).toISOString().split('T')[0])
          .lte('target_month', new Date(Date.UTC(yearNum, 11, 1)).toISOString().split('T')[0]); // Last month of the year
      } else if (targetMonthFilter) {
        targetsQuery = targetsQuery.eq('target_month', targetMonthFilter);
      }

      if (filterSalesPersonId) {
        targetsQuery = targetsQuery.eq('sales_person_id', filterSalesPersonId);
      } else {
        targetsQuery = targetsQuery.in('sales_person_id', salesPersonIds);
      }

      const { data: targetsData, error: targetsError } = await targetsQuery;

      if (targetsError) {
        console.error('Error fetching targets data:', targetsError.message);
        showError('Failed to load targets data for report.');
        setPerformanceData([]);
        setLoading(false);
        return;
      }

      const targetsByPerson: { [key: string]: number } = {};
      (targetsData || []).forEach(t => {
        targetsByPerson[t.sales_person_id] = (targetsByPerson[t.sales_person_id] || 0) + t.target_amount;
      });

      const reportData: SalesPersonPerformance[] = [];
      const personsToReport = filterSalesPersonId ? profilesData.filter(p => p.id === filterSalesPersonId) : profilesData;

      personsToReport.forEach(person => {
        const achievedSales = salesByPerson[person.id] || 0;
        const monthlyTarget = targetsByPerson[person.id] || 0; // This will be yearly if 'all months'
        const pendingSales = monthlyTarget - achievedSales;

        reportData.push({
          id: person.id,
          salesPersonName: salesPersonMap.get(person.id) || 'Unknown',
          totalSales: achievedSales, // This is the achieved sales for the month/year
          monthlyTarget: monthlyTarget,
          achievedSales: achievedSales,
          pendingSales: pendingSales,
        });
      });

      setPerformanceData(reportData.sort((a, b) => b.totalSales - a.totalSales)); // Sort by total sales descending
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

  const handlePrint = () => {
    const doc = new jsPDF();
    const reportPeriod = filterMonth === "all" ? `Year ${filterYear}` : `${getMonthName(filterMonth)} ${filterYear}`;
    doc.setFontSize(18);
    doc.text(`Sales Person Performance Report - ${reportPeriod}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = ["Sales Person", "Target Amount", "Achieved Sales", "Pending Sales"];
    const tableRows = performanceData.map(item => [
      item.salesPersonName,
      `₹${item.monthlyTarget.toFixed(2)}`,
      `₹${item.achievedSales.toFixed(2)}`,
      `₹${item.pendingSales.toFixed(2)}`,
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      margin: { top: 25 },
    });

    doc.save(`sales_person_performance_report_${filterMonth}_${filterYear}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
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
                <SelectItem value="all">All Months</SelectItem> {/* Added 'All Months' option */}
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
            <Select 
              value={filterSalesPersonId || "all"}
              onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}
            >
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
                    <TableHead className="text-muted-foreground">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground text-right">Target Amount</TableHead>
                    <TableHead className="text-muted-foreground text-right">Achieved Sales</TableHead>
                    <TableHead className="text-muted-foreground text-right">Pending Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{item.salesPersonName}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{item.monthlyTarget.toFixed(2)}</TableCell>
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
          <Button variant="outline" onClick={handlePrint} disabled={performanceData.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonPerformanceReportDialog;