"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, FileDown, Search, Check, ChevronsUpDown } from 'lucide-react';
import { showError } from '@/utils/toast';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

interface Dealer {
  id: string;
  name: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  particulars: string;
  voucher_type: string;
  voucher_no: string;
  debit: number | null;
  credit: number | null;
}

const DealerLedgerReport: React.FC = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  
  // State for the Combobox
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchDealers = async () => {
      setLoadingDealers(true);
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching dealers:', error);
        showError('Failed to load dealers.');
        setError('Could not fetch dealers.');
      } else {
        setDealers(data || []);
      }
      setLoadingDealers(false);
    };

    fetchDealers();
  }, []);

  const fetchLedger = useCallback(async () => {
    if (!selectedDealerId) return;

    setLoadingLedger(true);
    setError(null);
    setLedgerEntries([]);
    setOpeningBalance(0);
    setClosingBalance(0);

    const { data, error } = await supabase.rpc('get_dealer_ledger', {
      dealer_id_param: selectedDealerId,
    });

    if (error) {
      console.error('Error fetching ledger:', error);
      showError('Failed to generate ledger report.');
      setError('An error occurred while fetching the ledger data.');
    } else if (data) {
      const formattedEntries = data.map((entry: any) => ({
        ...entry,
        date: format(new Date(entry.date), 'dd-MMM-yyyy'),
      }));
      setLedgerEntries(formattedEntries);

      // Calculate balances
      const ob = data[0]?.opening_balance ?? 0;
      setOpeningBalance(ob);

      let currentBalance = ob;
      for (const entry of data) {
        currentBalance += (entry.debit || 0) - (entry.credit || 0);
      }
      setClosingBalance(currentBalance);
    }
    setLoadingLedger(false);
  }, [selectedDealerId]);

  const handleGenerateReport = () => {
    if (!selectedDealerId) {
      showError('Please select a dealer first.');
      return;
    }
    fetchLedger();
  };

  const renderBalance = (balance: number) => {
    const amount = Math.abs(balance).toFixed(2);
    if (balance > 0) {
      return `₹${amount} Dr`; // Debit
    }
    if (balance < 0) {
      return `₹${amount} Cr`; // Credit
    }
    return `₹${amount}`;
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-primary text-primary-foreground rounded-t-lg p-4">
        <CardTitle>Dealer Ledger Report</CardTitle>
        <CardDescription className="text-primary-foreground/80">
          View the detailed transaction ledger for a specific dealer.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium mb-1" htmlFor="dealer-select">
              Select Dealer
            </label>
            {loadingDealers ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading dealers...</span>
              </div>
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {selectedDealerId
                      ? dealers.find((dealer) => dealer.id === selectedDealerId)?.name
                      : "Select dealer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search dealer..." />
                    <CommandEmpty>No dealer found.</CommandEmpty>
                    <CommandGroup>
                      {dealers.map((dealer) => (
                        <CommandItem
                          key={dealer.id}
                          value={dealer.name}
                          onSelect={(currentValue) => {
                            const selected = dealers.find(d => d.name.toLowerCase() === currentValue.toLowerCase());
                            setSelectedDealerId(selected ? selected.id : "");
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedDealerId === dealer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {dealer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <Button onClick={handleGenerateReport} disabled={loadingLedger || !selectedDealerId}>
            {loadingLedger ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Generate Report
          </Button>
          <Button variant="outline" disabled={ledgerEntries.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        {loadingLedger && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Fetching ledger...</p>
          </div>
        )}

        {error && !loadingLedger && (
          <div className="text-center text-destructive py-8">{error}</div>
        )}

        {!loadingLedger && ledgerEntries.length > 0 && (
          <div>
            <div className="text-lg font-semibold mb-2">
              Ledger for: {dealers.find(d => d.id === selectedDealerId)?.name}
            </div>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Vch Type</TableHead>
                    <TableHead>Vch No.</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="font-semibold">
                    <TableCell colSpan={4}>Opening Balance</TableCell>
                    <TableCell colSpan={2} className="text-right">{renderBalance(openingBalance)}</TableCell>
                  </TableRow>
                  {ledgerEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>{entry.particulars}</TableCell>
                      <TableCell>{entry.voucher_type}</TableCell>
                      <TableCell>{entry.voucher_no}</TableCell>
                      <TableCell className="text-right">{entry.debit?.toFixed(2) ?? ''}</TableCell>
                      <TableCell className="text-right">{entry.credit?.toFixed(2) ?? ''}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={4}>Closing Balance</TableCell>
                    <TableCell colSpan={2} className="text-right">{renderBalance(closingBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {!loadingLedger && !error && ledgerEntries.length === 0 && selectedDealerId && (
           <div className="text-center text-muted-foreground py-8">
             No transactions found for the selected dealer.
           </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DealerLedgerReport;