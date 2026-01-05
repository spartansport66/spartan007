"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, DollarSign, Calendar, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface PaymentReportData {
  id: string; // Order ID
  order_number: number;
  dealer_name: string;
  dealer_phone: string;
  total_amount: number;
  payment_status: string;
  payment_due_date: string | null;
  order_date: string;
  payment_id: string | null; // New: to store the actual payment record ID for approval actions
  dealer_id: string; // New: to pass to the approve-payment edge function
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
  initialFilterFromDate?: string; // YYYY-MM-DD
  initialFilterToDate?: string; // YYYY-MM-DD
}

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const APPROVE_PAYMENT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/approve-payment";

const PaymentsReportDialog: React.FC<PaymentsReportDialogProps> = ({
  isOpen,
  onOpenChange,
  initialFilterStatus = 'all', // Default to 'all'
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
  const [isSubmittingAction, setIsSubmittingAction] = useState(false); // For approve/reject actions

  // Filter states, initialized directly from props
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>(initialFilterStatus);
  const [filterDealerId, setFilterDealerId] = useState<string>(initialFilterDealerId);
  const [filterFromDate, setFilterFromDate] = useState<string>(initialFilterFromDate);
  const [filterToDate, setFilterToDate] = useState<string>(initialFilterToDate);

  // Update local filter states when initial props change (due to key prop in parent)
  useEffect(() => {
    setFilterStatus(initialFilterStatus);
    setFilterDealerId(initialFilterDealerId);
    setFilterFromDate(initialFilterFromDate);
    setFilterToDate(initialFilterToDate);
  }, [initialFilterStatus, initialFilterDealerId, initialFilterFromDate, initialFilterToDate]);


  // Helper to get start of current UTC day
  const getStartOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
  };

  // Helper to get end of current UTC day
  const getEndOfUTCDayISO = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
  };

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

  const fetchPaymentsAndDealers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all dealers for the filter dropdown
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name');
      if (dealersError) {
        console.error('Error fetching dealers for filter:', dealersError.message);
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
        // If filtering for pending approval or paid, query payments table directly
        let query = supabase
          .from('payments')
          .select(`
            id, order_id, amount, payment_method, payment_date, approved_at,
            orders (
              id, order_number, order_date, total_amount, payment_status, payment_due_date, dealer_id,
              dealers (name, phone)
            )
          `)
          .eq('status', filterStatus === 'paid' ? 'completed' : 'pending_approval')
          .order('payment_date', { ascending: true });

        if (filterDealerId) {
          query = query.eq('orders.dealer_id', filterDealerId);
        }
        // Date filters for payments would apply to payment_date or approved_at
        if (filterFromDate) {
          const startOfDay = `${filterFromDate}T00:00:00.000Z`;
          query = query.gte(filterStatus === 'paid' ? 'approved_at' : 'payment_date', startOfDay);
        }
        if (filterToDate) {
          const endOfDay = `${filterToDate}T23:59:59.999Z`;
          query = query.lte(filterStatus === 'paid' ? 'approved_at' : 'payment_date', endOfDay);
        }

        const { data, error } = await query;
        fetchedData = data;
        fetchError = error;
      } else {
        // For other statuses (pending, overdue, upcoming, todays_due, all), query orders table
        let query = supabase
          .from('orders')
          .select(`
            id, order_number, order_date, total_amount, payment_status, payment_due_date, dealer_id,
            dealers (name, phone),
            payments (id, amount, payment_method, payment_date, cheque_dd_date, status)
          `)
          .order('payment_due_date', { ascending: true });

        if (filterStatus === 'pending') {
          query = query.eq('payment_status', 'pending');
        } else if (filterStatus === 'overdue') {
          query = query.eq('payment_status', 'pending').lte('payment_due_date', startOfUTCTodayISO);
        } else if (filterStatus === 'upcoming') {
          query = query.eq('payment_status', 'pending').gte('payment_due_date', endOfUTCTodayISO);
        } else if (filterStatus === 'todays_due') {
          query = query.eq('payment_status', 'pending')
            .gte('payment_due_date', startOfUTCTodayISO)
            .lte('payment_due_date', endOfUTCTodayISO);
        }

        if (filterDealerId) {
          query = query.eq('dealer_id', filterDealerId);
        }
        if (filterFromDate) {
          const startOfDay = `${filterFromDate}T00:00:00.000Z`;
          query = query.gte('order_date', startOfDay);
        }
        if (filterToDate) {
          const endOfDay = `${filterToDate}T23:59:59.999Z`;
          query = query.lte('order_date', endOfDay);
        }

        const { data, error } = await query;
        fetchedData = data;
        fetchError = error;
      }

      if (fetchError) {
        console.error('Error fetching payments:', fetchError.message);
        showError('Failed to load payment data.');
        setPayments([]);
      } else {
        const formattedPayments: PaymentReportData[] = (fetchedData || []).map((item: any) => {
          if (filterStatus === 'pending_approval' || filterStatus === 'paid') {
            // When querying payments directly
            return {
              id: item.orders.id, // Order ID
              order_number: item.orders.order_number,
              dealer_name: item.orders.dealers?.name || 'N/A',
              dealer_phone: item.orders.dealers?.phone || '',
              total_amount: item.amount, // Payment amount from the payment record
              payment_status: item.status === 'completed' ? 'paid' : item.status, // Payment's status
              payment_due_date: item.orders.payment_due_date,
              order_date: item.orders.order_date,
              payment_id: item.id, // This is the payment record ID
              dealer_id: item.orders.dealer_id,
            };
          } else {
            // When querying orders directly
            return {
              id: item.id, // Order ID
              order_number: item.order_number,
              dealer_name: item.dealers?.name || 'N/A',
              dealer_phone: item.dealers?.phone || '',
              total_amount: item.total_amount, // Total amount from the order record
              payment_status: item.payment_status,
              payment_due_date: item.payment_due_date,
              order_date: item.order_date,
              payment_id: item.payments?.[0]?.id || null, // Get payment ID if available
              dealer_id: item.dealer_id,
            };
          }
        });
        setPayments(formattedPayments);
      }
    } catch (error: any) {
      console.error('Error in fetchPaymentsAndDealers:', error.message);
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
    if (!dealerPhone) {
      showError('Dealer phone number is not available.');
      return;
    }
    if (!companyName) {
      showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.');
      return;
    }
    const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';
    const message = `Hello ${dealerName},\n\nThis is a reminder from *${companyName}* that payment for Order No. *${orderNumber}* of *₹${amountDue.toFixed(2)}* is due on ${formattedDueDate}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    // Open WhatsApp Web in a new tab
    window.open(`https://web.whatsapp.com/send?phone=${dealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp message drafted. Please check the new tab.');
  };

  const handleUpdatePaymentClick = (order: PaymentReportData) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handlePaymentUpdated = () => {
    fetchPaymentsAndDealers();
  };

  const handleApproveRejectPayment = async (payment: PaymentReportData, action: 'approve' | 'reject') => {
    if (!payment.payment_id) {
      showError('Payment ID is missing for this record.');
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
          paymentId: payment.payment_id,
          orderId: payment.id, // This is the order ID
          dealerId: payment.dealer_id,
          amount: payment.total_amount,
          action: action,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} payment`);
      }
      showSuccess(`Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      fetchPaymentsAndDealers(); // Refresh the list
    } catch (error: any) {
      console.error(`Error ${action}ing payment:`, error);
      showError(`Failed to ${action} payment: ${error.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });
      doc.setFontSize(18);
      doc.text("Payments Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);

      const tableColumn = ["Order No.", "Dealer Name", "Amount", "Status", "Due Date", "Order Date"];
      const tableRows = payments.map(payment => [
        payment.order_number,
        payment.dealer_name,
        `₹${payment.total_amount.toFixed(2)}`,
        payment.payment_status,
        payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'N/A',
        new Date(payment.order_date).toLocaleDateString(),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: {
          fontSize: 8
        },
        headStyles: {
          fillColor: [200, 200, 200],
          textColor: [0, 0, 0]
        },
        margin: { top: 25, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 25 }, // Order No.
          1: { cellWidth: 40 }, // Dealer Name
          2: { cellWidth: 30, halign: 'right' }, // Amount
          3: { cellWidth: 25 }, // Status
          4: { cellWidth: 30 }, // Due Date
          5: { cellWidth: 30 }, // Order Date
        }
      });

      doc.save('payments_report.pdf');
      showSuccess('Payments report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate payments report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  // Function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'pending_approval':
        return 'text-blue-600 bg-blue-100';
      case 'overdue':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Payments Report</DialogTitle>
          <DialogDescription>
            Generate a report of all orders with their payment status.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterStatus" className="text-foreground font-medium">Payment Status</Label>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
              <SelectTrigger id="filterStatus" className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="todays_due">Today's Due</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealer" className="text-foreground font-medium">Dealer Name</Label>
            <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterDealer" className="w-full">
                <SelectValue placeholder="Filter by dealer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {allDealers.map(dealer => (
                  <SelectItem key={dealer.value} value={dealer.value}>{dealer.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate" className="text-foreground font-medium">From Order Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate" className="text-foreground font-medium">To Order Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchPaymentsAndDealers} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading payment data...</p>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payment data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Order No.</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Due Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Order Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">#{payment.order_number}</TableCell>
                      <TableCell className="text-foreground">{payment.dealer_name}</TableCell>
                      <TableCell className="text-foreground text-right font-medium">₹{payment.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(payment.payment_status)}`}>
                          {getStatusIcon(payment.payment_status)}
                          <span className="capitalize">{payment.payment_status.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-foreground">{new Date(payment.order_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {payment.payment_status === 'pending' && (
                            <Button variant="ghost" size="icon" onClick={() => handleUpdatePaymentClick(payment)} title="Add Payment" className="hover:bg-green-100">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {payment.payment_status === 'pending' && payment.dealer_phone && (
                            <Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(
                              payment.dealer_phone,
                              payment.dealer_name,
                              payment.order_number,
                              payment.total_amount,
                              payment.payment_due_date
                            )} title="Send WhatsApp Reminder" className="hover:bg-blue-100">
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          {payment.payment_status === 'pending_approval' && (
                            <>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" title="Approve Payment" disabled={isSubmittingAction}>
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to approve the payment of ₹{payment.total_amount.toFixed(2)} for Order #{payment.order_number} from {payment.dealer_name}? This will mark the order as paid and update the dealer's credit.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleApproveRejectPayment(payment, 'approve')} disabled={isSubmittingAction}>
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
                                      Are you sure you want to reject the payment of ₹{payment.total_amount.toFixed(2)} for Order #{payment.order_number} from {payment.dealer_name}? This will revert the order to pending status.
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={payments.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
      {selectedOrderForPaymentUpdate && (
        <UpdatePaymentDialog
          orderToUpdate={selectedOrderForPaymentUpdate}
          isOpen={isUpdatePaymentDialogOpen}
          onOpenChange={setIsUpdatePaymentDialogOpen}
          onPaymentUpdated={handlePaymentUpdated}
        />
      )}
    </Dialog>
  );
};

export default PaymentsReportDialog;