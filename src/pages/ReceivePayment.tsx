"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Check, ChevronsUpDown, Search, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface Dealer {
  id: string;
  name: string;
}

interface Liability {
  id: string; // Can be a dealer ID (for opening_balance) or an order ID
  type: 'opening_balance' | 'order';
  description: string;
  dueDate: string | null;
  dueAmount: number;
  paidAmount: number;
  balance: number;
}

interface Allocation {
  liabilityId: string;
  amount: number;
}

const paymentSchema = z.object({
  amount: z.preprocess((val) => Number(val || 0), z.number().min(0.01, "Amount must be greater than 0.")),
  paymentMethod: z.string().min(1, "Payment method is required."),
  paymentDate: z.string().min(1, "Payment date is required."),
  chequeDdNo: z.string().optional(),
  chequeDdDate: z.string().optional(),
  transactionId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'Cheque/DD' && !data.chequeDdNo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cheque/DD number is required.', path: ['chequeDdNo'] });
  }
  if (data.paymentMethod === 'Cheque/DD' && !data.chequeDdDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cheque/DD date is required.', path: ['chequeDdDate'] });
  }
});

const ReceivePayment = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearch, setDealerSearch] = useState('');

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: '',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('dealers').select('id, name').order('name');
      if (error) throw error;
      setDealers(data || []);
    } catch (error: any) {
      showError(`Failed to load dealers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      showError('Access Denied.');
      navigate('/dashboard');
    } else if (!sessionLoading) {
      fetchDealers();
    }
  }, [sessionLoading, isAdmin, navigate, fetchDealers]);

  const fetchLiabilities = useCallback(async (dealerId: string) => {
    setLoading(true);
    try {
      // Fetch opening balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', dealerId)
        .single();
      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      const openingBalance = balanceData?.opening_balance || 0;

      // Fetch payments allocated to opening balance
      const { data: openingBalancePayments, error: obpError } = await supabase
        .from('payment_allocations')
        .select('allocated_amount, payments(status)')
        .eq('liability_id', dealerId)
        .eq('allocation_type', 'opening_balance')
        .eq('payments.status', 'completed');
      if (obpError) throw obpError;
      const totalPaidAgainstOpeningBalance = (openingBalancePayments || []).reduce((sum, p) => sum + p.allocated_amount, 0);
      
      const openingBalanceDue = openingBalance - totalPaidAgainstOpeningBalance;

      // Fetch outstanding orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_due_date, payments(amount, status)')
        .eq('dealer_id', dealerId)
        .neq('payment_status', 'paid');
      if (ordersError) throw ordersError;

      const newLiabilities: Liability[] = [];

      if (openingBalanceDue > 0) {
        newLiabilities.push({
          id: dealerId,
          type: 'opening_balance',
          description: 'Opening Balance',
          dueDate: null,
          dueAmount: openingBalance,
          paidAmount: totalPaidAgainstOpeningBalance,
          balance: openingBalanceDue,
        });
      }

      (ordersData || []).forEach(order => {
        const paidAmount = (order.payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
        const balance = order.total_amount - paidAmount;
        if (balance > 0) {
          newLiabilities.push({
            id: order.id,
            type: 'order',
            description: `Order #${order.order_number}`,
            dueDate: order.payment_due_date,
            dueAmount: order.total_amount,
            paidAmount: paidAmount,
            balance: balance,
          });
        }
      });

      setLiabilities(newLiabilities);
    } catch (error: any) {
      showError(`Failed to load liabilities: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDealerId) {
      fetchLiabilities(selectedDealerId);
    } else {
      setLiabilities([]);
    }
    setAllocations([]);
    paymentForm.reset();
  }, [selectedDealerId, fetchLiabilities, paymentForm]);

  const totalPaymentAmount = paymentForm.watch('amount');
  const parsedTotalPaymentAmount = parseFloat(String(totalPaymentAmount)) || 0;
  const totalAllocated = useMemo(() => allocations.reduce((sum, alloc) => sum + alloc.amount, 0), [allocations]);
  const remainingToAllocate = parsedTotalPaymentAmount - totalAllocated;

  const handleAllocationChange = (liabilityId: string, amountStr: string) => {
    const amount = parseFloat(amountStr) || 0;
    const liability = liabilities.find(l => l.id === liabilityId);
    if (!liability) return;

    const clampedAmount = Math.max(0, Math.min(amount, liability.balance));
    
    setAllocations(prev => {
      const existing = prev.find(a => a.liabilityId === liabilityId);
      if (existing) {
        return prev.map(a => a.liabilityId === liabilityId ? { ...a, amount: clampedAmount } : a);
      }
      return [...prev, { liabilityId, amount: clampedAmount }];
    });
  };

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    if (!selectedDealerId || !user) return;
    if (totalAllocated > parsedTotalPaymentAmount) {
      showError("Total allocated amount cannot exceed the payment amount.");
      return;
    }
    if (totalAllocated <= 0) {
      showError("You must allocate the payment to at least one due item.");
      return;
    }

    setIsSubmitting(true);
    try {
      const effectivePaymentDate = values.paymentMethod === 'Cheque/DD' ? values.chequeDdDate : values.paymentDate;
      const isPostDated = effectivePaymentDate && new Date(effectivePaymentDate) > new Date();
      const paymentStatus = isPostDated ? 'pending_approval' : 'completed';
      const approvedAt = isPostDated ? null : new Date().toISOString();

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          dealer_id: selectedDealerId,
          amount: values.amount,
          payment_method: values.paymentMethod,
          payment_date: values.paymentDate,
          status: paymentStatus,
          approved_at: approvedAt,
          cheque_dd_no: values.chequeDdNo,
          cheque_dd_date: values.chequeDdDate,
          transaction_id: values.transactionId,
          recorded_by: user.id,
          source: 'voucher', // Set the source
        })
        .select('id')
        .single();

      if (paymentError) throw paymentError;

      if (paymentStatus === 'completed') {
        const allocationsToInsert = allocations
          .filter(a => a.amount > 0)
          .map(a => {
            const liability = liabilities.find(l => l.id === a.liabilityId);
            if (!liability) throw new Error(`Could not find liability with ID ${a.liabilityId}`);
            return {
              payment_id: payment.id,
              liability_id: a.liabilityId,
              allocated_amount: a.amount,
              allocation_type: liability.type,
            };
          });

        if (allocationsToInsert.length > 0) {
          const { error: allocationError } = await supabase.from('payment_allocations').insert(allocationsToInsert);
          if (allocationError) throw allocationError;
        }
      }

      showSuccess(`Payment recorded. Status: ${paymentStatus.replace('_', ' ')}.`);
      setSelectedDealerId(null);
    } catch (error: any) {
      showError(`Failed to record payment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDealers = useMemo(() => {
    if (!dealerSearch) return dealers;
    return dealers.filter(d => d.name.toLowerCase().includes(dealerSearch.toLowerCase()));
  }, [dealers, dealerSearch]);

  const selectedDealerName = selectedDealerId ? dealers.find(d => d.id === selectedDealerId)?.name : "Select a dealer";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>
      <Card className="shadow-lg">
        <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
          <CardTitle className="text-2xl font-bold text-white">Receive Payment Voucher</CardTitle>
          <CardDescription className="text-blue-100 dark:text-blue-200">Record a new payment from a dealer and allocate it to their outstanding dues.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="max-w-sm">
            <Label>Select Dealer</Label>
            <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">{selectedDealerName}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <div className="p-2 border-b"><Input placeholder="Search dealer..." value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} className="h-8" /></div>
                <ScrollArea className="h-[200px]"><div className="p-1">{filteredDealers.map((d) => (<Button key={d.id} variant="ghost" className="w-full justify-start font-normal" onClick={() => { setSelectedDealerId(d.id); setIsDealerPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", selectedDealerId === d.id ? "opacity-100" : "opacity-0")} />{d.name}</Button>))}</div></ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          {selectedDealerId && (
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader className="bg-muted/50">
                      <CardTitle>Payment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <FormField control={paymentForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount Received</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={paymentForm.control} name="paymentMethod" render={({ field }) => (<FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Card">Card</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Cheque/DD">Cheque/DD</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      {paymentForm.watch('paymentMethod') === 'Cheque/DD' && (<><FormField control={paymentForm.control} name="chequeDdNo" render={({ field }) => (<FormItem><FormLabel>Cheque/DD No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={paymentForm.control} name="chequeDdDate" render={({ field }) => (<FormItem><FormLabel>Cheque/DD Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} /></>)}
                      {['Card', 'Bank Transfer', 'UPI'].includes(paymentForm.watch('paymentMethod')) && (<FormField control={paymentForm.control} name="transactionId" render={({ field }) => (<FormItem><FormLabel>Transaction ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="bg-muted/50">
                      <CardTitle>Allocate Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {loading ? <Loader2 className="animate-spin" /> : liabilities.length === 0 ? <p>No outstanding dues for this dealer.</p> : (
                        <div className="space-y-4">
                          <div className="max-h-64 overflow-y-auto border rounded-md">
                            <Table>
                              <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Due Amount</TableHead><TableHead>Allocate</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {liabilities.map(l => (
                                  <TableRow key={l.id}>
                                    <TableCell>{l.description}<br /><span className="text-xs text-muted-foreground">Due: {l.dueDate ? new Date(l.dueDate).toLocaleDateString() : 'N/A'}</span></TableCell>
                                    <TableCell>₹{l.balance.toFixed(2)}</TableCell>
                                    <TableCell><Input type="number" step="0.01" max={l.balance} min="0" placeholder="0.00" onChange={e => handleAllocationChange(l.id, e.target.value)} className="w-28" /></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <Separator />
                          <div className="space-y-2 text-sm font-medium">
                            <div className="flex justify-between"><span>Total Payment:</span><span>₹{parsedTotalPaymentAmount.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Total Allocated:</span><span>₹{totalAllocated.toFixed(2)}</span></div>
                            <div className={`flex justify-between font-bold ${remainingToAllocate < 0 ? 'text-destructive' : 'text-primary'}`}><span>Unallocated:</span><span>₹{remainingToAllocate.toFixed(2)}</span></div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting || loading || remainingToAllocate < 0 || totalAllocated === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                    Submit Payment
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default ReceivePayment;