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
}

const formSchema = z.object({
  billNo: z.string().min(1, { message: 'Bill number is required.' }),
  dispatchDate: z.string().min(1, { message: 'Dispatch date is required.' }),
});

const DispatchOrderDialog: React.FC<DispatchOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onDispatchSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [dealerName, setDealerName] = useState<string | null>(null);

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
          .select('order_number, dealers(name)')
          .eq('id', orderId)
          .single() as { data: FetchedOrderInfo | null; error: any }; // Explicitly type data

        if (error) {
          console.error('Error fetching order info for dispatch:', error.message);
          showError('Failed to load order information.');
          setOrderNumber(null);
          setDealerName(null);
        } else if (data) {
          setOrderNumber(data.order_number);
          setDealerName(data.dealers?.name || 'N/A');
        }
        setLoading(false);
      } else {
        setOrderNumber(null);
        setDealerName(null);
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
      const { error } = await supabase
        .from('orders')
        .update({
          bill_no: values.billNo,
          dispatch_date: values.dispatchDate,
          dispatched: true,
        })
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