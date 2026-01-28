"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, DollarSign, Calendar, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import { getStartOfUTCDayISO, getEndOfUTCDayISO, formatDate } from '@/utils/date';

interface PaymentReportData {
  id: string; // Order ID
  order_number: number;
  dealer_name: string;
  dealer_phone: string;
  total_amount: number;
  payment_status: string;
  payment_due_date: string | null;
  order_date: string;
  payment_id: string | null; // Actual payment record ID
  payment_method: string | null;
  cheque_dd_date: string | null;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonPaymentsReportProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesPersonPaymentsReport: React.FC<SalesPersonPaymentsReportProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [payments, setPayments] = useState<PaymentReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Dialog states
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

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
      console.error('[SalesPersonPaymentsReport] Error fetching company name for WhatsApp message:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchPaymentsAndDealers = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch all dealers assigned to the current user for the filter dropdown
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', user.id);
      if (assignedDealersError) {
        console.error('[SalesPersonPaymentsReport] Error fetching assigned dealers for filter:', assignedDealersError.message);
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers((assignedDealersData || []).map((item: any) => ({
          value: item.dealers.id,
          label: item.dealers.name
        })));
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
            id, order_id, amount, payment_method, payment_date, approved_at, status, cheque_dd_date,
            orders!inner (
              id, order_number, order_date, total_amount, payment_status, payment_due_date, dealer_id, user_id,
              dealers (name, phone)
            )
          `)
          .eq('status', filterStatus === 'paid' ? 'completed' : 'pending_approval')
          .eq('orders.user_id', user.id) // Filter by current user's orders
          .order('payment_date', { ascending: true });

        if (filterDealerId) {
          query = query.eq('orders.dealer_id', filterDealerId);
        }
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
            id, order_number, order_date, total_amount, payment_status, payment_due_date, dealer_id, user_id,
            dealers (name, phone),
            payments (id, amount, payment_method, payment_date, cheque_dd_date, status)
          `)
          .eq('user_id', user.id) // Filter by current user's orders
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
        console.error('[SalesPersonPaymentsReport] Error fetching payments:', fetchError.message);
        showError('Failed to load payment data.');
        setPayments([]);
      } else {
        const formattedPayments: PaymentReportData[] = (fetchedData || []).map((item: any) => {
          let currentPaymentStatus: string;
          let currentOrderId: string;
          let currentOrderNumber: number;
          let currentDealerName: string;
          let currentDealerPhone: string;
          let currentTotalAmount: number;
          let currentPaymentDueDate: string | null;
          let currentOrderDate: string;
          let currentPaymentId: string | null;
          let currentPaymentMethod: string | null;
          let currentChequeDdDate: string | null;

          if (filterStatus === 'pending_approval' || filterStatus === 'paid') {
            // When querying payments directly
            currentPaymentStatus = item.status === 'completed' ? 'paid' : item.status;
            currentOrderId = item.orders.id;
            currentOrderNumber = item.orders.order_number;
            currentDealerName = item.orders.dealers?.name || 'N/A';
            currentDealerPhone = item.orders.dealers?.phone || '';
            currentTotalAmount = item.amount; // Payment amount from the payment record
            currentPaymentDueDate = item.orders.payment_due_date;
            currentOrderDate = item.orders.order_date;
            currentPaymentId = item.id; // This is the payment record ID
            currentPaymentMethod = item.payment_method;
            currentChequeDdDate = item.cheque_dd_date;
          } else {
            // When querying orders directly
            currentPaymentStatus = item.payment_status;
            currentOrderId = item.id;
            currentOrderNumber = item.order_number;
            currentDealerName = item.dealers?.name || 'N/A';
            currentDealerPhone = item.dealers?.phone || '';
            currentTotalAmount = item.total_amount; // Total amount from the order record
            currentPaymentDueDate = item.payment_due_date;
            currentOrderDate = item.order_date;
            currentPaymentId = item.payments?.[0]?.id || null; // Get payment ID if available
            currentPaymentMethod = item.payments?.[0]?.payment_method || null;
            currentChequeDdDate = item.payments?.[0]?.cheque_dd_date || null;
          }

          return {
            id: currentOrderId,
            order_number: currentOrderNumber,
            dealer_name: currentDealerName,
            dealer_phone: currentDealerPhone,
            total_amount: currentTotalAmount,
            payment_status: currentPaymentStatus,
            payment_due_date: currentPaymentDueDate,
            order_date: currentOrderDate,
            payment_id: currentPaymentId,
            payment_method: currentPaymentMethod,
            cheque_dd_date: currentChequeDdDate,
          };
        });
        setPayments(formattedPayments);
      }
    } catch (error: any) {
      console.error('[SalesPersonPaymentsReport] Error in fetchPaymentsAndDealers:', error.message);
      showError('An unexpected error occurred while fetching payment data.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterStatus, filterDealerId, filterFromDate, filterToDate]);

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
      showError('Company name is required to send WhatsApp messages. Please contact an administrator.');
      return;
    }
    const formattedDueDate = dueDate ? formatDate(dueDate) : 'N/A';
    const message = `Hello ${dealerName},\n\nThis is a reminder from *${companyName}* that payment for Order No. *${orderNumber}* of *₹${amountDue.toFixed(2)}* is due on ${formattedDueDate}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://web.whatsapp.com/send?phone=${dealerPhone}&text=${encodedMessage}`, '_blank');
    showSuccess('WhatsApp message drafted. Please check the new tab.');
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    setSelectedPaymentIdForDetails(paymentId);
    setIsPaymentDetailsDialogOpen(true);
  };

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

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("My Payments Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterStatus !== 'all') filterDetails.push(`Status: ${filterStatus.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}`);
      if (filterDealerId) {
        const dealerLabel = allDealers.find(d => d.value === filterDealerId)?.label;
        if (dealerLabel) filterDetails.push(`Dealer: ${dealerLabel}`);
      }
      if (filterFromDate) filterDetails.push(`From Order Date: ${formatDate(filterFromDate)}`);
      if (filterToDate) filterDetails.push(`To Order Date: ${formatDate(filterToDate)}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = [
        "Order No.",
        "Dealer Name",
        "Phone",
        "Order Date",
        "Payment Method",
        "Status",
        "Due Date",
        "Amount"
      ];

      const tableRows = payments.map(payment => [
        `#${payment.order_number}`,
        payment.dealer_name,
        payment.dealer_phone || 'N/A',
        formatDate(payment.order_date),
        payment.payment_method ? payment.payment_method.replace(/_/g, ' ') : 'N/A',
        payment.payment_status.replace(/_/g, ' ').toUpperCase(),
        formatDate(payment.payment_due_date),
        `₹${payment.total_amount.toFixed(2)}`,
      ]);

      const totalSum = payments.reduce((sum, payment) => sum + payment.total_amount, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalSum.toFixed(2)}`]],
        startY: 45,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        footStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 30, halign: 'center' },
          5: { cellWidth: 25, halign: 'center' },
          6: { cellWidth: 25, halign: 'center' },
          7: { cellWidth: 25, halign: 'right' },
        }
      });

      doc.save('my_payments_report.pdf');
      showSuccess('My Payments report generated successfully!');
    } catch (error: any) {
      console.error('[SalesPersonPaymentsReport] Error generating PDF:', error);
      showError(`Failed to generate payments report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">My Payments Report</DialogTitle>
          <DialogDescription>
            Generate a report of all your orders with their payment status.
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
                  {payments.map((payment) => {
                    const displayStatus = payment.payment_status ?? 'unknown';
                    return (
                      <TableRow key={payment.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">#{payment.order_number}</TableCell>
                        <TableCell className="text-foreground">{payment.dealer_name}</TableCell>
                        <TableCell className="text-foreground text-right font-medium">₹{payment.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(displayStatus, payment.payment_due_date)}`}>
                            {getStatusIcon(displayStatus, payment.payment_due_date)}
                            <span className="capitalize">{(displayStatus).replace(/_/g, ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {formatDate(payment.payment_due_date)}
                        </TableCell>
                        <TableCell className="text-foreground">{formatDate(payment.order_date)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
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
                            {(payment.payment_status === 'paid' || payment.payment_status === 'pending_approval') && payment.payment_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewPaymentDetails(payment.payment_id!)}
                                title="View Payment Details"
                              >
                                <Eye className="h-4 w-4 text-blue-500" />
                              </Button>
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

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={payments.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
      {selectedPaymentIdForDetails && (
        <PaymentDetailsDialog
          paymentId={selectedPaymentIdForDetails}
          isOpen={isPaymentDetailsDialogOpen}
          onOpenChange={setIsPaymentDetailsDialogOpen}
        />
      )}
    </Dialog>
  );
};

export default SalesPersonPaymentsReport;