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
import { Loader2, DollarSign } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useSession } from '@/contexts/SessionContext';

interface DealerBalancePayment {
  dealer_id: string;
  dealer_name: string;
  current_balance: number;
}

interface RecordBalancePaymentDialogProps {
  dealerToUpdate: DealerBalancePayment | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded: () => void;
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
  // Transaction ID field (used for Card, Bank Transfer, UPI, Cash)
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

const RecordBalancePaymentDialog: React.FC<RecordBalancePaymentDialogProps> = ({ dealerToUpdate, isOpen, onOpenChange, onPaymentRecorded }) => {
  const { user } = useSession();
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
    if (dealerToUpdate && isOpen) {
      form.reset({
        paymentMethod: '',
        amount: dealerToUpdate.current_balance > 0 ? parseFloat(dealerToUpdate.current_balance.toFixed(2)) : 0,
        chequeDdNo: '',
        chequeDdDate: '',
        transactionId: '',
      });
    }
  }, [dealerToUpdate, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!dealerToUpdate || !user) return;
    setLoading(true);
    try {
      // 1. Insert a new payment record with status 'completed'
      // We now insert NULL for order_id, assuming the payments.order_id column allows NULLs.
      
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          order_id: null, // Use NULL for general balance payment
          amount: values.amount,
          payment_method: values.paymentMethod,
          payment_date: new Date().toISOString(),
          status: 'completed', // Assume general balance payments are completed immediately
          approved_at: new Date().toISOString(), // Mark as approved immediately
          
          // Conditional fields
          cheque_dd_no: values.paymentMethod === 'Cheque/DD' ? values.chequeDdNo : null,
          cheque_dd_date: values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : null,
          transaction_id: values.transactionId || null,
          
          // Additional metadata to link to dealer for RLS/tracking
          dealer_id: dealerToUpdate.dealer_id,
          recorded_by: user.id,
        });

      if (paymentInsertError) {
        throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
      }

      showSuccess(`Payment of ₹${values.amount.toFixed(2)} recorded successfully for ${dealerToUpdate.dealer_name}.`);
      onPaymentRecorded();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error recording balance payment:', error.message);
      showError(`Failed to record payment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedPaymentMethod = form.watch('paymentMethod');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Record Balance Payment
          </DialogTitle>
          <DialogDescription>
            Record a general payment against the outstanding balance of {dealerToUpdate?.dealer_name}.
          </DialogDescription>
        </DialogHeader>
        {dealerToUpdate ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Dealer:</Label>
                <Input value={dealerToUpdate.dealer_name} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Current Outstanding Balance:</Label>
                <Input value={`₹${dealerToUpdate.current_balance.toFixed(2)}`} readOnly className="bg-muted font-semibold text-red-600" />
              </div>
              
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
                        <Input type="text" placeholder="e.g., TXN123456789" {...field} />
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
          <p className="text-center text-muted-foreground py-8">No dealer selected.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecordBalancePaymentDialog;