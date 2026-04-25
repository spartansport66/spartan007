"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface DispatchOrderDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatchSuccess: (dispatchedOrderId: string) => void; // Modified to pass orderId
}

// Define the expected structure of the data returned by the Supabase query
interface FetchedOrderInfo {
  order_number: number;
  dealers: { name: string } | null;
  bill_no: string | null;
}

const formSchema = z.object({
  billNo: z.string().optional(),
  dispatchDate: z.string().min(1, { message: 'Dispatch date is required.' }),
});

const DispatchOrderDialog: React.FC<DispatchOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onDispatchSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [dealerName, setDealerName] = useState<string | null>(null);
  const [billNo, setBillNo] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      billNo: '',
      dispatchDate: new Date().toISOString().split('T')[0], // Default to today's date
    },
  });

  useEffect(() => {
    const fetchOrderInfo = async () => {
      if (orderId && isOpen) {
        setLoading(true);
        const { data, error } = await supabase
          .from('orders')
          .select('order_number, dealers(name), bill_no')
          .eq('id', orderId)
          .single() as { data: FetchedOrderInfo | null; error: any }; // Explicitly type data

        if (error) {
          console.error('Error fetching order info for dispatch:', error.message);
          showError('Failed to load order information.');
          setOrderNumber(null);
          setDealerName(null);
          setBillNo(null);
        } else if (data) {
          setOrderNumber(data.order_number);
          setDealerName(data.dealers?.name || 'N/A');
          setBillNo(data.bill_no || null);
          // Pre-populate the form with fetched bill_no
          form.reset({
            billNo: data.bill_no || '',
            dispatchDate: new Date().toISOString().split('T')[0],
          });
        }
        setLoading(false);
      } else {
        setOrderNumber(null);
        setDealerName(null);
        setBillNo(null);
        form.reset({
          billNo: '',
          dispatchDate: new Date().toISOString().split('T')[0],
        });
      }
    };
    fetchOrderInfo();
  }, [orderId, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!orderId) return;
    setLoading(true);
    try {
      // Try to fetch the next dispatch number via RPC. If the RPC/function
      // is not available in the remote DB (schema not migrated), fall back
      // to updating without the number and let the DB trigger assign it.
      let nextDispatchNumber: number | null = null;
      try {
        const { data: seqData, error: seqError } = await supabase
          .rpc('get_next_dispatch_number')
          .single();
        if (seqError) {
          console.warn('get_next_dispatch_number RPC error, falling back to trigger:', seqError.message);
        } else {
          nextDispatchNumber = seqData as unknown as number;
        }
      } catch (rpcErr) {
        console.warn('RPC call failed, falling back to trigger:', rpcErr);
      }

      const updatePayload: any = {
        bill_no: values.billNo?.trim() ? values.billNo.trim() : null,
        dispatch_date: values.dispatchDate,
        dispatched: true,
        status: 'completed',
      };
      if (nextDispatchNumber !== null) updatePayload.dispatch_number = nextDispatchNumber;

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      showSuccess(`Order ${orderNumber} dispatched successfully!`);
      onDispatchSuccess(orderId); // Pass the dispatched orderId back
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error dispatching order:', error.message);
      showError(`Failed to dispatch order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Dispatch Order</DialogTitle>
          <DialogDescription>
            Enter the bill number and dispatch date for Order #{orderNumber} (Dealer: {dealerName}).
          </DialogDescription>
          {billNo && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>Bill No:</strong> <span className="text-blue-600 font-semibold">#{billNo}</span>
            </div>
          )}
        </DialogHeader>
        {loading && !orderNumber ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading order info...</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="billNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., INV-2023-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dispatchDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispatch Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Dispatch Order'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DispatchOrderDialog;