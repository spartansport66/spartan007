"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker'; // Assuming you have this component
import { Loader2, Search, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Dealer {
  id: string;
  name: string;
}

interface LedgerEntry {
  date: string;
  particulars: string;
  voucher_type: string;
  voucher_no: string;
  debit: number | null;
  credit: number | null;
}

const DealerLedger = () => {
  const { user, loading: sessionLoading } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  
  // State for the combobox
  const [open, setOpen] = useState(false);

  const fetchDealers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('dealers')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching dealers:', error);
      showError('Failed to fetch dealers.');
    } else {
      setDealers(data || []);
    }
  }, [user]);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  const fetchLedgerData = async () => {
    if (!selectedDealer || !startDate || !endDate) {
      showError('Please select a dealer and a date range.');
      return;
    }
    setLoading(true);
    setLedgerData([]);

    const { data, error } = await supabase.rpc('get_dealer_ledger', {
      dealer_id_param: selectedDealer,
      start_date_param: format(startDate, 'yyyy-MM-dd'),
      end_date_param: format(endDate, 'yyyy-MM-dd'),
    });

    if (error) {
      console.error('Error fetching ledger data:', error);
      showError('Failed to fetch ledger data.');
      setLedgerData([]);
    } else {
      const formattedData = data.map((item: any) => ({
        ...item,
        debit: item.debit ? parseFloat(item.debit) : null,
        credit: item.credit ? parseFloat(item.credit) : null,
      }));
      
      // Extract summary info
      const ob = formattedData.find((d: any) => d.voucher_type === 'OpeningBalance');
      const cb = formattedData.find((d: any) => d.voucher_type === 'ClosingBalance');
      const totals = formattedData.find((d: any) => d.voucher_type === 'Totals');
      
      setOpeningBalance(ob ? (ob.debit || -ob.credit) : 0);
      setClosingBalance(cb ? (cb.debit || -cb.credit) : 0);
      setTotalDebit(totals?.debit || 0);
      setTotalCredit(totals?.credit || 0);

      // Filter out the summary rows for the main table
      setLedgerData(formattedData.filter((d: any) => !['OpeningBalance', 'ClosingBalance', 'Totals'].includes(d.voucher_type)));
    }
    setLoading(false);
  };

  const handleDownload = () => {
    // Basic CSV export
    const headers = ['Date', 'Particulars', 'Voucher Type', 'Voucher No', 'Debit', 'Credit'];
    const rows = ledgerData.map(entry => 
      [
        entry.date,
        `"${entry.particulars.replace(/"/g, '""')}"`, // Handle quotes
        entry.voucher_type,
        entry.voucher_no,
        entry.debit ?? '',
        entry.credit ?? ''
      ].join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n" 
      + rows.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dealerName = dealers.find(d => d.id === selectedDealer)?.name || 'dealer';
    const fileName = `Ledger_${dealerName}_${format(startDate!, 'yyyy-MM-dd')}_to_${format(endDate!, 'yyyy-MM-dd')}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (sessionLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="p-4 md:p-8">
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Dealer Ledger Report</CardTitle>
          <CardDescription className="text-primary-foreground/80">View the transaction history for a specific dealer.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Select Dealer</label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {selectedDealer
                      ? dealers.find((dealer) => dealer.id === selectedDealer)?.name
                      : "Select dealer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search dealer..." />
                    <CommandEmpty>No dealer found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {dealers.map((dealer) => (
                        <CommandItem
                          key={dealer.id}
                          value={dealer.name}
                          onSelect={() => {
                            setSelectedDealer(dealer.id);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedDealer === dealer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {dealer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <DatePicker date={startDate} setDate={setStartDate} />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <DatePicker date={endDate} setDate={setEndDate} />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchLedgerData} className="w-full flex items-center gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : ledgerData.length > 0 || (selectedDealer && startDate && endDate) ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">
                  Ledger for: {dealers.find(d => d.id === selectedDealer)?.name}
                </h3>
                <Button onClick={handleDownload} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Opening Balance</p>
                  <p className="text-lg font-semibold">₹{Math.abs(openingBalance).toFixed(2)} {openingBalance > 0 ? 'Dr' : 'Cr'}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Debit</p>
                  <p className="text-lg font-semibold text-red-600">₹{totalDebit.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Credit</p>
                  <p className="text-lg font-semibold text-green-600">₹{totalCredit.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Closing Balance</p>
                  <p className="text-lg font-semibold">₹{Math.abs(closingBalance).toFixed(2)} {closingBalance > 0 ? 'Dr' : 'Cr'}</p>
                </div>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Particulars</TableHead>
                      <TableHead>Voucher Type</TableHead>
                      <TableHead>Voucher No</TableHead>
                      <TableHead className="text-right">Debit (₹)</TableHead>
                      <TableHead className="text-right">Credit (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerData.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{format(new Date(entry.date), 'dd-MM-yyyy')}</TableCell>
                        <TableCell>{entry.particulars}</TableCell>
                        <TableCell>{entry.voucher_type}</TableCell>
                        <TableCell>{entry.voucher_no}</TableCell>
                        <TableCell className="text-right text-red-600">{entry.debit ? entry.debit.toFixed(2) : ''}</TableCell>
                        <TableCell className="text-right text-green-600">{entry.credit ? entry.credit.toFixed(2) : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please select a dealer and date range to generate a report.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DealerLedger;