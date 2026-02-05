"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PaymentVoucherDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DealerOption {
  value: string;
  label: string;
}

interface OutstandingOrder {
  id: string;
  order_number: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'UPI'];

const PaymentVoucherDialog: React.FC<PaymentVoucherDialogProps> = ({ isOpen, onOpenChange }) => {
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [outstandingOrders, setOutstandingOrders] = useState<OutstandingOrder[]>([]);
  
  // Payment Voucher State
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  
  // Allocation State: { [orderId]: allocatedAmount }
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Searchable Select States
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearchValue, setDealerSearchValue] = useState("");

  // --- Data Fetching ---

  const fetchDealers = useCallback(async () => {
    const { data, error } = await supabase
      .from('dealers')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      showError('Failed to load dealers.');
      setAllDealers([]);
    } else {
      setAllDealers(data.map(d => ({ value: d.id, label: d.name })));
    }
  }, []);

  const fetchOutstandingOrders = useCallback(async (dealerId: string) => {
    if (!dealerId) {
      setOutstandingOrders([]);
      return;
    }
    setLoading(true);
    try {
      // NOTE: This query assumes 'paid_amount' column exists in the 'orders' table.
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, paid_amount')
        .eq('dealer_id', dealerId)
        .or('paid_amount.is.null,total_amount.gt.paid_amount');

      if (error) throw error;

      const orders: OutstandingOrder[] = (data || []).map(order => {
        const total = order.total_amount || 0;
        const paid = order.paid_amount || 0;
        return {
          id: order.id,
          order_number: order.order_number,
          total_amount: total,
          paid_amount: paid,
          balance: total - paid,
        };
      }).filter(order => order.balance > 0); // Only show orders with a positive balance

      setOutstandingOrders(orders);
      // Reset allocations for the new dealer/orders
      setAllocations({});
    } catch (error: any) {
      console.error('Error fetching outstanding orders:', error.message);
      showError('Failed to load outstanding orders.');
      setOutstandingOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDealers();
      // Reset state when dialog opens
      setFilterDealerId('');
      setPaymentAmount('');
      setPaymentMethod('');
      setReferenceNumber('');
      setOutstandingOrders([]);
      setAllocations({});
    }
  }, [isOpen, fetchDealers]);

  useEffect(() => {
    if (filterDealerId) {
      fetchOutstandingOrders(filterDealerId);
    }
  }, [filterDealerId, fetchOutstandingOrders]);

  // --- Allocation Logic ---

  const totalPayment = useMemo(() => parseFloat(paymentAmount) || 0, [paymentAmount]);

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  }, [allocations]);

  const advanceAmount = useMemo(() => {
    const advance = totalPayment - totalAllocated;
    return Math.max(0, advance); // Advance cannot be negative
  }, [totalPayment, totalAllocated]);

  const remainingAllocation = useMemo(() => {
    return totalPayment - totalAllocated;
  }, [totalPayment, totalAllocated]);

  const handleAllocationChange = (orderId: string, value: string) => {
    const order = outstandingOrders.find(o => o.id === orderId);
    if (!order) return;

    let amount = parseFloat(value) || 0;
    amount = Math.max(0, amount); // Allocation cannot be negative

    // 1. Allocation cannot exceed the order's balance
    amount = Math.min(amount, order.balance);

    // 2. Calculate how much this change affects the total allocation
    const currentAllocationForOrder = allocations[orderId] || 0;
    const changeInAllocation = amount - currentAllocationForOrder;

    // 3. Allocation cannot exceed the remaining payment amount
    if (totalAllocated + changeInAllocation > totalPayment) {
      // If the new amount pushes the total over, cap the new amount
      const maxAllowed = currentAllocationForOrder + remainingAllocation;
      amount = Math.min(amount, maxAllowed);
    }

    setAllocations(prev => ({
      ...prev,
      [orderId]: amount,
    }));
  };

  // --- Submission ---

  const handleSubmit = async () => {
    if (!filterDealerId || totalPayment <= 0 || !paymentMethod) {
      showError('Please select a dealer, enter a valid payment amount, and select a payment method.');
      return;
    }

    setSubmitting(true);

    // Prepare the allocations array for the RPC
    const finalAllocations = Object.entries(allocations)
      .filter(([, amount]) => amount > 0)
      .map(([order_id, allocated_amount]) => ({
        order_id,
        allocated_amount: parseFloat(allocated_amount.toFixed(2)), // Ensure precision
      }));

    try {
      // NOTE: This RPC function must be implemented in Supabase for this to work.
      const { data, error } = await supabase.rpc('process_dealer_payment', {
        p_dealer_id: filterDealerId,
        p_total_amount: totalPayment,
        p_payment_method: paymentMethod,
        p_reference_number: referenceNumber,
        p_allocations: finalAllocations,
      });

      if (error) throw error;

      showSuccess(`Payment Voucher recorded successfully! Payment ID: ${data}`);
      onOpenChange(false); // Close dialog on success
    } catch (error: any) {
      console.error('Payment submission failed:', error);
      showError(`Failed to record payment: ${error.message || 'An unknown error occurred.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || !filterDealerId || totalPayment <= 0 || !paymentMethod;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">New Payment Voucher</DialogTitle>
          <DialogDescription>
            Record a payment from a dealer and allocate the amount to their outstanding orders or record it as an advance.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
          {/* Dealer Selection */}
          <div className="col-span-3 md:col-span-1">
            <Label htmlFor="dealer">Select Dealer *</Label>
            <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isDealerPopoverOpen}
                  className="w-full justify-between"
                  disabled={loading || submitting}
                >
                  {allDealers.find(d => d.value === filterDealerId)?.label || "Select a dealer..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search dealer..." value={dealerSearchValue} onValueChange={setDealerSearchValue} />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {allDealers.length === 0 ? <CommandEmpty>No dealers found.</CommandEmpty> : (
                      <CommandGroup>
                        {allDealers.filter(d => d.label.toLowerCase().includes(dealerSearchValue.toLowerCase())).map((dealer) => (
                          <CommandItem key={dealer.value} value={dealer.label} onSelect={() => {
                            setFilterDealerId(dealer.value);
                            setIsDealerPopoverOpen(false);
                            setDealerSearchValue("");
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", filterDealerId === dealer.value ? "opacity-100" : "opacity-0")} />
                            {dealer.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Amount */}
          <div>
            <Label htmlFor="amount">Payment Amount (₹) *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="e.g., 15000.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={submitting}>
              <SelectTrigger id="method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference Number */}
          <div className="col-span-3 md:col-span-1">
            <Label htmlFor="reference">Reference Number (Cheque/Txn ID)</Label>
            <Input
              id="reference"
              type="text"
              placeholder="Optional"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-green-600" />
          Order Allocation
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2 text-foreground">Loading outstanding orders...</p>
          </div>
        ) : outstandingOrders.length === 0 && filterDealerId ? (
          <p className="text-center text-muted-foreground py-4 border rounded-md">
            No outstanding orders found for this dealer. Any payment will be recorded as an advance.
          </p>
        ) : outstandingOrders.length > 0 && totalPayment > 0 ? (
          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-accent">
                <TableRow>
                  <TableHead>Order No.</TableHead>
                  <TableHead className="text-right">Total Amount (₹)</TableHead>
                  <TableHead className="text-right">Already Paid (₹)</TableHead>
                  <TableHead className="text-right">Current Balance (₹)</TableHead>
                  <TableHead className="text-center w-[150px]">Amount to Allocate (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.order_number}</TableCell>
                    <TableCell className="text-right">{order.total_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{order.paid_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">{order.balance.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={allocations[order.id] > 0 ? allocations[order.id].toFixed(2) : ''}
                        onChange={(e) => handleAllocationChange(order.id, e.target.value)}
                        min="0"
                        max={order.balance.toString()}
                        step="0.01"
                        className="text-right"
                        disabled={submitting || totalPayment <= 0}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            Select a dealer and enter the payment amount to view outstanding orders for allocation.
          </p>
        )}

        {/* Summary */}
        <div className="mt-4 p-4 border-t border-dashed flex justify-end">
          <div className="w-full max-w-md space-y-2">
            <div className="flex justify-between font-medium">
              <span>Total Payment:</span>
              <span>₹{totalPayment.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Total Allocated to Orders:</span>
              <span>₹{totalAllocated.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Advance / Unallocated Amount:</span>
              <span className={advanceAmount > 0 ? "text-blue-600" : "text-gray-500"}>
                ₹{advanceAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="mr-2 h-4 w-4" />
            )}
            {advanceAmount > 0 ? 'Record Payment & Advance' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentVoucherDialog;