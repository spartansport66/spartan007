"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, DollarSign, Package, Check, ChevronsUpDown, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TransactionReportData {
  payment_id: string;
  order_id: string | null;
  dealer_id: string;
  amount: number;
  payment_date: string;
  order_created_at: string | null;
  dealer_name: string;
  order_number: number | null;
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerTransactionReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";


const DealerTransactionReportDialog: React.FC<DealerTransactionReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [transactions, setTransactions] = useState<TransactionReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  // Searchable Select States
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearchValue, setDealerSearchValue] = useState("");

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

  const fetchDealers = useCallback(async () => {
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
  }, []);

  const fetchTransactionData = useCallback(async () => {
    if (!filterDealerId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Call the RPC function
      const { data: rawData, error: rpcError } = await supabase
        .rpc('get_dealer_transactions', { dealer_id_param: filterDealerId });

      if (rpcError) {
        console.error('Error calling get_dealer_transactions RPC:', rpcError);
        throw rpcError;
      }

      const dealerName = allDealers.find(d => d.value === filterDealerId)?.label || 'N/A';
      
      // 2. Fetch order numbers for orders that are not null
      const orderIds = [...new Set(rawData.map(d => d.order_id).filter(id => id))];
      let orderNumberMap = new Map<string, number>();
      if (orderIds.length > 0) {
          const { data: ordersData, error: ordersError } = await supabase
              .from('orders')
              .select('id, order_number')
              .in('id', orderIds);
          
          if (ordersError) console.warn('Failed to fetch order numbers:', ordersError.message);
          orderNumberMap = new Map(ordersData?.map(o => [o.id, o.order_number]) || []);
      }

      // 3. Format the data
      const formattedTransactions: TransactionReportData[] = (rawData || []).map((d: any) => ({
        payment_id: d.payment_id,
        order_id: d.order_id,
        dealer_id: d.dealer_id,
        amount: d.amount,
        payment_date: d.payment_date,
        order_created_at: d.order_created_at,
        dealer_name: dealerName,
        order_number: d.order_id ? orderNumberMap.get(d.order_id) || null : 0, // Use 0 for general payments
      }));

      // Sort by payment date
      formattedTransactions.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

      setTransactions(formattedTransactions);
    } catch (error: any) {
      console.error('Error fetching transaction data:', error.message);
      showError(`Failed to load transaction data: ${error.message}`);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerId, allDealers]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchDealers();
    }
  }, [isOpen, fetchCompanyInfo, fetchDealers]);

  useEffect(() => {
    fetchTransactionData();
  }, [fetchTransactionData]);

  const handleClearFilters = () => {
    setFilterDealerId('');
  };

  const handlePrint = () => {
    if (transactions.length === 0) {
      showError('No transactions to print.');
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'portrait' });
      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22); doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18); doc.text("Dealer Transaction Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });
      
      const dealerName = transactions[0]?.dealer_name || 'N/A';
      doc.setFontSize(12); doc.setTextColor(0); doc.text(`Dealer: ${dealerName}`, 14, 40);

      const tableColumn = ["Payment ID", "Order No.", "Amount (₹)", "Payment Date", "Order Creation Date"];
      const tableRows = transactions.map(t => [
        t.payment_id.substring(0, 8) + '...',
        t.order_number === 0 ? 'General Payment' : `#${t.order_number || 'N/A'}`,
        t.amount.toFixed(2),
        new Date(t.payment_date).toLocaleDateString(),
        t.order_created_at ? new Date(t.order_created_at).toLocaleDateString() : 'N/A',
      ]);

      const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

      autoTable(doc, {
        head: [tableColumn], body: tableRows,
        foot: [[{ content: 'Total Payments', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalAmount.toFixed(2)}`, '', '']],
        startY: 45, styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: [0, 0, 0] },
        footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: { 2: { halign: 'right' } }
      });
      doc.save(`dealer_transactions_${dealerName.replace(/\s/g, '_')}.pdf`);
      showSuccess('Dealer Transaction Report generated successfully!');
    } catch (error: any) { showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Transaction Report</DialogTitle>
          <DialogDescription>
            View all payment transactions (completed and pending approval) for a selected dealer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterDealer">Select Dealer</Label>
            <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isDealerPopoverOpen}
                  className="w-full justify-between"
                  disabled={loading}
                >
                  {allDealers.find(d => d.value === filterDealerId)?.label || "Select a dealer..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search dealer..." value={dealerSearchValue} onValueChange={setDealerSearchValue} />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {allDealers.length === 0 ? <CommandEmpty>No dealers found.</CommandEmpty> : (
                      <CommandGroup>
                        {allDealers.filter(d => d.label.toLowerCase().includes(dealerSearchValue.toLowerCase())).map((dealer) => (
                          <CommandItem key={dealer.value} value={dealer.label} onSelect={() => {
                            setFilterDealerId(dealer.value);
                            setIsDealerPopoverOpen(false);
                            setDealerSearchValue("");
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", filterDealerId === dealer.value ? "opacity-100" : "opacity-0")} />
                            {dealer.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={fetchTransactionData} disabled={loading || !filterDealerId} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Load Transactions
          </Button>
          <Button variant="outline" onClick={handleClearFilters} disabled={loading} className="flex items-center gap-2">
            Clear Selection
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {filterDealerId ? 'No transactions found for this dealer.' : 'Please select a dealer to view transactions.'}
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Payment ID</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Order No.</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Amount (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Payment Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Order Creation Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.payment_id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{t.payment_id.substring(0, 8)}...</TableCell>
                      <TableCell className="text-foreground">
                        {t.order_number === 0 ? <span className="text-muted-foreground">General Payment</span> : `#${t.order_number || 'N/A'}`}
                      </TableCell>
                      <TableCell className="text-foreground text-right font-medium">₹{t.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground">{new Date(t.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-foreground">{t.order_created_at ? new Date(t.order_created_at).toLocaleDateString() : 'N/A'}</TableCell>
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

export default DealerTransactionReportDialog;