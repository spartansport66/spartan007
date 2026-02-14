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
      // Step 1: Fetch raw receipts data without joins
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('stock_receipts')
        .select('id, receipt_date, quantity, remarks, created_by, product_id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (receiptsError) throw receiptsError;
      if (!receiptsData) {
        setRecords([]);
        setLoading(false);
        return;
      }

      // Step 2: Collect all unique IDs for subsequent queries
      const userIds = [...new Set(receiptsData.map(r => r.created_by).filter(Boolean))];
      const productIds = [...new Set(receiptsData.map(r => r.product_id).filter(Boolean))];

      // Step 3: Fetch related data in parallel
      const [profilesResponse, productsResponse] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('id, first_name, last_name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
        productIds.length > 0 ? supabase.from('products').select('id, name, code').in('id', productIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesResponse.error) console.warn('Could not fetch some user profiles:', profilesResponse.error.message);
      if (productsResponse.error) throw productsResponse.error;

      // Step 4: Create maps for easy lookup
      const userMap = new Map<string, string>();
      (profilesResponse.data || []).forEach(p => {
        userMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim());
      });

      const productMap = new Map<string, { name: string; code: string }>();
      (productsResponse.data || []).forEach(p => {
        productMap.set(p.id, { name: p.name, code: p.code });
      });

      // Step 5: Format the final records
      const formatted: StockReceiptRecord[] = receiptsData.map((r: any) => ({
        id: r.id,
        receipt_date: r.receipt_date,
        quantity: r.quantity,
        remarks: r.remarks,
        product_name: productMap.get(r.product_id)?.name || 'N/A',
        product_code: productMap.get(r.product_id)?.code || 'N/A',
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