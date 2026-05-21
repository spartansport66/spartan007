"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSession } from '@/contexts/SessionContext';

interface PendingPayment {
  id: string;
  dealer_id: string;
  dealer_name?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_reference?: string;
  created_at: string;
  created_by_name?: string;
}

const PendingPaymentsReport = () => {
  const { user } = useSession();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payment_received')
        .select(
          `
          id,
          dealer_id,
          amount,
          payment_date,
          payment_method,
          transaction_reference,
          created_at,
          created_by,
          sales_person_name,
          dealers!inner(name)
        `
        )
        .eq('status', 'pending_approval');

      // Apply date filters if provided
      if (fromDate) {
        query = query.gte('created_at', new Date(fromDate).toISOString());
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((payment: any) => ({
        id: payment.id,
        dealer_id: payment.dealer_id,
        dealer_name: payment.dealers?.name || 'Unknown Dealer',
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        transaction_reference: payment.transaction_reference,
        created_at: payment.created_at,
        created_by_name: payment.sales_person_name || 'System',
      }));

      setPayments(formattedData);
    } catch (error: any) {
      showError(`Failed to load pending payments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, [fromDate, toDate]);

  const handleApproveClick = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setApprovalRemarks('');
    setIsApproveDialogOpen(true);
  };

  const handleApprovePayment = async () => {
    if (!selectedPayment || !user) return;

    setApprovingId(selectedPayment.id);
    try {
      const { error } = await supabase
        .from('payment_received')
        .update({
          status: 'completed',
        })
        .eq('id', selectedPayment.id);

      if (error) throw error;

      showSuccess(`Payment of ${formatCurrency(selectedPayment.amount)} approved successfully!`);
      setIsApproveDialogOpen(false);
      setSelectedPayment(null);
      fetchPendingPayments();
    } catch (error: any) {
      showError(`Failed to approve payment: ${error.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectPayment = async (paymentId: string, payment: PendingPayment) => {
    if (!user) return;

    setRejectingId(paymentId);
    try {
      const { error } = await supabase
        .from('payment_received')
        .update({
          status: 'rejected',
        })
        .eq('id', paymentId);

      if (error) throw error;

      showSuccess(`Payment rejected successfully!`);
      fetchPendingPayments();
    } catch (error: any) {
      showError(`Failed to reject payment: ${error.message}`);
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-gray-600 dark:text-gray-400">Loading pending payments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Pending Payments for Approval
              </CardTitle>
              <CardDescription>Review and approve pending dealer payments</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>

        {/* Filters */}
        {showFilters && (
          <CardContent className="border-t pt-4 pb-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from-date">From Date</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="to-date">To Date</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        )}

        <CardContent className={showFilters ? 'border-t pt-4' : ''}>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No pending payments for approval
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96 border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <TableRow>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Entry Date</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 5).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                      <TableCell className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-sm">{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-semibold">
                          Pending
                        </span>
                      </TableCell>
                      <TableCell className="space-x-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setIsDetailsDialogOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {payments.length > 5 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
              Showing 5 of {payments.length} pending payments. Scroll to see more.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Dealer</p>
                  <p className="font-semibold text-lg">{selectedPayment.dealer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-lg text-green-600">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Payment Date</p>
                  <p className="font-semibold">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Payment Method</p>
                  <p className="font-semibold capitalize">{selectedPayment.payment_method}</p>
                </div>
              </div>
              {selectedPayment.transaction_reference && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transaction Reference</p>
                  <p className="font-semibold">{selectedPayment.transaction_reference}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Added By</p>
                <p className="font-semibold">{selectedPayment.created_by_name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payment</DialogTitle>
            <DialogDescription>
              Approve {selectedPayment?.amount && formatCurrency(selectedPayment.amount)} payment from {selectedPayment?.dealer_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Approval Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any remarks for this approval..."
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                className="mt-2 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApprovePayment}
                disabled={approvingId !== null}
                className="bg-green-600 hover:bg-green-700"
              >
                {approvingId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve Payment'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingPaymentsReport;
