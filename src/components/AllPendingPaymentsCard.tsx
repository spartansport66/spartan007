"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye, Calendar, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';

interface PendingPaymentItem {
  type: 'order_due_today' | 'payment_pending_approval'; // Simplified type
  id: string; // Order ID for 'order_due_today', Payment ID for others
  order_id: string; // Always the order ID
  order_number: number;
  dealer_name: string;
  dealer_phone: string;
  amount: number; // total_amount for order, amount for payment
  payment_status: 'pending' | 'paid' | 'pending_approval'; // Actual status
  payment_due_date: string | null; // From order
  payment_method: string | null; // From payment record if exists
  payment_date: string | null; // From payment record if exists (when payment was made/submitted)
  cheque_dd_date: string | null; // From payment record if exists
  approved_at: string | null; // From payment record if exists (when payment was approved)
  dealer_id: string; // For actions
}

interface AllPendingPaymentsCardProps {
  onPaymentAction: () => void; // Callback to refresh parent data
}

const APPROVE_PAYMENT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/approve-payment";

const AllPendingPaymentsCard: React.FC<AllPendingPaymentsCardProps> = ({ onPaymentAction }) => {
  const [paymentsPendingApproval, setPaymentsPendingApproval] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Dialog states
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null); // This is the payment_id from the payments table

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company info for WhatsApp message:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchPaymentsPendingApproval = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all payments with status = 'pending_approval'
      const { data: paymentsPendingApproval, error: paymentsPendingApprovalError } = await supabase
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
            dealers (name, phone)
          )
        `)
        .eq('status', 'pending_approval')
        .order('payment_date', { ascending: true }); // Order by payment_date for consistency

      if (paymentsPendingApprovalError) throw paymentsPendingApprovalError;

      const formattedPayments: PendingPaymentItem[] = (paymentsPendingApproval || [])
        .map((payment: any) => ({
          type: 'payment_pending_approval',
          id: payment.id, // Payment ID
          order_id: payment.order_id,
          order_number: payment.orders?.order_number || 'N/A',
          dealer_name: payment.orders?.dealers?.name || 'N/A',
          dealer_phone: payment.orders?.dealers?.phone || '',
          amount: payment.amount,
          payment_status: payment.status, // 'pending_approval'
          payment_due_date: payment.orders?.payment_due_date || null,
          payment_method: payment.payment_method,
          payment_date: payment.payment_date,
          cheque_dd_date: payment.cheque_dd_date,
          approved_at: null,
          dealer_id: payment.orders?.dealer_id || '',
        }));

      setPaymentsPendingApproval(formattedPayments);
    } catch (error: any) {
      console.error('Error fetching pending approval payments:', error.message);
      showError('Failed to load pending approval payments.');
      setPaymentsPendingApproval([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanyInfo();
    fetchPaymentsPendingApproval();
    
    // Subscribe to changes in the payments table
    const paymentsChannel = supabase
      .channel('payments_approval_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'payments',
        },
        (payload) => {
          console.log('Payment change received!', payload);
          fetchPaymentsPendingApproval(); // Refetch on any payment change
          onPaymentAction(); // Notify parent
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(paymentsChannel);
    };
  }, [fetchCompanyInfo, fetchPaymentsPendingApproval, onPaymentAction]);

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status !== 'pending') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getStatusColor = (status: string, dueDate: string | null, chequeDdDate: string | null) => {
    if (status === 'paid') return 'text-green-600 bg-green-100';
    if (status === 'pending_approval') {
      const isDue = isPaymentDueForApproval(chequeDdDate, dueDate);
      return isDue ? 'text-blue-600 bg-blue-100' : 'text-orange-600 bg-orange-100';
    }
    if (isOverdue(dueDate, status)) return 'text-red-600 bg-red-100';
    if (status === 'pending') return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string, dueDate: string | null, chequeDdDate: string | null) => {
    if (status === 'paid') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'pending_approval') {
      const isDue = isPaymentDueForApproval(chequeDdDate, dueDate);
      return isDue ? <Clock className="h-4 w-4 text-blue-600" /> : <Calendar className="h-4 w-4 text-orange-600" />;
    }
    if (isOverdue(dueDate, status)) return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-600" />;
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  const isPaymentDueForApproval = (chequeDdDate: string | null, orderDueDate: string | null) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let effectiveDueDate: Date | null = null;

    if (chequeDdDate) {
      effectiveDueDate = new Date(chequeDdDate);
    } else if (orderDueDate) {
      effectiveDueDate = new Date(orderDueDate);
    }

    if (!effectiveDueDate) return true; // If no due date, assume it's due (or can be approved)
    effectiveDueDate.setHours(0, 0, 0, 0);
    return effectiveDueDate <= today;
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
      fetchPaymentsPendingApproval(); // Refresh the list
      onPaymentAction(); // Notify parent to refresh dashboard data
    } catch (error: any) {
      console.error(`Error ${action}ing payment:`, error);
      showError(`Failed to ${action} payment: ${error.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    setSelectedPaymentIdForDetails(paymentId);
    setIsPaymentDetailsDialogOpen(true);
  };

  const sortedPayments = paymentsPendingApproval.sort((a, b) => {
    // Sort by effective due date, prioritizing earlier dates
    const dateA = a.cheque_dd_date ? new Date(a.cheque_dd_date).getTime() : (a.payment_due_date ? new Date(a.payment_due_date).getTime() : 0);
    const dateB = b.cheque_dd_date ? new Date(b.cheque_dd_date).getTime() : (b.payment_due_date ? new Date(b.payment_due_date).getTime() : 0);
    return dateA - dateB;
  });

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Payments Pending Approval</CardTitle>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          Payments submitted by sales persons awaiting final approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading pending payments...</p>
            </div>
          ) : sortedPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments currently pending approval.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Method</TableHead>
                    <TableHead className="text-muted-foreground">Submitted Date</TableHead>
                    <TableHead className="text-muted-foreground">Due/Cheque Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPayments.map((payment) => {
                    const displayStatus = payment.payment_status ?? 'unknown';
                    const isDueForApproval = isPaymentDueForApproval(payment.cheque_dd_date, payment.payment_due_date);
                    const effectiveDueDate = payment.cheque_dd_date || payment.payment_due_date;

                    return (
                      <TableRow
                        key={`${payment.type}-${payment.id}`}
                        className={!isDueForApproval ? "bg-orange-50/50 hover:bg-orange-100/50" : "hover:bg-accent/50"}
                      >
                        <TableCell className="font-medium text-foreground">#{payment.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.payment_method}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(payment.payment_date)}</TableCell>
                        <TableCell className={!isDueForApproval ? "text-orange-600 font-semibold" : "text-muted-foreground"}>
                          {formatDate(effectiveDueDate)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewPaymentDetails(payment.id)} // Pass payment_id
                              title="View Payment Details"
                            >
                              <Eye className="h-4 w-4 text-blue-500" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={isDueForApproval ? "Approve Payment" : "Payment not yet due"}
                                  disabled={isSubmittingAction || !isDueForApproval}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {!isDueForApproval ? (
                                      <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded">
                                        <p className="font-medium">Post-dated/Upcoming Payment</p>
                                        <p>This payment is scheduled for {formatDate(effectiveDueDate)}. It can only be approved on or after that date.</p>
                                      </div>
                                    ) : null}
                                    Are you sure you want to approve the payment of ₹{payment.amount.toFixed(2)} for Order #{payment.order_number} from {payment.dealer_name}? This will mark the order as paid and update the dealer's credit.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'approve')} disabled={isSubmittingAction || !isDueForApproval}>
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
                                  <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'reject')} disabled={isSubmittingAction}>
                                    {isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reject'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
    </Card>
  );
};

export default AllPendingPaymentsCard;