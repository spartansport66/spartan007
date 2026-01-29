"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, AlertCircle, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { getStartOfUTCDayISO } from '@/utils/date';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface AccountStatementEntry {
  date: string; // YYYY-MM-DD
  description: string;
  debit: number; // Order amount
  credit: number; // Payment amount
  balance: number; // Running balance
  type: 'opening_balance' | 'order' | 'payment';
  // Order specific details
  order_number?: number;
  bill_no?: string;
  payment_status?: string;
  days_overdue?: number | null;
  // Payment specific details (if cleared/pending approval)
  payment_method?: string | null;
  payment_amount?: number | null;
  payment_date?: string | null;
  cheque_dd_date?: string | null;
  transaction_id?: string | null;
}

interface DealerAccountStatement {
  dealer_id: string;
  dealer_name: string;
  dealer_phone: string;
  dealer_credit_days: number;
  entries: AccountStatementEntry[];
  final_balance: number;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonAccountStatementReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesPersonAccountStatementReportDialog: React.FC<SalesPersonAccountStatementReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [reportData, setReportData] = useState<DealerAccountStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Filter states
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

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

  const calculateDaysOverdue = (billDate: string): number | null => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const bill = new Date(billDate);
    bill.setUTCHours(0, 0, 0, 0);

    if (bill >= today) return 0;

