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
  bill_amount: number | null;
  transaction_id: string | null;
  transaction_type: string | null;
}

interface FormattedLedgerEntry extends LedgerEntry {
  balance: number;
  days_elapsed: number | null;
  payment_status?: 'pending_approval' | 'completed' | 'rejected'; // For payment_received entries
}

interface ItemLedgerEntry {
  transaction_date: string;
  transaction_type: string;
  order_number: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
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

  const fetchLedgerData = useCallback(async (dealerId: string, pendingOnly: boolean, itemWise: boolean) => {
    if (!dealerId) {
      setTransactions([]);
      setItemLedgerEntries([]);
      setSelectedDealerPhone(null);
      setSelectedDealerName(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: dealerDetails, error: dealerDetailsError } = await supabase.from('dealers').select('name, phone').eq('id', dealerId).single();
      if (dealerDetailsError) throw dealerDetailsError;
      setSelectedDealerPhone(dealerDetails?.phone || null);
      setSelectedDealerName(dealerDetails?.name || null);

      const { data, error } = await supabase.rpc('get_dealer_ledger', {
        dealer_id_param: dealerId,
        p_show_pending_only: pendingOnly
      });
      if (error) throw error;
      
      // Fetch payment_received data for this dealer
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_received')
        .select('id, amount, payment_method, payment_date, status, created_at')
        .eq('dealer_id', dealerId)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Merge ledger entries with payment_received entries
      let allEntries: FormattedLedgerEntry[] = [];

      // Add existing ledger entries (orders and opening balance)
      let currentBalance = 0;
      const ledgerEntries = (data || []).map((entry: LedgerEntry) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        if (entry.details === 'Opening Balance') {
          currentBalance = debit - credit;
        } else {
          // Add all orders to balance (no pending entries in this function)
          currentBalance = currentBalance + debit - credit;
        }
        const days_elapsed = (debit > 0) ? calculateDaysDifference(entry.transaction_date) : null;
        return { ...entry, balance: currentBalance, days_elapsed };
      });

      // Prefer the current payment_received and credit_notes sources in the admin ledger UI.
      // If the backend function still returns legacy payment or credit note rows,
      // drop them here to avoid duplicates or stale detail text.
      const ledgerEntriesWithoutPaymentAndCreditNotes = ledgerEntries.filter(
        (entry) => entry.transaction_type !== 'payment' && entry.transaction_type !== 'credit_note'
      );

      // Add payment_received entries (only non-rejected payments)
      // IMPORTANT: Only approved payments (status = 'completed') affect the balance calculation
      const paymentEntries: FormattedLedgerEntry[] = (paymentsData || [])
        .filter((payment: any) => payment.status !== 'rejected') // Filter out rejected payments
        .map((payment: any) => {
          const isCompleted = payment.status === 'completed';
          // ONLY deduct from balance if payment is completed (status = 'completed')
          // Pending approval payments show in ledger but don't affect balance
          if (isCompleted) {
            currentBalance = currentBalance - payment.amount;
          }
          const statusLabel = payment.status === 'pending_approval' ? 'Pending Approval' : 'Approved';
          return {
            transaction_date: payment.payment_date,
            details: `Payment Received - ${payment.payment_method} (${statusLabel})`,
            debit: null,
            credit: payment.amount, // Show as credit (payment received)
            bill_amount: 0,
            transaction_id: payment.id,
            transaction_type: 'payment',
            balance: currentBalance, // Only updated if status = 'completed'
            days_elapsed: null,
            payment_status: payment.status,
          };
        });

      const { data: creditNotesData, error: creditNotesError } = await supabase
        .from('credit_notes')
        .select('id, credit_note_number, credit_note_date, credit_amount, status, approval_status')
        .eq('dealer_id', dealerId)
        .eq('approval_status', 'approved')
        .neq('status', 'cancelled')
        .order('credit_note_date', { ascending: true });

      if (creditNotesError) throw creditNotesError;

      const existingCreditNoteIds = new Set(
        ledgerEntriesWithoutPaymentAndCreditNotes
          .filter((entry) => entry.transaction_type === 'credit_note' && entry.transaction_id)
          .map((entry) => entry.transaction_id)
      );

      const creditNoteEntries: FormattedLedgerEntry[] = (creditNotesData || [])
        .filter((note: any) => !existingCreditNoteIds.has(note.id))
        .map((note: any) => ({
          transaction_date: note.credit_note_date,
          details: `Credit Note ${note.credit_note_number}${note.status ? ` (${note.status.replace(/_/g, ' ')})` : ''}`,
          debit: null,
          credit: note.credit_amount,
          bill_amount: 0,
          transaction_id: note.id,
          transaction_type: 'credit_note',
          balance: 0,
          days_elapsed: null,
        }));

      // Combine and sort by date (ascending - oldest first)
      allEntries = [...ledgerEntriesWithoutPaymentAndCreditNotes, ...paymentEntries, ...creditNoteEntries].sort((a, b) => {
        // Opening balance always first
        if (a.transaction_type === 'opening_balance') return -1;
        if (b.transaction_type === 'opening_balance') return 1;
        // Then sort by date ascending (oldest first)
        return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
      });

      // Recalculate running balance after sorting
      // IMPORTANT: Only approved payments (payment entries with status = 'completed') affect balance
      let runningBalance = 0;
      allEntries = allEntries.map((entry) => {
        if (entry.transaction_type === 'opening_balance') {
          // Opening balance sets the initial balance
          runningBalance = entry.debit - entry.credit;
          return { ...entry, balance: runningBalance };
        }
        if (entry.transaction_type === 'payment') {
          // Only add to balance if payment is completed (status = 'completed')
          if (entry.payment_status === 'completed') {
            runningBalance -= (entry.credit || 0);
          }
          // Pending approval payments show but don't affect balance
          return { ...entry, balance: runningBalance };
        }
        // For orders and returns, add debit and subtract credit
        runningBalance += (entry.debit || 0) - (entry.credit || 0);
        return { ...entry, balance: runningBalance };
      });

      setTransactions(allEntries);

      if (itemWise) {
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
    if (isOpen && filterDealerId) {
      fetchLedgerData(filterDealerId, showPendingOnly, showItemWise);
    }
  }, [isOpen, filterDealerId, showPendingOnly, showItemWise, fetchLedgerData]);

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

  const itemsByOrderNumber = useMemo(() => {
    if (!showItemWise) return new Map();
    return itemLedgerEntries
      .filter(item => item.transaction_type === 'Sale')
      .reduce((acc, item) => {
        if (!acc.has(item.order_number)) {
          acc.set(item.order_number, []);
        }
        acc.get(item.order_number)!.push(item);
        return acc;
      }, new Map<number, ItemLedgerEntry[]>());
  }, [itemLedgerEntries, showItemWise]);

  const returnItemsMap = useMemo(() => {
    if (!showItemWise) return new Map();
    const map = new Map<string, ItemLedgerEntry>();
    itemLedgerEntries
      .filter(item => item.transaction_type === 'Return')
      .forEach(item => {
        const key = `${item.order_number}|${item.product_name}|${Math.abs(item.total_value).toFixed(2)}|${item.transaction_date}`;
        map.set(key, item);
      });
    return map;
  }, [itemLedgerEntries, showItemWise]);

  const handlePrint = () => {
    if (!selectedDealerName || transactions.length === 0) {
      showError('No ledger data is available to print.');
      return;
    }

    const printWindow = window.open('', '', 'width=1000,height=700');
    if (!printWindow) {
      showError('Unable to open print window. Please allow popups for this site.');
      return;
    }

    const rowsHtml = transactions.map((entry) => {
      const date = entry.transaction_date ? new Date(entry.transaction_date).toLocaleDateString('en-IN') : '-';
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.details}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${entry.debit !== null ? entry.debit.toFixed(2) : ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${entry.credit !== null ? entry.credit.toFixed(2) : ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${entry.balance.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Dealer Ledger Report - ${selectedDealerName}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
          h1, h2, h3, p { margin: 0; }
          .header { margin-bottom: 24px; }
          .header h1 { font-size: 24px; margin-bottom: 8px; }
          .header p { font-size: 14px; color: #4b5563; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #d1d5db; padding: 10px; }
          th { background: #f3f4f6; text-align: left; }
          .text-right { text-align: right; }
          .totals td { font-weight: 700; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Dealer Ledger Report</h1>
          <p><strong>Dealer:</strong> ${selectedDealerName}</p>
          <p><strong>Company:</strong> ${companyName || 'N/A'}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th class="text-right">Debit (₹)</th>
              <th class="text-right">Credit (₹)</th>
              <th class="text-right">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="totals">
              <td colspan="2">Totals</td>
              <td class="text-right">${totalDebit.toFixed(2)}</td>
              <td class="text-right">${totalCredit.toFixed(2)}</td>
              <td class="text-right">${finalBalance.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

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
          <Button onClick={() => fetchLedgerData(filterDealerId, showPendingOnly, showItemWise)} disabled={!filterDealerId} className="flex items-center gap-2 bg-primary hover:bg-primary/90"><Search className="h-4 w-4" /> Apply Filters</Button>
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
                      const orderNumberMatch = entry.details.match(/Order #(\d+)/);
                      const orderNumber = orderNumberMatch ? parseInt(orderNumberMatch[1], 10) : null;

                      let items: ItemLedgerEntry[] = [];
                      if (showItemWise) {
                        if (entry.transaction_type === 'order' && orderNumber !== null) {
                          items = itemsByOrderNumber.get(orderNumber) || [];
                        } else if (entry.transaction_type === 'sales_return' && orderNumber !== null) {
                          const productNameMatch = entry.details.match(/ - (.*)$/);
                          const productName = productNameMatch ? productNameMatch[1] : null;
                          if (productName) {
                            const key = `${orderNumber}|${productName}|${(entry.credit || 0).toFixed(2)}|${entry.transaction_date}`;
                            const matchedItem = returnItemsMap.get(key);
                            if (matchedItem) {
                              items = [matchedItem];
                            }
                          }
                        }
                      }

                      return (
                        <TableRow key={entry.transaction_id || index} className={entry.payment_status === 'pending_approval' ? 'bg-red-50 dark:bg-red-950' : entry.payment_status === 'completed' ? 'bg-green-50 dark:bg-green-950' : ''}>
                          <TableCell className={entry.payment_status === 'pending_approval' ? 'text-red-700 dark:text-red-200 font-semibold' : entry.payment_status === 'completed' ? 'text-green-700 dark:text-green-200 font-semibold' : ''}>{new Date(entry.transaction_date).toLocaleDateString()}</TableCell>
                          <TableCell className={entry.payment_status === 'pending_approval' ? 'text-red-700 dark:text-red-200 font-semibold' : entry.payment_status === 'completed' ? 'text-green-700 dark:text-green-200 font-semibold' : ''}>
                            <div className="flex flex-col">
                              <span>{entry.details}</span>
                              {items.length > 0 && (
                                <div className="pl-4 mt-1 text-xs text-muted-foreground border-l-2 border-muted">
                                  {items.map((item, itemIndex) => (
                                    <p key={itemIndex}>
                                      - {item.product_name} (Qty: {item.quantity}, Price: {item.unit_price.toFixed(2)})
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{entry.days_elapsed !== null ? entry.days_elapsed : ''}</TableCell>
                          <TableCell className={`text-right font-semibold ${entry.payment_status === 'pending_approval' ? 'text-red-600' : 'text-red-600'}`}>{entry.debit ? entry.debit.toFixed(2) : ''}</TableCell>
                          <TableCell className={`text-right font-semibold ${entry.payment_status === 'pending_approval' ? 'text-orange-600 dark:text-orange-400' : entry.payment_status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-green-600'}`}>{entry.credit ? entry.credit.toFixed(2) : ''}</TableCell>
                          <TableCell className="text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                        </TableRow>
                      );
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
          <Button variant="outline" onClick={handlePrint} disabled={transactions.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerLedgerReportDialog;