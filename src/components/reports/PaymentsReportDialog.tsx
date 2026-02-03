"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, DollarSign, Calendar, Clock, CheckCircle, AlertCircle, XCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { approveRejectPayment } from '@/utils/supabase-actions';

interface PaymentReportData {
  id: string; // Order ID (or Dealer ID for general payment)
  order_number: number;
  dealer_name: string;
  dealer_phone: string;
  total_amount: number;
  payment_status: string;
  payment_due_date: string | null;
  order_date: string;
  payment_id: string | null;
  dealer_id: string;
  payment_method: string | null;
  cheque_dd_date: string | null;
  payment_date: string | null;
}

interface DealerOption {
  value: string;
  label: string;
}

interface PaymentsReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilterStatus?: 'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval';
  initialFilterDealerId?: string;
  initialFilterFromDate?: string;
  initialFilterToDate?: string;
}

const PaymentsReportDialog: React.FC<PaymentsReportDialogProps> = ({
  isOpen,
  onOpenChange,
  initialFilterStatus = 'all',
  initialFilterDealerId = '',
  initialFilterFromDate = '',
  initialFilterToDate = '',
}) => {
  const [payments, setPayments] = useState<PaymentReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PaymentReportData | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState(initialFilterStatus);
  const [filterDealerId, setFilterDealerId] = useState(initialFilterDealerId);
  const [filterFromDate, setFilterFromDate] = useState(initialFilterFromDate);
  const [filterToDate, setFilterToDate] = useState(initialFilterToDate);

  useEffect(() => {
    setFilterStatus(initialFilterStatus);
    setFilterDealerId(initialFilterDealerId);
    setFilterFromDate(initialFilterFromDate);
    setFilterToDate(initialFilterToDate);
  }, [initialFilterStatus, initialFilterDealerId, initialFilterFromDate, initialFilterToDate]);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchPaymentsAndDealers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dealersData, error: dealersError } = await supabase.from('dealers').select('id, name');
      if (dealersError) {
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers(dealersData.map(d => ({ value: d.id, label: d.name })));
      }

      let fetchedData: any[] | null = null;
      let fetchError: any = null;
      const startOfUTCTodayISO = getStartOfUTCDayISO();
      const endOfUTCTodayISO = getEndOfUTCDayISO();

      if (filterStatus === 'pending_approval' || filterStatus === 'paid') {
        let query = supabase.from('payments').select(`id, order_id, dealer_id, amount, payment_method, payment_date, approved_at, status, cheque_dd_date, orders (id, order_number, order_date, total_amount, payment_status, payment_due_date, dealer_id, dealers (name, phone)), dealers (name, phone)`).eq('status', filterStatus === 'paid' ? 'completed' : 'pending_approval').order('payment_date', { ascending: true });
        if (filterDealerId) query = query.eq('dealer_id', filterDealerId);
        if (filterFromDate) query = query.gte(filterStatus === 'paid' ? 'approved_at' : 'payment_date', `${filterFromDate}T00:00:00.000Z`);
        if (filterToDate) query = query.lte(filterStatus === 'paid' ? 'approved_at' : 'payment_date', `${filterToDate}T23:59:59.999Z`);
        const { data, error } = await query;
        fetchedData = data;
        fetchError = error;
      } else {
        let query = supabase.from('orders').select(`id, order_number, order_date, total_amount, payment_status, payment_due_date, dealer_id, dealers (name, phone), payments (id, amount, payment_method, payment_date, cheque_dd_date, status)`).order('payment_due_date', { ascending: true });
        if (filterStatus === 'pending') query = query.eq('payment_status', 'pending');
        else if (filterStatus === 'overdue') query = query.eq('payment_status', 'pending').lte('payment_due_date', startOfUTCTodayISO);
        else if (filterStatus === 'upcoming') query = query.eq('payment_status', 'pending').gte('payment_due_date', endOfUTCTodayISO);
        else if (filterStatus === 'todays_due') query = query.eq('payment_status', 'pending').gte('payment_due_date', startOfUTCTodayISO).lte('payment_due_date', endOfUTCTodayISO);
        if (filterDealerId) query = query.eq('dealer_id', filterDealerId);
        if (filterFromDate) query = query.gte('order_date', `${filterFromDate}T00:00:00.000Z`);
        if (filterToDate) query = query.lte('order_date', `${filterToDate}T23:59:59.999Z`);
        const { data, error } = await query;
        fetchedData = data;
        fetchError = error;
      }

      if (fetchError) {
        showError('Failed to load payment data.');
        setPayments([]);
      } else {
        const formattedPayments: PaymentReportData[] = (fetchedData || []).map((item: any) => {
          let currentPaymentStatus: string, currentOrderId: string, currentOrderNumber: number, currentDealerName: string, currentDealerPhone: string, currentTotalAmount: number, currentPaymentDueDate: string | null, currentOrderDate: string, currentPaymentId: string | null, currentDealerId: string, currentPaymentMethod: string | null, currentChequeDdDate: string | null, currentPaymentDate: string | null;
          if (filterStatus === 'pending_approval' || filterStatus === 'paid') {
            const isGeneralPayment = !item.order_id;
            currentPaymentStatus = item.status === 'completed' ? 'paid' : item.status;
            currentOrderId = isGeneralPayment ? item.dealer_id : item.orders.id;
            currentOrderNumber = isGeneralPayment ? 0 : item.orders.order_number;
            currentDealerName = isGeneralPayment ? item.dealers?.name || 'N/A' : item.orders.dealers?.name || 'N/A';
            currentDealerPhone = isGeneralPayment ? item.dealers?.phone || '' : item.orders.dealers?.phone || '';
            currentTotalAmount = item.amount;
            currentPaymentDueDate = isGeneralPayment ? null : item.orders.payment_due_date;
            currentOrderDate = isGeneralPayment ? item.payment_date : item.orders.order_date;
            currentPaymentId = item.id;
            currentDealerId = item.dealer_id;
            currentPaymentMethod = item.payment_method;
            currentChequeDdDate = item.cheque_dd_date;
            currentPaymentDate = item.payment_date;
          } else {
            currentPaymentStatus = item.payment_status;
            currentOrderId = item.id;
            currentOrderNumber = item.order_number;
            currentDealerName = item.dealers?.name || 'N/A';
            currentDealerPhone = item.dealers?.phone || '';
            currentTotalAmount = item.total_amount;
            currentPaymentDueDate = item.payment_due_date;
            currentOrderDate = item.order_date;
            currentPaymentId = item.payments?.[0]?.id || null;
            currentDealerId = item.dealer_id;
            currentPaymentMethod = item.payments?.[0]?.payment_method || null;
            currentChequeDdDate = item.payments?.[0]?.cheque_dd_date || null;
            currentPaymentDate = item.payments?.[0]?.payment_date || null;
          }
          return { id: currentOrderId, order_number: currentOrderNumber, dealer_name: currentDealerName, dealer_phone: currentDealerPhone, total_amount: currentTotalAmount, payment_status: currentPaymentStatus, payment_due_date: currentPaymentDueDate, order_date: currentOrderDate, payment_id: currentPaymentId, dealer_id: currentDealerId, payment_method: currentPaymentMethod, cheque_dd_date: currentChequeDdDate, payment_date: currentPaymentDate };
        });
        setPayments(formattedPayments);
      }
    } catch (error: any) {
      showError('An unexpected error occurred while fetching payment data.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDealerId, filterFromDate, filterToDate]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchPaymentsAndDealers();
    }
  }, [isOpen, fetchCompanyInfo, fetchPaymentsAndDealers]);

  const handleClearFilters = () => {
    setFilterStatus('all');
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleSendWhatsApp = (dealerPhone: string, dealerName: string, orderNumber: number, amountDue: number, dueDate: string | null) => {
    if (!dealerPhone) { showError('Dealer phone number is not available.'); return; }
    if (!companyName) { showError('Company name is required. Please set it in Admin Dashboard -> Company Information.'); return; }
    const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';
    const message = `Hello ${dealerName},\n\nThis is a reminder from *${companyName}* that payment for Order No. *${orderNumber}* of *₹${amountDue.toFixed(2)}* is due on ${formattedDueDate}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://web.whatsapp.com/send?phone=${dealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp message drafted. Please check the new tab.');
  };

  const handleUpdatePaymentClick = (order: PaymentReportData) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    setSelectedPaymentIdForDetails(paymentId);
    setIsPaymentDetailsDialogOpen(true);
  };

  const handlePaymentUpdated = () => { fetchPaymentsAndDealers(); };

  const isPaymentDue = (payment: PaymentReportData) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let effectiveDueDate: Date | null = null;
    if (payment.payment_date) effectiveDueDate = new Date(payment.payment_date);
    else if (payment.payment_due_date) effectiveDueDate = new Date(payment.payment_due_date);
    if (!effectiveDueDate) return true;
    effectiveDueDate.setHours(0, 0, 0, 0);
    return effectiveDueDate <= today;
  };

  const handleApproveRejectPayment = async (payment: PaymentReportData, action: 'approve' | 'reject') => {
    if (!payment.payment_id) { showError('Payment ID is missing.'); return; }
    setIsSubmittingAction(true);
    const success = await approveRejectPayment({ paymentId: payment.payment_id, orderId: payment.order_number === 0 ? null : payment.id, dealerId: payment.dealer_id, action });
    if (success) { fetchPaymentsAndDealers(); }
    setIsSubmittingAction(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'pending_approval': return 'text-blue-600 bg-blue-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pending_approval': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'overdue': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22); doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18); doc.text("Payments Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });
      let filterDetails = [];
      if (filterStatus !== 'all') filterDetails.push(`Status: ${filterStatus.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}`);
      if (filterDealerId) { const dealerLabel = allDealers.find(d => d.value === filterDealerId)?.label; if (dealerLabel) filterDetails.push(`Dealer: ${dealerLabel}`); }
      if (filterFromDate) filterDetails.push(`From Order Date: ${new Date(filterFromDate).toLocaleDateString()}`);
      if (filterToDate) filterDetails.push(`To Order Date: ${new Date(filterToDate).toLocaleDateString()}`);
      if (filterDetails.length > 0) { doc.setFontSize(9); doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' }); }
      const tableColumn = ["Order No.", "Dealer Name", "Phone", "Order/Payment Date", "Payment Method", "Status", "Due Date", "Amount"];
      const tableRows = payments.map(p => [p.order_number === 0 ? 'General Balance' : `#${p.order_number}`, p.dealer_name, p.dealer_phone || 'N/A', new Date(p.order_date).toLocaleDateString(), p.payment_method ? p.payment_method.replace(/_/g, ' ') : 'N/A', p.payment_status.replace(/_/g, ' ').toUpperCase(), p.payment_due_date ? new Date(p.payment_due_date).toLocaleDateString() : 'N/A', `₹${p.total_amount.toFixed(2)}`]);
      const totalSum = payments.reduce((sum, p) => sum + p.total_amount, 0);
      autoTable(doc, { head: [tableColumn], body: tableRows, foot: [[{ content: 'Total', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalSum.toFixed(2)}`]], startY: 45, styles: { fontSize: 7, cellPadding: 2, valign: 'middle' }, headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }, bodyStyles: { textColor: [0, 0, 0] }, footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 }, margin: { top: 10, left: 10, right: 10 }, columnStyles: { 0: { cellWidth: 25, halign: 'center' }, 1: { cellWidth: 30 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25, halign: 'center' }, 4: { cellWidth: 30, halign: 'center' }, 5: { cellWidth: 25, halign: 'center' }, 6: { cellWidth: 25, halign: 'center' }, 7: { cellWidth: 25, halign: 'right' } } });
      doc.save('payments_report.pdf');
      showSuccess('Payments report generated successfully!');
    } catch (error: any) { showError(`Failed to generate payments report: ${error.message || 'An unknown error occurred.'}`); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Payments Report</DialogTitle>
          <DialogDescription>Generate a report of all orders with their payment status.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[150px]"><Label htmlFor="filterStatus" className="text-foreground font-medium">Payment Status</Label><Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}><SelectTrigger id="filterStatus" className="w-full"><SelectValue placeholder="Filter by status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending_approval">Pending Approval</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="todays_due">Today's Due</SelectItem><SelectItem value="upcoming">Upcoming</SelectItem></SelectContent></Select></div>
          <div className="flex-1 min-w-[150px]"><Label htmlFor="filterDealer" className="text-foreground font-medium">Dealer Name</Label><Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}><SelectTrigger id="filterDealer" className="w-full"><SelectValue placeholder="Filter by dealer" /></SelectTrigger><SelectContent><SelectItem value="all">All Dealers</SelectItem>{allDealers.map(d => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent></Select></div>
          <div className="flex-1 min-w-[150px]"><Label htmlFor="filterFromDate" className="text-foreground font-medium">From Order Date</Label><Input id="filterFromDate" type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full" /></div>
          <div className="flex-1 min-w-[150px]"><Label htmlFor="filterToDate" className="text-foreground font-medium">To Order Date</Label><Input id="filterToDate" type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full" /></div>
          <Button onClick={fetchPaymentsAndDealers} className="flex items-center gap-2 bg-primary hover:bg-primary/90"><Search className="h-4 w-4" /> Apply Filters</Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">Clear Filters</Button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-foreground">Loading payment data...</p></div>) : payments.length === 0 ? (<p className="text-center text-muted-foreground py-8">No payment data found matching your criteria.</p>) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted"><TableRow className="bg-muted hover:bg-muted/90"><TableHead className="text-muted-foreground font-bold">Order No.</TableHead><TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead><TableHead className="text-muted-foreground font-bold text-right">Amount</TableHead><TableHead className="text-muted-foreground font-bold">Status</TableHead><TableHead className="text-muted-foreground font-bold">Due Date</TableHead><TableHead className="text-muted-foreground font-bold">Order/Payment Date</TableHead><TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const displayStatus = p.payment_status ?? 'unknown';
                    const paymentIsDue = isPaymentDue(p);
                    return (
                      <TableRow key={p.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{p.order_number === 0 ? 'General Balance' : `#${p.order_number}`}</TableCell>
                        <TableCell className="text-foreground">{p.dealer_name}</TableCell>
                        <TableCell className="text-foreground text-right font-medium">₹{p.total_amount.toFixed(2)}</TableCell>
                        <TableCell><div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(displayStatus)}`}>{getStatusIcon(displayStatus)}<span className="capitalize">{(displayStatus).replace(/_/g, ' ')}</span></div></TableCell>
                        <TableCell className="text-foreground">{p.payment_due_date ? new Date(p.payment_due_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell className="text-foreground">{new Date(p.order_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {p.payment_status === 'pending' && p.order_number !== 0 && (<Button variant="ghost" size="icon" onClick={() => handleUpdatePaymentClick(p)} title="Add Payment" className="hover:bg-green-100"><DollarSign className="h-4 w-4 text-green-600" /></Button>)}
                            {p.payment_status === 'pending' && p.order_number !== 0 && p.dealer_phone && (<Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(p.dealer_phone, p.dealer_name, p.order_number, p.total_amount, p.payment_due_date)} title="Send WhatsApp Reminder" className="hover:bg-blue-100"><MessageCircle className="h-4 w-4 text-blue-500" /></Button>)}
                            {(p.payment_status === 'paid' || p.payment_status === 'pending_approval') && p.payment_id && (<Button variant="ghost" size="icon" onClick={() => handleViewPaymentDetails(p.payment_id!)} title="View Payment Details"><Eye className="h-4 w-4 text-blue-500" /></Button>)}
                            {p.payment_status === 'pending_approval' && (<>
                              <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" title={paymentIsDue ? "Approve Payment" : "Payment not yet due"} disabled={isSubmittingAction || !paymentIsDue}><CheckCircle className="h-4 w-4 text-green-600" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve Payment?</AlertDialogTitle><AlertDialogDescription>{!paymentIsDue && p.cheque_dd_date ? (<div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded"><p className="font-medium">Post-dated Payment</p><p>This payment is scheduled for {new Date(p.cheque_dd_date).toLocaleDateString()}.</p><p>It can only be approved on or after that date.</p></div>) : null}Are you sure you want to approve the payment of ₹{p.total_amount.toFixed(2)} for {p.order_number === 0 ? 'General Balance' : `Order #${p.order_number}`} from {p.dealer_name}? This will {p.order_number === 0 ? 'update the dealer\'s opening balance' : 'mark the order as paid'} and update the dealer's credit.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleApproveRejectPayment(p, 'approve')} disabled={isSubmittingAction || !paymentIsDue}>{isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Approve'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                              <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Reject Payment" disabled={isSubmittingAction}><XCircle className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reject Payment?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to reject the payment of ₹{p.total_amount.toFixed(2)} for {p.order_number === 0 ? 'General Balance' : `Order #${p.order_number}`} from {p.dealer_name}? This will delete the payment record and {p.order_number === 0 ? 'require re-entry' : 'revert the order to pending status'}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleApproveRejectPayment(p, 'reject')} disabled={isSubmittingAction}>{isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reject'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                            </>)}
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
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={payments.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
      {selectedOrderForPaymentUpdate && (<UpdatePaymentDialog orderToUpdate={{id: selectedOrderForPaymentUpdate.id, order_number: selectedOrderForPaymentUpdate.order_number, total_amount: selectedOrderForPaymentUpdate.total_amount, dealer_name: selectedOrderForPaymentUpdate.dealer_name, payment_due_date: selectedOrderForPaymentUpdate.payment_due_date}} isOpen={isUpdatePaymentDialogOpen} onOpenChange={setIsUpdatePaymentDialogOpen} onPaymentUpdated={handlePaymentUpdated} />)}
      {selectedPaymentIdForDetails && (<PaymentDetailsDialog paymentId={selectedPaymentIdForDetails} isOpen={isPaymentDetailsDialogOpen} onOpenChange={setIsPaymentDetailsDialogOpen} />)}
    </Dialog>
  );
};

export default PaymentsReportDialog;