"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StockInRecord {
  id: string;
  receipt_date: string;
  quantity: number;
  remarks: string | null;
  product_name: string;
  product_code: string;
  received_by_name: string;
}

const StockInHistoryTable: React.FC = () => {
  const [records, setRecords] = useState<StockInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Corrected join syntax: profiles!received_by specifies the foreign key column
      const { data, error } = await supabase
        .from('stock_receipts')
        .select(`
          id,
          receipt_date,
          quantity,
          remarks,
          products (name, code),
          received_by_profile:profiles!received_by (first_name, last_name)
        `)
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[StockInHistoryTable] Supabase error:', error);
        throw error;
      }

      const formatted: StockInRecord[] = (data || []).map((r: any) => {
        const profile = r.received_by_profile;
        const name = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
          : 'Unknown User';

        return {
          id: r.id,
          receipt_date: r.receipt_date,
          quantity: r.quantity,
          remarks: r.remarks,
          product_name: r.products?.name || 'N/A',
          product_code: r.products?.code || 'N/A',
          received_by_name: name || 'N/A',
        };
      });

      setRecords(formatted);
    } catch (error: any) {
      console.error('Error fetching stock in history:', error.message);
      showError('Failed to load stock in history. Please check database permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredRecords = records.filter(r => 
    r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.remarks && r.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card className="bg-card text-card-foreground shadow-lg mt-6">
      <CardHeader className="bg-muted/50 p-4 rounded-t-lg">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Stock In History
        </CardTitle>
        <CardDescription>A detailed log of all inventory additions.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4">
          <Label htmlFor="historySearch">Search History</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="historySearch"
              placeholder="Search by product or remarks..." 
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
            <p className="text-center text-muted-foreground py-8">No stock in records found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Received By</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-accent/50">
                      <TableCell className="whitespace-nowrap">{new Date(record.receipt_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="font-medium">{record.product_name}</div>
                        <div className="text-xs text-muted-foreground">{record.product_code}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">+{record.quantity}</TableCell>
                      <TableCell>{record.received_by_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.remarks || ''}>
                        {record.remarks || 'N/A'}
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

export default StockInHistoryTable;