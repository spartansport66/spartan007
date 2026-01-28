"use client";
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

interface PendingOrderPayment {
  id: string; // Order ID
  order_number: number;
  total_amount: number;
  dealer_name: string;
  payment_due_date: string | null;
}

interface UpdatePaymentDialogProps {
  orderToUpdate: PendingOrderPayment | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentUpdated: () => void;
}

const formSchema = z.object({
  paymentMethod: z.string().min(1, { message: 'Payment method is required.' }),
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: 'Amount must be a positive number.' })
  ),
  // Cheque/DD fields
  chequeDdNo: z.string().optional(),
  chequeDdDate: z.string().optional(),
  // Generic Transaction ID field
  transactionId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'Cheque/DD') {
    if (!data.chequeDdNo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cheque/DD Number is required for Cheque/DD payment.',
        path: ['chequeDdNo'],
      });
    }
    if (!data.chequeDdDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cheque/DD Date is required for Cheque/DD payment.',
        path: ['chequeDdDate'],
      });
    }
  } else if (data.paymentMethod !== 'Cash' && data.paymentMethod !== 'Cheque/DD') {
    // Require transaction ID for Card, Bank Transfer, UPI
    if (!data.transactionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transaction ID is required for this payment method.',
        path: ['transactionId'],
      });
    }
  }
});

const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

const UpdatePaymentDialog: React.FC<UpdatePaymentDialogProps> = ({ orderToUpdate, isOpen, onOpenChange, onPaymentUpdated }) => {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentMethod: '',
      amount: 0,
      chequeDdNo: '',
      chequeDdDate: '',
      transactionId: '',
    },
  });

  useEffect(() => {
    if (orderToUpdate && isOpen) {
      form.reset({
        paymentMethod: '',
        amount: orderToUpdate.total_amount,
        chequeDdNo: '',
        chequeDdDate: '',
        transactionId: '',
      });
    }
  }, [orderToUpdate, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!orderToUpdate) return;
    setLoading(true);
    try {
      // 1. Update the order's payment status to 'pending_approval'
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ payment_status: 'pending_approval' })
        .eq('id', orderToUpdate.id);
      
      if (orderUpdateError) {
        throw new Error(`Failed to update order payment status: ${orderUpdateError.message}`);
      }

      // 2. Insert a new payment record with status 'pending_approval'
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          order_id: orderToUpdate.id,
          amount: values.amount,
          payment_method: values.paymentMethod,
          payment_date: new Date().toISOString(), // Record current date as payment date
          status: 'pending_approval', // Payment is now pending approval
          // Conditional fields based on payment method
          cheque_dd_no: values.paymentMethod === 'Cheque/DD' ? values.chequeDdNo : null,
          cheque_dd_date: values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : null,
          // Generic transaction ID for all non-Cheque/DD methods
          transaction_id: values.transactionId || null,
          // Clear unused fields
          card_number: null,
          card_holder_name: null,
          expiry_date: null,
          cvv: null,
          bank_name: null,
          account_number: null,
          ifsc_code: null,
          upi_id: null,
        });

      if (paymentInsertError) {
        throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
      }

      showSuccess(`Payment for Order #${orderToUpdate.order_number} submitted for approval.`);
      onPaymentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating payment:', error.message);
      showError(`Failed to update payment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedPaymentMethod = form.watch('paymentMethod');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Payment for Order #{orderToUpdate?.order_number}</DialogTitle>
          <DialogDescription>
            Record payment details. This payment will be pending admin approval.
          </DialogDescription>
        </DialogHeader>
        {orderToUpdate ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Dealer:</Label>
                <Input value={orderToUpdate.dealer_name} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Total Amount Due:</Label>
                <Input value={`₹${orderToUpdate.total_amount.toFixed(2)}`} readOnly className="bg-muted" />
              </div>
              {orderToUpdate.payment_due_date && (
                <div className="space-y-2">
                  <Label>Payment Due Date:</Label>
                  <Input value={new Date(orderToUpdate.payment_due_date).toLocaleDateString()} readOnly className="bg-muted" />
                </div>
              )}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger id="paymentMethod" className="w-full">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethodsOptions.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="amount">Amount Paid</Label>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedPaymentMethod === 'Cheque/DD' && (
                <>
                  <FormField
                    control={form.control}
                    name="chequeDdNo"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="chequeDdNo">Cheque/DD Number</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., 123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="chequeDdDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="chequeDdDate">Cheque/DD Date</Label>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {(selectedPaymentMethod === 'Card' || selectedPaymentMethod === 'Bank Transfer' || selectedPaymentMethod === 'UPI' || selectedPaymentMethod === 'Cash') && (
                <FormField
                  control={form.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="transactionId">Transaction ID {selectedPaymentMethod === 'Cash' ? '(Optional)' : ''}</Label>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder={selectedPaymentMethod === 'Cash' ? 'Cash reference (Optional)' : 'e.g., TXN123456789'} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Payment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <p className="text-center text-muted-foreground py-8">No order selected for payment update.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePaymentDialog;