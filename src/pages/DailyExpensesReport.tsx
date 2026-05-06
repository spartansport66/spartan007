"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Trash2, Printer, Plus } from 'lucide-react';

interface ExpenseEntry {
  id: string;
  sales_person_id: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  remarks: string | null;
  receipt_url: string | null;
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

interface SalesPersonOption {
  id: string;
  name: string;
  ta?: number;
}

interface VisitEntry {
  id: string;
  sales_person_id: string;
  dealer_id: string;
  visit_time: string;
  dealers?: { name?: string };
}

interface OrderEntry {
  id: string;
  order_number: number | null;
  user_id: string | null;
  dealer_id: string;
  order_date: string;
  total_amount: number;
  dealers?: { name?: string };
}

const formatCurrency = (amount: number) => `Rs.${amount.toFixed(2)}`;

const formatDate = (value: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const DailyExpensesReport: React.FC = () => {
  const navigate = useNavigate();
  const { loading: sessionLoading, isAdmin, userType } = useSession();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [visits, setVisits] = useState<VisitEntry[]>([]);
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('all');
  const selectedSalesPersonTA = useMemo(() => {
    if (selectedSalesPerson === 'all') return null;
    return salesPersons.find((person) => person.id === selectedSalesPerson)?.ta ?? 0;
  }, [selectedSalesPerson, salesPersons]);

  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    now.setDate(now.getDate() - 7);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'view' | 'add'>('view');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [expenseDate, setExpenseDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [expenseType, setExpenseType] = useState('Fuel');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [newSalesPerson, setNewSalesPerson] = useState('');

  const getDateKey = (value: string) => new Date(value).toISOString().slice(0, 10);
  const getDayName = (value: string) => new Date(value).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const reportRows = useMemo(() => {
    const rows: Array<{ date: string; day: string; dealers: string; orderNumbers: string; ordersReceived: number; ta: number | null; expenses: number; total: number }> = [];
    const from = new Date(fromDate);
    const to = new Date(toDate);

    for (const dateCursor = new Date(from); dateCursor <= to; dateCursor.setDate(dateCursor.getDate() + 1)) {
      const dateKey = `${dateCursor.getFullYear()}-${String(dateCursor.getMonth() + 1).padStart(2, '0')}-${String(dateCursor.getDate()).padStart(2, '0')}`;
      const dayVisits = visits.filter((visit) => getDateKey(visit.visit_time) === dateKey);
      const dayOrders = orders.filter((order) => getDateKey(order.order_date) === dateKey);
      const dayExpenses = entries.filter((entry) => entry.expense_date === dateKey);
      const visitDealerNames = dayVisits.map((visit) => visit.dealers?.name?.trim() || '').filter(Boolean);
      const orderDealerNames = dayOrders.map((order) => order.dealers?.name?.trim() || '').filter(Boolean);
      const allDealerNames = Array.from(new Set([...visitDealerNames, ...orderDealerNames]));
      const dealerNames = allDealerNames.length > 0
        ? allDealerNames
        : (dayVisits.length > 0 || dayOrders.length > 0 ? ['Dealer details unavailable'] : ['-']);

      const orderNumbers = Array.from(new Set(dayOrders.map((order) => order.order_number?.toString() || order.id)));
      const taValue = selectedSalesPersonTA ?? 0;
      const expenseTotal = dayExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      rows.push({
        date: dateKey,
        day: getDayName(dateKey),
        dealers: dealerNames.join(', '),
        orderNumbers: orderNumbers.length > 0 ? orderNumbers.join(', ') : '-',
        ordersReceived: dayOrders.reduce((sum, order) => sum + Number(order.total_amount), 0),
        ta: selectedSalesPersonTA,
        expenses: expenseTotal,
        total: taValue + expenseTotal,
      });
    }

    return rows;
  }, [fromDate, toDate, visits, orders, entries, selectedSalesPersonTA]);

  const totalOrdersReceived = useMemo(() => reportRows.reduce((sum, row) => sum + row.ordersReceived, 0), [reportRows]);
  const totalTA = useMemo(() => reportRows.reduce((sum, row) => sum + (row.ta ?? 0), 0), [reportRows]);
  const totalExpenses = useMemo(() => reportRows.reduce((sum, row) => sum + row.expenses, 0), [reportRows]);
  const totalWithTA = useMemo(() => reportRows.reduce((sum, row) => sum + row.total, 0), [reportRows]);

  useEffect(() => {
    if (!sessionLoading && !isAdmin && userType !== 'super_admin') {
      navigate('/admin-dashboard');
    }
  }, [sessionLoading, isAdmin, userType, navigate]);

  const fetchSalesPersons = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, ta')
        .eq('user_type', 'sales_person')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setSalesPersons((data || []).map((profile: any) => ({
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.id,
        ta: Number(profile.ta) || 0,
      })));
    } catch (error: any) {
      console.error('Error fetching sales person list:', error?.message || error);
    }
  }, []);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${fromDate}T00:00:00.000Z`;
      const endDate = `${toDate}T23:59:59.999Z`;

      let visitsQuery = supabase
        .from('sales_person_visits')
        .select('id, sales_person_id, dealer_id, visit_time, dealers(name)')
        .gte('visit_time', startDate)
        .lte('visit_time', endDate)
        .order('visit_time', { ascending: false });

      let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, user_id, dealer_id, order_date, total_amount, dealers(name)')
        .gte('order_date', startDate)
        .lte('order_date', endDate)
        .order('order_date', { ascending: false });

      let expensesQuery = supabase
        .from('sales_person_daily_expenses')
        .select('id, sales_person_id, expense_date, expense_type, amount, remarks, receipt_url, created_at')
        .gte('expense_date', fromDate)
        .lte('expense_date', toDate)
        .order('expense_date', { ascending: false });

      if (selectedSalesPerson !== 'all') {
        visitsQuery = visitsQuery.eq('sales_person_id', selectedSalesPerson);
        ordersQuery = ordersQuery.eq('user_id', selectedSalesPerson);
        expensesQuery = expensesQuery.eq('sales_person_id', selectedSalesPerson);
      }

      const [visitResult, orderResult, expenseResult] = await Promise.all([visitsQuery, ordersQuery, expensesQuery]);

      if (visitResult.error) throw visitResult.error;
      if (orderResult.error) throw orderResult.error;
      if (expenseResult.error) throw expenseResult.error;

      setVisits((visitResult.data || []) as VisitEntry[]);
      setOrders((orderResult.data || []) as OrderEntry[]);
      setEntries((expenseResult.data || []) as ExpenseEntry[]);
    } catch (error: any) {
      console.error('Error fetching daily expenses report:', error?.message || error);
      showError('Could not load daily expenses report.');
      setVisits([]);
      setOrders([]);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedSalesPerson]);

  useEffect(() => {
    if (!sessionLoading) {
      fetchSalesPersons();
      fetchReportData();
    }
  }, [sessionLoading, fetchSalesPersons, fetchReportData]);

  const handleDelete = async (entryId: string) => {
    const confirmed = window.confirm('Delete this expense entry?');
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('sales_person_daily_expenses')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
      showSuccess('Expense entry deleted.');
      fetchReportData();
    } catch (error: any) {
      console.error('Error deleting expense entry:', error?.message || error);
      showError(`Could not delete expense entry: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newSalesPerson) {
      showError('Please select a salesperson.');
      return;
    }

    const parsedAmount = Number(amount);
    if (!expenseType.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      showError('Please enter a valid expense type and amount.');
      return;
    }

    setSubmitLoading(true);
    try {
      const { error } = await supabase
        .from('sales_person_daily_expenses')
        .insert([
          {
            sales_person_id: newSalesPerson,
            expense_date: expenseDate,
            expense_type: expenseType,
            amount: parsedAmount,
            remarks: remarks || null,
          },
        ]);

      if (error) throw error;
      showSuccess('Expense added successfully.');
      setExpenseType('Fuel');
      setAmount('');
      setRemarks('');
      setNewSalesPerson('');
      const now = new Date();
      setExpenseDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
      setViewMode('view');
      fetchReportData();
    } catch (error: any) {
      console.error('Error adding expense entry:', error?.message || error);
      showError(`Could not add expense: ${error?.message || 'Unknown error'}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Daily Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">View daily visits, order received and expense totals for the selected range.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button variant={viewMode === 'add' ? 'secondary' : 'outline'} size="sm" onClick={() => setViewMode('add')}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
          <Button variant={viewMode === 'view' ? 'secondary' : 'outline'} size="sm" onClick={() => setViewMode('view')}>
            View Summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <Label htmlFor="fromDate" className="text-xs uppercase tracking-widest text-muted-foreground">From</Label>
          <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="text-xs h-9" />
        </div>
        <div>
          <Label htmlFor="toDate" className="text-xs uppercase tracking-widest text-muted-foreground">To</Label>
          <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="text-xs h-9" />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="salesPerson" className="text-xs uppercase tracking-widest text-muted-foreground">Salesperson</Label>
          <Select value={selectedSalesPerson} onValueChange={setSelectedSalesPerson}>
            <SelectTrigger id="salesPerson" className="text-xs h-9">
              <SelectValue placeholder="All salespersons" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="all">All</SelectItem>
              {salesPersons.map((person) => (
                <SelectItem key={person.id} value={person.id} className="text-xs">{person.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewMode === 'add' ? (
        <Card className="bg-card text-card-foreground shadow-lg mb-6">
          <CardHeader className="bg-slate-600 dark:bg-slate-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-lg">Add Expense</CardTitle>
            <CardDescription className="text-xs">Add a new daily expense entry.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="newSalesPerson" className="text-xs uppercase tracking-widest text-muted-foreground">Salesperson</Label>
                <Select value={newSalesPerson} onValueChange={setNewSalesPerson}>
                  <SelectTrigger id="newSalesPerson" className="text-xs h-9">
                    <SelectValue placeholder="Choose salesperson" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {salesPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id} className="text-xs">{person.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseDate" className="text-xs uppercase tracking-widest text-muted-foreground">Date</Label>
                <Input id="expenseDate" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="text-xs h-9" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseType" className="text-xs uppercase tracking-widest text-muted-foreground">Type</Label>
                <Input id="expenseType" value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className="text-xs h-9" placeholder="e.g. Fuel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseAmount" className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
                <Input id="expenseAmount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-xs h-9" placeholder="Enter amount" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="expenseRemarks" className="text-xs uppercase tracking-widest text-muted-foreground">Remarks</Label>
              <Textarea id="expenseRemarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="text-xs min-h-[90px]" placeholder="Optional note" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewMode('view')} className="h-10 text-xs">Cancel</Button>
              <Button variant="secondary" onClick={handleAddExpense} disabled={submitLoading} className="h-10 text-xs">
                {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Expense'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-slate-600 dark:bg-slate-700 text-white rounded-t-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Daily Expenses Summary</CardTitle>
              <CardDescription className="text-xs">Shows daily visit dealers, orders received and expense totals.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-white/80">Orders Received: {formatCurrency(totalOrdersReceived)}</span>
              <span className="text-xs text-white/80">TA: {selectedSalesPersonTA === null ? 'N/A' : formatCurrency(selectedSalesPersonTA)}</span>
              <span className="text-xs text-white/80">Expenses: {formatCurrency(totalExpenses)}</span>
              <span className="text-xs text-white/80">Total: {formatCurrency(totalWithTA)}</span>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Print Report
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            {loading ? (
              <div className="flex items-center gap-2 text-xs py-10 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading report...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="p-2">Sno.</TableHead>
                      <TableHead className="p-2">Date</TableHead>
                      <TableHead className="p-2">Day</TableHead>
                      <TableHead className="p-2">Visited Dealers</TableHead>
                      <TableHead className="p-2">Order No.</TableHead>
                      <TableHead className="p-2 text-right">Order Received</TableHead>
                      <TableHead className="p-2 text-right">TA</TableHead>
                      <TableHead className="p-2 text-right">Expenses</TableHead>
                      <TableHead className="p-2 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportRows.map((row, index) => (
                      <TableRow key={row.date} className="align-top">
                        <TableCell className="p-2 whitespace-nowrap">{index + 1}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{formatDate(row.date)}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{row.day}</TableCell>
                        <TableCell className="p-2 max-w-[240px] truncate text-xs">{row.dealers}</TableCell>
                        <TableCell className="p-2 max-w-[220px] truncate text-xs">{row.orderNumbers}</TableCell>
                        <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(row.ordersReceived)}</TableCell>
                        <TableCell className="p-2 text-right whitespace-nowrap">{row.ta === null ? '-' : formatCurrency(row.ta)}</TableCell>
                        <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(row.expenses)}</TableCell>
                        <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-slate-50 dark:bg-slate-800">
                      <TableCell className="p-2" colSpan={5}>Total</TableCell>
                      <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(totalOrdersReceived)}</TableCell>
                      <TableCell className="p-2 text-right whitespace-nowrap">{selectedSalesPersonTA === null ? '-' : formatCurrency(totalTA)}</TableCell>
                      <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(totalExpenses)}</TableCell>
                      <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(totalWithTA)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="mt-3 flex justify-end pr-2 text-sm font-semibold">
                  <span>Grand Total: {formatCurrency(totalWithTA)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyExpensesReport;
