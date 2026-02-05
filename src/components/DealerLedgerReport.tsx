"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Loader2, Printer, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Dealer {
  id: string;
  name: string;
}

interface LedgerEntry {
  transaction_date: string;
  type: 'Invoice' | 'Payment';
  details: string;
  debit: number | null;
  credit: number | null;
}

interface FormattedLedgerEntry extends LedgerEntry {
  balance: number;
}

const DealerLedgerReport = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<FormattedLedgerEntry[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const fetchDealers = useCallback(async () => {
    setLoadingDealers(true);
    const { data, error } = await supabase
      .from('dealers')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      showError('Failed to fetch dealers.');
      console.error('Error fetching dealers:', error);
      setError('Could not load dealers.');
    } else {
      setDealers(data || []);
    }
    setLoadingDealers(false);
  }, []);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  const fetchLedger = useCallback(async () => {
    if (!selectedDealerId) {
      setLedgerEntries([]);
      return;
    }

    setLoadingLedger(true);
    setError(null);
    setLedgerEntries([]);

    const { data, error } = await supabase.rpc('get_dealer_ledger', {
      dealer_id_param: selectedDealerId
    });

    if (error) {
      showError('Failed to fetch ledger report.');
      console.error('Error fetching ledger:', error);
      setError('Could not load the ledger for the selected dealer.');
      setLedgerEntries([]);
    } else {
      let currentBalance = 0;
      const formattedData = (data || []).map((entry: LedgerEntry) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        currentBalance = currentBalance + debit - credit;
        return { ...entry, balance: currentBalance };
      });
      setLedgerEntries(formattedData);
    }
    setLoadingLedger(false);
  }, [selectedDealerId]);
  
  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handlePrint = () => {
    window.print();
  };

  const selectedDealerName = dealers.find(d => d.id === selectedDealerId)?.name || "Select dealer...";

  return (
    <Card className="bg-card text-card-foreground shadow-lg w-full h-full" id="dealer-ledger-report">
      <CardHeader className="bg-primary text-primary-foreground rounded-t-lg p-4 print:hidden">
        <CardTitle className="text-xl font-semibold">Dealer Ledger Report</CardTitle>
        <CardDescription className="text-primary-foreground/80">View the transaction history for a specific dealer.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center print:hidden">
          <div className="flex-1 w-full md:w-auto">
            <label className="font-semibold mb-2 block">Select a Dealer</label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full md:w-[300px] justify-between"
                  disabled={loadingDealers}
                >
                  {loadingDealers ? "Loading dealers..." : selectedDealerName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search dealer..." />
                  <CommandList>
                    <CommandEmpty>No dealer found.</CommandEmpty>
                    <CommandGroup>
                      {dealers.map((dealer) => (
                        <CommandItem
                          key={dealer.id}
                          value={dealer.name}
                          onSelect={() => {
                            setSelectedDealerId(dealer.id);
                            setComboboxOpen(false);
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
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="self-end">
            <Button onClick={handlePrint} disabled={!selectedDealerId || ledgerEntries.length === 0}>
              <Printer className="mr-2 h-4 w-4" /> Print Report
            </Button>
          </div>
        </div>

        <div ref={reportRef} className="printable-area">
          {selectedDealerId && (
            <div className="text-center my-4 hidden print:block">
              <h1 className="text-2xl font-bold">Ledger for {selectedDealerName}</h1>
              <p>Date: {new Date().toLocaleDateString()}</p>
            </div>
          )}
          
          {loadingLedger ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg">Loading report...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : !selectedDealerId ? (
            <div className="text-center py-8 text-muted-foreground">Please select a dealer to view their ledger.</div>
          ) : ledgerEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions found for this dealer.</div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                    <TableHead className="text-right">Balance (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(entry.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.details}</TableCell>
                      <TableCell className="text-right text-red-600">{entry.debit ? entry.debit.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right text-green-600">{entry.credit ? entry.credit.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{entry.balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </Card>
  );
};

export default DealerLedgerReport;