"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Undo2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface OrderItemDetail {
  product_name: string;
  quantity: number;
  total_price: number;
}

interface OrderDetail {
  id: string;
  order_number: number;
  order_date: string;
  dealer_name: string;
  bill_no: string | null;
  dispatch_date: string | null;
  items: OrderItemDetail[];
}

const MaterialReturnForm: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!searchTerm.trim()) {
      setOrder(null);
      return;
    }
    setLoading(true);
    setOrder(null);

    const search = searchTerm.trim();
    const isNumeric = /^\d+$/.test(search);

    let query = supabase
      .from('orders')
      .select(`
        id, order_number, order_date, bill_no, dispatch_date,
        dealers (name),
        sales (quantity, total_price, products (name))
      `)
      .eq('dispatched', true);

    if (isNumeric) {
      query = query.or(`order_number.eq.${search},bill_no.eq.${search}`);
    } else {
      query = query.eq('bill_no', search);
    }

    const { data, error } = await query.limit(1).single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching order:', error.message);
      showError(`Failed to fetch order: ${error.message}`);
    } else if (!data) {
      showError(`No dispatched order found for "${search}".`);
    } else {
      const formattedOrder: OrderDetail = {
        id: data.id,
        order_number: data.order_number,
        order_date: data.order_date,
        dealer_name: (data.dealers as any)?.name || 'N/A',
        bill_no: data.bill_no,
        dispatch_date: data.dispatch_date,
        items: (data.sales || []).map((sale: any) => ({
          product_name: sale.products?.name || 'N/A',
          quantity: sale.quantity,
          total_price: sale.total_price,
        })),
      };
      setOrder(formattedOrder);
      showSuccess(`Order #${formattedOrder.order_number} loaded.`);
    }
    setLoading(false);
  }, [searchTerm]);

  const handleProcessReturn = async () => {
    if (!order) return;
    setIsProcessing(true);
    try {
      // 1. Delete associated payments
      const { error: paymentError } = await supabase.from('payments').delete().eq('order_id', order.id);
      if (paymentError) throw new Error(`Failed to delete payment records: ${paymentError.message}`);

      // 2. Delete associated sales items (this will trigger stock restoration)
      const { error: salesError } = await supabase.from('sales').delete().eq('order_id', order.id);
      if (salesError) throw new Error(`Failed to delete sales records: ${salesError.message}`);

      // 3. Delete the order itself
      const { error: orderError } = await supabase.from('orders').delete().eq('id', order.id);
      if (orderError) throw new Error(`Failed to delete the order: ${orderError.message}`);

      showSuccess(`Material return for Order #${order.order_number} processed successfully. Stock has been restored.`);
      setOrder(null);
      setSearchTerm('');
    } catch (error: any) {
      console.error('Error processing return:', error);
      showError(`Failed to process return: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-red-600 dark:bg-red-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-2xl font-semibold flex items-center gap-2">
          <Undo2 className="h-6 w-6" /> Material Return Voucher
        </CardTitle>
        <CardDescription className="text-red-100 dark:text-red-200">
          Search for a dispatched order to process a full material return.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-grow">
            <Label htmlFor="searchTerm">Order Number or Bill Number</Label>
            <Input
              id="searchTerm"
              placeholder="e.g., 1001 or INV-2024-001"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={fetchOrder} disabled={loading || !searchTerm.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {order && (
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="text-xl font-bold">Order #{order.order_number}</h3>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="font-semibold">Dealer:</span> {order.dealer_name}</p>
                <p><span className="font-semibold">Order Date:</span> {new Date(order.order_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p><span className="font-semibold">Bill No:</span> {order.bill_no || 'N/A'}</p>
                <p><span className="font-semibold">Dispatch Date:</span> {order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
            <Separator />
            <h4 className="text-lg font-semibold">Items in Order</h4>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.total_price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full bg-red-600 hover:bg-red-700 mt-4" disabled={isProcessing}>
                  <Undo2 className="mr-2 h-4 w-4" /> Process Full Return
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" /> Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will process a **full material return** for Order #{order.order_number}.
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>The order and its associated sales records will be permanently deleted.</li>
                      <li>Any payment records for this order will be deleted.</li>
                      <li>The stock for all items in this order will be restored to inventory.</li>
                    </ul>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleProcessReturn} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm Return'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialReturnForm;