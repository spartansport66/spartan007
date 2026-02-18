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

interface DailySale {
  id: string; // Composite key: sales_person_id-date
  salesPersonId: string;
  salesPersonName: string;
  date: string;
  totalSales: number;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonDailySalesReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortKey = 'salesPersonName' | 'date' | 'totalSales';

const SalesPersonDailySalesReportDialog: React.FC<SalesPersonDailySalesReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [reportData, setReportData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [filterFromDate, setFilterFromDate] = useState<string>(today);
  const [filterToDate, setFilterToDate] = useState<string>(today);
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all sales persons profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      if (profilesError) throw profilesError;
      setAllSalesPersons((profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name || ''}`.trim() })));

      // 2. Fetch orders within the date range
      let query = supabase
        .from('orders')
        .select(`total_amount, user_id`)
        .gte('order_date', `${filterFromDate}T00:00:00.000Z`)
        .lte('order_date', `${filterToDate}T23:59:59.999Z`);

      if (filterSalesPersonId) {
        query = query.eq('user_id', filterSalesPersonId);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      // 3. Aggregate sales by salesperson ID for the entire period
      const salesByPerson: { [key: string]: number } = (ordersData || []).reduce((acc: any, order: any) => {
        if (order.user_id) {
          acc[order.user_id] = (acc[order.user_id] || 0) + order.total_amount;
        }
        return acc;
      }, {});

      // 4. Determine the date string for the report
      const from = new Date(filterFromDate);
      const to = new Date(filterToDate);
      // Adjust for timezone offset to display local date correctly
      from.setMinutes(from.getMinutes() + from.getTimezoneOffset());
      to.setMinutes(to.getMinutes() + to.getTimezoneOffset());

      const dateRangeString = from.toDateString() === to.toDateString()
        ? from.toLocaleDateString()
        : `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;

      // 5. Create report data for ALL salespersons
      const reportData: DailySale[] = (profilesData || [])
        .map(profile => {
          // If a specific salesperson is filtered, only include them
          if (filterSalesPersonId && profile.id !== filterSalesPersonId) {
            return null;
          }
          
          const totalSales = salesByPerson[profile.id] || 0;
          return {
            id: `${profile.id}-${dateRangeString}`, // Make ID unique for the period
            salesPersonId: profile.id,
            salesPersonName: `${profile.first_name} ${profile.last_name || ''}`.trim(),
            date: dateRangeString, // Use the date range as the "date"
            totalSales: totalSales,
          };
        })
        .filter((item): item is DailySale => item !== null);

      setReportData(reportData);
    } catch (error: any) {
      showError(`Failed to load report data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterFromDate, filterToDate, filterSalesPersonId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      fetchCompanyInfo();
    }
  }, [isOpen, fetchData, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterFromDate(today);
    setFilterToDate(today);
    setFilterSalesPersonId('');
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    return [...reportData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [reportData, sortKey, sortDirection]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedData.map(d => d.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(selectedId => selectedId !== id));
  };

  const handlePrint = (dataToPrint: DailySale[]) => {
    if (dataToPrint.length === 0) {
      showError("No data selected to print.");
      return;
    }
    try {
      const doc = new jsPDF();
      doc.text("Sales Person Daily Sales Report", 14, 22);
      autoTable(doc, {
        head: [['Sales Person', 'Date', 'Total Sales (₹)']],
        body: dataToPrint.map(d => [d.salesPersonName, d.date, d.totalSales.toFixed(2)]),
        startY: 30,
      });
      doc.save('daily_sales_report.pdf');
      showSuccess('Report generated successfully!');
    } catch (error: any) {
      showError(`Failed to generate PDF: ${error.message}`);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sales Person Daily Sales Report</DialogTitle>
          <DialogDescription>View daily sales performance for each salesperson.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]"><Label>From Date</Label><Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} /></div>
          <div className="flex-1 min-w-[150px]"><Label>To Date</Label><Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} /></div>
          <div className="flex-1 min-w-[180px]"><Label>Sales Person</Label><Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}><SelectTrigger><SelectValue placeholder="All Sales Persons" /></SelectTrigger><SelectContent><SelectItem value="all">All Sales Persons</SelectItem>{allSalesPersons.map(sp => (<SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>))}</SelectContent></Select></div>
          <Button onClick={fetchData}><Search className="h-4 w-4 mr-2" /> Apply</Button>
          <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : sortedData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales data found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Checkbox checked={selectedIds.length === sortedData.length} onCheckedChange={handleSelectAll} /></TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('salesPersonName')}><div className="flex items-center">Sales Person <SortIcon column="salesPersonName" /></div></TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('date')}><div className="flex items-center">Date <SortIcon column="date" /></div></TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('totalSales')}><div className="flex items-center justify-end">Total Sales <SortIcon column="totalSales" /></div></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)} /></TableCell>
                      <TableCell>{item.salesPersonName}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell className="text-right font-medium">₹{item.totalSales.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => handlePrint(sortedData.filter(d => selectedIds.includes(d.id)))} disabled={selectedIds.length === 0}><Printer className="mr-2 h-4 w-4" /> Print Selected ({selectedIds.length})</Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonDailySalesReportDialog;