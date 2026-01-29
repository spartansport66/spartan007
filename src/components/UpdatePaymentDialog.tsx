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
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog'; // Ensure this is imported correctly

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
  paymentDate: z.string().min(1, { message: 'Payment date is required.' }), // New field for effective payment date
  // Cheque/DD fields
  chequeDdNo: z.string().optional(),
  chequeDdDate: z.string().optional(),
  // Transaction ID fields (consolidated)
  cardTransactionId: z.string().optional(),
  bankTransactionId: z.string().optional(),
  upiTransactionId: z.string().optional(),
  cashTransactionId: z.string().optional(),
  // New fields for Bank Transfer details (required by schema but optional in form)
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  // New fields for Card details (required by schema but optional in form)
  cardNumber: z.string().optional(),
  cardHolderName: z.string().optional(),
  expiryDate: z.string().optional(),
  cvv: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'Cheque/DD') {
    if (!data.chequeDdNo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cheque/DD Number is required for Cheque/DD payment.',
        path: ['chequeDdNo'],
      });
    }
    // For Cheque/DD, paymentDate must be the cheque date (chequeDdDate)
    if (data.paymentDate !== data.chequeDdDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Payment Date must match Cheque/DD Date.',
            path: ['paymentDate'],
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
  // Cash transaction ID is optional
});

const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

