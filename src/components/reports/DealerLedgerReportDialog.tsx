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

interface LedgerEntry {
  date: string; // YYYY-MM-DD
  description: string;
  debit: number; // Amount owed by dealer (e.g., for orders)
  credit: number; // Amount paid by dealer
  balance: number; // Running balance
  type: 'opening_balance' | 'order' | 'payment';
  refId?: string; // Order ID or Payment ID
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerLedgerReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DealerLedgerReportDialog: React.FC<DealerLedgerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [companyName, setCompanyName] = useState<string | null>(null);

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

  const fetchLedgerData = useCallback(async () => {
    if (!filterDealerId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const dealerId = filterDealerId;
      const fromDateISO = filterFromDate ? `${filterFromDate}T00:00:00.000Z` : null;
      const toDateISO = filterToDate ? `${filterToDate}T23:59:59.999Z` : null;

      // 1. Get initial balance (opening balance + all transactions before fromDate)
      let initialBalance = 0;
      const { data: dealerBalanceData, error: balanceError } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', dealerId)
        .single();

      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      initialBalance = dealerBalanceData?.opening_balance || 0;

      // Calculate balance from orders/payments before the filterFromDate
      if (fromDateISO) {
        // Orders before fromDate
        const { data: prevOrders, error: prevOrdersError } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('dealer_id', dealerId)
          .lte('order_date', fromDateISO)
          .in('payment_status', ['pending', 'pending_approval', 'paid']); // Consider all orders as debits

        if (prevOrdersError) throw prevOrdersError;
        const prevOrdersTotal = (prevOrders || []).reduce((sum, order) => sum + order.total_amount, 0);

        // Payments before fromDate
        const { data: prevPayments, error: prevPaymentsError } = await supabase
          .from('payments')
          .select('amount, orders(dealer_id)') // Select orders.dealer_id to filter
          .eq('orders.dealer_id', dealerId) // Filter by dealer_id from the joined orders table
          .lte('payment_date', fromDateISO)
          .eq('status', 'completed'); // Only completed payments are credits

        if (prevPaymentsError) throw prevPaymentsError;
        const prevPaymentsTotal = (prevPayments || []).reduce((sum, payment) => sum + payment.amount, 0);

        initialBalance = initialBalance + prevOrdersTotal - prevPaymentsTotal;
      }

      const ledgerEntries: LedgerEntry[] = [];
      let currentBalance = initialBalance;

      // Add opening balance entry if it's the start of the report or if there's an actual opening balance
      if (!fromDateISO || initialBalance !== 0) {
        ledgerEntries.push({
          date: filterFromDate || new Date().toISOString().split('T')[0], // Use fromDate or today if no fromDate
          description: 'Opening Balance',
          debit: 0,
          credit: 0,
          balance: currentBalance,
          type: 'opening_balance',
        });
      }

      // 2. Fetch orders within the date range
      let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, order_date, total_amount, payment_status')
        .eq('dealer_id', dealerId)
        .in('payment_status', ['pending', 'pending_approval', 'paid']); // Include all orders as debits

      if (fromDateISO) ordersQuery = ordersQuery.gte('order_date', fromDateISO);
      if (toDateISO) ordersQuery = ordersQuery.lte('order_date', toDateISO);

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      (ordersData || []).forEach(order => {
        ledgerEntries.push({
          date: order.order_date.split('T')[0],
          description: `Order #${order.order_number} (${order.payment_status.replace('_', ' ')})`,
          debit: order.total_amount,
          credit: 0,
          balance: 0, // Will be calculated later
          type: 'order',
          refId: order.id,
        });
      });

      // 3. Fetch payments within the date range
      let paymentsQuery = supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, orders(order_number)')
        .eq('orders.dealer_id', dealerId) // Filter by dealer_id from the joined orders table
        .eq('status', 'completed'); // Only completed payments are credits

      if (fromDateISO) paymentsQuery = paymentsQuery.gte('payment_date', fromDateISO);
      if (toDateISO) paymentsQuery = paymentsQuery.lte('payment_date', toDateISO);

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      (paymentsData || []).forEach(payment => {
        ledgerEntries.push({
          date: payment.payment_date.split('T')[0],
          description: `Payment for Order #${payment.orders?.[0]?.order_number || 'N/A'} (${payment.payment_method})`,
          debit: 0,
          credit: payment.amount,
          balance: 0, // Will be calculated later
          type: 'payment',
          refId: payment.id,
        });
      });

      // Sort all entries by date
      ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      const finalLedger: LedgerEntry[] = [];
      ledgerEntries.forEach(entry => {
        if (entry.type === 'opening_balance') {
          currentBalance = entry.balance; // Set initial balance
          finalLedger.push(entry);
        } else {
          currentBalance = currentBalance + entry.debit - entry.credit;
          finalLedger.push({ ...entry, balance: currentBalance });
        }
      });

      setTransactions(finalLedger);
    } catch (error: any) {
      console.error('Error fetching dealer ledger data:', error.message);
      showError(`Failed to load dealer ledger: ${error.message}`);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerId, filterFromDate, filterToDate]);

  useEffect(() => {
    if (isOpen) {
      // Fetch all dealers for the filter dropdown
      const fetchAllDealers = async () => {
        const { data, error } = await supabase
          .from('dealers')
          .select('id, name')
          .order('name', { ascending: true });
        if (error) {
          console.error('Error fetching all dealers:', error.message);
          showError('Failed to load dealers for filter.');
          setAllDealers([]);
        } else {
          setAllDealers(data.map(d => ({ value: d.id, label: d.name })));
        }
      };
      fetchAllDealers();
      fetchCompanyInfo();
      fetchLedgerData(); // Initial fetch
    }
  }, [isOpen, fetchLedgerData, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("Dealer Ledger Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      const selectedDealerName = allDealers.find(d => d.value === filterDealerId)?.label || 'N/A';
      doc.text(`Dealer: ${selectedDealerName}`, 14, 40);
      doc.text(`Period: ${filterFromDate || 'Start'} to ${filterToDate || 'End'}`, 14, 45);

      const tableColumn = ["Date", "Description", "Debit (₹)", "Credit (₹)", "Balance (₹)"];
      const tableRows = transactions.map(entry => [
        entry.date,
        entry.description,
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.balance.toFixed(2),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 55,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [30, 58, 138], // Dark blue (similar to indigo-800)
          textColor: [255, 255, 255], // White
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' }, // Date
          1: { cellWidth: 100 }, // Description
          2: { cellWidth: 30, halign: 'right' }, // Debit
          3: { cellWidth: 30, halign: 'right' }, // Credit
          4: { cellWidth: 30, halign: 'right' }, // Balance
        }
      });

      doc.save(`dealer_ledger_report_${selectedDealerName.replace(/\s/g, '_')}.pdf`);
      showSuccess('Dealer ledger report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate dealer ledger report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Ledger Report</DialogTitle>
          <DialogDescription>
            View a detailed ledger of transactions for a specific dealer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterDealer">Select Dealer</Label>
            <Select value={filterDealerId} onValueChange={setFilterDealerId}>
              <SelectTrigger id="filterDealer" className="w-full">
                <SelectValue placeholder="Select a dealer" />
              </SelectTrigger>
              <SelectContent>
                {allDealers.map(dealer => (
                  <SelectItem key={dealer.value} value={dealer.value}>{dealer.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate">From Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate">To Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchLedgerData} disabled={!filterDealerId} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
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
              <p className="ml-2 text-lg text-foreground">Loading ledger data...</p>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No ledger data found for the selected criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Description</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Debit (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Credit (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Balance (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((entry, index) => (
                    <TableRow key={index} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{entry.date}</TableCell>
                      <TableCell className="text-foreground">{entry.description}</TableCell>
                      <TableCell className="text-foreground text-right">{entry.debit.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right">{entry.credit.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={transactions.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerLedgerReportDialog;