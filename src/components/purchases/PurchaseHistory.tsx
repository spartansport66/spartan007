"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface Purchase {
  id: string;
  purchase_date: string;
  total_amount: number;
  supplier_name: string | null;
  created_by_name: string | null;
}

const PurchaseHistory: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          purchase_date,
          total_amount,
          suppliers (name),
          profiles (first_name, last_name)
        `)
        .order('purchase_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedData = (data || []).map((p: any) => ({
        id: p.id,
        purchase_date: new Date(p.purchase_date).toLocaleDateString(),
        total_amount: p.total_amount,
        supplier_name: p.suppliers?.name || 'N/A',
        created_by_name: `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.trim() || 'Unknown',
      }));
      setPurchases(formattedData);
    } catch (error: any) {
      showError(`Failed to load purchase history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase History</CardTitle>
        <CardDescription>A log of the most recent purchases.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="max-h-96 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.purchase_date}</TableCell>
                    <TableCell>{p.supplier_name}</TableCell>
                    <TableCell>{p.created_by_name}</TableCell>
                    <TableCell className="text-right">₹{p.total_amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PurchaseHistory;