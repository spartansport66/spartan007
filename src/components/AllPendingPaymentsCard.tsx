"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye, Calendar, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog'; // Import UpdatePaymentDialog

interface PendingPaymentItem {
  type: 'order_pending' | 'payment_pending_approval';
  id: string; // Order ID for 'order_pending', Payment ID for 'payment_pending_approval'
  order_id: string; // Always the order ID
  order_number: number;
  dealer_name: string;
  amount: number; // total_amount for order, amount for payment
  payment_status: string; // 'pending' or 'pending_approval'
  payment_due_date: string | null; // From order
  payment_method: string | null; // From payment record if exists
  payment_date: string | null; // From payment record if exists
  cheque_dd_date: string | null; // From payment record if exists
  dealer_id: string; // For actions
}

interface AllPendingPaymentsCardProps {
  onPaymentAction: () => void; // Callback to refresh parent data
}

const APPROVE_PAYMENT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/approve-payment";

const AllPendingPaymentsCard: React.FC<AllPendingPaymentsCardProps> = ({ onPaymentAction }) => {
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Dialog states
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null); // This is the payment_id from the payments table

  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PendingPaymentItem | null>(null); // This is the order_id for 'order_pending'

  const fetchAllPendingPayments = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch orders with payment_status = 'pending'
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          payment_due_date,
          dealer_id,
          dealers (name)
        `)
        .eq('payment_status', 'pending')
        .order('payment_due_date', { ascending: true });

      if (ordersError) throw ordersError;

      const formattedOrders: PendingPaymentItem[] = (ordersData || []).map((order: any) => ({
        type: 'order_pending',
        id: order.id, // Order ID
        order_id: order.id,
        order_number: order.order_number,
        dealer_name: order.dealers?.name || 'N/A',
        amount: order.total_amount,
        payment_status: 'pending',
        payment_due_date: order.payment_due_date,
        payment_method: null,
        payment_date: null,
        cheque_dd_date: null,
        dealer_id: order.dealer_id,
      }));

      // 2. Fetch payments with status = 'pending_approval'
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          amount,
          payment_method,
          payment_date,
          cheque_dd_date,
          status,
          orders (
            order_number,
            payment_status,
            payment_due_date,
            dealer_id,
            dealers (name)
          )
        `)
        .eq('status', 'pending_approval')
        .order('payment_date', { ascending: true });

      if (paymentsError) throw paymentsError;

      const formattedPayments: PendingPaymentItem[] = (paymentsData || []).map((payment: any) => ({
        type: 'payment_pending_approval',
        id: payment.id, // Payment ID
        order_id: payment.order_id,
        order_number: payment.orders?.order_number || 'N/A',
        dealer_name: payment.orders?.dealers?.name || 'N/A',
        amount: payment.amount,
        payment_status: payment.status, // 'pending_approval'
        payment_due_date: payment.orders?.payment_due_date || null,
        payment_method: payment.payment_method,
        payment_date: payment.payment_date,
        cheque_dd_date: payment.cheque_dd_date,
        dealer_id: payment.orders?.dealer_id || '',
      }));

      // Combine and sort
      const combinedPayments = [...formattedOrders, ...formattedPayments].sort((a, b) => {
        const dateA = a.payment_due_date ? new Date(a.payment_due_date).getTime() : Infinity;
        const dateB = b.payment_due_date ? new Date(b.payment_due_date).getTime() : Infinity;
        return dateA - dateB;
      });

      setPendingPayments(combinedPayments);
    } catch (error: any) {
      console.error('Error fetching all pending payments:', error.message);
      showError('Failed to load all pending payments.');
      setPendingPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (true) { // Always fetch when component mounts or on refresh
      fetchAllPendingPayments();
    }
  }, [fetchAllPendingPayments]);

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status !== 'pending') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getStatusColor = (status: string, dueDate: string | null) => {
    if (status === 'pending_approval') return 'text-blue-600 bg-blue-100';
    if (isOverdue(dueDate, status)) return 'text-red-600 bg-red-100';
    if (status === 'pending') return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string, dueDate: string | null) => {
    if (status === 'pending_approval') return <Clock className="h-4 w-4 text-blue-600" />;
    if (isOverdue(dueDate, status)) return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-600" />;
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  const handleApproveRejectPayment = async (payment: PendingPaymentItem, action: 'approve' | 'reject') => {
    if (payment.type !== 'payment_pending_approval' || !payment.id) {
      showError('Invalid action for this payment type.');
      return;
    }
    setIsSubmittingAction(true);
    try {
      const response = await fetch(APPROVE_PAYMENT_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: payment.id, // This is the payment record ID
          orderId: payment.order_id, // This is the order ID
          dealerId: payment.dealer_id,
          amount: payment.amount,
          action: action,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} payment`);
      }
      showSuccess(`Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      fetchAllPendingPayments(); // Refresh the list
      onPaymentAction(); // Notify parent to refresh dashboard data
    } catch (error: any) {
      console.error(`Error ${action}ing payment:`, error);
      showError(`Failed to ${action} payment: ${error.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddPaymentDetails = (order: PendingPaymentItem) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    setSelectedPaymentIdForDetails(paymentId);
    setIsPaymentDetailsDialogOpen(true);
  };

  const handlePaymentUpdated = () => {
    fetchAllPendingPayments(); // Refresh the list after a payment is updated
    onPaymentAction(); // Notify parent to refresh dashboard data
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">All Pending Payments</CardTitle>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          Overview of all orders with pending or pending approval payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payments...</p>
            </div>
          ) : pendingPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending payments found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Due Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPayments.map((payment) => {
                    const isDue = payment.cheque_dd_date ? (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dueDate = new Date(payment.cheque_dd_date);
                      dueDate.setHours(0, 0, 0, 0);
                      return dueDate <= today;
                    })() : true; // Non post-dated payments are always due

                    const isPostDated = payment.payment_method === 'Cheque/DD' && payment.cheque_dd_date;

                    return (
                      <TableRow
                        key={`${payment.type}-${payment.id}`}
                        className={isOverdue(payment.payment_due_date, payment.payment_status) ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}
                      >
                        <TableCell className="font-medium text-foreground">#{payment.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(payment.payment_status, payment.payment_due_date)}`}>
                            {getStatusIcon(payment.payment_status, payment.payment_due_date)}
                            <span className="capitalize">{payment.payment_status.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className={isOverdue(payment.payment_due_date, payment.payment_status) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                          {payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {payment.type === 'order_pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAddPaymentDetails(payment)}
                                title="Add Payment Details"
                              >
                                <DollarSign className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {payment.type === 'payment_pending_approval' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewPaymentDetails(payment.id)}
                                  title="View Payment Details"
                                >
                                  <Eye className="h-4 w-4 text-blue-500" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title={isDue ? "Approve Payment" : "Payment not yet due"}
                                      disabled={isSubmittingAction || !isDue}
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {isPostDated && !isDue ? (
                                          <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded">
                                            <p className="font-medium">Post-dated Payment</p>
                                            <p>This payment is scheduled for {new Date(payment.cheque_dd_date!).toLocaleDateString()}.</p>
                                            <p>It can only be approved on or after that date.</p>
                                          </div>
                                        ) : null}
                                        Are you sure you want to approve the payment of ₹{payment.amount.toFixed(2)} for Order #{payment.order_number} from {payment.dealer_name}? This will mark the order as paid and update the dealer's credit.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleApproveRejectPayment(payment, 'approve')}
                                        disabled={isSubmittingAction || !isDue}
                                      >
                                        {isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Approve'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Reject Payment" disabled={isSubmittingAction}>
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reject Payment?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to reject the payment of ₹{payment.amount.toFixed(2)} for Order #{payment.order_number} from {payment.dealer_name}? This will revert the order to pending status.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleApproveRejectPayment(payment, 'reject')}
                                        disabled={isSubmittingAction}
                                      >
                                        {isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reject'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {selectedPaymentIdForDetails && (
        <PaymentDetailsDialog
          paymentId={selectedPaymentIdForDetails}
          isOpen={isPaymentDetailsDialogOpen}
          onOpenChange={setIsPaymentDetailsDialogOpen}
        />
      )}

      {selectedOrderForPaymentUpdate && (
        <UpdatePaymentDialog
          orderToUpdate={{
            id: selectedOrderForPaymentUpdate.order_id,
            order_number: selectedOrderForPaymentUpdate.order_number,
            total_amount: selectedOrderForPaymentUpdate.amount,
            dealer_name: selectedOrderForPaymentUpdate.dealer_name,
            payment_due_date: selectedOrderForPaymentUpdate.payment_due_date,
          }}
          isOpen={isUpdatePaymentDialogOpen}
          onOpenChange={setIsUpdatePaymentDialogOpen}
          onPaymentUpdated={handlePaymentUpdated}
        />
      )}
    </Card>
  );
};

export default AllPendingPaymentsCard;