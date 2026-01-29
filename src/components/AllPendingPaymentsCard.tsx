"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye, Calendar, DollarSign, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog'; // Import UpdatePaymentDialog
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';

interface PendingPaymentItem {
  type: 'order_due_today' | 'payment_pending_approval_today';
  id: string; // Order ID for 'order_due_today', Payment ID for others
  order_id: string | null; // Actual Order ID (null for general payment)
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
  const [paymentsToday, setPaymentsToday] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Dialog states
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null); // This is the payment_id from the payments table

  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PendingPaymentItem | null>(null); // This is the order_id for 'order_pending'

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
      showError('Failed to load company information for WhatsApp message.');
      setCompanyName(null);
    }
  }, []);

  const fetchTodayPaymentActivities = useCallback(async () => {
    setLoading(true);
    try {
      const startOfUTCToday = getStartOfUTCDayISO();
      const endOfUTCToday = getEndOfUTCDayISO();

      // 1. Fetch orders with payment_status = 'pending' and payment_due_date is today or earlier
      const { data: ordersDueToday, error: ordersDueTodayError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          payment_due_date,
          dealer_id,
          dealers (name, phone)
        `)
        .eq('payment_status', 'pending')
        .lte('payment_due_date', endOfUTCToday) // Due today or earlier
        .order('payment_due_date', { ascending: true });

      if (ordersDueTodayError) throw ordersDueTodayError;

      const formattedOrdersDueToday: PendingPaymentItem[] = (ordersDueToday || []).map((order: any) => ({
        type: 'order_due_today',
        id: order.id, // Order ID
        order_id: order.id,
        order_number: order.order_number,
        dealer_name: order.dealers?.name || 'N/A',
        dealer_phone: order.dealers?.phone || '',
        amount: order.total_amount,
        payment_status: 'pending',
        payment_due_date: order.payment_due_date,
        payment_method: null,
        payment_date: null,
        cheque_dd_date: null,
        approved_at: null,
        dealer_id: order.dealer_id,
      }));

      // 2. Fetch payments with status = 'pending_approval'
      const { data: paymentsPendingApproval, error: paymentsPendingApprovalError } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          dealer_id,
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
          ),
          dealers (name, phone)
        `)
        .eq('status', 'pending_approval')
        .order('payment_date', { ascending: true }); // Order by payment_date for consistency

      if (paymentsPendingApprovalError) throw paymentsPendingApprovalError;

      const formattedPaymentsPendingApprovalToday: PendingPaymentItem[] = (paymentsPendingApproval || [])
        .filter((payment: any) => {
          let effectiveDueDate: Date | null = null;
          
          // Determine effective due date based on whether it's an order payment or general payment
          if (payment.order_id) {
            // Order Payment
            if (payment.payment_method === 'Cheque/DD' && payment.cheque_dd_date) {
              effectiveDueDate = new Date(payment.cheque_dd_date);
            } else if (payment.orders?.payment_due_date) {
              effectiveDueDate = new Date(payment.orders.payment_due_date);
            }
          } else if (payment.dealer_id) {
            // General Payment (against opening balance)
            // For general payments, we treat the payment_date as the due date for approval
            effectiveDueDate = new Date(payment.payment_date);
          }

          if (!effectiveDueDate) return false;
          effectiveDueDate.setUTCHours(0, 0, 0, 0);

          // Show if effective due date is today or earlier
          return effectiveDueDate <= new Date(endOfUTCToday);
        })
        .map((payment: any) => {
          const isGeneralPayment = !payment.order_id;
          const dealerName = isGeneralPayment ? payment.dealers?.name : payment.orders?.dealers?.name;
          const dealerPhone = isGeneralPayment ? payment.dealers?.phone : payment.orders?.dealers?.phone;
          const orderNumber = isGeneralPayment ? 0 : payment.orders?.order_number;
          const paymentDueDate = isGeneralPayment ? null : payment.orders?.payment_due_date;

          return {
            type: 'payment_pending_approval_today',
            id: payment.id, // Payment ID
            order_id: payment.order_id, // Actual Order ID (can be null)
            order_number: orderNumber || 0,
            dealer_name: dealerName || 'N/A',
            dealer_phone: dealerPhone || '',
            amount: payment.amount,
            payment_status: payment.status, // 'pending_approval'
            payment_due_date: paymentDueDate || null,
            payment_method: payment.payment_method,
            payment_date: payment.payment_date,
            cheque_dd_date: payment.cheque_dd_date,
            approved_at: null,
            dealer_id: payment.dealer_id,
          };
        });

      // Combine only orders due today and pending approval payments due today/earlier
      const combinedPayments = [
        ...formattedOrdersDueToday,
        ...formattedPaymentsPendingApprovalToday,
      ].sort((a, b) => {
        // Sort by effective due date, prioritizing earlier dates
        const dateA = a.cheque_dd_date ? new Date(a.cheque_dd_date).getTime() : (a.payment_due_date ? new Date(a.payment_due_date).getTime() : 0);
        const dateB = b.cheque_dd_date ? new Date(b.cheque_dd_date).getTime() : (b.payment_due_date ? new Date(b.payment_due_date).getTime() : 0);
        return dateA - dateB;
      });

      setPaymentsToday(combinedPayments);
    } catch (error: any) {
      console.error('Error fetching today payment activities:', error.message);
      showError('Failed to load today\'s payment activities.');
      setPaymentsToday([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanyInfo();
    fetchTodayPaymentActivities();
    
    // Subscribe to changes in the orders and payments tables
    const ordersChannel = supabase
      .channel('orders_payment_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('Order change received!', payload);
          fetchTodayPaymentActivities(); // Refetch on any order change
          onPaymentAction(); // Notify parent
        }
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel('payments_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'payments',
        },
        (payload) => {
          console.log('Payment change received!', payload);
          fetchTodayPaymentActivities(); // Refetch on any payment change
          onPaymentAction(); // Notify parent
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [fetchCompanyInfo, fetchTodayPaymentActivities, onPaymentAction]);

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status !== 'pending') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getStatusColor = (status: string, dueDate: string | null) => {
    if (status === 'paid') return 'text-green-600 bg-green-100';
    if (status === 'pending_approval') return 'text-blue-600 bg-blue-100';
    if (isOverdue(dueDate, status)) return 'text-red-600 bg-red-100';
    if (status === 'pending') return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string, dueDate: string | null) => {
    if (status === 'paid') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'pending_approval') return <Clock className="h-4 w-4 text-blue-600" />;
    if (isOverdue(dueDate, status)) return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-600" />;
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  const isPaymentDueForApproval = (payment: PendingPaymentItem) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let effectiveDueDate: Date | null = null;

    if (payment.payment_method === 'Cheque/DD' && payment.cheque_dd_date) {
      effectiveDueDate = new Date(payment.cheque_dd_date);
    } else if (payment.payment_due_date) {
      effectiveDueDate = new Date(payment.payment_due_date);
    } else if (payment.type === 'payment_pending_approval_today' && payment.payment_date) {
      // For general payments, use the payment date as the due date for approval
      effectiveDueDate = new Date(payment.payment_date);
    }

    if (!effectiveDueDate) return true; // Should not happen for pending approval payments
    effectiveDueDate.setHours(0, 0, 0, 0);
    return effectiveDueDate <= today;
  };

  const handleApproveRejectPayment = async (payment: PendingPaymentItem, action: 'approve' | 'reject') => {
    if (payment.type !== 'payment_pending_approval_today' || !payment.id) {
      showError('Invalid action for this payment type.');
      return;
    }
    setIsSubmittingAction(true);
    try {
      const payload = {
        paymentId: payment.id, // This is the payment record ID
        orderId: payment.order_id, // Actual order ID (can be null for general payment)
        dealerId: payment.dealer_id,
        amount: Number(payment.amount), // Ensure amount is explicitly a number
        action: action,
      };
      
      console.log(`[AllPendingPaymentsCard] Sending payload for ${action}:`, payload);

      const response = await fetch(APPROVE_PAYMENT_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} payment`);
      }
      showSuccess(`Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      fetchTodayPaymentActivities(); // Refresh the list
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
    fetchTodayPaymentActivities(); // Refresh the list after a payment is updated
    onPaymentAction(); // Notify parent to refresh dashboard data
  };

  const handleSendWhatsApp = (dealerPhone: string, dealerName: string, orderNumber: number, amountDue: number, dueDate: string | null) => {
    if (!dealerPhone) {
      showError('Dealer phone number is not available.');
      return;
    }
    if (!companyName) {
      showError('Company name is required to send WhatsApp messages. Please contact an administrator.');
      return;
    }
    const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';
    const message = `Hello ${dealerName},\n\nThis is a reminder from *${companyName}* that payment for Order No. *${orderNumber}* of *₹${amountDue.toFixed(2)}* is due on ${formattedDueDate}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    // Open WhatsApp Web in a new tab
    window.open(`https://web.whatsapp.com/send?phone=${dealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp message drafted. Please check the new tab.');
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Today's Due Payments</CardTitle>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          Orders due today or earlier, and payments pending approval with due dates today or earlier.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading today's payments...</p>
            </div>
          ) : paymentsToday.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments due today or earlier.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Due/Payment Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsToday.map((payment) => {
                    const displayStatus = payment.payment_status ?? 'unknown';
                    const paymentIsDueForApproval = isPaymentDueForApproval(payment);

                    const displayDate = payment.cheque_dd_date ? new Date(payment.cheque_dd_date).toLocaleDateString() :
                                      payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() :
                                      payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'N/A';

                    return (
                      <TableRow
                        key={`${payment.type}-${payment.id}`}
                        className={isOverdue(payment.payment_due_date, payment.payment_status) ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}
                      >
                        <TableCell className="font-medium text-foreground">
                          {payment.order_number === 0 ? 'General Balance' : `#${payment.order_number}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(displayStatus, payment.payment_due_date)}`}>
                            {getStatusIcon(displayStatus, payment.payment_due_date)}
                            <span className="capitalize">{(displayStatus).replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className={isOverdue(payment.payment_due_date, payment.payment_status) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                          {displayDate}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {payment.type === 'order_due_today' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAddPaymentDetails(payment)}
                                  title="Add Payment Details"
                                >
                                  <DollarSign className="h-4 w-4 text-green-600" />
                                </Button>
                                {payment.dealer_phone && (
                                  <Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(
                                    payment.dealer_phone,
                                    payment.dealer_name,
                                    payment.order_number,
                                    payment.amount,
                                    payment.payment_due_date
                                  )} title="Send WhatsApp Reminder" className="hover:bg-blue-100">
                                    <MessageCircle className="h-4 w-4 text-blue-500" />
                                  </Button>
                                )}
                              </>
                            )}
                            {payment.type === 'payment_pending_approval_today' && payment.id && (
                              <>
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
                                      title={paymentIsDueForApproval ? "Approve Payment" : "Payment not yet due"}
                                      disabled={isSubmittingAction || !paymentIsDueForApproval}
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {!paymentIsDueForApproval && payment.cheque_dd_date ? (
                                          <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded">
                                            <p className="font-medium">Post-dated Payment</p>
                                            <p>This payment is scheduled for {new Date(payment.cheque_dd_date).toLocaleDateString()}.</p>
                                            <p>It can only be approved on or after that date.</p>
                                          </div>
                                        ) : null}
                                        Are you sure you want to approve the payment of ₹{payment.amount.toFixed(2)} for {payment.order_number === 0 ? 'General Balance' : `Order #${payment.order_number}`} from {payment.dealer_name}? This will {payment.order_number === 0 ? 'update the dealer\'s opening balance' : 'mark the order as paid'} and update the dealer's credit.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'approve')} disabled={isSubmittingAction || !paymentIsDueForApproval}>
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
                                        Are you sure you want to reject the payment of ₹{payment.amount.toFixed(2)} for {payment.order_number === 0 ? 'General Balance' : `Order #${payment.order_number}`} from {payment.dealer_name}? This will delete the payment record and {payment.order_number === 0 ? 'require re-entry' : 'revert the order to pending status'}.
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
            id: selectedOrderForPaymentUpdate.order_id || selectedOrderForPaymentUpdate.dealer_id, // Use dealer_id if order_id is null
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