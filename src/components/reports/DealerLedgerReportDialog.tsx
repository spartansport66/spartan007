"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useSession } from '@/contexts/SessionContext'; // Import useSession
import { cn } from '@/lib/utils';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface LedgerEntry {
  date: string; // YYYY-MM-DD
  description: string;
  debit: number; // Amount owed by dealer (e.g., for orders)
  credit: number; // Amount paid by dealer
  balance: number; // Running balance
  type: 'opening_balance' | 'order' | 'payment' | 'advance';
  refId?: string; // Order ID or Payment ID
  order_number?: number;
  payment_due_date?: string | null;
  payment_status?: string; // Order status: pending, paid, pending_approval
  allocated_amount?: number; // Amount allocated to this liability (for orders/OB)
  days_overdue?: number | null; // Days overdue for pending orders
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerLedgerReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const calculateDaysOverdue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setUTCHours(0, 0, 0, 0);

  if (due >= today) return 0;

  const diffTime = today.getTime() - due.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const DealerLedgerReportDialog: React.FC<DealerLedgerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedDealerPhone, setSelectedDealerPhone] = useState<string | null>(null);
  const [selectedDealerName, setSelectedDealerName] = useState<string | null>(null);

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
      console.error('[DealerLedgerReportDialog] Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchLedgerData = useCallback(async () => {
    if (!filterDealerId) {
      setTransactions([]);
      setSelectedDealerPhone(null);
      setSelectedDealerName(null);
      setLoading(false);
      return;
    }
    if (!user?.id) {
      showError("User not authenticated. Please log in again.");
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const dealerId = filterDealerId;
      const fromDateISO = filterFromDate ? `${filterFromDate}T00:00:00.000Z` : null;
      const toDateISO = filterToDate ? `${filterToDate}T23:59:59.999Z` : null;

      // Fetch dealer details (name and phone)
      const { data: dealerDetails, error: dealerDetailsError } = await supabase
        .from('dealers')
        .select('name, phone')
        .eq('id', dealerId)
        .single();

      if (dealerDetailsError) throw dealerDetailsError;
      setSelectedDealerPhone(dealerDetails?.phone || null);
      setSelectedDealerName(dealerDetails?.name || null);

      // 1. Fetch Opening Balance
      const { data: dealerBalanceData, error: balanceError } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', dealerId)
        .single();

      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      let initialBalance = dealerBalanceData?.opening_balance || 0;

      // 2. Fetch all Orders (Debits)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, order_date, total_amount, payment_status, payment_due_date')
        .eq('dealer_id', dealerId);
      if (ordersError) throw ordersError;

      // 3. Fetch all Payments (Credits) and Allocations
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id, amount, payment_date, payment_method, status,
          payment_allocations (liability_id, allocated_amount, allocation_type)
        `)
        .eq('dealer_id', dealerId)
        .eq('status', 'completed'); // Only consider completed payments for ledger

      if (paymentsError) throw paymentsError;

      // --- Process Data ---
      const allTransactions: LedgerEntry[] = [];
      const orderMap = new Map(ordersData.map(o => [o.id, o]));
      const paymentMap = new Map(paymentsData.map(p => [p.id, p]));
      const allocationsByLiability = new Map<string, number>(); // Key: Order ID or Dealer ID (for OB/Advance)

      // Aggregate allocations
      paymentsData.forEach(p => {
        (p.payment_allocations || []).forEach((alloc: any) => {
          allocationsByLiability.set(alloc.liability_id, (allocationsByLiability.get(alloc.liability_id) || 0) + alloc.allocated_amount);
        });
      });

      // --- Calculate Initial Balance (before filterFromDate) ---
      if (fromDateISO) {
        let prevOrdersTotal = 0;
        let prevPaymentsTotal = 0;
        
        // Orders before fromDate
        ordersData.filter(o => new Date(o.order_date) < new Date(fromDateISO)).forEach(o => {
            prevOrdersTotal += o.total_amount;
        });

        // Payments before fromDate
        paymentsData.filter(p => new Date(p.payment_date) < new Date(fromDateISO)).forEach(p => {
            prevPaymentsTotal += p.amount;
        });
        
        initialBalance = initialBalance + prevOrdersTotal - prevPaymentsTotal;
      }

      // Add Opening Balance Entry
      if (!fromDateISO || initialBalance !== 0) {
        allTransactions.push({
          date: filterFromDate || new Date().toISOString().split('T')[0],
          description: 'Opening Balance',
          debit: 0,
          credit: 0,
          balance: initialBalance,
          type: 'opening_balance',
        });
      }

      // --- Create Ledger Entries within Date Range ---
      
      // 1. Orders (Debits)
      ordersData.filter(o => {
        const orderDate = new Date(o.order_date);
        const isAfterFrom = fromDateISO ? orderDate >= new Date(fromDateISO) : true;
        const isBeforeTo = toDateISO ? orderDate <= new Date(toDateISO) : true;
        return isAfterFrom && isBeforeTo;
      }).forEach(order => {
        const allocatedAmount = allocationsByLiability.get(order.id) || 0;
        const pendingAmount = order.total_amount - allocatedAmount;
        const daysOverdue = order.payment_status === 'pending' ? calculateDaysOverdue(order.payment_due_date) : null;

        allTransactions.push({
          date: order.order_date.split('T')[0],
          description: `Order #${order.order_number}`,
          debit: order.total_amount,
          credit: 0,
          balance: 0,
          type: 'order',
          refId: order.id,
          order_number: order.order_number,
          payment_due_date: order.payment_due_date,
          payment_status: order.payment_status,
          allocated_amount: allocatedAmount,
          days_overdue: daysOverdue,
        });
      });

      // 2. Payments (Credits)
      paymentsData.filter(p => {
        const paymentDate = new Date(p.payment_date);
        const isAfterFrom = fromDateISO ? paymentDate >= new Date(fromDateISO) : true;
        const isBeforeTo = toDateISO ? paymentDate <= new Date(toDateISO) : true;
        return isAfterFrom && isBeforeTo;
      }).forEach(payment => {
        const advanceAllocation = payment.payment_allocations.find((a: any) => a.allocation_type === 'advance');
        const allocatedToLiabilities = payment.amount - (advanceAllocation?.allocated_amount || 0);
        
        // Add the main payment entry
        allTransactions.push({
          date: payment.payment_date.split('T')[0],
          description: `Payment (${payment.payment_method}) - Allocated: ₹${allocatedToLiabilities.toFixed(2)}`,
          debit: 0,
          credit: payment.amount,
          balance: 0,
          type: 'payment',
          refId: payment.id,
        });
        
        // Add a separate entry for Advance Payment if applicable
        if (advanceAllocation) {
            allTransactions.push({
                date: payment.payment_date.split('T')[0],
                description: `Advance Payment Received`,
                debit: 0,
                credit: advanceAllocation.allocated_amount,
                balance: 0,
                type: 'advance',
                refId: payment.id,
            });
        }
      });

      // Sort all entries by date
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // Ensure opening balance is always first on the same date
        if (a.type === 'opening_balance') return -1;
        if (b.type === 'opening_balance') return 1;
        return 0;
      });

      // Calculate running balance
      const finalLedger: LedgerEntry[] = [];
      let currentBalance = initialBalance;
      allTransactions.forEach(entry => {
        if (entry.type === 'opening_balance') {
          finalLedger.push(entry);
        } else {
          currentBalance = currentBalance + entry.debit - entry.credit;
          finalLedger.push({ ...entry, balance: currentBalance });
        }
      });

      setTransactions(finalLedger);
    } catch (error: any) {
      console.error('[DealerLedgerReportDialog] Error fetching dealer ledger data:', error.message);
      showError(`Failed to load dealer ledger: ${error.message}`);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerId, filterFromDate, filterToDate, user?.id]);

  useEffect(() => {
    if (isOpen) {
      const fetchAllDealers = async () => {
        const { data, error } = await supabase
          .from('dealers')
          .select('id, name')
          .order('name', { ascending: true });
        if (error) {
          showError('Failed to load dealers for filter.');
          setAllDealers([]);
        } else {
          setAllDealers(data.map(d => ({ value: d.id, label: d.name })));
        }
      };
      fetchAllDealers();
      fetchCompanyInfo();
      fetchLedgerData();
    }
  }, [isOpen, fetchLedgerData, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleSendOrderWhatsApp = (orderNumber: number, amountDue: number, dueDate: string | null) => {
    if (!selectedDealerPhone) { showError('Dealer phone number is not available.'); return; }
    if (!companyName) { showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.'); return; }
    const dealerName = selectedDealerName || 'Dealer';
    const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';
    const message = `Hello ${dealerName},\n\nThis is a reminder from *${companyName}* that payment for Order No. *${orderNumber}* of *₹${amountDue.toFixed(2)}* is due on ${formattedDueDate}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://web.whatsapp.com/send?phone=${selectedDealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp message drafted. Please check the new tab.');
  };

  const handleSendBalanceWhatsApp = (balance: number) => {
    if (!selectedDealerPhone) { showError('Dealer phone number is not available.'); return; }
    if (!companyName) { showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.'); return; }
    if (balance <= 0) { showError('Current balance is zero or negative. No reminder needed.'); return; }

    const dealerName = selectedDealerName || 'Dealer';
    const formattedBalance = balance.toFixed(2);
    
    const message = `Hello ${dealerName},\n\nThis is a reminder from *${companyName}* that your current outstanding balance is *₹${formattedBalance}*. Please clear your balance as soon as possible.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://web.whatsapp.com/send?phone=${selectedDealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp balance reminder drafted. Please check the new tab.');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22); doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18); doc.text("Dealer Ledger Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      const dealerNameForPdf = allDealers.find(d => d.value === filterDealerId)?.label || 'N/A';
      doc.text(`Dealer: ${dealerNameForPdf}`, 14, 40);
      doc.text(`Period: ${filterFromDate || 'Start'} to ${filterToDate || 'End'}`, 14, 45);

      const tableColumn = ["Date", "Description", "Debit (₹)", "Credit (₹)", "Balance (₹)", "Status/Due Days"];
      const tableRows = transactions.map(entry => {
        let statusText = '';
        if (entry.type === 'order') {
            const pending = entry.debit - (entry.allocated_amount || 0);
            if (pending > 0) {
                statusText = `Pending: ₹${pending.toFixed(2)}`;
                if (entry.days_overdue && entry.days_overdue > 0) {
                    statusText += ` (${entry.days_overdue} days overdue)`;
                } else if (entry.payment_due_date) {
                    statusText += ` (Due: ${new Date(entry.payment_due_date).toLocaleDateString()})`;
                }
            } else {
                statusText = 'Paid in Full';
            }
        } else if (entry.type === 'advance') {
            statusText = 'Advance Payment';
        } else if (entry.type === 'opening_balance' && entry.balance > 0) {
            statusText = 'Outstanding';
        } else {
            statusText = 'N/A';
        }

        return [
          entry.date,
          entry.description,
          entry.debit.toFixed(2),
          entry.credit.toFixed(2),
          entry.balance.toFixed(2),
          statusText,
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 55,
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: [0, 0, 0] },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' }, // Date
          1: { cellWidth: 80 }, // Description
          2: { cellWidth: 25, halign: 'right' }, // Debit
          3: { cellWidth: 25, halign: 'right' }, // Credit
          4: { cellWidth: 25, halign: 'right' }, // Balance
          5: { cellWidth: 40 }, // Status/Due Days
        }
      });

      doc.save(`dealer_ledger_report_${dealerNameForPdf.replace(/\s/g, '_')}.pdf`);
      showSuccess('Dealer ledger report generated successfully!');
    } catch (error: any) {
      console.error('[DealerLedgerReportDialog] Error generating PDF:', error);
      showError(`Failed to generate dealer ledger report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
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
                    <TableHead className="text-muted-foreground font-bold text-center">Status/Due Days</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((entry, index) => {
                    const isPendingOrder = entry.type === 'order' && entry.payment_status === 'pending';
                    const isAdvance = entry.type === 'advance';
                    const isOpeningBalance = entry.type === 'opening_balance';
                    const isOverdue = isPendingOrder && entry.days_overdue && entry.days_overdue > 0;
                    const pendingAmount = entry.type === 'order' ? entry.debit - (entry.allocated_amount || 0) : 0;

                    let statusText = 'N/A';
                    if (isAdvance) {
                        statusText = 'Advance Payment';
                    } else if (isOpeningBalance && entry.balance > 0) {
                        statusText = 'Outstanding';
                    } else if (entry.type === 'order') {
                        if (pendingAmount <= 0) {
                            statusText = 'Paid in Full';
                        } else {
                            statusText = `Pending: ₹${pendingAmount.toFixed(2)}`;
                            if (isOverdue) {
                                statusText += ` (${entry.days_overdue} days overdue)`;
                            } else if (entry.payment_due_date) {
                                statusText += ` (Due: ${new Date(entry.payment_due_date).toLocaleDateString()})`;
                            }
                        }
                    }

                    return (
                      <TableRow key={index} className={cn("hover:bg-accent/50", isOverdue && "bg-red-50/50")}>
                        <TableCell className="font-medium text-foreground">{entry.date}</TableCell>
                        <TableCell className="text-foreground">{entry.description}</TableCell>
                        <TableCell className="text-foreground text-right">{entry.debit.toFixed(2)}</TableCell>
                        <TableCell className="text-foreground text-right">{entry.credit.toFixed(2)}</TableCell>
                        <TableCell className="text-foreground text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-sm">
                            <div className={cn("flex items-center justify-center gap-1", isOverdue ? 'text-red-600 font-semibold' : isAdvance ? 'text-green-600' : 'text-muted-foreground')}>
                                {isOverdue && <AlertCircle className="h-4 w-4" />}
                                {statusText}
                            </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {/* 1. Specific Pending Order Reminder */}
                            {isPendingOrder && entry.order_number && pendingAmount > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendOrderWhatsApp(entry.order_number!, pendingAmount, entry.payment_due_date || null)}
                                title="Send WhatsApp Reminder for this Pending Order"
                                disabled={!selectedDealerPhone}
                              >
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            {/* 2. General Balance Reminder (if final balance is positive) */}
                            {index === transactions.length - 1 && entry.balance > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendBalanceWhatsApp(entry.balance)}
                                title="Send WhatsApp Reminder for Current Balance"
                                disabled={!selectedDealerPhone}
                              >
                                <MessageCircle className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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