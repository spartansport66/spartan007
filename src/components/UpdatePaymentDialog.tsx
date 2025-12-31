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
  // Card fields
  cardNumber: z.string().optional(),
  cardHolderName: z.string().optional(),
  expiryDate: z.string().optional(),
  cvv: z.string().optional(),
  // Bank Transfer fields
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  // UPI fields
  upiId: z.string().optional(),
  transactionId: z.string().optional(), // Common for Bank Transfer and UPI
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
    if (!data.cardNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Card Number is required.', path: ['cardNumber'] });
    if (!data.cardHolderName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Card Holder Name is required.', path: ['cardHolderName'] });
    if (!data.expiryDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expiry Date is required.', path: ['expiryDate'] });
    if (!data.cvv) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CVV is required.', path: ['cvv'] });
  } else if (data.paymentMethod === 'Bank Transfer') {
    if (!data.bankName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bank Name is required.', path: ['bankName'] });
    if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Account Number is required.', path: ['accountNumber'] });
    if (!data.ifscCode) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IFSC Code is required.', path: ['ifscCode'] });
    if (!data.transactionId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction ID is required.', path: ['transactionId'] });
  } else if (data.paymentMethod === 'UPI') {
    if (!data.upiId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UPI ID is required.', path: ['upiId'] });
    if (!data.transactionId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction ID is required.', path: ['transactionId'] });
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
      cardNumber: '',
      cardHolderName: '',
      expiryDate: '',
      cvv: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      upiId: '',
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
        cardNumber: '',
        cardHolderName: '',
        expiryDate: '',
        cvv: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        upiId: '',
        transactionId: '',
      });
    }
  }, [orderToUpdate, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!orderToUpdate) return;
    setLoading(true);
    try {
      // 1. Update the order's payment status to 'paid'
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderToUpdate.id);

      if (orderUpdateError) {
        throw new Error(`Failed to update order payment status: ${orderUpdateError.message}`);
      }

      // 2. Insert a new payment record
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          order_id: orderToUpdate.id,
          amount: values.amount,
          payment_method: values.paymentMethod,
          payment_date: new Date().toISOString(), // Record current date as payment date
          status: 'completed', // Payment is now completed
          // Conditional fields based on payment method
          cheque_dd_no: values.paymentMethod === 'Cheque/DD' ? values.chequeDdNo : null,
          cheque_dd_date: values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : null,
          card_number: values.paymentMethod === 'Card' ? values.cardNumber : null,
          card_holder_name: values.paymentMethod === 'Card' ? values.cardHolderName : null,
          expiry_date: values.paymentMethod === 'Card' ? values.expiryDate : null,
          cvv: values.paymentMethod === 'Card' ? values.cvv : null,
          bank_name: values.paymentMethod === 'Bank Transfer' ? values.bankName : null,
          account_number: values.paymentMethod === 'Bank Transfer' ? values.accountNumber : null,
          ifsc_code: values.paymentMethod === 'Bank Transfer' ? values.ifscCode : null,
          upi_id: values.paymentMethod === 'UPI' ? values.upiId : null,
          transaction_id: (values.paymentMethod === 'Bank Transfer' || values.paymentMethod === 'UPI') ? values.transactionId : null,
        });

      if (paymentInsertError) {
        throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
      }

      showSuccess(`Payment for Order #${orderToUpdate.order_number} recorded successfully!`);
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
            Mark this order as paid and record the payment details.
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

              {selectedPaymentMethod === 'Card' && (
                <>
                  <FormField
                    control={form.control}
                    name="cardNumber"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., XXXX XXXX XXXX 1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cardHolderName"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="cardHolderName">Card Holder Name</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <Label htmlFor="expiryDate">Expiry Date (MM/YY)</Label>
                          <FormControl>
                            <Input type="text" placeholder="MM/YY" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cvv"
                      render={({ field }) => (
                        <FormItem>
                          <Label htmlFor="cvv">CVV</Label>
                          <FormControl>
                            <Input type="text" placeholder="XXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {selectedPaymentMethod === 'Bank Transfer' && (
                <>
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="bankName">Bank Name</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., State Bank of India" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., 123456789012" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ifscCode"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="ifscCode">IFSC Code</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., SBIN0000001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="transactionId"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="transactionId">Transaction ID</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., TXN123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {selectedPaymentMethod === 'UPI' && (
                <>
                  <FormField
                    control={form.control}
                    name="upiId"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="upiId">UPI ID</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., user@bank" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="transactionId"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="transactionId">Transaction ID</Label>
                        <FormControl>
                          <Input type="text" placeholder="e.g., UPI123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
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