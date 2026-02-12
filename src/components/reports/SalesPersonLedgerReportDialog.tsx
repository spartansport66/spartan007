"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface DealerLedger {
  dealer_id: string;
  dealer_name: string;
  entries: FormattedLedgerEntry[];
  final_balance: number;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonLedgerReportDialogProps {
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

const SalesPersonLedgerReportDialog: React.FC<SalesPersonLedgerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [reportData, setReportData] = useState<DealerLedger[]>([]);
  const [loading, setLoading] = useState(false);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
    }
  }, []);

  const fetchReportData = useCallback(async () => {
    if (!filterSalesPersonId) {
      setReportData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: assignedDealers, error: dealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', filterSalesPersonId);
      if (dealersError) throw dealersError;

      const finalReport: DealerLedger[] = [];
      for (const item of assignedDealers || []) {
        const dealer = Array.isArray(item.dealers) ? item.dealers[0] : item.dealers;
        if (!dealer) continue;

        const { data: ledgerData, error: ledgerError } = await supabase.rpc('get_dealer_ledger', {
          dealer_id_param: dealer.id,
          p_show_pending_only: showPendingOnly,
        });

        if (ledgerError) {
          console.error(`Failed to fetch ledger for ${dealer.name}:`, ledgerError);
          continue;
        }

        const openingBalanceEntry = (ledgerData || []).find((e: LedgerEntry) => e.details === 'Opening Balance');
        const otherEntries = (ledgerData || []).filter((e: LedgerEntry) => e.details !== 'Opening Balance');
        otherEntries.sort((a: LedgerEntry, b: LedgerEntry) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
        const sortedEntries = openingBalanceEntry ? [openingBalanceEntry, ...otherEntries] : otherEntries;

        let currentBalance = 0;
        const formattedData = sortedEntries.map((entry: LedgerEntry) => {
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;
          currentBalance = (entry.details === 'Opening Balance') ? (debit - credit) : (currentBalance + debit - credit);
          const days_elapsed = (debit > 0) ? calculateDaysDifference(entry.transaction_date) : null;
          return { ...entry, balance: currentBalance, days_elapsed };
        });

        finalReport.push({
          dealer_id: dealer.id,
          dealer_name: dealer.name,
          entries: formattedData,
          final_balance: currentBalance,
        });
      }
      setReportData(finalReport);
    } catch (error: any) {
      showError(`Failed to load report data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, showPendingOnly]);

  useEffect(() => {
    if (isOpen) {
      const fetchAllSalesPersons = async () => {
        const { data, error } = await supabase.from('profiles').select('id, first_name, last_name').eq('user_type', 'sales_person').order('first_name');
        if (error) showError('Failed to load sales persons.');
        else setAllSalesPersons((data || []).map(sp => ({ value: sp.id, label: `${sp.first_name} ${sp.last_name || ''}`.trim() })));
      };
      fetchAllSalesPersons();
      fetchCompanyInfo();
    }
  }, [isOpen, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    setFilterDealerName('');
    setFilterFromDate('');
    setFilterToDate('');
    setShowPendingOnly(false);
    setReportData([]);
  };

  const handlePrint = () => {
    // Print logic will be complex, for now, let's keep it simple
    showSuccess("Print functionality for this report is under development.");
  };

  const filteredReportData = useMemo(() => {
    if (!filterDealerName) return reportData;
    return reportData.filter(d => d.dealer_name.toLowerCase().includes(filterDealerName.toLowerCase()));
  }, [reportData, filterDealerName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Sales Person Wise Ledger Report</DialogTitle>
          <DialogDescription>View ledgers for all dealers assigned to a selected sales person.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[200px]"><Label>Sales Person</Label><Select value={filterSalesPersonId} onValueChange={setFilterSalesPersonId}><SelectTrigger><SelectValue placeholder="Select a sales person" /></SelectTrigger><SelectContent>{allSalesPersons.map(sp => (<SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>))}</SelectContent></Select></div>
          <div className="flex-1 min-w-[200px]"><Label>Dealer Name</Label><Input placeholder="Filter by dealer name" value={filterDealerName} onChange={(e) => setFilterDealerName(e.target.value)} /></div>
          <div className="flex items-center space-x-2"><Checkbox id="showPendingOnly-sp" checked={showPendingOnly} onCheckedChange={(checked) => setShowPendingOnly(!!checked)} /><Label htmlFor="showPendingOnly-sp">Show Pending Only</Label></div>
          <Button onClick={fetchReportData} disabled={!filterSalesPersonId || loading}><Search className="h-4 w-4 mr-2" /> Generate Report</Button>
          <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
        </div>

        <ScrollArea className="max-h-[500px] overflow-y-auto">
          {loading ? (<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>) : filteredReportData.length === 0 ? (<p className="text-center text-muted-foreground py-8">No data for selected criteria.</p>) : (
            <div className="space-y-6">
              {filteredReportData.map(dealerLedger => (
                <div key={dealerLedger.dealer_id} className="border p-4 rounded-lg">
                  <h3 className="text-lg font-bold mb-2">{dealerLedger.dealer_name}</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {dealerLedger.entries.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{entry.transaction_date}</TableCell>
                          <TableCell>{entry.details}</TableCell>
                          <TableCell className="text-right">{entry.debit?.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{entry.credit?.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <UiTableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-bold">Final Balance</TableCell>
                        <TableCell className="text-right font-bold">₹{dealerLedger.final_balance.toFixed(2)}</TableCell>
                      </TableRow>
                    </UiTableFooter>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={filteredReportData.length === 0}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonLedgerReportDialog;