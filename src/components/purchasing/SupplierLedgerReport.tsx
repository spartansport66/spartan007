"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RecordSupplierPaymentDialog from './RecordSupplierPaymentDialog';

interface Supplier {
  id: string;
  name: string;
}

interface LedgerEntry {
  transaction_date: string;
  details: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

const SupplierLedgerReport: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      showError(`Failed to load suppliers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const fetchLedger = useCallback(async () => {
    if (!selectedSupplierId) {
      setLedger([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_supplier_ledger', { supplier_id_param: selectedSupplierId });
      if (error) throw error;

      let runningBalance = 0;
      const formattedLedger = data.map((entry: any) => {
        runningBalance += (entry.debit || 0) - (entry.credit || 0);
        return { ...entry, balance: runningBalance };
      });
      setLedger(formattedLedger);
    } catch (error: any) {
      showError(`Failed to load ledger: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSupplierId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Supplier Ledger</CardTitle>
              <CardDescription>View the transaction history and balance for a supplier.</CardDescription>
            </div>
            <Button onClick={() => setIsPaymentDialogOpen(true)} disabled={!selectedSupplierId}>
              <PlusCircle className="mr-2 h-4 w-4" /> Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm mb-4">
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                    <TableHead className="text-right">Balance (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(entry.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.details}</TableCell>
                      <TableCell className="text-right">{entry.debit?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.credit?.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">{entry.balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {selectedSupplier && (
        <RecordSupplierPaymentDialog
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          isOpen={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          onPaymentRecorded={fetchLedger}
        />
      )}
    </>
  );
};

export default SupplierLedgerReport;