    const diffTime = today.getTime() - bill.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const fetchReportData = useCallback(async () => {
    if (!filterSalesPersonId) {
      setReportData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fromDateISO = filterFromDate ? `${filterFromDate}T00:00:00.000Z` : null;
      const toDateISO = filterToDate ? `${filterToDate}T23:59:59.999Z` : null;
      const todayISO = getStartOfUTCDayISO();

      // 1. Fetch all dealers assigned to the selected sales person
      let dealerQuery = supabase
        .from('dealer_sales_persons')
        .select(`
          dealers (
            id, name, phone, allotted_credit_days, last_billing_date,
            dealer_balances(opening_balance),
            orders!inner (
              id, order_number, dispatch_date, bill_no, total_amount, payment_status, order_date,
              payments (id, amount, payment_date, payment_method, cheque_dd_date, transaction_id, status)
            )
          )
        `)
        .eq('sales_person_id', filterSalesPersonId)
        .eq('dealers.orders.dispatched', true); // Only dispatched orders

      if (filterDealerName) {
        dealerQuery = dealerQuery.ilike('dealers.name', `%${filterDealerName}%`);
      }

      const { data: rawDealersData, error: dealersError } = await dealerQuery;
      if (dealersError) throw dealersError;

      const finalReport: DealerAccountStatement[] = [];

      for (const item of rawDealersData || []) {
        const dealer = item.dealers;
        if (!dealer) continue;

        const dealerId = dealer.id;
        const openingBalance = dealer.dealer_balances?.opening_balance || 0;
        const allottedCreditDays = dealer.allotted_credit_days || 0;
        const lastBillingDate = dealer.last_billing_date;

        const allEntries: AccountStatementEntry[] = [];
        let currentBalance = openingBalance;

        // --- 1. Calculate Initial Balance (Transactions before filterFromDate) ---
        let initialBalance = openingBalance;
        if (fromDateISO) {
          // Orders before fromDate
          const ordersBefore = (dealer.orders || []).filter((o: any) => new Date(o.dispatch_date) < new Date(fromDateISO));
          const ordersBeforeTotal = ordersBefore.reduce((sum, order) => sum + order.total_amount, 0);

          // Payments before fromDate (Order payments and General payments)
          let paymentsBeforeTotal = 0;
          
          // Fetch general payments before fromDate
          const { data: generalPaymentsBefore, error: gpError } = await supabase
            .from('payments')
            .select('amount')
            .eq('dealer_id', dealerId)
            .is('order_id', null)
            .lte('payment_date', fromDateISO)
            .eq('status', 'completed');
            
          if (gpError) console.error('Error fetching general payments before date:', gpError);
          paymentsBeforeTotal += (generalPaymentsBefore || []).reduce((sum, p) => sum + p.amount, 0);

          // Order payments before fromDate
          ordersBefore.forEach((order: any) => {
            (order.payments || []).forEach((payment: any) => {
              if (payment.status === 'completed' && new Date(payment.payment_date) < new Date(fromDateISO)) {
                paymentsBeforeTotal += payment.amount;
              }
            });
          });
          
          initialBalance = openingBalance + ordersBeforeTotal - paymentsBeforeTotal;
        }
        currentBalance = initialBalance;

        // Add Opening Balance Entry (if relevant)
        if (!fromDateISO || initialBalance !== 0) {
          allEntries.push({
            date: filterFromDate || lastBillingDate?.split('T')[0] || new Date().toISOString().split('T')[0],
            description: `Opening Balance (as of ${filterFromDate || 'Start'})`,
            debit: 0,
            credit: 0,
            balance: initialBalance,
            type: 'opening_balance',
          });
        }

        // --- 2. Process Orders within the Date Range ---
        const ordersInPeriod = (dealer.orders || []).filter((o: any) => {
          const dispatchDate = new Date(o.dispatch_date);
          const isAfterFrom = fromDateISO ? dispatchDate >= new Date(fromDateISO) : true;
          const isBeforeTo = toDateISO ? dispatchDate <= new Date(toDateISO) : true;
          return isAfterFrom && isBeforeTo;
        });

        for (const order of ordersInPeriod) {
          const billDate = order.dispatch_date.split('T')[0];
          const dueDate = new Date(billDate);
          dueDate.setDate(dueDate.getDate() + allottedCreditDays);
          const dueDateISO = dueDate.toISOString().split('T')[0];
          
          // Calculate days overdue if pending
          let daysOverdue: number | null = null;
          if (order.payment_status === 'pending') {
            const today = new Date(todayISO);
            const effectiveDueDate = new Date(dueDateISO);
            effectiveDueDate.setUTCHours(0, 0, 0, 0);
            
            if (effectiveDueDate < today) {
              daysOverdue = calculateDaysOverdue(dueDateISO);
            }
          }

          // Add Order Entry (Debit)
          currentBalance += order.total_amount;
          allEntries.push({
            date: billDate,
            description: `Order #${order.order_number} (Bill No: ${order.bill_no})`,
            debit: order.total_amount,
            credit: 0,
            balance: currentBalance,
            type: 'order',
            order_number: order.order_number,
            bill_no: order.bill_no,
            payment_status: order.payment_status,
            days_overdue: daysOverdue,
          });

          // Add Payment Entry (Credit) if paid or pending approval
          const completedPayment = order.payments?.find(p => p.status === 'completed');
          const pendingPayment = order.payments?.find(p => p.status === 'pending_approval');
          const payment = completedPayment || pendingPayment;

          if (payment) {
            const paymentDate = payment.payment_date.split('T')[0];
            const statusText = payment.status === 'completed' ? 'Cleared' : 'Pending Approval';
            
            // Only include payment entry if it falls within the report date range OR if it's the only payment for an order in the range
            const paymentDateObj = new Date(paymentDate);
            const isPaymentInPeriod = fromDateISO ? paymentDateObj >= new Date(fromDateISO) : true;
            const isPaymentBeforeTo = toDateISO ? paymentDateObj <= new Date(toDateISO) : true;

            if (isPaymentInPeriod && isPaymentBeforeTo) {
                currentBalance -= payment.amount;
                allEntries.push({
                    date: paymentDate,
                    description: `Payment - ${statusText} (${payment.payment_method})`,
                    debit: 0,
                    credit: payment.amount,
                    balance: currentBalance,
                    type: 'payment',
                    payment_method: payment.payment_method,
                    payment_amount: payment.amount,
                    payment_date: paymentDate,
                    cheque_dd_date: payment.cheque_dd_date,
                    transaction_id: payment.transaction_id,
                });
            }
          }
        }
        
        // --- 3. Process General Payments within the Date Range ---
        const { data: generalPaymentsInPeriod, error: gpInPeriodError } = await supabase
            .from('payments')
            .select('id, amount, payment_date, payment_method, cheque_dd_date, transaction_id, status')
            .eq('dealer_id', dealerId)
            .is('order_id', null)
            .in('status', ['completed', 'pending_approval']);
            
        if (gpInPeriodError) console.error('Error fetching general payments in period:', gpInPeriodError);
        
        (generalPaymentsInPeriod || []).forEach((payment: any) => {
            const paymentDate = payment.payment_date.split('T')[0];
            const paymentDateObj = new Date(paymentDate);
            const isPaymentInPeriod = fromDateISO ? paymentDateObj >= new Date(fromDateISO) : true;
            const isPaymentBeforeTo = toDateISO ? paymentDateObj <= new Date(toDateISO) : true;

            if (isPaymentInPeriod && isPaymentBeforeTo) {
                const statusText = payment.status === 'completed' ? 'Cleared' : 'Pending Approval';
                
                if (payment.status === 'completed') {
                    currentBalance -= payment.amount;
                }
                
                allEntries.push({
                    date: paymentDate,
                    description: `General Payment - ${statusText} (${payment.payment_method})`,
                    debit: 0,
                    credit: payment.amount,
                    balance: currentBalance,
                    type: 'payment',
                    payment_method: payment.payment_method,
                    payment_amount: payment.amount,
                    payment_date: paymentDate,
                    cheque_dd_date: payment.cheque_dd_date,
                    transaction_id: payment.transaction_id,
                });
            }
        });


        // Sort all entries chronologically
        allEntries.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          // Ensure opening balance is always first on the same date
          if (a.type === 'opening_balance') return -1;
          if (b.type === 'opening_balance') return 1;
          return 0;
        });
        
        // Recalculate running balance after sorting
        let finalRunningBalance = initialBalance;
        const sortedEntriesWithBalance = allEntries.map(entry => {
            if (entry.type !== 'opening_balance') {
                // Only update balance if it's a completed transaction (debit is always an order/completed transaction)
                // For payments, only completed payments affect the balance calculation here.
                if (entry.type === 'order' || (entry.type === 'payment' && entry.description.includes('Cleared'))) {
                    finalRunningBalance = finalRunningBalance + entry.debit - entry.credit;
                }
                return { ...entry, balance: finalRunningBalance };
            }
            return entry;
        });


        finalReport.push({
          dealer_id: dealerId,
          dealer_name: dealer.name,
          dealer_phone: dealer.phone || '',
          dealer_credit_days: allottedCreditDays,
          entries: sortedEntriesWithBalance,
          final_balance: finalRunningBalance,
        });
      }

      setReportData(finalReport);
    } catch (error: any) {
      console.error('Error fetching account statement data:', error.message);
      showError(`Failed to load report data: ${error.message}`);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, filterFromDate, filterToDate, filterDealerName]);

  const fetchSalesPersons = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('user_type', 'sales_person')
      .order('first_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching sales persons:', error.message);
      setAllSalesPersons([]);
    } else {
      setAllSalesPersons((data || []).map(sp => ({
        value: sp.id,
        label: `${sp.first_name} ${sp.last_name || ''}`.trim(),
      })));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchSalesPersons();
      if (filterSalesPersonId) {
        fetchReportData();
      }
    }
  }, [isOpen, fetchCompanyInfo, fetchSalesPersons, fetchReportData, filterSalesPersonId]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    setFilterDealerName('');
    setFilterFromDate('');
    setFilterToDate('');
    setReportData([]);
  };

  const handleSendWhatsApp = async (dealer: DealerAccountStatement, entry: AccountStatementEntry) => {
    if (!user) {
      showError('You must be logged in to send WhatsApp messages.');
      return;
    }
    if (!dealer.dealer_phone) {
      showError(`Phone number not available for ${dealer.dealer_name}.`);
      return;
    }
    if (!companyName) {
      showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.');
      return;
    }
    if (!entry.order_number || !entry.bill_no || !entry.days_overdue) {
        showError('Missing order details for reminder.');
        return;
    }

    setIsSendingWhatsApp(true);
    try {
      const message = `Hello ${dealer.dealer_name},\n\nThis is an urgent reminder from *${companyName}*.\n\nPayment for Dispatched Order No. *${entry.order_number}* (Bill No: ${entry.bill_no}) of *₹${entry.debit.toFixed(2)}* is currently overdue by *${entry.days_overdue} days* (Bill Date: ${entry.date}).\n\nPlease clear this outstanding payment immediately.\n\nThank you!`;
      
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerIds: [dealer.dealer_id],
          message: message,
          comboOfferId: null,
          sentByUserId: user.id,
          messageType: 'order_overdue_reminder',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to log WhatsApp message send attempt');

      showSuccess(`WhatsApp message drafted for ${dealer.dealer_name}. Please check the new tab.`);
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealer.dealer_phone}&text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handlePrint = () => {
    if (reportData.length === 0) {
      showError('No data to print.');
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      let yPos = 15;
      const margin = 10;
      const pageWidth = doc.internal.pageSize.width;

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(18);
      doc.text(companyNameText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      doc.setFontSize(14);
      doc.text("Sales Person Account Statement Report", pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label || 'N/A';
      doc.text(`Sales Person: ${salesPersonLabel}`, margin, yPos);
      doc.text(`Period: ${filterFromDate || 'Start'} to ${filterToDate || 'End'}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
      doc.setTextColor(0);

      for (const dealerStatement of reportData) {
        if (yPos + 10 > doc.internal.pageSize.height - margin) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Dealer: ${dealerStatement.dealer_name} (Phone: ${dealerStatement.dealer_phone || 'N/A'})`, margin, yPos);
        yPos += 5;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Credit Days: ${dealerStatement.dealer_credit_days}`, margin, yPos);
        yPos += 5;

        const tableColumn = ["Date", "Description", "Bill No.", "Status/Details", "Days Overdue", "Debit (₹)", "Credit (₹)", "Balance (₹)"];
        const tableRows = dealerStatement.entries.map(entry => {
          let statusDetails = '';
          let daysOverdueDisplay = 'N/A';

          if (entry.type === 'order') {
            statusDetails = entry.payment_status === 'pending' ? 'Pending' : entry.payment_status === 'pending_approval' ? 'Pending Approval' : 'Paid';
            if (entry.days_overdue !== null && entry.days_overdue > 0) {
              daysOverdueDisplay = entry.days_overdue.toString();
            }
          } else if (entry.type === 'payment') {
            statusDetails = `${entry.payment_method} (Amt: ₹${entry.credit.toFixed(2)})`;
          } else if (entry.type === 'opening_balance') {
            statusDetails = 'N/A';
          }

          return [
            entry.date,
            entry.description,
            entry.bill_no || 'N/A',
            statusDetails,
            daysOverdueDisplay,
            entry.debit.toFixed(2),
            entry.credit.toFixed(2),
            entry.balance.toFixed(2),
          ];
        });

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: yPos,
          styles: { fontSize: 6, cellPadding: 1, valign: 'middle', overflow: 'linebreak' },
          headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          bodyStyles: { textColor: [0, 0, 0] },
          margin: { top: 0, left: margin, right: margin },
          columnStyles: {
            0: { cellWidth: 18, halign: 'center' }, // Date
            1: { cellWidth: 40 }, // Description
            2: { cellWidth: 18, halign: 'center' }, // Bill No.
            3: { cellWidth: 35 }, // Status/Details
            4: { cellWidth: 15, halign: 'center' }, // Days Overdue
            5: { cellWidth: 20, halign: 'right' }, // Debit
            6: { cellWidth: 20, halign: 'right' }, // Credit
            7: { cellWidth: 20, halign: 'right' }, // Balance
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 5;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Final Closing Balance: ₹${dealerStatement.final_balance.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 10;
      }

      doc.save('sales_person_account_statement.pdf');
      showSuccess('Account Statement Report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  const filteredReportData = useMemo(() => {
    if (!filterDealerName) return reportData;
    const lowerCaseFilter = filterDealerName.toLowerCase();
    return reportData.filter(d => d.dealer_name.toLowerCase().includes(lowerCaseFilter));
  }, [reportData, filterDealerName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Sales Person Account Statement Report</DialogTitle>
          <DialogDescription>
            Detailed ledger view of dealer transactions (Opening Balance, Dispatched Orders, Payments) for a selected sales person.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterSalesPerson" className="text-foreground font-medium">Select Sales Person</Label>
            <Select value={filterSalesPersonId} onValueChange={setFilterSalesPersonId} disabled={loading}>
              <SelectTrigger id="filterSalesPerson" className="w-full">
                <SelectValue placeholder="Select a sales person" />
              </SelectTrigger>
              <SelectContent>
                {allSalesPersons.map(sp => (
                  <SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate" className="text-foreground font-medium">From Date (Order/Payment)</Label>
            <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} disabled={loading} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate" className="text-foreground font-medium">To Date (Order/Payment)</Label>
            <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} disabled={loading} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterDealerName" className="text-foreground font-medium">Search Dealer Name</Label>
            <Input type="text" value={filterDealerName} onChange={(e) => setFilterDealerName(e.target.value)} placeholder="Filter by dealer name" disabled={loading} />
          </div>
          <Button onClick={fetchReportData} disabled={loading || !filterSalesPersonId} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Generate Report
          </Button>
          <Button variant="outline" onClick={handleClearFilters} disabled={loading} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Generating report...</p>
            </div>
          ) : filteredReportData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No account statement data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md p-2 space-y-6">
              {filteredReportData.map((dealerStatement) => (
                <div key={dealerStatement.dealer_id} className="border p-4 rounded-lg shadow-sm">
                  <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {dealerStatement.dealer_name}
                    <span className="text-sm font-normal text-muted-foreground ml-3">
                      (Final Balance: ₹{dealerStatement.final_balance.toFixed(2)})
                    </span>
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted">
                        <TableRow className="bg-muted hover:bg-muted/90">
                          <TableHead className="text-muted-foreground font-bold">Date</TableHead>
                          <TableHead className="text-muted-foreground font-bold">Description</TableHead>
                          <TableHead className="text-muted-foreground font-bold">Bill No.</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-right">Debit (₹)</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-right">Credit (₹)</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-right">Balance (₹)</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-center">Status/Overdue</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dealerStatement.entries.map((entry, index) => {
                          const isOverdue = entry.type === 'order' && entry.days_overdue && entry.days_overdue > 0;
                          const isPendingApproval = entry.type === 'payment' && entry.description.includes('Pending Approval');
                          const isOrder = entry.type === 'order';
                          const isPayment = entry.type === 'payment';

                          return (
                            <TableRow key={index} className={isOverdue ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}>
                              <TableCell className="font-medium text-foreground">{entry.date}</TableCell>
                              <TableCell className="text-foreground max-w-[200px] truncate">{entry.description}</TableCell>
                              <TableCell className="text-foreground">{entry.bill_no || 'N/A'}</TableCell>
                              <TableCell className="text-right text-red-600 font-medium">{entry.debit.toFixed(2)}</TableCell>
                              <TableCell className="text-right text-green-600 font-medium">{entry.credit.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                {isOverdue ? (
                                  <div className="flex items-center justify-center gap-1 text-red-600 font-semibold">
                                    <AlertCircle className="h-4 w-4" /> {entry.days_overdue} Days Overdue
                                  </div>
                                ) : isPendingApproval ? (
                                  <div className="flex items-center justify-center gap-1 text-blue-600 font-semibold">
                                    <Clock className="h-4 w-4" /> Pending Approval
                                  </div>
                                ) : isOrder && entry.payment_status === 'pending' ? (
                                  <div className="flex items-center justify-center gap-1 text-yellow-600 font-semibold">
                                    <Clock className="h-4 w-4" /> Pending
                                  </div>
                                ) : isPayment && entry.payment_method ? (
                                  <span className="text-green-600 font-semibold">{entry.payment_method}</span>
                                ) : (
                                  'N/A'
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {isOverdue && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSendWhatsApp(dealerStatement, entry)}
                                    title="Send Overdue WhatsApp Reminder"
                                    disabled={isSendingWhatsApp || !dealerStatement.dealer_phone}
                                  >
                                    <MessageCircle className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={filteredReportData.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonAccountStatementReportDialog;