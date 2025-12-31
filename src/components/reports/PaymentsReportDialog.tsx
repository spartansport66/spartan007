"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, DollarSign, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';

interface PaymentReportData {
  id: string;
  order_number: number;
  dealer_name: string;
  dealer_phone: string;
  total_amount: number;
  payment_status: string;
  payment_due_date: string | null;
  order_date: string;
}

interface DealerOption {
  value: string;
  label: string;
}

interface PaymentsReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const PaymentsReportDialog: React.FC<PaymentsReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [payments, setPayments] = useState<PaymentReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<PaymentReportData | null>(null);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due'>('pending');
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

      // Build the query for payments
      let query = supabase
        .from('orders')
        .select(`
          id, 
          order_number, 
          order_date, 
          total_amount, 
          payment_status, 
          payment_due_date, 
          dealers (name, phone)
        `)
        .order('payment_due_date', { ascending: true });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const endOfTodayISO = endOfToday.toISOString();

      if (filterStatus === 'pending') {
        query = query.eq('payment_status', 'pending');
      } else if (filterStatus === 'paid') {
        query = query.eq('payment_status', 'paid');
      } else if (filterStatus === 'overdue') {
        query = query.eq('payment_status', 'pending').lte('payment_due_date', todayISO);
      } else if (filterStatus === 'upcoming') {
        query = query.eq('payment_status', 'pending').gte('payment_due_date', todayISO);
      } else if (filterStatus === 'todays_due') {
        query = query.eq('payment_status', 'pending')
          .gte('payment_due_date', todayISO)
          .lte('payment_due_date', endOfTodayISO);
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

      const { data: paymentsData, error: paymentsError } = await query;
      
      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError.message);
        showError('Failed to load payment data.');
        setPayments([]);
      } else {
        const formattedPayments: PaymentReportData[] = (paymentsData || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          dealer_name: order.dealers?.name || 'N/A',
          dealer_phone: order.dealers?.phone || '',
          total_amount: order.total_amount,
          payment_status: order.payment_status,
          payment_due_date: order.payment_due_date,
          order_date: order.order_date,
        }));
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
    setFilterStatus('pending');
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

  const handlePrint = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
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

      console.log('Payments Report - Table Columns:', tableColumn);
      console.log('Payments Report - Table Rows:', tableRows);

      // Explicitly call autoTable as a function on the doc instance
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: {
          fillColor: [200, 200, 200],
          textColor: [0, 0, 0]
        },
        margin: { top: 25, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 25 },  // Order No.
          1: { cellWidth: 40 },  // Dealer Name
          2: { cellWidth: 30, halign: 'right' },  // Amount
          3: { cellWidth: 25 },  // Status
          4: { cellWidth: 30 },  // Due Date
          5: { cellWidth: 30 },  // Order Date
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
          <DialogTitle className="text-2xl font-bold text-indigo-600">Payments Report</DialogTitle>
          <DialogDescription>
            Generate a report of all orders with their payment status.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-indigo-50 rounded-lg">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterStatus" className="text-indigo-700 font-medium">Payment Status</Label>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
              <SelectTrigger id="filterStatus" className="w-full border-indigo-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="todays_due">Today's Due</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealer" className="text-indigo-700 font-medium">Dealer Name</Label>
            <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterDealer" className="w-full border-indigo-200">
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
            <Label htmlFor="filterFromDate" className="text-indigo-700 font-medium">From Order Date</Label>
            <Input 
              id="filterFromDate" 
              type="date" 
              value={filterFromDate} 
              onChange={(e) => setFilterFromDate(e.target.value)} 
              className="w-full border-indigo-200" 
            />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate" className="text-indigo-700 font-medium">To Order Date</Label>
            <Input 
              id="filterToDate" 
              type="date" 
              value={filterToDate} 
              onChange={(e) => setFilterToDate(e.target.value)} 
              className="w-full border-indigo-200" 
            />
          </div>
          
          <Button onClick={fetchPaymentsAndDealers} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            Clear Filters
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payment data...</p>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payment data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-indigo-100">
                  <TableRow className="bg-indigo-100 hover:bg-indigo-200">
                    <TableHead className="text-indigo-800 font-bold">Order No.</TableHead>
                    <TableHead className="text-indigo-800 font-bold">Dealer Name</TableHead>
                    <TableHead className="text-indigo-800 font-bold text-right">Amount</TableHead>
                    <TableHead className="text-indigo-800 font-bold">Status</TableHead>
                    <TableHead className="text-indigo-800 font-bold">Due Date</TableHead>
                    <TableHead className="text-indigo-800 font-bold">Order Date</TableHead>
                    <TableHead className="text-indigo-800 font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-indigo-50">
                      <TableCell className="font-medium text-indigo-900">#{payment.order_number}</TableCell>
                      <TableCell className="text-gray-700">{payment.dealer_name}</TableCell>
                      <TableCell className="text-gray-700 text-right font-medium">₹{payment.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(payment.payment_status)}`}>
                          {getStatusIcon(payment.payment_status)}
                          <span className="capitalize">{payment.payment_status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {payment.payment_due_date ? new Date(payment.payment_due_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-gray-700">{new Date(payment.order_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {payment.payment_status === 'pending' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleUpdatePaymentClick(payment)} 
                              title="Update Payment"
                              className="hover:bg-green-100"
                            >
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {payment.payment_status === 'pending' && payment.dealer_phone && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleSendWhatsApp(
                                payment.dealer_phone, 
                                payment.dealer_name, 
                                payment.order_number, 
                                payment.total_amount, 
                                payment.payment_due_date
                              )} 
                              title="Send WhatsApp Reminder"
                              className="hover:bg-blue-100"
                            >
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                            </Button>
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
          <Button variant="outline" onClick={handlePrint} disabled={payments.length === 0} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-indigo-600 hover:bg-indigo-700">Close</Button>
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