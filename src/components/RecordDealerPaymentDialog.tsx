"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface DealerLiability {
  id: string; // Unique ID (dealer_id for OB, order_id for order)
  type: 'opening_balance' | 'order';
  description: string;
  amount_due: number;
  amount_paid: number; // Amount already paid against this liability (for partial tracking)
  net_due: number;
  due_date: string | null;
  is_overdue: boolean;
  order_number?: number;
}

interface DealerOption {
  value: string;
  label: string;
}

interface RecordDealerPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded: () => void;
}

const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

const RecordDealerPaymentDialog: React.FC<RecordDealerPaymentDialogProps> = ({ isOpen, onOpenChange, onPaymentRecorded }) => {
  const { user } = useSession();
  const [dealers, setAllDealers] = useState<DealerOption[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [liabilities, setLiabilities] = useState<DealerLiability[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Input States
  const [paymentAmountInput, setPaymentAmountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [chequeDdNo, setChequeDdNo] = useState<string>('');
  const [chequeDdDate, setChequeDdDate] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');

  const [allocatedAmount, setAllocatedAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);

  const fetchDealerLiabilities = useCallback(async (dealerId: string) => {
    if (!dealerId) return;
    setLoading(true);
    try {
      // 1. Fetch Dealer Credit Days
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('allotted_credit_days')
        .eq('id', dealerId)
        .single();
      if (dealerError) throw dealerError;
      const allottedCreditDays = dealerData.allotted_credit_days || 0;

      // 2. Fetch Opening Balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', dealerId)
        .single();
      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      const openingBalance = balanceData?.opening_balance || 0;

      // 3. Fetch Pending Orders (payment_status = 'pending')
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`id, order_number, total_amount, payment_due_date, payments(amount, status)`)
        .eq('dealer_id', dealerId)
        .eq('payment_status', 'pending')
        .order('payment_due_date', { ascending: true });
      if (ordersError) throw ordersError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const liabilitiesList: DealerLiability[] = [];

      // Add Opening Balance as the first liability if positive
      if (openingBalance > 0) {
        // For simplicity, we use the dealer's last billing date as the conceptual due date for OB
        // Since we don't store OB due date, we'll use a very old date to ensure it's first/overdue.
        const obDueDate = new Date(0).toISOString().split('T')[0]; 
        const isOverdue = true; // Always treat OB as overdue if positive

        liabilitiesList.push({
          id: dealerId,
          type: 'opening_balance',
          description: 'Opening Balance',
          amount_due: openingBalance,
          amount_paid: 0, // Assuming no partial payment tracking on OB itself in this view
          net_due: openingBalance,
          due_date: obDueDate,
          is_overdue: isOverdue,
        });
      }

      // Add Pending Orders
      (ordersData || []).forEach(order => {
        const amountPaid = (order.payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
        const netDue = order.total_amount - amountPaid;
        
        if (netDue > 0) {
          const dueDate = order.payment_due_date ? new Date(order.payment_due_date) : new Date();
          const isOverdue = order.payment_due_date ? new Date(order.payment_due_date) < today : true;

          liabilitiesList.push({
            id: order.id,
            type: 'order',
            description: `Order #${order.order_number}`,
            amount_due: order.total_amount,
            amount_paid: amountPaid,
            net_due: netDue,
            due_date: order.payment_due_date,
            is_overdue: isOverdue,
            order_number: order.order_number,
          });
        }
      });

      setLiabilities(liabilitiesList);
    } catch (error: any) {
      showError(`Failed to load dealer liabilities: ${error.message}`);
      setLiabilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const fetchAllDealers = async () => {
        const { data, error } = await supabase.from('dealers').select('id, name').order('name', { ascending: true });
        if (error) { showError('Failed to load dealers.'); setAllDealers([]); }
        else { setAllDealers(data.map(d => ({ value: d.id, label: d.name }))); }
      };
      fetchAllDealers();
      setPaymentAmountInput(0);
      setPaymentMethod('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setChequeDdNo('');
      setChequeDdDate('');
      setTransactionId('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDealerId) {
      fetchDealerLiabilities(selectedDealerId);
    } else {
      setLiabilities([]);
    }
  }, [selectedDealerId, fetchDealerLiabilities]);

  // --- Core Allocation Logic ---
  useEffect(() => {
    let remainingPayment = paymentAmountInput;
    let totalAllocated = 0;
    
    // Create a deep copy of liabilities to track allocation locally
    const updatedLiabilities = liabilities.map(l => ({ ...l, allocated_now: 0 }));

    for (const liability of updatedLiabilities) {
      if (remainingPayment <= 0) break;

      const amountToAllocate = Math.min(remainingPayment, liability.net_due);
      
      if (amountToAllocate > 0) {
        liability.allocated_now = amountToAllocate;
        remainingPayment -= amountToAllocate;
        totalAllocated += amountToAllocate;
      }
    }

    setAllocatedAmount(totalAllocated);
    setAdvanceAmount(remainingPayment);
  }, [paymentAmountInput, liabilities]);

  const handleRecordPayment = async () => {
    if (!user || !selectedDealerId || paymentAmountInput <= 0 || !paymentMethod) {
      showError('Please select a dealer, enter a positive amount, and select a payment method.');
      return;
    }
    if (paymentMethod === 'Cheque/DD' && (!chequeDdNo || !chequeDdDate)) {
      showError('Cheque/DD number and date are required.');
      return;
    }
    if (['Card', 'Bank Transfer', 'UPI'].includes(paymentMethod) && !transactionId) {
      showError('Transaction ID is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Prepare Payment Data
      let transactionIdValue = null;
      if (['Card', 'Bank Transfer', 'UPI', 'Cash'].includes(paymentMethod)) transactionIdValue = transactionId;
      
      const paymentData = {
        order_id: null, // This is a general payment entry initially
        dealer_id: selectedDealerId,
        amount: paymentAmountInput,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        status: 'pending_approval', // Always pending approval for Admin entry
        cheque_dd_no: paymentMethod === 'Cheque/DD' ? chequeDdNo : null,
        cheque_dd_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : null,
        transaction_id: transactionIdValue,
        // Note: Card/Bank/UPI details are omitted here for simplicity, assuming they are handled by transactionId/method.
      };

      // 2. Insert the main payment record
      const { data: insertedPayment, error: paymentInsertError } = await supabase
        .from('payments')
        .insert(paymentData)
        .select('id')
        .single();

      if (paymentInsertError) throw new Error(`Failed to record payment: ${paymentInsertError.message}`);
      const paymentId = insertedPayment.id;

      // 3. Record Allocation (This is complex and usually requires a dedicated allocation table/RPC)
      // For now, we rely on the Admin to approve the payment, which will reduce the dealer's net balance.
      // The allocation logic is primarily for display/guidance here.

      showSuccess(`Payment of ₹${paymentAmountInput.toFixed(2)} recorded and submitted for approval.`);
      
      // Reset form and refresh data
      setPaymentAmountInput(0);
      setPaymentMethod('');
      setChequeDdNo('');
      setChequeDdDate('');
      setTransactionId('');
      setSelectedDealerId('');
      onPaymentRecorded();
      onOpenChange(false);

    } catch (error: any) {
      showError(`Failed to record payment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPaymentDetailsValid = useMemo(() => {
    if (!paymentMethod || paymentAmountInput <= 0) return false;
    if (paymentMethod === 'Cheque/DD' && (!chequeDdNo || !chequeDdDate)) return false;
    if (['Card', 'Bank Transfer', 'UPI'].includes(paymentMethod) && !transactionId) return false;
    return true;
  }, [paymentMethod, paymentAmountInput, chequeDdNo, chequeDdDate, transactionId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Dealer Payment</DialogTitle>
          <DialogDescription>
            Record a payment received from a dealer and see how it is allocated against outstanding liabilities.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Column 1: Payment Input & Details */}
          <div className="space-y-4">
            <Label htmlFor="dealerSelect">Select Dealer</Label>
            <Select value={selectedDealerId} onValueChange={setSelectedDealerId} disabled={loading || isSubmitting}>
              <SelectTrigger id="dealerSelect"><SelectValue placeholder="Select a dealer" /></SelectTrigger>
              <SelectContent>
                {dealers.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Separator />

            <Label htmlFor="paymentAmountInput">Payment Amount Received (₹)</Label>
            <Input
              id="paymentAmountInput"
              type="number"
              step="0.01"
              value={paymentAmountInput}
              onChange={(e) => setPaymentAmountInput(parseFloat(e.target.value) || 0)}
              min="0.01"
              disabled={isSubmitting}
            />

            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSubmitting}>
              <SelectTrigger id="paymentMethod"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                {paymentMethodsOptions.map((method) => (<SelectItem key={method} value={method}>{method}</SelectItem>))}
              </SelectContent>
            </Select>
            
            <Label htmlFor="paymentDate">Payment Date (Date Received)</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} disabled={isSubmitting} />

            {paymentMethod === 'Cheque/DD' && (
              <>
                <Label htmlFor="chequeDdNo">Cheque/DD Number</Label>
                <Input type="text" value={chequeDdNo} onChange={e => setChequeDdNo(e.target.value)} disabled={isSubmitting} />
                <Label htmlFor="chequeDdDate">Cheque/DD Date (Effective Date)</Label>
                <Input type="date" value={chequeDdDate} onChange={e => setChequeDdDate(e.target.value)} disabled={isSubmitting} />
              </>
            )}
            {['Card', 'Bank Transfer', 'UPI', 'Cash'].includes(paymentMethod) && (
              <>
                <Label htmlFor="transactionId">Transaction ID / Reference {paymentMethod === 'Cash' ? '(Optional)' : ''}</Label>
                <Input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} disabled={isSubmitting} />
              </>
            )}
          </div>

          {/* Column 2: Allocation Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Allocation Preview</h3>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : liabilities.length === 0 ? (
              <p className="text-muted-foreground">No outstanding liabilities found for this dealer.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Liability</TableHead>
                      <TableHead className="text-right">Net Due (₹)</TableHead>
                      <TableHead className="text-right">Allocated (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liabilities.map((liability, index) => {
                      const allocated = Math.min(
                        Math.max(0, paymentAmountInput - liabilities.slice(0, index).reduce((sum, l) => sum + l.net_due, 0)),
                        liability.net_due
                      );
                      return (
                        <TableRow key={liability.id} className={cn(liability.is_overdue && 'bg-red-50/50')}>
                          <TableCell>
                            <span className="font-medium">{liability.description}</span>
                            {liability.due_date && <div className="text-xs text-muted-foreground">Due: {new Date(liability.due_date).toLocaleDateString()}</div>}
                          </TableCell>
                          <TableCell className="text-right">₹{liability.net_due.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ₹{allocated.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-base">
                <span>Total Payment:</span>
                <span className="font-semibold">₹{paymentAmountInput.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span>Allocated to Liabilities:</span>
                <span className="font-semibold text-green-600">₹{allocatedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Advance Payment (Unallocated):</span>
                <span className={advanceAmount > 0 ? 'text-blue-600' : 'text-foreground'}>₹{advanceAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleRecordPayment} 
            disabled={isSubmitting || paymentAmountInput <= 0 || !selectedDealerId || !isPaymentDetailsValid}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Payment & Submit for Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordDealerPaymentDialog;