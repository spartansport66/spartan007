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
import { Checkbox } from '@/components/ui/checkbox';

interface LedgerEntry {
  transaction_date: string;
  details: string;
  debit: number | null;
  credit: number | null;
  transaction_id: string | null;
  transaction_type: string | null;
}

interface FormattedLedgerEntry extends LedgerEntry {
  balance: number;
  days_elapsed: number | null;
}

interface ItemLedgerEntry {
  parent_id: string;
  parent_type: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_value: number;
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerLedgerReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const calculateDaysDifference = (dateString: string): number | null => {
  if (!dateString || new Date(dateString).getFullYear() <= 1970) return null;
  const targetDate = new Date(dateString);
  const today = new Date();
  targetDate.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);
  if (targetDate > today) return 0;
  const diffTime = today.getTime() - targetDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const DealerLedgerReportDialog: React.FC<DealerLedgerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [transactions, setTransactions] = useState<FormattedLedgerEntry[]>([]);
  const [itemLedgerEntries, setItemLedgerEntries] = useState<ItemLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [showItemWise, setShowItemWise] = useState(false);
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
    }
  }, [isOpen, fetchCompanyInfo]);

  useEffect(() => {
    if (!isOpen || !filterDealerId) {
      setTransactions([]);
      setItemLedgerEntries([]);
      if (isOpen) setLoading(false);
      return;
    }

    const fetchLedgerData = async () => {
      setLoading(true);
      try {
        const dealerId = filterDealerId;
        const { data: dealerDetails, error: dealerDetailsError } = await supabase.from('dealers').select('name, phone').eq('id', dealerId).single();
        if (dealerDetailsError) throw dealerDetailsError;
        setSelectedDealerPhone(dealerDetails?.phone || null);
        setSelectedDealerName(dealerDetails?.name || null);

        const { data, error } = await supabase.rpc('get_dealer_ledger', {
          dealer_id_param: dealerId,
          p_show_pending_only: showPendingOnly
        });
        if (error) throw error;
        
        let currentBalance = 0;
        const formattedData = (data || []).map((entry: LedgerEntry) => {
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;
            if (entry.details === 'Opening Balance') {
                currentBalance = debit - credit;
            } else {
                if (!entry.details.includes('Pending Approval')) {
                    currentBalance = currentBalance + debit - credit;
                }
            }
            const days_elapsed = (debit > 0) ? calculateDaysDifference(entry.transaction_date) : null;
            return { ...entry, balance: currentBalance, days_elapsed };
        });
        setTransactions(formattedData);

        if (showItemWise) {
          const { data: itemData, error: itemError } = await supabase.rpc('get_dealer_item_ledger', {
            dealer_id_param: dealerId
          });
          if (itemError) throw itemError;
          setItemLedgerEntries(itemData || []);
        } else {
          setItemLedgerEntries([]);
        }

      } catch (error: any) {
        showError(`Failed to load dealer ledger: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchLedgerData();
  }, [isOpen, filterDealerId, showPendingOnly, showItemWise]);

  const handleClearFilters = () => {
    setFilterDealerId('');
    setShowPendingOnly(false);
    setShowItemWise(false);
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
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Ledger Report</DialogTitle>
          <DialogDescription>View the transaction history for a specific dealer.</DialogDescription>
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
          <div className="flex items-center space-x-2"><Checkbox id="showPendingOnly" checked={showPendingOnly} onCheckedChange={(checked) => setShowPendingOnly(!!checked)} /><Label htmlFor="showPendingOnly">Show Pending Only</Label></div>
          <div className="flex items-center space-x-2"><Checkbox id="showItemWise" checked={showItemWise} onCheckedChange={(checked) => setShowItemWise(!!checked)} /><Label htmlFor="showItemWise">Show Item-wise Details</Label></div>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">Clear Filters</Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-foreground">Loading ledger data...</p></div>) : !filterDealerId ? (<p className="text-center text-muted-foreground py-8">Please select a dealer.</p>) : (
            transactions.length === 0 ? <p className="text-center text-muted-foreground py-8">No transactions found.</p> : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Particulars</TableHead><TableHead className="text-center">Days</TableHead><TableHead className="text-right">Debit (₹)</TableHead><TableHead className="text-right">Credit (₹)</TableHead><TableHead className="text-right">Balance (₹)</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {transactions.map((entry, index) => {
                      const items = showItemWise && (entry.transaction_type === 'order' || entry.transaction_type === 'sales_return')
                        ? itemLedgerEntries.filter(item => item.parent_id === entry.transaction_id)
                        : [];
                      return (
                        <React.Fragment key={entry.transaction_id || index}>
                          <TableRow>
                            <TableCell>{new Date(entry.transaction_date).toLocaleDateString()}</TableCell>
                            <TableCell>{entry.details}</TableCell>
                            <TableCell className="text-center">{entry.days_elapsed !== null ? entry.days_elapsed : ''}</TableCell>
                            <TableCell className="text-right text-red-600">{entry.debit ? entry.debit.toFixed(2) : ''}</TableCell>
                            <TableCell className="text-right text-green-600">{entry.credit ? entry.credit.toFixed(2) : ''}</TableCell>
                            <TableCell className="text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                          </TableRow>
                          {items.map((item, itemIndex) => (
                            <TableRow key={`${entry.transaction_id}-${itemIndex}`} className="bg-muted/30 text-xs">
                              <TableCell></TableCell>
                              <TableCell colSpan={5} className="py-1 px-8">
                                <div className="flex justify-between">
                                  <span>{item.product_name}</span>
                                  <span>Qty: {item.quantity} @ ₹{item.unit_price.toFixed(2)} = ₹{item.total_value.toFixed(2)}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                  <UiTableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Totals</TableCell><TableCell className="text-right font-bold">₹{totalDebit.toFixed(2)}</TableCell><TableCell className="text-right font-bold">₹{totalCredit.toFixed(2)}</TableCell><TableCell className="text-right font-bold">₹{finalBalance.toFixed(2)}</TableCell></TableRow></UiTableFooter>
                </Table>
              </div>
            )
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { /* handleSendWhatsApp(finalBalance) */ }} disabled={!filterDealerId || finalBalance <= 0 || isSendingWhatsApp} className="flex items-center gap-2">
            {isSendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Send Balance Reminder
          </Button>
          <Button variant="outline" onClick={() => { /* handlePrint() */ }} disabled={transactions.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerLedgerReportDialog;