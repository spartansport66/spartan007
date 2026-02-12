"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface LedgerEntry {
  transaction_date: string;
  details: string;
  debit: number | null;
  credit: number | null;
}

interface FormattedLedgerEntry extends LedgerEntry {
  balance: number;
  days_elapsed: number | null;
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerLedgerReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FetchedPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id: string | null;
  order_id: string | null; // Now nullable
  dealer_id: string | null; // New
  orders: {
    dealer_id: string;
    order_number: number;
  } | null;
}

const calculateDaysDifference = (dateString: string): number | null => {
  if (!dateString || new Date(dateString).getFullYear() <= 1970) return null;
  const targetDate = new Date(dateString);
  const today = new Date();
  
  targetDate.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);

  if (targetDate > today) return 0;

  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

const DealerLedgerReportDialog: React.FC<DealerLedgerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [transactions, setTransactions] = useState<FormattedLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedDealerPhone, setSelectedDealerPhone] = useState<string | null>(null);
  const [selectedDealerName, setSelectedDealerName] = useState<string | null>(null);
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearch, setDealerSearch] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('[DealerLedgerReportDialog] Error fetching company name for PDF:', error.message);
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
      const { data: dealerDetails, error: dealerDetailsError } = await supabase.from('dealers').select('name, phone').eq('id', dealerId).single();
      if (dealerDetailsError) throw dealerDetailsError;
      setSelectedDealerPhone(dealerDetails?.phone || null);
      setSelectedDealerName(dealerDetails?.name || null);

      const { data, error } = await supabase.rpc('get_dealer_ledger', {
        dealer_id_param: dealerId
      });

      if (error) {
        showError('Failed to fetch ledger report.');
        console.error('Error fetching ledger:', error);
        setTransactions([]);
      } else {
        const openingBalanceEntry = (data || []).find((e: LedgerEntry) => e.details === 'Opening Balance');
        const otherEntries = (data || []).filter((e: LedgerEntry) => e.details !== 'Opening Balance');

        otherEntries.sort((a: LedgerEntry, b: LedgerEntry) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

        const sortedEntries = openingBalanceEntry ? [openingBalanceEntry, ...otherEntries] : otherEntries;

        let currentBalance = 0;
        const formattedData = sortedEntries.map((entry: LedgerEntry) => {
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;
            if (entry.details === 'Opening Balance') {
                currentBalance = debit - credit;
            } else {
                currentBalance = currentBalance + debit - credit;
            }
            const days_elapsed = (debit > 0) ? calculateDaysDifference(entry.transaction_date) : null;
            return { ...entry, balance: currentBalance, days_elapsed };
        });
        setTransactions(formattedData);
      }
    } catch (error: any) {
      showError(`Failed to load dealer ledger: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterDealerId, filterFromDate, filterToDate, user?.id]);

  useEffect(() => {
    if (isOpen) {
      const fetchAllDealers = async () => {
        const { data, error } = await supabase.from('dealers').select('id, name').order('name', { ascending: true });
        if (error) {
          showError('Failed to load dealers for filter.');
          setAllDealers([]);
        } else {
          setAllDealers(data.map(d => ({ value: d.id, label: d.name })));
        }
      };
      fetchAllDealers();
      fetchCompanyInfo();
      if (filterDealerId) fetchLedgerData();
    }
  }, [isOpen, fetchLedgerData, fetchCompanyInfo, filterDealerId]);

  const handleClearFilters = () => {
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleSendWhatsApp = async (balance: number) => {
    if (!user || !filterDealerId || !selectedDealerPhone || !companyName || balance <= 0) return;
    setIsSendingWhatsApp(true);
    try {
      const message = `Hello ${selectedDealerName},\n\nThis is a reminder from *${companyName}* that your current outstanding balance is *₹${balance.toFixed(2)}*. Please clear your balance as soon as possible.\n\nThank you!`;
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerIds: [filterDealerId], message, sentByUserId: user.id, messageType: 'balance_due_reminder' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to log WhatsApp message send attempt');
      showSuccess(`WhatsApp message drafted for ${selectedDealerName}. Please check the new tab.`);
      window.open(`https://web.whatsapp.com/send?phone=${selectedDealerPhone}&text=${encodeURIComponent(message)}`, '_blank');
    } catch (error: any) {
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
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

      const tableColumn = ["Date", "Description", "Days", "Debit (₹)", "Credit (₹)", "Balance (₹)"];
      const tableRows = transactions.map(entry => [
        entry.transaction_date, 
        entry.details, 
        entry.days_elapsed !== null ? entry.days_elapsed.toString() : '',
        entry.debit?.toFixed(2) || '0.00', 
        entry.credit?.toFixed(2) || '0.00', 
        entry.balance.toFixed(2)
      ]);
      const totalDebit = transactions.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = transactions.reduce((sum, entry) => sum + (entry.credit || 0), 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Totals', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalDebit.toFixed(2)}`, `₹${totalCredit.toFixed(2)}`, '']],
        startY: 55,
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: [0, 0, 0] },
        footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: { 0: { cellWidth: 25, halign: 'center' }, 1: { cellWidth: 90 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 30, halign: 'right' } }
      });

      doc.save(`dealer_ledger_report_${dealerNameForPdf.replace(/\s/g, '_')}.pdf`);
      showSuccess('Dealer ledger report generated successfully!');
    } catch (error: any) {
      showError(`Failed to generate dealer ledger report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  const filteredDealers = useMemo(() => {
    if (!dealerSearch) return allDealers;
    return allDealers.filter(d => d.label.toLowerCase().includes(dealerSearch.toLowerCase()));
  }, [allDealers, dealerSearch]);

  const totalDebit = useMemo(() => transactions.reduce((sum, entry) => sum + (entry.debit || 0), 0), [transactions]);
  const totalCredit = useMemo(() => transactions.reduce((sum, entry) => sum + (entry.credit || 0), 0), [transactions]);
  const finalBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Ledger Report</DialogTitle>
          <DialogDescription>View a detailed ledger of transactions for a specific dealer.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[300px]">
            <Label htmlFor="filterDealer">Select Dealer</Label>
            <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">{selectedDealerName}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <div className="p-2 border-b"><Input placeholder="Search dealer..." value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} className="h-8" /></div>
                <ScrollArea className="h-[200px]"><div className="p-1">{filteredDealers.map((d) => (<Button key={d.value} variant="ghost" className="w-full justify-start font-normal" onClick={() => { setFilterDealerId(d.value); setIsDealerPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", filterDealerId === d.value ? "opacity-100" : "opacity-0")} />{d.label}</Button>))}</div></ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex-1 min-w-[150px]"><Label htmlFor="filterFromDate">From Date</Label><Input id="filterFromDate" type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full" /></div>
          <div className="flex-1 min-w-[150px]"><Label htmlFor="filterToDate">To Date</Label><Input id="filterToDate" type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full" /></div>
          <Button onClick={fetchLedgerData} disabled={!filterDealerId} className="flex items-center gap-2 bg-primary hover:bg-primary/90"><Search className="h-4 w-4" /> Apply Filters</Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">Clear Filters</Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-foreground">Loading ledger data...</p></div>) : transactions.length === 0 ? (<p className="text-center text-muted-foreground py-8">No ledger data found for the selected criteria.</p>) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted"><TableRow className="bg-muted hover:bg-muted/90"><TableHead className="text-muted-foreground font-bold">Date</TableHead><TableHead className="text-muted-foreground font-bold">Description</TableHead><TableHead className="text-muted-foreground font-bold text-center">Days</TableHead><TableHead className="text-muted-foreground font-bold text-right">Debit (₹)</TableHead><TableHead className="text-muted-foreground font-bold text-right">Credit (₹)</TableHead><TableHead className="text-muted-foreground font-bold text-right">Balance (₹)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {transactions.map((entry, index) => (
                    <TableRow key={index} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{entry.transaction_date}</TableCell>
                      <TableCell className="text-foreground">{entry.details}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{entry.days_elapsed !== null ? entry.days_elapsed : ''}</TableCell>
                      <TableCell className="text-foreground text-right">{entry.debit && entry.debit > 0 ? entry.debit.toFixed(2) : ''}</TableCell>
                      <TableCell className="text-foreground text-right">{entry.credit && entry.credit > 0 ? entry.credit.toFixed(2) : ''}</TableCell>
                      <TableCell className="text-foreground text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <UiTableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Totals</TableCell>
                    <TableCell className="text-right font-bold">₹{totalDebit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">₹{totalCredit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">₹{finalBalance.toFixed(2)}</TableCell>
                  </TableRow>
                </UiTableFooter>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => handleSendWhatsApp(finalBalance)} disabled={!filterDealerId || finalBalance <= 0 || isSendingWhatsApp} className="flex items-center gap-2">
            {isSendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Send Balance Reminder
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={transactions.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerLedgerReportDialog;