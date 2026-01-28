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
  id: string; // Order ID (or Dealer ID if order_number is 0)
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
  // Card fields (only transaction ID)
  cardTransactionId: z.string().optional(),
  // Bank Transfer fields (only transaction ID)
  bankTransactionId: z.string().optional(),
  // UPI fields (only transaction ID)
  upiTransactionId: z.string().optional(),
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
  } else if (data.paymentMethod === 'Card') {
    if (!data.cardTransactionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transaction ID is required for Card payment.',
        path: ['cardTransactionId'],
      });
    }
  } else if (data.paymentMethod === 'Bank Transfer') {
    if (!data.bankTransactionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transaction ID is required for Bank Transfer.',
        path: ['bankTransactionId'],
      });
    }
  } else if (data.paymentMethod === 'UPI') {
    if (!data.upiTransactionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transaction ID is required for UPI payment.',
        path: ['upiTransactionId'],
      });
    }
  }
});

const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const RECORD_GENERAL_PAYMENT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/record-general-payment";

const UpdatePaymentDialog: React.FC<UpdatePaymentDialogProps> = ({ orderToUpdate, isOpen, onOpenChange, onPaymentUpdated }) => {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentMethod: '',
      amount: 0,
      chequeDdNo: '',
      chequeDdDate: '',
      cardTransactionId: '',
      bankTransactionId: '',
      upiTransactionId: '',
    },
  });

  useEffect(() => {
    if (orderToUpdate && isOpen) {
      form.reset({
        paymentMethod: '',
        amount: orderToUpdate.total_amount,
        chequeDdNo: '',
        chequeDdDate: '',
        cardTransactionId: '',
        bankTransactionId: '',
        upiTransactionId: '',
      });
    }
  }, [orderToUpdate, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!orderToUpdate) return;
    setLoading(true);
    
    const isGeneralBalancePayment = orderToUpdate.order_number === 0;
    const dealerId = isGeneralBalancePayment ? orderToUpdate.id : null;

    try {
      if (isGeneralBalancePayment) {
        // --- Scenario 2: Payment against General Balance (Opening Balance) ---
        
        const response = await fetch(RECORD_GENERAL_PAYMENT_EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dealerId: dealerId,
            amount: values.amount,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to record general payment');
        }
        
        showSuccess(`Payment of ₹${values.amount.toFixed(2)} recorded against general balance for ${orderToUpdate.dealer_name}. New Outstanding Balance: ₹${data.new_opening_balance.toFixed(2)}.`);
        
      } else {
        // --- Scenario 1: Payment against a specific Order ---
        
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
            order_id: orderToUpdate.id, // Use the actual order ID
            amount: values.amount,
            payment_method: values.paymentMethod,
            payment_date: new Date().toISOString(), // Record current date as payment date
            status: 'pending_approval', // Payment is now pending approval
            // Conditional fields based on payment method
            cheque_dd_no: values.paymentMethod === 'Cheque/DD' ? values.chequeDdNo : null,
            cheque_dd_date: values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : null,
            transaction_id: 
              values.paymentMethod === 'Card' ? values.cardTransactionId :
              values.paymentMethod === 'Bank Transfer' ? values.bankTransactionId :
              values.paymentMethod === 'UPI' ? values.upiTransactionId : null,
          });

        if (paymentInsertError) {
          throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
        }

        showSuccess(`Payment for Order #${orderToUpdate.order_number} submitted for approval.`);
      }
      
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
          <DialogTitle>
            {orderToUpdate?.order_number === 0 
              ? `Record Payment for Outstanding Balance` 
              : `Update Payment for Order #${orderToUpdate?.order_number}`}
          </DialogTitle>
          <DialogDescription>
            {orderToUpdate?.order_number === 0 
              ? `Record a payment against the dealer's general outstanding balance.`
              : `Mark this order as paid and record the payment details.`}
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
                <Label>
                  {orderToUpdate.order_number === 0 ? 'Outstanding Balance:' : 'Total Amount Due:'}
                </Label>
                <Input value={`₹${orderToUpdate.total_amount.toFixed(2)}`} readOnly className="bg-muted" />
              </div>
              {orderToUpdate.payment_due_date && orderToUpdate.order_number !== 0 && (
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
              {selectedPaymentMethod === 'Card' && (
                <FormField
                  control={form.control}
                  name="cardTransactionId"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="cardTransactionId">Transaction ID</Label>
                      <FormControl>
                        <Input type="text" placeholder="e.g., TXN123456789" {...field} />
                        </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {selectedPaymentMethod === 'Bank Transfer' && (
                <FormField
                  control={form.control}
                  name="bankTransactionId"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="bankTransactionId">Transaction ID</Label>
                      <FormControl>
                        <Input type="text" placeholder="e.g., TXN123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {selectedPaymentMethod === 'UPI' && (
                <FormField
                  control={form.control}
                  name="upiTransactionId"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="upiTransactionId">Transaction ID</Label>
                      <FormControl>
                        <Input type="text" placeholder="e.g., UPI123456789" {...field} />
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