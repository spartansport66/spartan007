"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, CheckCircle, AlertCircle, Clock, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// IMPORTANT: This schema reflects the universal payment details structure
const paymentFormSchema = z.object({
  dealerId: z.string().uuid({ message: 'Dealer selection is required.' }),
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: 'Amount must be positive.' })
  ),
  paymentMethod: z.string().min(1, { message: 'Payment method is required.' }),
  paymentDate: z.string().min(1, { message: 'Payment date is required.' }),
  // Conditional fields
  chequeDdNo: z.string().optional(),
  chequeDdDate: z.string().optional(),
  transactionId: z.string().optional(),
  upiId: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  cardHolderName: z.string().optional(),
  cardNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  cvv: z.string().optional(),
});

interface DealerLiability {
  type: 'opening_balance' | 'order';
  id: string; // Dealer ID or Order ID
  description: string;
  due_date: string | null;
  original_amount: number;
  pending_amount: number;
  allocated_amount: number; // Amount allocated from the current payment
  days_overdue: number | null;
}

interface DealerOption {
  value: string;
  label: string;
}

interface AdminDealerPaymentFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded: () => void;
}

const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

const calculateDaysOverdue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setUTCHours(0, 0, 0, 0);

  if (due >= today) return 0;

  const diffTime = today.getTime() - due.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const AdminDealerPaymentForm: React.FC<AdminDealerPaymentFormProps> = ({ isOpen, onOpenChange, onPaymentRecorded }) => {
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liabilities, setLiabilities] = useState<DealerLiability[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      dealerId: '',
      amount: 0,
      paymentMethod: 'Cash',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedDealerId = form.watch('dealerId');
  const selectedPaymentMethod = form.watch('paymentMethod');
  const inputAmount = form.watch('amount');

  // --- Data Fetching ---
  const fetchDealers = useCallback(async () => {
    const { data, error } = await supabase.from('dealers').select('id, name').order('name', { ascending: true });
    if (error) { showError('Failed to load dealers.'); return; }
    setAllDealers(data.map(d => ({ value: d.id, label: d.name })));
  }, []);

  const fetchLiabilities = useCallback(async (dealerId: string) => {
    if (!dealerId) { setLiabilities([]); return; }
    setLoading(true);
    try {
      const { data: balanceData, error: balanceError } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', dealerId)
        .single();

      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      const openingBalance = balanceData?.opening_balance || 0;

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_due_date, payment_status, payments(amount, status)')
        .eq('dealer_id', dealerId)
        .in('payment_status', ['pending', 'pending_approval'])
        .order('payment_due_date', { ascending: true });

      if (ordersError) throw ordersError;

      const newLiabilities: DealerLiability[] = [];

      // 1. Opening Balance (if positive)
      if (openingBalance > 0) {
        newLiabilities.push({
          type: 'opening_balance',
          id: dealerId,
          description: 'Opening Balance',
          due_date: null,
          original_amount: openingBalance,
          pending_amount: openingBalance,
          allocated_amount: 0,
          days_overdue: null,
        });
      }

      // 2. Pending Orders (sorted by due date)
      (ordersData || []).forEach((order: any) => {
        // Calculate amount already paid/pending approval for this order
        const paidOrPendingAmount = (order.payments || [])
          .filter((p: any) => p.status === 'completed' || p.status === 'pending_approval')
          .reduce((sum: number, p: any) => sum + p.amount, 0);

        const pendingOrderAmount = order.total_amount - paidOrPendingAmount;

        if (pendingOrderAmount > 0) {
          const daysOverdue = calculateDaysOverdue(order.payment_due_date);
          newLiabilities.push({
            type: 'order',
            id: order.id,
            description: `Order #${order.order_number}`,
            due_date: order.payment_due_date,
            original_amount: order.total_amount,
            pending_amount: pendingOrderAmount,
            allocated_amount: 0,
            days_overdue: daysOverdue,
          });
        }
      });

      setLiabilities(newLiabilities);
    } catch (error: any) {
      showError(`Failed to load dealer liabilities: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  useEffect(() => {
    if (selectedDealerId) {
      fetchLiabilities(selectedDealerId);
    } else {
      setLiabilities([]);
    }
  }, [selectedDealerId, fetchLiabilities]);

  // --- Allocation Logic ---
  const totalLiability = useMemo(() => liabilities.reduce((sum, l) => sum + l.pending_amount, 0), [liabilities]);
  const unallocatedPayment = paymentAmount - liabilities.reduce((sum, l) => sum + l.allocated_amount, 0);

  useEffect(() => {
    // Auto-allocate payment when amount or liabilities change
    const autoAllocate = () => {
      let remainingPayment = inputAmount;
      const updatedLiabilities = liabilities.map(l => ({ ...l, allocated_amount: 0 }));

      for (const liability of updatedLiabilities) {
        if (remainingPayment <= 0) break;

        const amountToAllocate = Math.min(remainingPayment, liability.pending_amount);
        liability.allocated_amount = amountToAllocate;
        remainingPayment -= amountToAllocate;
      }

      setLiabilities(updatedLiabilities);
      setPaymentAmount(inputAmount); // Keep paymentAmount state updated with form input
    };

    if (inputAmount > 0 && liabilities.length > 0) {
      autoAllocate();
    } else if (liabilities.length > 0) {
      // Reset allocations if amount is zero
      setLiabilities(liabilities.map(l => ({ ...l, allocated_amount: 0 })));
      setPaymentAmount(0);
    }
  }, [inputAmount, liabilities.length]); // Only re-run when inputAmount or liability count changes

  const handleManualAllocationChange = (id: string, newValue: number) => {
    const liabilityIndex = liabilities.findIndex(l => l.id === id);
    if (liabilityIndex === -1) return;

    const maxAllocation = liabilities[liabilityIndex].pending_amount;
    const safeNewValue = Math.max(0, Math.min(newValue, maxAllocation));

    const currentTotalAllocatedExcludingThis = liabilities.reduce((sum, l, index) => sum + (index === liabilityIndex ? 0 : l.allocated_amount), 0);
    const totalPayment = paymentAmount;
    const maxAllowedAllocation = Math.max(0, totalPayment - currentTotalAllocatedExcludingThis);
    
    const finalAllocation = Math.min(safeNewValue, maxAllowedAllocation);

    setLiabilities(prev => prev.map((l, index) => 
      index === liabilityIndex ? { ...l, allocated_amount: finalAllocation } : l
    ));
  };

  // --- Submission ---
  const onSubmit = async (values: z.infer<typeof paymentFormSchema>) => {
    if (unallocatedPayment < 0) {
      showError('Total allocated amount exceeds the payment amount.');
      return;
    }
    if (liabilities.length > 0 && liabilities.every(l => l.allocated_amount === 0) && unallocatedPayment === 0) {
        showError('Please allocate the payment or ensure the payment amount is correct.');
        return;
    }

    setIsSubmitting(true);
    try {
      // 1. Prepare Payment Record
      const paymentRecord = {
        dealer_id: values.dealerId,
        amount: values.amount,
        payment_method: values.paymentMethod,
        payment_date: values.paymentDate,
        status: 'completed', // Admin payments are immediately completed
        // Conditional fields
        cheque_dd_no: values.paymentMethod === 'Cheque/DD' ? values.chequeDdNo : null,
        cheque_dd_date: values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : null,
        transaction_id: values.transactionId,
        upi_id: values.upiId,
        bank_name: values.bankName,
        account_number: values.accountNumber,
        ifsc_code: values.ifscCode,
        card_number: values.cardNumber,
        card_holder_name: values.cardHolderName,
        expiry_date: values.expiryDate,
        cvv: values.cvv,
        approved_at: new Date().toISOString(), // Mark as approved immediately
      };

      const { data: newPayment, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentRecord)
        .select('id')
        .single();

      if (paymentError) throw paymentError;
      const paymentId = newPayment.id;

      // 2. Prepare Allocation Records
      const allocationsToInsert = [];
      let remainingAdvance = unallocatedPayment;

      // Insert allocations against liabilities
      liabilities.forEach(l => {
        if (l.allocated_amount > 0) {
          allocationsToInsert.push({
            payment_id: paymentId,
            liability_id: l.id, // Order ID or Dealer ID (for OB)
            allocated_amount: l.allocated_amount,
            allocation_type: l.type,
          });
        }
      });

      // Insert advance payment allocation if remaining
      if (remainingAdvance > 0) {
        allocationsToInsert.push({
          payment_id: paymentId,
          liability_id: values.dealerId, // Use Dealer ID as liability ID for advance
          allocated_amount: remainingAdvance,
          allocation_type: 'advance',
        });
      }

      const { error: allocationError } = await supabase
        .from('payment_allocations')
        .insert(allocationsToInsert);

      if (allocationError) throw allocationError;

      // 3. Trigger Ledger Update (This is handled by database triggers, but we ensure the UI reflects changes)
      // The database triggers should handle updating dealer_balances (for OB/Advance) and orders (for partial/full payment status).

      showSuccess(`Payment of ₹${values.amount.toFixed(2)} recorded and allocated successfully!`);
      form.reset();
      setLiabilities([]);
      setPaymentAmount(0);
      onPaymentRecorded();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error recording payment:', error);
      showError(`Failed to record payment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAllocated = liabilities.reduce((sum, l) => sum + l.allocated_amount, 0);
  const advanceAmount = paymentAmount - totalAllocated;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Record Dealer Payment</DialogTitle>
          <DialogDescription>
            Enter payment details and allocate the amount against the dealer's outstanding liabilities.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
            {/* Payment Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md">
              <FormField
                control={form.control}
                name="dealerId"
                render={({ field }) => (
                  <FormItem>
                    <Label>Dealer</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allDealers.map(d => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}
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
                    <Label>Payment Amount (₹)</Label>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 10000.00" {...field} onChange={(e) => { field.onChange(e); setPaymentAmount(parseFloat(e.target.value) || 0); }} disabled={isSubmitting} />
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
                    <Label>Payment Date</Label>
                    <FormControl>
                      <Input type="date" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <Label>Payment Method</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethodsOptions.map((method) => (<SelectItem key={method} value={method}>{method}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Conditional Payment Fields */}
              {selectedPaymentMethod === 'Cheque/DD' && (
                <>
                  <FormField control={form.control} name="chequeDdNo" render={({ field }) => (<FormItem><Label>Cheque/DD No</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="chequeDdDate" render={({ field }) => (<FormItem><Label>Cheque/DD Date</Label><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>
              )}
              {selectedPaymentMethod === 'Bank Transfer' && (
                <>
                  <FormField control={form.control} name="transactionId" render={({ field }) => (<FormItem><Label>Transaction ID</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><Label>Bank Name</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="accountNumber" render={({ field }) => (<FormItem><Label>Account No.</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="ifscCode" render={({ field }) => (<FormItem><Label>IFSC Code</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>
              )}
              {selectedPaymentMethod === 'UPI' && (
                <>
                  <FormField control={form.control} name="upiId" render={({ field }) => (<FormItem><Label>UPI ID</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="transactionId" render={({ field }) => (<FormItem><Label>Transaction ID</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>
              )}
              {selectedPaymentMethod === 'Card' && (
                <>
                  <FormField control={form.control} name="transactionId" render={({ field }) => (<FormItem><Label>Transaction ID</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="cardNumber" render={({ field }) => (<FormItem><Label>Card Number (Last 4)</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="cardHolderName" render={({ field }) => (<FormItem><Label>Card Holder Name</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>
              )}
            </div>

            {/* Allocation Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment Allocation</h3>
              <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                <span className="font-bold">Payment Amount:</span>
                <span className="text-xl font-bold text-primary">₹{paymentAmount.toFixed(2)}</span>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : liabilities.length === 0 && totalLiability === 0 ? (
                <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Outstanding Liability</AlertTitle><AlertDescription>This dealer has no pending Opening Balance or unpaid orders. The entire payment will be recorded as an Advance Payment.</AlertDescription></Alert>
              ) : (
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Liability</TableHead>
                        <TableHead className="text-center">Due Date</TableHead>
                        <TableHead className="text-right">Pending (₹)</TableHead>
                        <TableHead className="text-right">Allocate (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liabilities.map(l => (
                        <TableRow key={l.id} className={cn(l.type === 'opening_balance' && 'bg-yellow-50/50', l.days_overdue && l.days_overdue > 0 && 'bg-red-50/50')}>
                          <TableCell className="font-medium">{l.description}</TableCell>
                          <TableCell className="text-center text-sm">
                            {l.due_date ? new Date(l.due_date).toLocaleDateString() : 'N/A'}
                            {l.days_overdue && l.days_overdue > 0 && <span className="block text-xs text-red-600 font-semibold">({l.days_overdue} days overdue)</span>}
                          </TableCell>
                          <TableCell className="text-right">₹{l.pending_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={l.allocated_amount.toFixed(2)}
                              onChange={(e) => handleManualAllocationChange(l.id, parseFloat(e.target.value) || 0)}
                              min="0"
                              max={l.pending_amount}
                              className="w-24 text-right h-8"
                              disabled={isSubmitting}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between font-semibold">
                <span>Total Allocated:</span>
                <span>₹{totalAllocated.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Advance Payment (Remaining):</span>
                <span className={cn(advanceAmount < 0 ? 'text-destructive' : 'text-green-600')}>
                  ₹{advanceAmount.toFixed(2)}
                </span>
              </div>
              {advanceAmount < 0 && <p className="text-sm text-destructive">Error: Allocated amount exceeds payment amount.</p>}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || advanceAmount < 0 || !selectedDealerId}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDealerPaymentForm;