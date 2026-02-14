"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface StockReceiptRecord {
  id: string;
  receipt_date: string;
  quantity: number;
  remarks: string | null;
  product_name: string;
  product_code: string;
  recorded_by: string;
}

const StockReceiptHistory: React.FC = () => {
  const [records, setRecords] = useState<StockReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: Fetch receipts with created_by user ID
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('stock_receipts')
        .select(`
          id,
          receipt_date,
          quantity,
          remarks,
          created_by,
          products (name, code)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (receiptsError) throw receiptsError;

      // Step 2: Get unique user IDs from the receipts
      const userIds = [...new Set((receiptsData || []).map(r => r.created_by).filter(Boolean))];

      // Step 3: Fetch profiles for those user IDs
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        
        if (profilesError) {
          console.warn('Could not fetch some user profiles:', profilesError.message);
        } else {
          (profilesData || []).forEach(p => {
            userMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim());
          });
        }
      }

      // Step 4: Format the records with user names
      const formatted: StockReceiptRecord[] = (receiptsData || []).map((r: any) => ({
        id: r.id,
        receipt_date: r.receipt_date,
        quantity: r.quantity,
        remarks: r.remarks,
        product_name: r.products?.name || 'N/A',
        product_code: r.products?.code || 'N/A',
        recorded_by: userMap.get(r.created_by) || 'Unknown',
      }));

      setRecords(formatted);
    } catch (error: any) {
      console.error('Error fetching stock receipt history:', error.message);
      showError(`Failed to load history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('stock_receipts').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Record deleted and stock reverted successfully.');
      fetchHistory();
    } catch (error: any) {
      showError(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Stock Receipts</CardTitle>
        <CardDescription>History of manually added stock.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{new Date(record.receipt_date).toLocaleDateString()}</TableCell>
                    <TableCell>{record.product_name} ({record.product_code})</TableCell>
                    <TableCell className="text-right font-bold text-green-600">+{record.quantity}</TableCell>
                    <TableCell>{record.recorded_by}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={record.remarks || ''}>{record.remarks || 'N/A'}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={!!isDeleting}>
                            {isDeleting === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                            <AlertDialogDescription>This will revert the stock change. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(record.id)}>Delete & Revert</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StockReceiptHistory;