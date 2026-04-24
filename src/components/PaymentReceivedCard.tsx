"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, CreditCard, Edit, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/format';

interface Dealer {
  id: string;
  name: string;
}

interface PaymentRecord {
  id: string;
  dealer_id: string;
  dealer_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  created_at: string;
}

const PaymentReceivedCard = () => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealerIds, setDealerIds] = useState<string[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('cash');
  const [salesPersonName, setSalesPersonName] = useState<string>('Unknown');

  // Form states
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [dealerSearch, setDealerSearch] = useState<string>('');
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState<boolean>(false);

  // Fetch associated dealers
  const fetchDealers = useCallback(async () => {
    if (!user) return;
    try {
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', user.id);

      if (dealerError) {
        throw dealerError;
      }

      const formattedDealers: Dealer[] = (dealerData || [])
        .map((item: any) => item.dealers)
        .filter(Boolean);
      setDealers(formattedDealers);
      setDealerIds(formattedDealers.map(d => d.id));
    } catch (error: any) {
      console.error('Error fetching dealers:', error);
      showError(`Failed to load dealers: ${error.message}`);
    }
  }, [user]);

  // Fetch payments added by this sales person
  const fetchPayments = useCallback(async () => {
    if (!user || dealerIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch payments from payment_received table with dealer info
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_received')
        .select('id, dealer_id, amount, payment_method, payment_date, status, created_at, dealers(name)')
        .in('dealer_id', dealerIds)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        throw paymentsError;
      }

      const formattedPayments: PaymentRecord[] = (paymentsData || []).map((p: any) => ({
        id: p.id,
        dealer_id: p.dealer_id,
        dealer_name: p.dealers?.name || 'Unknown Dealer',
        amount: p.amount,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        status: p.status || 'pending_approval',
        created_at: p.created_at,
      }));

      setPayments(formattedPayments);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      showError(`Failed to load payments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, dealerIds]);

  useEffect(() => {
    if (user) {
      fetchDealers();
      // Fetch the sales person's full name from their profile
      const fetchSalesPersonName = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          const name = [data?.first_name, data?.last_name]
            .filter(Boolean)
            .join(' ') || 'Unknown';
          setSalesPersonName(name);
        } catch (error: any) {
          console.error('Error fetching sales person name:', error);
          setSalesPersonName('Unknown');
        }
      };
      fetchSalesPersonName();
    }
  }, [user, fetchDealers]);

  useEffect(() => {
    if (dealerIds.length > 0) {
      fetchPayments();
    }
  }, [dealerIds, fetchPayments]);

  const handleSubmitPayment = async () => {
    if (!selectedDealerId || !amountPaid || !user) {
      showError('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('payment_received')
        .insert({
          dealer_id: selectedDealerId,
          amount: amount,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          status: 'pending_approval', // New payments start as pending_approval
          created_by: user.id,
          sales_person_name: salesPersonName,
          transaction_reference: transactionReference || null,
        });

      if (insertError) {
        throw insertError;
      }

      showSuccess('Payment submitted successfully! Waiting for approval.');
      setAmountPaid('');
      setSelectedDealerId('');
      setPaymentMethod('cash');
      setTransactionReference('');
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setPaymentDate(`${year}-${month}-${day}`);
      
      // Refresh the payments list
      fetchPayments();
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      showError(`Failed to submit payment: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPayment = (payment: PaymentRecord) => {
    setEditingId(payment.id);
    setEditAmount(payment.amount.toString());
    setEditMethod(payment.payment_method);
  };

  const handleSaveEdit = async (paymentId: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('payment_received')
        .update({
          amount: amount,
          payment_method: editMethod,
        })
        .eq('id', paymentId);

      if (updateError) {
        throw updateError;
      }

      showSuccess('Payment updated successfully!');
      setEditingId(null);
      fetchPayments();
    } catch (error: any) {
      console.error('Error updating payment:', error);
      showError(`Failed to update payment: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) {
      return;
    }

    setSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('payment_received')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        throw deleteError;
      }

      showSuccess('Payment deleted successfully!');
      fetchPayments();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      showError(`Failed to delete payment: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const filteredDealers = React.useMemo(() => {
    if (!dealerSearch) return dealers;
    const query = dealerSearch.toLowerCase();
    return dealers.filter((dealer) => dealer.name.toLowerCase().includes(query));
  }, [dealers, dealerSearch]);

  const selectedDealerName = dealers.find((dealer) => dealer.id === selectedDealerId)?.name || '';

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'Pending Approval by Account Dept';
      case 'completed':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Received
        </CardTitle>
        <CardDescription className="text-purple-100 dark:text-purple-200">
          Submit payments received from dealers (Status: Pending Approval by Account Dept)
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4">
        {/* Form Section */}
        <div className="mb-6 p-4 bg-muted rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Add New Payment</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="dealer">Select Dealer *</Label>
              <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={isDealerPopoverOpen} className="w-full justify-between" id="dealer">
                    {selectedDealerName || 'Select a dealer'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Search dealer..."
                      value={dealerSearch}
                      onChange={(e) => setDealerSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="h-[220px]">
                    <div className="p-1">
                      {filteredDealers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No dealers found.</div>
                      ) : (
                        filteredDealers.map((dealer) => (
                          <Button
                            key={dealer.id}
                            variant="ghost"
                            className="w-full justify-start font-normal"
                            onClick={() => {
                              setSelectedDealerId(dealer.id);
                              setIsDealerPopoverOpen(false);
                              setDealerSearch('');
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedDealerId === dealer.id ? 'opacity-100' : 'opacity-0'}`} />
                            {dealer.name}
                          </Button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="amount">Amount Paid *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Payment Date</Label>
              <Input
                id="date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="reference">Transaction Reference (Cheque/UPI ID/Ref No)</Label>
              <Input
                id="reference"
                placeholder="e.g., CHQ123456 or UPI-TXN-1234"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleSubmitPayment}
            disabled={submitting || !selectedDealerId || !amountPaid}
            className="w-full md:w-auto bg-purple-600 hover:bg-purple-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </>
            )}
          </Button>
        </div>

        {/* Payments List Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Payments Awaiting Account Approval</h3>
          <p className="text-sm text-muted-foreground mb-4">Payments submitted but not yet approved by accounts department</p>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-gray-700 dark:text-gray-300">Loading payments...</p>
            </div>
          ) : payments.filter(p => p.status === 'pending_approval').length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments pending approval.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md mb-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-yellow-50 dark:bg-yellow-950 hover:bg-yellow-50 dark:hover:bg-yellow-950">
                    <TableHead className="text-yellow-700 dark:text-yellow-300 font-semibold">Dealer</TableHead>
                    <TableHead className="text-yellow-700 dark:text-yellow-300 font-semibold">Amount</TableHead>
                    <TableHead className="text-yellow-700 dark:text-yellow-300 font-semibold">Method</TableHead>
                    <TableHead className="text-yellow-700 dark:text-yellow-300 font-semibold">Date</TableHead>
                    <TableHead className="text-yellow-700 dark:text-yellow-300 font-semibold">Status</TableHead>
                    <TableHead className="text-yellow-700 dark:text-yellow-300 font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.filter(p => p.status === 'pending_approval').map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                      <TableCell>
                        {editingId === payment.id ? (
                          <Input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            step="0.01"
                            min="0"
                            className="w-24"
                          />
                        ) : (
                          formatCurrency(payment.amount)
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === payment.id ? (
                          <Select value={editMethod} onValueChange={setEditMethod}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="capitalize">{payment.payment_method}</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(payment.status)}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {editingId === payment.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(payment.id)}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setEditingId(null)}
                                variant="outline"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleEditPayment(payment)}
                                variant="outline"
                                title="Edit Payment"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleDeletePayment(payment.id)}
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                title="Delete Payment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Approved Payments Section */}
          {payments.filter(p => p.status === 'completed').length > 0 && (
            <>
              <h3 className="text-lg font-semibold mb-4 mt-8">Approved Payments</h3>
              <p className="text-sm text-muted-foreground mb-4">Payments approved by accounts department</p>
              <div className="overflow-x-auto border rounded-md mb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50 dark:bg-green-950 hover:bg-green-50 dark:hover:bg-green-950">
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Dealer</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Amount</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Method</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Date</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.filter(p => p.status === 'completed').map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="capitalize">{payment.payment_method}</TableCell>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(payment.status)}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Rejected Payments Section */}
          {payments.filter(p => p.status === 'rejected').length > 0 && (
            <>
              <h3 className="text-lg font-semibold mb-4 mt-8">Rejected Payments</h3>
              <p className="text-sm text-muted-foreground mb-4">Payments rejected by accounts department</p>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50 dark:bg-red-950 hover:bg-red-50 dark:hover:bg-red-950">
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Dealer</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Amount</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Method</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Date</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.filter(p => p.status === 'rejected').map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="capitalize">{payment.payment_method}</TableCell>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(payment.status)}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentReceivedCard;
