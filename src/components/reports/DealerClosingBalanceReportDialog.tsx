"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, RotateCcw, Send, ArrowUp, ArrowDown, ChevronsUpDown, DollarSign, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { Checkbox } from '@/components/ui/checkbox';
import RCSBulkMessageSender from '@/components/RCSBulkMessageSender';
import { cn } from '@/lib/utils';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import DealerPaymentsReceivedDialog from '@/components/reports/DealerPaymentsReceivedDialog';

const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface DealerClosingBalance {
  id: string;
  name: string;
  phone: string;
  opening_balance: number;
  opening_balance_due_date: string | null;
  opening_balance_due_days: number | null;
  totalSales: number;
  totalPaymentsReceived: number;
  closing_balance: number;
  last_dispatch_date: string | null;
  daysSinceLastDispatch: number | null;
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerClosingBalanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PendingOrderPayment {
  id: string;
  order_number: number;
  total_amount: number;
  dealer_name: string;
  payment_due_date: string | null;
}

const OVERDUE_THRESHOLD_DAYS = 60;

const DealerClosingBalanceReportDialog: React.FC<DealerClosingBalanceReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<DealerClosingBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  
  // New state for the two overdue filters
  const [filterOpeningBalanceOverduePeriod, setFilterOpeningBalanceOverduePeriod] = useState<'all' | 'less_than_60' | 'more_than_60'>('all');
  const [filterDispatchOverduePeriod, setFilterDispatchOverduePeriod] = useState<'all' | 'less_than_60' | 'more_than_60'>('all');
  
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [sentDealerIds, setSentDealerIds] = useState<Set<string>>(new Set());
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);
  const [isRCSBulkSenderOpen, setIsRCSBulkSenderOpen] = useState(false);
  
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PendingOrderPayment | null>(null);
  
  const [isPaymentsReceivedDialogOpen, setIsPaymentsReceivedDialogOpen] = useState(false);
  const [selectedDealerForPayments, setSelectedDealerForPayments] = useState<{ id: string; name: string } | null>(null);
  
  const [sortKey, setSortKey] = useState<'name' | 'closing_balance' | 'opening_balance_due_days' | 'daysSinceLastDispatch'>('name');
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

  const calculateDaysDifference = (dateString: string | null): number | null => {
    if (!dateString) return null;
    const targetDate = new Date(dateString);
    const today = new Date();
    
    targetDate.setUTCHours(0, 0, 0, 0);
    today.setUTCHours(0, 0, 0, 0);

    // If the last bill date is today or in the future, the overdue period is 0 days.
    if (targetDate.getTime() >= today.getTime()) {
      return 0;
    }

    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const fetchClosingBalances = useCallback(async () => {
    setLoading(true);
    try {
      const { data: salesPersonsData, error: salesPersonsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person')
        .order('first_name', { ascending: true });

      if (salesPersonsError) throw salesPersonsError;
      setAllSalesPersons((salesPersonsData || []).map(sp => ({
        value: sp.id,
        label: `${sp.first_name} ${sp.last_name || ''}`.trim(),
      })));

      // RPC call now only takes 2 arguments (no limit/offset)
      const { data: reportData, error: rpcError } = await supabase
        .rpc('get_dealer_balance_report', {
          p_sales_person_id: filterSalesPersonId || null,
          p_dealer_name_filter: filterDealerName || null,
        });

      if (rpcError) {
        console.error('Error calling get_dealer_balance_report RPC:', rpcError);
        throw rpcError;
      }

      const formattedDealers: DealerClosingBalance[] = (reportData || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        phone: d.phone || '',
        opening_balance: d.opening_balance,
        opening_balance_due_date: d.opening_balance_due_date,
        opening_balance_due_days: calculateDaysDifference(d.opening_balance_due_date),
        closing_balance: d.closing_balance,
        last_dispatch_date: d.last_dispatch_date,
        daysSinceLastDispatch: calculateDaysDifference(d.last_dispatch_date),
        totalSales: d.total_sales,
        totalPaymentsReceived: d.total_payments_received,
      }));
      
      // Combined Filtering Logic for Overdue Periods
      const anyOverdueFilterActive = filterOpeningBalanceOverduePeriod !== 'all' || filterDispatchOverduePeriod !== 'all';

      const filteredDealers = formattedDealers.filter(dealer => {
          // If any overdue filter is active, the dealer must have a positive closing balance.
          if (anyOverdueFilterActive && dealer.closing_balance <= 0) {
              return false;
          }

          // --- Opening Balance Filter Check ---
          if (filterOpeningBalanceOverduePeriod !== 'all') {
              const days = dealer.opening_balance_due_days;
              if (days === null) return false; // Must have a due date to be filtered
              
              if (filterOpeningBalanceOverduePeriod === 'less_than_60' && days > OVERDUE_THRESHOLD_DAYS) return false;
              if (filterOpeningBalanceOverduePeriod === 'more_than_60' && days <= OVERDUE_THRESHOLD_DAYS) return false;
          }

          // --- Dispatch Filter Check ---
          if (filterDispatchOverduePeriod !== 'all') {
              const days = dealer.daysSinceLastDispatch;
              if (days === null) return false; // Must have a dispatch date to be filtered
              
              if (filterDispatchOverduePeriod === 'less_than_60' && days > OVERDUE_THRESHOLD_DAYS) return false;
              if (filterDispatchOverduePeriod === 'more_than_60' && days <= OVERDUE_THRESHOLD_DAYS) return false;
          }

          return true;
      });

      setDealers(filteredDealers);
    } catch (error: any) {
      console.error('Error in fetchClosingBalances:', error.message);
      showError('An unexpected error occurred while fetching dealer data.');
      setDealers([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerName, filterSalesPersonId, filterOpeningBalanceOverduePeriod, filterDispatchOverduePeriod]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchClosingBalances();
    } else {
      setSentDealerIds(new Set());
      setSelectedDealerIds([]);
    }
  }, [isOpen, fetchCompanyInfo, fetchClosingBalances]);

  const handleInitiatePayment = async (dealerId: string, dealerName: string) => {
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_due_date')
        .eq('dealer_id', dealerId)
        .eq('payment_status', 'pending')
        .order('order_date', { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const dealer = dealers.find(d => d.id === dealerId);
      const closingBalance = dealer?.closing_balance || 0;

      if (orders) {
        setSelectedOrderForPaymentUpdate({
          id: orders.id,
          order_number: orders.order_number,
          total_amount: orders.total_amount,
          dealer_name: dealerName,
          payment_due_date: orders.payment_due_date,
        });
        setIsUpdatePaymentDialogOpen(true);
      } else if (closingBalance > 0) {
        setSelectedOrderForPaymentUpdate({
          id: dealerId,
          order_number: 0,
          total_amount: closingBalance,
          dealer_name: dealerName,
          payment_due_date: null,
        });
        setIsUpdatePaymentDialogOpen(true);
      } else {
        showError(`Dealer ${dealerName} has no outstanding balance or pending orders.`);
      }
    } catch (error: any) {
      showError(`Failed to initiate payment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentUpdated = () => {
    fetchClosingBalances();
  };

  const handleViewPayments = (dealer: DealerClosingBalance) => {
    setSelectedDealerForPayments({ id: dealer.id, name: dealer.name });
    setIsPaymentsReceivedDialogOpen(true);
  };

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterSalesPersonId('');
    setFilterOpeningBalanceOverduePeriod('all');
    setFilterDispatchOverduePeriod('all');
  };

  const handleResetSentStatus = () => {
    setSentDealerIds(new Set());
    showSuccess('Sent status reset for all dealers.');
  };

  const handleSelectDealer = (dealerId: string, checked: boolean) => {
    setSelectedDealerIds(prev => 
      checked ? [...prev, dealerId] : prev.filter(id => id !== dealerId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableIds = dealers
        .filter(d => d.phone && !sentDealerIds.has(d.id))
        .map(d => d.id);
      setSelectedDealerIds(selectableIds);
    } else {
      setSelectedDealerIds([]);
    }
  };

  const handleSendWhatsApp = async (dealer: DealerClosingBalance) => {
    if (!user) { showError('You must be logged in to send WhatsApp messages.'); return; }
    if (!dealer.phone) { showError(`Phone number not available for ${dealer.name}.`); return; }
    if (!companyName) { showError('Company name is required. Please set it in Admin Dashboard -> Company Information.'); return; }

    setIsSendingWhatsApp(true);
    try {
      const formattedBalance = dealer.closing_balance.toFixed(2);
      const message = `Hello ${dealer.name},\n\nThis is a friendly reminder from *${companyName}* regarding your account. Your current outstanding balance is *₹${formattedBalance}*.\n\nTo ensure your account remains active and to continue placing new orders without interruption, please clear this outstanding balance promptly.\n\nThank you for your cooperation.\n\nBest regards,\n${companyName} Team`;
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerIds: [dealer.id],
          message: message,
          comboOfferId: null,
          sentByUserId: user.id,
          messageType: 'closing_balance_reminder',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to log WhatsApp message send attempt');
      showSuccess(`WhatsApp message drafted for ${dealer.name}. Please check the new tab.`);
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      setSentDealerIds(prev => new Set([...prev, dealer.id]));
    } catch (error: any) {
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleBulkSendWhatsApp = async () => {
    if (selectedDealerIds.length === 0) { showError('Please select at least one dealer.'); return; }
    if (!user) { showError('You must be logged in.'); return; }
    if (!companyName) { showError('Company name is required.'); return; }

    setIsSendingWhatsApp(true);
    const dealersToSend = dealers.filter(d => selectedDealerIds.includes(d.id) && d.phone && !sentDealerIds.has(d.id));
    if (dealersToSend.length === 0) {
      showError('No un-sent dealers with valid phone numbers selected.');
      setIsSendingWhatsApp(false);
      return;
    }

    try {
      const dealerIdsToLog = dealersToSend.map(d => d.id);
      const genericMessage = `Bulk reminder from ${companyName}. Please check your outstanding balance.`;
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerIds: dealerIdsToLog,
          message: genericMessage,
          comboOfferId: null,
          sentByUserId: user.id,
          messageType: 'closing_balance_reminder_bulk',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to log bulk send attempt');

      let successfulSends = 0;
      for (const dealer of dealersToSend) {
        const formattedBalance = dealer.closing_balance.toFixed(2);
        const message = `Hello ${dealer.name},\n\nThis is a friendly reminder from *${companyName}* regarding your account. Your current outstanding balance is *₹${formattedBalance}*.\n\nTo ensure your account remains active and to continue placing new orders without interruption, please clear this outstanding balance promptly.\n\nThank you for your cooperation.\n\nBest regards,\n${companyName} Team`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        setSentDealerIds(prev => new Set([...prev, dealer.id]));
        successfulSends++;
      }
      showSuccess(`Drafted ${successfulSends} WhatsApp messages. Please check the new tabs.`);
      setSelectedDealerIds([]);
    } catch (error: any) {
      showError(`Failed to send bulk WhatsApp messages: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };
  
  const handleSort = (key: 'name' | 'closing_balance' | 'opening_balance_due_days' | 'daysSinceLastDispatch') => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedDealers = React.useMemo(() => {
    if (dealers.length === 0) return [];
    return [...dealers].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === 'closing_balance') {
        comparison = a.closing_balance - b.closing_balance;
      } else if (sortKey === 'opening_balance_due_days' || sortKey === 'daysSinceLastDispatch') {
        const valA = a[sortKey] === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : a[sortKey]!;
        const valB = b[sortKey] === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : b[sortKey]!;
        comparison = valA - valB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [dealers, sortKey, sortDirection]);

  const generatePdf = (dealersToPrint: DealerClosingBalance[]) => {
    if (dealersToPrint.length === 0) {
      showError("No dealers to print.");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22); doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18); doc.text("Dealer Net Balance Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });
      let filterDetails = [];
      if (filterDealerName) filterDetails.push(`Dealer Name: ${filterDealerName}`);
      if (filterSalesPersonId) {
        const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
      }
      if (filterOpeningBalanceOverduePeriod !== 'all') filterDetails.push(`Op. Bal. Overdue: ${filterOpeningBalanceOverduePeriod.replace('_', ' ')}`);
      if (filterDispatchOverduePeriod !== 'all') filterDetails.push(`Dispatch Overdue: ${filterDispatchOverduePeriod.replace('_', ' ')}`);
      if (filterDetails.length > 0) { doc.setFontSize(9); doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' }); }
      
      const tableRows = dealersToPrint.map(d => ({
        ...d,
        opening_balance_str: `Rs. ${d.opening_balance.toFixed(2)}`,
        totalSales_str: `Rs. ${d.totalSales.toFixed(2)}`,
        totalPaymentsReceived_str: `Rs. ${d.totalPaymentsReceived.toFixed(2)}`,
        closing_balance_str: `Rs. ${d.closing_balance.toFixed(2)}`,
        opening_balance_due_date_str: d.opening_balance_due_date ? new Date(d.opening_balance_due_date).toLocaleDateString() : 'N/A',
        last_dispatch_date_str: d.last_dispatch_date ? new Date(d.last_dispatch_date).toLocaleDateString() : 'N/A',
        opening_balance_due_days_str: d.opening_balance_due_days !== null ? d.opening_balance_due_days.toString() : 'N/A',
        daysSinceLastDispatch_str: d.daysSinceLastDispatch !== null ? d.daysSinceLastDispatch.toString() : 'N/A',
        phone_str: d.phone || 'N/A'
      }));
      
      const totalNetBalance = dealersToPrint.reduce((sum, d) => sum + d.closing_balance, 0);
      const totalSales = dealersToPrint.reduce((sum, d) => sum + d.totalSales, 0);
      const totalPaymentsReceived = dealersToPrint.reduce((sum, d) => sum + d.totalPaymentsReceived, 0);
      const totalOpeningBalance = dealersToPrint.reduce((sum, d) => sum + d.opening_balance, 0);
      
      autoTable(doc, {
        columns: [
          { header: 'Dealer Name', dataKey: 'name' },
          { header: 'Op. Bal (Rs.)', dataKey: 'opening_balance_str' },
          { header: 'Op. Due Date', dataKey: 'opening_balance_due_date_str' },
          { header: 'Op. Due Days', dataKey: 'opening_balance_due_days_str' },
          { header: 'Total Sales (Rs.)', dataKey: 'totalSales_str' },
          { header: 'Total Rcvd (Rs.)', dataKey: 'totalPaymentsReceived_str' },
          { header: 'Net Bal (Rs.)', dataKey: 'closing_balance_str' },
          { header: 'Last Dispatch', dataKey: 'last_dispatch_date_str' },
          { header: 'Days Since Dispatch', dataKey: 'daysSinceLastDispatch_str' },
          { header: 'Phone', dataKey: 'phone_str' },
        ],
        body: tableRows,
        foot: [[{ content: 'Totals', colSpan: 1, styles: { halign: 'right', fontStyle: 'bold' } }, `Rs. ${totalOpeningBalance.toFixed(2)}`, '', '', `Rs. ${totalSales.toFixed(2)}`, `Rs. ${totalPaymentsReceived.toFixed(2)}`, `Rs. ${totalNetBalance.toFixed(2)}`, '', '', '']],
        startY: 45,
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.dataKey === 'opening_balance_due_days_str') {
            const dealer = data.row.raw as unknown as DealerClosingBalance;
            const opDueDays = dealer.opening_balance_due_days;
            if (opDueDays === null) return;

            let fillColor: [number, number, number] | undefined;
            if (opDueDays > 90) {
              fillColor = [220, 38, 38]; // red-600
            } else if (opDueDays > 60) {
              fillColor = [202, 138, 4]; // yellow-600
            } else {
              fillColor = [22, 163, 74]; // green-600
            }
            
            if (fillColor) {
              data.cell.styles.fillColor = fillColor;
              data.cell.styles.textColor = [255, 255, 255]; // White text for contrast
            }
          }
        },
        styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        margin: { top: 10, left: 5, right: 5 },
        columnStyles: {
          0: { cellWidth: 30 }, 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 20, halign: 'right' }, 5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 20, halign: 'right' },
          7: { cellWidth: 20, halign: 'center' }, 8: { cellWidth: 20, halign: 'center' }, 9: { cellWidth: 20, halign: 'center' }
        }
      });
      
      const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label || 'All';
      const safeSalesPersonName = salesPersonLabel.replace(/\s+/g, '_');
      const fileName = `${safeSalesPersonName}_dealer_net_balance_report.pdf`;

      doc.save(fileName);
      showSuccess('Dealer net balance report generated successfully!');
    } catch (error: any) { showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`); }
  };

  const allDealersSelected = selectedDealerIds.length === dealers.length && dealers.length > 0;
  const selectedDealersForRCS = dealers.filter(d => selectedDealerIds.includes(d.id));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1400px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Dealer Net Balance Report</DialogTitle>
            <DialogDescription>
              View and manage dealers with outstanding closing balances (Opening Balance + Total Sales - Total Received).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
            <div className="flex-1 min-w-[180px]"><Label htmlFor="filterDealerName">Dealer Name</Label><Input id="filterDealerName" placeholder="Filter by dealer name" value={filterDealerName} onChange={(e) => setFilterDealerName(e.target.value)} className="w-full" /></div>
            <div className="flex-1 min-w-[180px]"><Label htmlFor="filterSalesPerson">Sales Person</Label><Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}><SelectTrigger id="filterSalesPerson" className="w-full"><SelectValue placeholder="All Sales Persons" /></SelectTrigger><SelectContent><SelectItem value="all">All Sales Persons</SelectItem>{allSalesPersons.map(sp => (<SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>))}</SelectContent></Select></div>
            
            {/* NEW FILTER: Overdue Period (Opening Balance) */}
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="filterOpeningBalanceOverduePeriod">Overdue Period (Opening Balance)</Label>
              <Select 
                value={filterOpeningBalanceOverduePeriod} 
                onValueChange={(value) => setFilterOpeningBalanceOverduePeriod(value as typeof filterOpeningBalanceOverduePeriod)}
              >
                <SelectTrigger id="filterOpeningBalanceOverduePeriod" className="w-full"><SelectValue placeholder="All Balances" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Balances</SelectItem>
                  <SelectItem value="less_than_60">Less than {OVERDUE_THRESHOLD_DAYS} Days Due</SelectItem>
                  <SelectItem value="more_than_60">More than {OVERDUE_THRESHOLD_DAYS} Days Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* EXISTING FILTER: Overdue Period (Dispatch) - Renamed state */}
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="filterDispatchOverduePeriod">Overdue Period (Dispatch)</Label>
              <Select 
                value={filterDispatchOverduePeriod} 
                onValueChange={(value) => setFilterDispatchOverduePeriod(value as typeof filterDispatchOverduePeriod)}
              >
                <SelectTrigger id="filterDispatchOverduePeriod" className="w-full"><SelectValue placeholder="All Balances" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Balances</SelectItem>
                  <SelectItem value="less_than_60">Less than {OVERDUE_THRESHOLD_DAYS} Days Due</SelectItem>
                  <SelectItem value="more_than_60">More than {OVERDUE_THRESHOLD_DAYS} Days Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={fetchClosingBalances} className="flex items-center gap-2 bg-primary hover:bg-primary/90"><Search className="h-4 w-4" /> Apply Filter</Button>
            <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">Clear Filters</Button>
          </div>
          <div className="overflow-x-auto">
            {loading ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-foreground">Loading data...</p></div>) : dealers.length === 0 ? (<p className="text-center text-muted-foreground py-8">No dealer closing balance data found matching your criteria.</p>) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted"><TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="w-10 text-muted-foreground font-bold"><Checkbox checked={allDealersSelected} onCheckedChange={handleSelectAll} aria-label="Select all dealers" disabled={isSendingWhatsApp} /></TableHead>
                    <TableHead className="text-muted-foreground font-bold cursor-pointer hover:bg-muted/70" onClick={() => handleSort('name')}><div className="flex items-center justify-between">Dealer Name{sortKey === 'name' ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : (<ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />)}</div></TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Opening Bal (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Op. Due Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center cursor-pointer hover:bg-muted/70" onClick={() => handleSort('opening_balance_due_days')}><div className="flex items-center justify-center">Op. Due Days{sortKey === 'opening_balance_due_days' ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : (<ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />)}</div></TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Sales (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Rcvd (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right cursor-pointer hover:bg-muted/70" onClick={() => handleSort('closing_balance')}><div className="flex items-center justify-end">Net Balance (₹){sortKey === 'closing_balance' ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : (<ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />)}</div></TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Last Dispatch</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center cursor-pointer hover:bg-muted/70" onClick={() => handleSort('daysSinceLastDispatch')}><div className="flex items-center justify-center">Days Since Dispatch{sortKey === 'daysSinceLastDispatch' ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : (<ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />)}</div></TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Phone</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sortedDealers.map((dealer) => {
                      const isDealerSent = sentDealerIds.has(dealer.id);
                      const isDealerSelected = selectedDealerIds.includes(dealer.id);
                      const canSend = !isSendingWhatsApp && dealer.phone && !isDealerSent;
                      const opDueDays = dealer.opening_balance_due_days;
                      const rowColorClass = opDueDays === null ? 'hover:bg-accent/50' :
                                             opDueDays > 90 ? 'bg-red-600 text-white dark:bg-red-800 dark:text-white hover:bg-red-700/90 dark:hover:bg-red-800/90' :
                                             opDueDays > 60 ? 'bg-yellow-600 text-white dark:bg-yellow-800 dark:text-white hover:bg-yellow-700/90 dark:hover:bg-yellow-800/90' :
                                             'bg-green-600 text-white dark:bg-green-800 dark:text-white hover:bg-green-700/90 dark:hover:bg-green-800/90';

                      return (
                        <TableRow key={dealer.id} className={cn(rowColorClass)}>
                          <TableCell><Checkbox checked={isDealerSelected} onCheckedChange={(checked) => handleSelectDealer(dealer.id, !!checked)} disabled={isSendingWhatsApp} /></TableCell>
                          <TableCell className="font-medium">{dealer.name}</TableCell>
                          <TableCell className="text-right">₹{dealer.opening_balance.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{dealer.opening_balance_due_date ? new Date(dealer.opening_balance_due_date).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell className="text-center font-semibold">
                            {opDueDays !== null ? opDueDays : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-medium">₹{dealer.totalSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">₹{dealer.totalPaymentsReceived.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">₹{dealer.closing_balance.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{dealer.last_dispatch_date ? new Date(dealer.last_dispatch_date).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell className="text-center">{dealer.daysSinceLastDispatch !== null ? dealer.daysSinceLastDispatch : 'N/A'}</TableCell>
                          <TableCell className="text-center">{dealer.phone || 'N/A'}</TableCell>
                          <TableCell className="text-center"><div className="flex justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(dealer)} title={isDealerSent ? "Message Sent" : "Send WhatsApp Reminder"} disabled={!canSend}>{isSendingWhatsApp && isDealerSent ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<MessageCircle className="h-4 w-4 text-blue-500" />)}</Button>
                            <Button variant="ghost" size="icon" onClick={() => handleInitiatePayment(dealer.id, dealer.name)} title="Add Payment for Outstanding Balance" disabled={loading || isSendingWhatsApp}><DollarSign className="h-4 w-4 text-green-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleViewPayments(dealer)} title="View Received Payments" disabled={loading || isSendingWhatsApp}><Eye className="h-4 w-4 text-purple-500" /></Button>
                          </div></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <UiTableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="text-right font-bold">Totals</TableCell>
                      <TableCell className="text-right font-bold">₹{dealers.reduce((sum, d) => sum + d.opening_balance, 0).toFixed(2)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right font-bold">₹{dealers.reduce((sum, d) => sum + d.totalSales, 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">₹{dealers.reduce((sum, d) => sum + d.totalPaymentsReceived, 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">₹{dealers.reduce((sum, d) => sum + d.closing_balance, 0).toFixed(2)}</TableCell>
                      <TableCell colSpan={4}></TableCell>
                    </TableRow>
                  </UiTableFooter>
                </Table>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-4">
            <Button onClick={handleBulkSendWhatsApp} disabled={isSendingWhatsApp || selectedDealerIds.length === 0} className="flex items-center gap-2 bg-green-600 hover:bg-green-700"><Send className="h-4 w-4" /> {isSendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send Bulk WhatsApp (${selectedDealerIds.length})`}</Button>
            <Button onClick={() => setIsRCSBulkSenderOpen(true)} disabled={selectedDealerIds.length === 0} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"><MessageCircle className="h-4 w-4" /> Send Bulk RCS (Mock)</Button>
            {sentDealerIds.size > 0 && (<Button variant="outline" onClick={handleResetSentStatus} disabled={isSendingWhatsApp} className="flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Enable All to Resend</Button>)}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => generatePdf(sortedDealers)} disabled={dealers.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
            <Button variant="outline" onClick={() => generatePdf(sortedDealers.filter(d => selectedDealerIds.includes(d.id)))} disabled={selectedDealerIds.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground"><Printer className="mr-2 h-4 w-4" /> Print Selected ({selectedDealerIds.length})</Button>
            <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
          </DialogFooter>
        </DialogContent>
        <RCSBulkMessageSender isOpen={isRCSBulkSenderOpen} onOpenChange={setIsRCSBulkSenderOpen} selectedDealers={selectedDealersForRCS} companyName={companyName} />
        {selectedOrderForPaymentUpdate && (<UpdatePaymentDialog orderToUpdate={selectedOrderForPaymentUpdate} isOpen={isUpdatePaymentDialogOpen} onOpenChange={setIsUpdatePaymentDialogOpen} onPaymentUpdated={handlePaymentUpdated} />)}
      </Dialog>
      {selectedDealerForPayments && (<DealerPaymentsReceivedDialog dealerId={selectedDealerForPayments.id} dealerName={selectedDealerForPayments.name} isOpen={isPaymentsReceivedDialogOpen} onOpenChange={setIsPaymentsReceivedDialogOpen} />)}
    </>
  );
};

export default DealerClosingBalanceReportDialog;