"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface SalesReturnDetails {
  return_number: number;
  return_date: string;
  total_credit_amount: number;
  order_number: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
}

interface SalesReturnDetailsDialogProps {
  returnId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesReturnDetailsDialog: React.FC<SalesReturnDetailsDialogProps> = ({ returnId, isOpen, onOpenChange }) => {
  const [details, setDetails] = useState<SalesReturnDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!returnId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select(`
          return_number,
          return_date,
          total_credit_amount,
          quantity,
          unit_price,
          discount_percent,
          gst_percent,
          orders (order_number),
          products (name)
        `)
        .eq('id', returnId)
        .single();

      if (error) throw error;

      setDetails({
        return_number: data.return_number,
        return_date: data.return_date,
        total_credit_amount: data.total_credit_amount,
        order_number: (data.orders as any)?.order_number || 0,
        product_name: (data.products as any)?.name || 'N/A',
        quantity: data.quantity,
        unit_price: data.unit_price,
        discount_percent: data.discount_percent,
        gst_percent: data.gst_percent,
      });
    } catch (error: any) {
      showError(`Failed to load return details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    }
  }, [isOpen, fetchDetails]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sales Return Details #{details?.return_number}</DialogTitle>
          <DialogDescription>
            Details for the credit note against Order #{details?.order_number}.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : details ? (
          <div className="space-y-4">
            <p><strong>Return Date:</strong> {new Date(details.return_date).toLocaleDateString()}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Disc %</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                  <TableHead className="text-right">Credit Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{details.product_name}</TableCell>
                  <TableCell className="text-right">{details.quantity}</TableCell>
                  <TableCell className="text-right">₹{details.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{details.discount_percent}%</TableCell>
                  <TableCell className="text-right">{details.gst_percent}%</TableCell>
                  <TableCell className="text-right font-bold">₹{details.total_credit_amount.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <p>No details found for this return.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SalesReturnDetailsDialog;