const UpdatePaymentDialog: React.FC<UpdatePaymentDialogProps> = ({ orderToUpdate, isOpen, onOpenChange, onPaymentUpdated }) => {
  const [loading, setLoading] = useState(false);
  // State for PaymentDetailsDialog (used if we need to view details after submission, though usually handled by parent)
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentMethod: '',
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0], // Default to today
      chequeDdNo: '',
      chequeDdDate: '',
      cardTransactionId: '',
      bankTransactionId: '',
      upiTransactionId: '',
      cashTransactionId: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      cardNumber: '',
      cardHolderName: '',
      expiryDate: '',
      cvv: '',
    },
  });

  const selectedPaymentMethod = form.watch('paymentMethod');
  const selectedChequeDdDate = form.watch('chequeDdDate');

  useEffect(() => {
    if (selectedPaymentMethod === 'Cheque/DD' && selectedChequeDdDate) {
        // If Cheque/DD is selected and date is set, force paymentDate to match chequeDdDate
        form.setValue('paymentDate', selectedChequeDdDate, { shouldValidate: true });
    } else if (selectedPaymentMethod !== 'Cheque/DD' && form.getValues('paymentDate') === selectedChequeDdDate) {
        // If method changes away from Cheque/DD, reset paymentDate to today if it was previously set to cheque date
        form.setValue('paymentDate', new Date().toISOString().split('T')[0], { shouldValidate: true });
    }
  }, [selectedPaymentMethod, selectedChequeDdDate, form]);

  useEffect(() => {
    if (orderToUpdate && isOpen) {
      form.reset({
        paymentMethod: '',
        // Set amount to total_amount if it's an order, or keep it editable if it's a general balance payment (Order #0)
        amount: orderToUpdate.order_number === 0 ? 0 : orderToUpdate.total_amount,
        paymentDate: new Date().toISOString().split('T')[0], // Default to today
        chequeDdNo: '',
        chequeDdDate: '',
        cardTransactionId: '',
        bankTransactionId: '',
        upiTransactionId: '',
        cashTransactionId: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        cardNumber: '',
        cardHolderName: '',
        expiryDate: '',
        cvv: '',
      });
    }
  }, [orderToUpdate, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!orderToUpdate) return;
    setLoading(true);
    
    const isGeneralBalancePayment = orderToUpdate.order_number === 0;
    let dealerId = orderToUpdate.order_number === 0 ? orderToUpdate.id : null; // If general payment, ID is the dealer ID

    try {
        if (!dealerId) {
            // If it's an order payment, fetch the dealer ID from the order
            const { data: orderData, error: orderFetchError } = await supabase
                .from('orders')
                .select('dealer_id')
                .eq('id', orderToUpdate.id)
                .single();
            
            if (orderFetchError) throw new Error(`Failed to fetch dealer ID for order: ${orderFetchError.message}`);
            dealerId = orderData.dealer_id;
        }

        if (!dealerId) {
            throw new Error('Could not determine dealer ID.');
        }

      // Determine transaction ID based on method
      let transactionId = null;
      if (values.paymentMethod === 'Card') transactionId = values.cardTransactionId;
      else if (values.paymentMethod === 'Bank Transfer') transactionId = values.bankTransactionId;
      else if (values.paymentMethod === 'UPI') transactionId = values.upiTransactionId;
      else if (values.paymentMethod === 'Cash') transactionId = values.cashTransactionId;

      const paymentData = {
        order_id: isGeneralBalancePayment ? null : orderToUpdate.id,
        dealer_id: dealerId,
        amount: values.amount,
        payment_method: values.paymentMethod,
        payment_date: values.paymentDate, // Use the user-provided payment date (PDC date)
        status: 'pending_approval',
        cheque_dd_no: values.paymentMethod === 'Cheque/DD' ? values.chequeDdNo : null,
        cheque_dd_date: values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : null,
        transaction_id: transactionId,
        // Bank Transfer details
        bank_name: values.paymentMethod === 'Bank Transfer' ? values.bankName : null,
        account_number: values.paymentMethod === 'Bank Transfer' ? values.accountNumber : null,
        ifsc_code: values.paymentMethod === 'Bank Transfer' ? values.ifscCode : null,
        // Card details
        card_number: values.paymentMethod === 'Card' ? values.cardNumber : null,
        card_holder_name: values.paymentMethod === 'Card' ? values.cardHolderName : null,
        expiry_date: values.paymentMethod === 'Card' ? values.expiryDate : null,
        cvv: values.paymentMethod === 'Card' ? values.cvv : null,
        // UPI details
        upi_id: values.paymentMethod === 'UPI' ? values.upiTransactionId : null, // Using transactionId field for UPI ID
      };

      if (!isGeneralBalancePayment) {
        // --- Scenario 1: Payment against a specific Order ---
        
        // 1. Update the order's payment status to 'pending_approval'
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ payment_status: 'pending_approval' })
          .eq('id', orderToUpdate.id);
        
        if (orderUpdateError) {
          throw new Error(`Failed to update order payment status: ${orderUpdateError.message}`);
        }
      }

      // 2. Insert a new payment record with status 'pending_approval'
      const { error: paymentInsertError, data: insertedPayment } = await supabase
        .from('payments')
        .insert(paymentData)
        .select('id');

      if (paymentInsertError) {
        throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
      }

      showSuccess(`Payment of ₹${values.amount.toFixed(2)} submitted for approval for ${orderToUpdate.order_number === 0 ? 'General Balance' : `Order #${orderToUpdate.order_number}`}.`);
      
      onPaymentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating payment:', error.message);
      showError(`Failed to update payment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isAmountEditable = orderToUpdate?.order_number === 0;

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
              ? `Record a payment against the dealer's general outstanding balance. This payment requires Admin approval.`
              : `Mark this order as paid and record the payment details. This payment requires Admin approval.`}
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
                  {orderToUpdate.order_number === 0 ? 'Total Outstanding Balance:' : 'Total Amount Due:'}
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
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="e.g., 1000.00" 
                        {...field} 
                        readOnly={!isAmountEditable}
                        className={isAmountEditable ? "" : "bg-muted"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Payment Date Field (Effective Date) */}
              {selectedPaymentMethod !== 'Cheque/DD' && (
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="paymentDate">Payment Date (Date Received)</Label>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
                        <Label htmlFor="chequeDdDate">Cheque/DD Date (Effective Date)</Label>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="paymentDate">Payment Date (Must match Cheque/DD Date)</Label>
                        <FormControl>
                          <Input type="date" {...field} readOnly className="bg-muted" />
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
                  <FormField
                    control={form.control}
                    name="cardNumber"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="cardNumber">Card Number (Optional)</Label>
                        <FormControl>
                          <Input type="text" placeholder="Last 4 digits" {...field} />
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
                        <Label htmlFor="cardHolderName">Card Holder Name (Optional)</Label>
                        <FormControl>
                          <Input type="text" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
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
                        <Label htmlFor="cvv">CVV (Optional)</Label>
                        <FormControl>
                          <Input type="text" placeholder="***" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {selectedPaymentMethod === 'Bank Transfer' && (
                <>
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
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="bankName">Bank Name (Optional)</Label>
                        <FormControl>
                          <Input type="text" {...field} />
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
                        <Label htmlFor="accountNumber">Account Number (Optional)</Label>
                        <FormControl>
                          <Input type="text" {...field} />
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
                        <Label htmlFor="ifscCode">IFSC Code (Optional)</Label>
                        <FormControl>
                          <Input type="text" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {selectedPaymentMethod === 'UPI' && (
                <FormField
                  control={form.control}
                  name="upiTransactionId"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="upiTransactionId">UPI ID / Transaction ID</Label>
                      <FormControl>
                        <Input type="text" placeholder="e.g., UPI123456789 or UPI ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {selectedPaymentMethod === 'Cash' && (
                <FormField
                  control={form.control}
                  name="cashTransactionId"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="cashTransactionId">Reference / Transaction ID (Optional)</Label>
                      <FormControl>
                        <Input type="text" placeholder="e.g., Cash reference number" {...field} />
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
      {/* Removed the nested PaymentDetailsDialog reference */}
    </Dialog>
  );
};

export default UpdatePaymentDialog;