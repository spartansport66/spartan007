"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye, Clock, AlertCircle, MessageCircle, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import { getStartOfUTCDayISO } from '@/utils/date';
import { approveRejectPayment } from '@/utils/supabase-actions';

interface PendingPaymentItem {
  type: 'payment_pending_approval';
  id: string; // Payment ID
  order_id: string | null; // Actual Order ID (null for general payment)
  order_number: number;
  dealer_name: string;
  dealer_phone: string;
  amount: number; // amount for payment
  payment_status: 'pending_approval'; // Actual status
  payment_due_date: string | null; // From order
  payment_method: string | null; // From payment record
  payment_date: string | null; // From payment record (when payment was submitted)
  cheque_dd_date: string | null; // From payment record
  dealer_id: string; // For actions
}

interface PaymentsPendingApprovalCardProps {
  onPaymentAction: () => void; // Callback to refresh parent data
}

const PaymentsPendingApprovalCard: React.FC<PaymentsPendingApprovalCardProps> = ({ onPaymentAction }) => {
  const [payments, setPayments] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  // Dialog states
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company info:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchPendingApprovalPayments = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch payments with status = 'pending_approval'
      let paymentsPendingQuery = supabase
        .from('payments')
        .select(`id, order_id, dealer_id, amount, payment_method, payment_date, cheque_dd_date, status, orders (order_number, payment_status, payment_due_date, dealer_id, dealers (name, phone)), dealers (name, phone)`)
        .eq('status', 'pending_approval')
        .order('payment_date', { ascending: true });
      
      const { data: paymentsPending, error: paymentsPendingError } = await paymentsPendingQuery;
      if (paymentsPendingError) throw paymentsPendingError;

      const formattedPaymentsPending: PendingPaymentItem[] = (paymentsPending || []).map((payment: any) => {
        const isGeneralPayment = !payment.order_id;
        const dealerName = isGeneralPayment ? payment.dealers?.name : payment.orders?.dealers?.name;
        const dealerPhone = isGeneralPayment ? payment.dealers?.phone : payment.orders?.dealers?.phone;
        const orderNumber = isGeneralPayment ? 0 : payment.orders?.order_number;
        const paymentDueDate = isGeneralPayment ? null : payment.orders?.payment_due_date;

        return {
          type: 'payment_pending_approval',
          id: payment.id,
          order_id: payment.order_id,
          order_number: orderNumber || 0,
          dealer_name: dealerName || 'N/A',
          dealer_phone: dealerPhone || '',
          amount: payment.amount,
          payment_status: payment.status,
          payment_due_date: paymentDueDate || null,
          payment_method: payment.payment_method,
          payment_date: payment.payment_date,
          cheque_dd_date: payment.cheque_dd_date,
          dealer_id: payment.dealer_id,
        };
      });

      setPayments(formattedPaymentsPending);
    } catch (error: any) {
      console.error('Error fetching pending approval payments:', error.message);
      showError('Failed to load payments pending approval.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanyInfo();
    fetchPendingApprovalPayments();
  }, [fetchCompanyInfo, fetchPendingApprovalPayments]);

  const isPaymentDueForApproval = (payment: PendingPaymentItem) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let effectiveDueDate: Date | null = null;
    
    // Use cheque/DD date if available, otherwise use payment submission date
    if (payment.cheque_dd_date) {
      effectiveDueDate = new Date(payment.cheque_dd_date);
    } else if (payment.payment_date) {
      effectiveDueDate = new Date(payment.payment_date);
    }
    
    if (!effectiveDueDate) return true; // If no date is recorded, assume it's due now
    effectiveDueDate.setHours(0, 0, 0, 0);
    return effectiveDueDate <= today;
  };

  const handleApproveRejectPayment = async (payment: PendingPaymentItem, action: 'approve' | 'reject') => {
    if (!payment.id) { showError('Payment ID is missing.'); return; }
    setIsSubmittingAction(true);
    const success = await approveRejectPayment({
      paymentId: payment.id,
      orderId: payment.order_id,
      dealerId: payment.dealer_id,
      action: action,
    });
    if (success) {
      fetchPendingApprovalPayments();
      onPaymentAction();
    }
    setIsSubmittingAction(false);
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    setSelectedPaymentIdForDetails(paymentId);
    setIsPaymentDetailsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    if (status === 'pending_approval') return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'pending_approval') return <Clock className="h-4 w-4 text-blue-600" />;
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Payments Pending Approval</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Payments submitted by sales persons awaiting final clearance.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
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
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const paymentIsDue = isPaymentDueForApproval(payment);
                    const displayDate = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A';
                    return (
                      <TableRow key={payment.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{payment.order_number === 0 ? 'General Balance' : `#${payment.order_number}`}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.payment_method || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">{displayDate}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleViewPaymentDetails(payment.id)} title="View Payment Details"><Eye className="h-4 w-4 text-blue-500" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title={paymentIsDue ? "Approve Payment" : "Payment not yet due"} disabled={isSubmittingAction || !paymentIsDue}><CheckCircle className="h-4 w-4 text-green-600" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {!paymentIsDue && payment.cheque_dd_date ? (<div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded"><p className="font-medium">Post-dated Payment</p><p>This payment is scheduled for {new Date(payment.cheque_dd_date).toLocaleDateString()}.</p><p>It can only be approved on or after that date.</p></div>) : null}
                                    Are you sure you want to approve the payment of ₹{payment.amount.toFixed(2)} for {payment.order_number === 0 ? 'General Balance' : `Order #${payment.order_number}`} from {payment.dealer_name}? This will mark the payment as completed and update the dealer's ledger.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'approve')} disabled={isSubmittingAction || !paymentIsDue}>{isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Approve'}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Reject Payment" disabled={isSubmittingAction}><XCircle className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject Payment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to reject the payment of ₹{payment.amount.toFixed(2)} for {payment.order_number === 0 ? 'General Balance' : `Order #${payment.order_number}`} from {payment.dealer_name}? This will delete the payment record and {payment.order_number === 0 ? 'require re-entry' : 'revert the order to pending status'}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'reject')} disabled={isSubmittingAction}>{isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reject'}</AlertDialogAction>
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
      {selectedPaymentIdForDetails && (<PaymentDetailsDialog paymentId={selectedPaymentIdForDetails} isOpen={isPaymentDetailsDialogOpen} onOpenChange={setIsPaymentDetailsDialogOpen} />)}
    </Card>
  );
};

export default PaymentsPendingApprovalCard;