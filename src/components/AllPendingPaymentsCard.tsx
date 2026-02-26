"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye, Calendar, DollarSign, Clock, AlertCircle, MessageCircle, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { approveRejectPayment } from '@/utils/supabase-actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface PendingPaymentItem {
  type: 'order_due' | 'payment_pending_approval';
  id: string; // Order ID for 'order_due', Payment ID for others
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

const AllPendingPaymentsCard: React.FC<AllPendingPaymentsCardProps> = ({ onPaymentAction }) => {
  const [payments, setPayments] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [filterFromDate, setFilterFromDate] = useState<string>(''); // Default to empty to show all till 'To' date
  const [filterToDate, setFilterToDate] = useState<string>(today);

  // Dialog states
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null);

  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PendingPaymentItem | null>(null);

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
      showError('Failed to load company information.');
      setCompanyName(null);
    }
  }, []);

  const fetchPaymentActivities = useCallback(async () => {
    setLoading(true);
    try {
      const endOfToDate = getEndOfUTCDayISO(new Date(filterToDate));

      // 1. Fetch orders with payment_status = 'pending'
      let ordersDueQuery = supabase
        .from('orders')
        .select(`id, order_number, total_amount, payment_due_date, dealer_id, dealers (name, phone)`)
        .eq('payment_status', 'pending')
        .lte('payment_due_date', endOfToDate)
        .order('payment_due_date', { ascending: true });

      if (filterFromDate) {
        const startOfFromDate = getStartOfUTCDayISO(new Date(filterFromDate));
        ordersDueQuery = ordersDueQuery.gte('payment_due_date', startOfFromDate);
      }

      const { data: ordersDue, error: ordersDueError } = await ordersDueQuery;
      if (ordersDueError) throw ordersDueError;

      const formattedOrdersDue: PendingPaymentItem[] = (ordersDue || []).map((order: any) => ({
        type: 'order_due',
        id: order.id,
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
      let paymentsPendingQuery = supabase
        .from('payments')
        .select(`id, order_id, dealer_id, amount, payment_method, payment_date, cheque_dd_date, status, orders (order_number, payment_status, payment_due_date, dealer_id, dealers (name, phone)), dealers (name, phone)`)
        .eq('status', 'pending_approval')
        .lte('payment_date', endOfToDate)
        .order('payment_date', { ascending: true });

      if (filterFromDate) {
        const startOfFromDate = getStartOfUTCDayISO(new Date(filterFromDate));
        paymentsPendingQuery = paymentsPendingQuery.gte('payment_date', startOfFromDate);
      }
      
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
          approved_at: null,
          dealer_id: payment.dealer_id,
        };
      });

      const combinedPayments = [...formattedOrdersDue, ...formattedPaymentsPending];
      setPayments(combinedPayments);
    } catch (error: any) {
      console.error('Error fetching payment activities:', error.message);
      showError('Failed to load payment activities.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [filterFromDate, filterToDate]);

  useEffect(() => {
    fetchCompanyInfo();
    fetchPaymentActivities();
  }, [fetchCompanyInfo, fetchPaymentActivities]);

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
    if (payment.payment_date) {
      effectiveDueDate = new Date(payment.payment_date);
    }
    if (!effectiveDueDate) return true;
    effectiveDueDate.setHours(0, 0, 0, 0);
    return effectiveDueDate <= today;
  };

  const handleApproveRejectPayment = async (payment: PendingPaymentItem, action: 'approve' | 'reject') => {
    if (payment.type !== 'payment_pending_approval' || !payment.id) {
      showError('Invalid action for this payment type.');
      return;
    }
    setIsSubmittingAction(true);
    const success = await approveRejectPayment({
      paymentId: payment.id,
      orderId: payment.order_id,
      dealerId: payment.dealer_id,
      action: action,
    });
    if (success) {
      fetchPaymentActivities();
      onPaymentAction();
    }
    setIsSubmittingAction(false);
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
    fetchPaymentActivities();
    onPaymentAction();
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
    window.open(`https://web.whatsapp.com/send?phone=${dealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp message drafted. Please check the new tab.');
  };

  const handlePrint = () => {
    if (payments.length === 0) {
      showError("No data to print.");
      return;
    }
    try {
      const doc = new jsPDF();
      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(18);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text("Due Payments Report", doc.internal.pageSize.width / 2, 22, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      const fromDateText = filterFromDate ? new Date(filterFromDate).toLocaleDateString() : 'Beginning';
      const toDateText = new Date(filterToDate).toLocaleDateString();
      doc.text(`Date Range: ${fromDateText} to ${toDateText}`, doc.internal.pageSize.width / 2, 28, { align: 'center' });

      const tableColumn = ["Order No.", "Dealer Name", "Amount", "Status", "Due/Payment Date"];
      const tableRows = payments.map(p => {
        const displayStatus = (p.payment_status ?? 'unknown').replace('_', ' ');
        const displayDate = p.payment_date ? new Date(p.payment_date).toLocaleDateString() :
                            p.payment_due_date ? new Date(p.payment_due_date).toLocaleDateString() : 'N/A';
        return [
          p.order_number === 0 ? 'General Balance' : `#${p.order_number}`,
          p.dealer_name,
          `Rs.${p.amount.toFixed(2)}`,
          displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1),
          displayDate
        ];
      });

      const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `Rs.${totalAmount.toFixed(2)}`, '', '']],
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          2: { halign: 'right' }
        }
      });

      const safeFromDate = fromDateText.replace(/\//g, '-');
      const safeToDate = toDateText.replace(/\//g, '-');
      doc.save(`due_payments_report_${safeFromDate}_to_${safeToDate}.pdf`);
      showSuccess("Report generated successfully!");
    } catch (error: any) {
      showError(`Failed to generate PDF: ${error.message}`);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">Due Payments</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="from-date-filter" className="text-white">From:</Label>
              <Input
                id="from-date-filter"
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="w-auto bg-indigo-400 text-white border-indigo-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="to-date-filter" className="text-white">To:</Label>
              <Input
                id="to-date-filter"
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-auto bg-indigo-400 text-white border-indigo-300"
              />
            </div>
            <Button onClick={handlePrint} variant="outline" size="icon" className="bg-white text-indigo-600 hover:bg-indigo-100" title="Print Report">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-indigo-100 dark:text-indigo-200">
          {filterFromDate
            ? 'Orders due and payments pending approval for the selected date range.'
            : 'Orders due and payments pending approval up to the selected date.'}
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
            <p className="text-center text-muted-foreground py-8">No payments due for the selected dates.</p>
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
                  {payments.map((payment) => {
                    const displayStatus = payment.payment_status ?? 'unknown';
                    const paymentIsDueForApproval = isPaymentDueForApproval(payment);
                    const displayDate = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() :
                                      payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'N/A';
                    return (
                      <TableRow key={`${payment.type}-${payment.id}`} className={isOverdue(payment.payment_due_date, payment.payment_status) ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}>
                        <TableCell className="font-medium text-foreground">{payment.order_number === 0 ? 'General Balance' : `#${payment.order_number}`}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(displayStatus, payment.payment_due_date)}`}>
                            {getStatusIcon(displayStatus, payment.payment_due_date)}
                            <span className="capitalize">{(displayStatus).replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className={isOverdue(payment.payment_due_date, payment.payment_status) ? "text-destructive font-semibold" : "text-muted-foreground"}>{displayDate}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {payment.type === 'order_due' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleAddPaymentDetails(payment)} title="Add Payment Details"><DollarSign className="h-4 w-4 text-green-600" /></Button>
                                {payment.dealer_phone && (<Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(payment.dealer_phone, payment.dealer_name, payment.order_number, payment.amount, payment.payment_due_date)} title="Send WhatsApp Reminder" className="hover:bg-blue-100"><MessageCircle className="h-4 w-4 text-blue-500" /></Button>)}
                              </>
                            )}
                            {payment.type === 'payment_pending_approval' && payment.id && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleViewPaymentDetails(payment.id)} title="View Payment Details"><Eye className="h-4 w-4 text-blue-500" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title={paymentIsDueForApproval ? "Approve Payment" : "Payment not yet due"} disabled={isSubmittingAction || !paymentIsDueForApproval}><CheckCircle className="h-4 w-4 text-green-600" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {!paymentIsDueForApproval && payment.cheque_dd_date ? (<div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded"><p className="font-medium">Post-dated Payment</p><p>This payment is scheduled for {new Date(payment.cheque_dd_date).toLocaleDateString()}.</p><p>It can only be approved on or after that date.</p></div>) : null}
                                        Are you sure you want to approve the payment of ₹{payment.amount.toFixed(2)} for {payment.order_number === 0 ? 'General Balance' : `Order #${payment.order_number}`} from {payment.dealer_name}? This will {payment.order_number === 0 ? 'update the dealer\'s opening balance' : 'mark the order as paid'} and update the dealer's credit.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'approve')} disabled={isSubmittingAction || !paymentIsDueForApproval}>{isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Approve'}</AlertDialogAction>
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
      {selectedPaymentIdForDetails && (<PaymentDetailsDialog paymentId={selectedPaymentIdForDetails} isOpen={isPaymentDetailsDialogOpen} onOpenChange={setIsPaymentDetailsDialogOpen} />)}
      {selectedOrderForPaymentUpdate && (<UpdatePaymentDialog orderToUpdate={{id: selectedOrderForPaymentUpdate.order_id || selectedOrderForPaymentUpdate.dealer_id, order_number: selectedOrderForPaymentUpdate.order_number, total_amount: selectedOrderForPaymentUpdate.amount, dealer_name: selectedOrderForPaymentUpdate.dealer_name, payment_due_date: selectedOrderForPaymentUpdate.payment_due_date,}} isOpen={isUpdatePaymentDialogOpen} onOpenChange={setIsUpdatePaymentDialogOpen} onPaymentUpdated={handlePaymentUpdated} />)}
    </Card>
  );
};

export default AllPendingPaymentsCard;