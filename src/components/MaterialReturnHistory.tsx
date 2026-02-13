"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MaterialReturnRecord {
  id: string;
  return_date: string;
  quantity: number;
  remarks: string | null;
  product_name: string;
  product_code: string;
  received_by_name: string;
  dealer_name: string | null;
  order_number: number | null;
}

const MaterialReturnHistory: React.FC = () => {
  const [records, setRecords] = useState<MaterialReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select(`
          id,
          return_date,
          quantity,
          remarks,
          products (name, code),
          profiles (first_name, last_name),
          dealers (name),
          orders (order_number)
        `)
        .order('return_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: MaterialReturnRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        return_date: r.return_date,
        quantity: r.quantity,
        remarks: r.remarks,
        product_name: r.products?.name || 'N/A',
        product_code: r.products?.code || 'N/A',
        received_by_name: `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim() || 'Unknown',
        dealer_name: r.dealers?.name || 'N/A',
        order_number: r.orders?.order_number || null,
      }));

      setRecords(formatted);
    } catch (error: any) {
      console.error('Error fetching material return history:', error.message);
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
      const { error } = await supabase
        .from('sales_returns')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Record deleted and stock reverted successfully.');
      fetchHistory();
    } catch (error: any) {
      console.error('Error deleting record:', error);
      showError(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredRecords = records.filter(r => 
    r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.dealer_name && r.dealer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.order_number && r.order_number.toString().includes(searchTerm)) ||
    (r.remarks && r.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card className="bg-card text-card-foreground shadow-lg mt-6">
      <CardHeader className="bg-muted/50 p-4 rounded-t-lg">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Material Return History
        </CardTitle>
        <CardDescription>A detailed log of all material returns from orders.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4">
          <Label htmlFor="historySearch">Search History</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="historySearch"
              placeholder="Search by product, dealer, order no, or remarks..." 
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto border rounded-md">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No material return records found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-accent/50">
                      <TableCell className="whitespace-nowrap">{new Date(record.return_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">#{record.order_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{record.product_name}</div>
                        <div className="text-xs text-muted-foreground">{record.product_code}</div>
                      </TableCell>
                      <TableCell>{record.dealer_name}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">+{record.quantity}</TableCell>
                      <TableCell>{record.received_by_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.remarks || ''}>
                        {record.remarks || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              {isDeleting === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the entry from history and **subtract {record.quantity} units** from the current stock of {record.product_name}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(record.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete & Revert Stock
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialReturnHistory;