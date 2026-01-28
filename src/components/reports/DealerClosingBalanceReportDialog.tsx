"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, Scale, MessageCircle, RotateCcw, Send, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { Checkbox } from '@/components/ui/checkbox';
import RCSBulkMessageSender from '@/components/RCSBulkMessageSender'; // Import the new component
import { cn } from '@/lib/utils';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface DealerClosingBalance {
  id: string; // Dealer ID
  name: string; // Dealer Name
  closing_balance: number; // Calculated field
  last_billing_date: string | null; // Now directly from dealers table
  phone: string; // Added phone number
  daysSinceLastBill: number | null; // New: Calculated days since last bill
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerClosingBalanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const OVERDUE_THRESHOLD_DAYS = 60;

const DealerClosingBalanceReportDialog: React.FC<DealerClosingBalanceReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<DealerClosingBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterOverduePeriod, setFilterOverduePeriod] = useState<'all' | 'less_than_60' | 'more_than_60'>('all'); // New filter state
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [sentDealerIds, setSentDealerIds] = useState<Set<string>>(new Set());
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]); // State for bulk selection
  const [isRCSBulkSenderOpen, setIsRCSBulkSenderOpen] = useState(false); // New state for RCS dialog
  
  // Sorting states
  const [sortKey, setSortKey] = useState<'name' | 'closing_balance' | 'daysSinceLastBill'>('name');
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

  const calculateDaysSinceLastBill = (lastBillingDate: string | null): number | null => {
    if (!lastBillingDate) return null;
    const lastBill = new Date(lastBillingDate);
    const today = new Date();
    
    // Normalize dates to midnight UTC for accurate day difference calculation
    lastBill.setUTCHours(0, 0, 0, 0);
    today.setUTCHours(0, 0, 0, 0);

    // If the last bill date is today or in the future, the overdue period is 0 days.
    if (lastBill.getTime() >= today.getTime()) {
      return 0;
    }

    const diffTime = today.getTime() - lastBill.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const fetchClosingBalances = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all sales persons first to populate the filter dropdown
      const { data: salesPersonsData, error: salesPersonsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person')
        .order('first_name', { ascending: true });

      if (salesPersonsError) {
        console.error('[DealerClosingBalanceReportDialog] Error fetching sales persons for filter:', salesPersonsError.message);
        showError('Failed to load sales persons for filter.');
        setAllSalesPersons([]);
      } else {
        setAllSalesPersons((salesPersonsData || []).map(sp => ({
          value: sp.id,
          label: `${sp.first_name} ${sp.last_name || ''}`.trim(),
        })));
      }

      // 2. Fetch all dealer data needed for calculation
      let query;
      if (filterSalesPersonId) {
        query = supabase
          .from('dealers')
          .select(`
            id,
            name,
            phone,
            last_billing_date,
            dealer_balances(opening_balance),
            orders(total_amount, payment_status, payments(amount, status)),
            dealer_sales_persons!inner(sales_person_id)
          `)
          .eq('dealer_sales_persons.sales_person_id', filterSalesPersonId);
      } else {
        query = supabase
          .from('dealers')
          .select(`
            id,
            name,
            phone,
            last_billing_date,
            dealer_balances(opening_balance),
            orders(total_amount, payment_status, payments(amount, status))
          `);
      }

      if (filterDealerName) {
        query = query.ilike('name', `%${filterDealerName}%`);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;
      if (error) {
        console.error('[DealerClosingBalanceReportDialog] Error fetching dealer data:', error.message);
        showError('Failed to load dealer data.');
        setDealers([]);
      } else {
        const formattedDealers: DealerClosingBalance[] = (data || []).map((d: any) => {
          const openingBalance = d.dealer_balances?.opening_balance || 0;
          
          let totalSales = 0;
          let totalPayments = 0;

          (d.orders || []).forEach((order: any) => {
            // All orders are debits (increase amount owed)
            totalSales += order.total_amount;

            // Iterate through payments associated with this order
            (order.payments || []).forEach((payment: any) => {
              if (payment.status === 'completed') {
                totalPayments += payment.amount;
              }
            });
          });

          // Calculation: Closing Balance = Opening Balance + Total Sales - Total Payments
          const closingBalance = openingBalance + totalSales - totalPayments;
          const daysSinceLastBill = calculateDaysSinceLastBill(d.last_billing_date);
          
          return {
            id: d.id,
            name: d.name,
            phone: d.phone || '',
            closing_balance: closingBalance,
            last_billing_date: d.last_billing_date,
            daysSinceLastBill: daysSinceLastBill,
          };
        }).filter(d => d.closing_balance > 0); // Only show dealers with positive closing balance
        
        // Apply overdue period filter
        const filteredByOverdue = formattedDealers.filter(dealer => {
          if (filterOverduePeriod === 'all') return true;
          
          const days = dealer.daysSinceLastBill;
          if (days === null) return false; // Must have a last billing date to be filtered by days

          if (filterOverduePeriod === 'less_than_60') {
            return days <= OVERDUE_THRESHOLD_DAYS;
          }
          if (filterOverduePeriod === 'more_than_60') {
            return days > OVERDUE_THRESHOLD_DAYS;
          }
          return true;
        });

        setDealers(filteredByOverdue);
      }
    } catch (error: any) {
      console.error('Error in fetchClosingBalances:', error.message);
      showError('An unexpected error occurred while fetching dealer data.');
    } finally {
      setLoading(false);
    }
  }, [filterDealerName, filterSalesPersonId, filterOverduePeriod]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchClosingBalances();
    } else {
      // Reset sent status and selection when dialog closes
      setSentDealerIds(new Set());
      setSelectedDealerIds([]);
    }
  }, [isOpen, fetchCompanyInfo, fetchClosingBalances]);

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterSalesPersonId('');
    setFilterOverduePeriod('all');
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
      // Only select dealers who have a phone number and haven't been sent a message yet
      const selectableIds = dealers
        .filter(d => d.phone && !sentDealerIds.has(d.id))
        .map(d => d.id);
      setSelectedDealerIds(selectableIds);
    } else {
      setSelectedDealerIds([]);
    }
  };

  const handleSendWhatsApp = async (dealer: DealerClosingBalance) => {
    if (!user) {
      showError('You must be logged in to send WhatsApp messages.');
      return;
    }
    if (!dealer.phone) {
      showError(`Phone number not available for ${dealer.name}.`);
      return;
    }
    if (!companyName) {
      showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.');
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      const formattedBalance = dealer.closing_balance.toFixed(2);
      
      // Draft a professional message
      const message = `Hello ${dealer.name},\n\nThis is a friendly reminder from *${companyName}* regarding your account. Your current outstanding balance is *₹${formattedBalance}*.\n\nTo ensure your account remains active and to continue placing new orders without interruption, please clear this outstanding balance promptly.\n\nThank you for your cooperation.\n\nBest regards,\n${companyName} Team`;

      // 1. Log the message send attempt via Edge Function
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: [dealer.id],
          message: message,
          comboOfferId: null,
          sentByUserId: user.id,
          messageType: 'closing_balance_reminder',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log WhatsApp message send attempt');
      }

      // 2. Open WhatsApp Web/Desktop
      showSuccess(`WhatsApp message drafted for ${dealer.name}. Please check the new tab.`);
      
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      
      // 3. Update local state to mark as sent
      setSentDealerIds(prev => new Set([...prev, dealer.id]));
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleBulkSendWhatsApp = async () => {
    if (selectedDealerIds.length === 0) {
      showError('Please select at least one dealer to send messages.');
      return;
    }
    if (!user) {
      showError('You must be logged in to send WhatsApp messages.');
      return;
    }
    if (!companyName) {
      showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.');
      return;
    }

    setIsSendingWhatsApp(true);
    const dealersToSend = dealers.filter(d => selectedDealerIds.includes(d.id) && d.phone && !sentDealerIds.has(d.id));
    
    if (dealersToSend.length === 0) {
      showError('No un-sent dealers with valid phone numbers selected.');
      setIsSendingWhatsApp(false);
      return;
    }

    try {
      const dealerIdsToLog = dealersToSend.map(d => d.id);
      
      // 1. Log the bulk message send attempt via Edge Function
      const genericMessage = `Bulk reminder from ${companyName}. Please check your outstanding balance.`;
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: dealerIdsToLog,
          message: genericMessage, // Log a generic message for the bulk action
          comboOfferId: null,
          sentByUserId: user.id,
          messageType: 'closing_balance_reminder_bulk',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log bulk WhatsApp message send attempt');
      }

      // 2. Open individual WhatsApp tabs for each selected dealer
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
      setSelectedDealerIds([]); // Clear selection after bulk send attempt
    } catch (error: any) {
      console.error('[DealerClosingBalanceReportDialog] Error during bulk WhatsApp send:', error);
      showError(`Failed to send bulk WhatsApp messages: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleSort = (key: 'name' | 'closing_balance' | 'daysSinceLastBill') => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedDealers = React.useMemo(() => {
    if (dealers.length === 0) return [];

    const sorted = [...dealers].sort((a, b) => {
      let comparison = 0;

      if (sortKey === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === 'closing_balance') {
        comparison = a.closing_balance - b.closing_balance;
      } else if (sortKey === 'daysSinceLastBill') {
        // Handle nulls: nulls should go to the end regardless of direction
        const valA = a.daysSinceLastBill === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : a.daysSinceLastBill;
        const valB = b.daysSinceLastBill === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : b.daysSinceLastBill;
        
        comparison = valA - valB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [dealers, sortKey, sortDirection]);

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("Dealer Closing Balance Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterDealerName) filterDetails.push(`Dealer Name: ${filterDealerName}`);
      if (filterSalesPersonId) {
        const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
      }
      if (filterOverduePeriod === 'less_than_60') filterDetails.push(`Overdue Period: <= ${OVERDUE_THRESHOLD_DAYS} Days`);
      if (filterOverduePeriod === 'more_than_60') filterDetails.push(`Overdue Period: > ${OVERDUE_THRESHOLD_DAYS} Days`);
      
      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      // Updated column header for PDF
      const tableColumn = ["Dealer Name", "Closing Balance (₹)", "Last Bill Date", "Days Since Last Bill", "Phone"];
      const tableRows = sortedDealers.map(dealer => [
        dealer.name,
        dealer.closing_balance.toFixed(2),
        dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : 'N/A',
        dealer.daysSinceLastBill !== null ? dealer.daysSinceLastBill.toString() : 'N/A',
        dealer.phone || 'N/A',
      ]);

      const totalClosingBalance = sortedDealers.reduce((sum, dealer) => sum + dealer.closing_balance, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Total Closing Balance', styles: { halign: 'right', fontStyle: 'bold' }, colSpan: 2 },
            `₹${totalClosingBalance.toFixed(2)}`,
            '',
            '',
            '',
          ]
        ],
        startY: 45,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        footStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 50 }, // Dealer Name
          1: { cellWidth: 30, halign: 'right' }, // Closing Balance
          2: { cellWidth: 30, halign: 'center' }, // Last Bill Date
          3: { cellWidth: 30, halign: 'center' }, // Days Since Last Bill
          4: { cellWidth: 30, halign: 'center' }, // Phone
        }
      });

      doc.save('dealer_closing_balance_report.pdf');
      showSuccess('Dealer closing balance report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  const allDealersSelected = selectedDealerIds.length === dealers.length && dealers.length > 0;
  
  const selectedDealersForRCS = dealers.filter(d => selectedDealerIds.includes(d.id));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Closing Balance Report</DialogTitle>
          <DialogDescription>
            View and manage dealers with outstanding closing balances (Opening Balance + Total Sales - Total Payments).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterDealerName">Dealer Name</Label>
            <Input
              id="filterDealerName"
              placeholder="Filter by dealer name"
              value={filterDealerName}
              onChange={(e) => setFilterDealerName(e.target.value)}
              className="w-full"
            />
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
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterOverduePeriod">Overdue Period</Label>
            <Select value={filterOverduePeriod} onValueChange={(value) => setFilterOverduePeriod(value as typeof filterOverduePeriod)}>
              <SelectTrigger id="filterOverduePeriod" className="w-full">
                <SelectValue placeholder="All Balances" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positive Balances</SelectItem>
                <SelectItem value="less_than_60">Less than {OVERDUE_THRESHOLD_DAYS} Days Due</SelectItem>
                <SelectItem value="more_than_60">More than {OVERDUE_THRESHOLD_DAYS} Days Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchClosingBalances} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filter
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading data...</p>
            </div>
          ) : dealers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No dealer closing balance data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="w-10 text-muted-foreground font-bold">
                      <Checkbox
                        checked={allDealersSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all dealers"
                        disabled={isSendingWhatsApp}
                      />
                    </TableHead>
                    <TableHead 
                      className="text-muted-foreground font-bold cursor-pointer hover:bg-muted/70"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center justify-between">
                        Dealer Name
                        {sortKey === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-muted-foreground font-bold text-right cursor-pointer hover:bg-muted/70"
                      onClick={() => handleSort('closing_balance')}
                    >
                      <div className="flex items-center justify-end">
                        Closing Balance (₹)
                        {sortKey === 'closing_balance' ? (
                          sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Last Bill Date</TableHead>
                    <TableHead 
                      className="text-muted-foreground font-bold text-center cursor-pointer hover:bg-muted/70"
                      onClick={() => handleSort('daysSinceLastBill')}
                    >
                      <div className="flex items-center justify-center">
                        Days Since Last Bill
                        {sortKey === 'daysSinceLastBill' ? (
                          sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Phone</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDealers.map((dealer) => {
                    const isDealerSent = sentDealerIds.has(dealer.id);
                    const isDealerSelected = selectedDealerIds.includes(dealer.id);
                    const canSend = !isSendingWhatsApp && dealer.phone && !isDealerSent;
                    const isOverdue = dealer.daysSinceLastBill !== null && dealer.daysSinceLastBill > OVERDUE_THRESHOLD_DAYS;

                    return (
                      <TableRow 
                        key={dealer.id} 
                        className={cn("hover:bg-accent/50", isOverdue && "bg-red-50/50 hover:bg-red-100/50")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isDealerSelected}
                            onCheckedChange={(checked) => handleSelectDealer(dealer.id, !!checked)}
                            disabled={isSendingWhatsApp}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                        <TableCell className="text-right">
                          {`₹${dealer.closing_balance.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className={cn("text-center text-muted-foreground", isOverdue && "font-semibold text-red-800 dark:text-red-200")}>
                          {dealer.daysSinceLastBill !== null ? dealer.daysSinceLastBill : 'N/A'}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {dealer.phone || 'N/A'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleSendWhatsApp(dealer)}
                              title={isDealerSent ? "Message Sent" : "Send WhatsApp Reminder"}
                              disabled={!canSend}
                            >
                              {isSendingWhatsApp && isDealerSent ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                              )}
                            </Button>
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

        <div className="flex justify-between items-center mt-4">
          <Button
            onClick={handleBulkSendWhatsApp}
            disabled={isSendingWhatsApp || selectedDealerIds.length === 0}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Send className="h-4 w-4" /> 
            {isSendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send Bulk WhatsApp (${selectedDealerIds.length})`}
          </Button>
          
          <Button
            onClick={() => setIsRCSBulkSenderOpen(true)}
            disabled={selectedDealerIds.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <MessageCircle className="h-4 w-4" /> 
            Send Bulk RCS (Mock)
          </Button>

          {sentDealerIds.size > 0 && (
            <Button 
              variant="outline" 
              onClick={handleResetSentStatus} 
              disabled={isSendingWhatsApp}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Enable All to Resend
            </Button>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={dealers.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
      
      <RCSBulkMessageSender
        isOpen={isRCSBulkSenderOpen}
        onOpenChange={setIsRCSBulkSenderOpen}
        selectedDealers={selectedDealersForRCS}
        companyName={companyName}
      />
    </Dialog>
  );
};

export default DealerClosingBalanceReportDialog;