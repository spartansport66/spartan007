"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, LogOut, ArrowLeft, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/utils/format';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaymentApproval {
  id: string;
  dealer_id: string;
  dealer_name: string;
  sales_person_name: string;
  sales_person_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  created_at: string;
  transaction_reference?: string;
}

const AccountsDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType } = useSession();
  const [payments, setPayments] = useState<PaymentApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  
  // Filter states
  const [dealerFilter, setDealerFilter] = useState<string>('');
  const [fromDateFilter, setFromDateFilter] = useState<string>('');
  const [toDateFilter, setToDateFilter] = useState<string>('');
  
  // Pagination states
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const [currentPageApproved, setCurrentPageApproved] = useState(1);
  const [currentPageRejected, setCurrentPageRejected] = useState(1);
  
  const ITEMS_PER_PAGE = 5;

  const fetchPendingPayments = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL payments from payment_received table (not just pending)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_received')
        .select(`
          id,
          dealer_id,
          amount,
          payment_method,
          payment_date,
          status,
          created_at,
          created_by,
          sales_person_name,
          transaction_reference,
          dealers(name)
        `)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        throw paymentsError;
      }

      // Format payments using stored sales_person_name (no profile lookup needed)
      const formattedPayments: PaymentApproval[] = (paymentsData || []).map((p: any) => ({
        id: p.id,
        dealer_id: p.dealer_id,
        dealer_name: p.dealers?.name || 'Unknown Dealer',
        sales_person_name: p.sales_person_name || 'Unknown',
        sales_person_id: p.created_by,
        amount: p.amount,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        status: p.status,
        created_at: p.created_at,
        transaction_reference: p.transaction_reference,
      }));

      setPayments(formattedPayments);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      // If error is about missing column, it means migration hasn't been deployed yet
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        showError('Database schema needs to be updated. Please deploy the latest migrations.');
      } else {
        showError(`Failed to load payments: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter payments based on dealer name and date range
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const dealerMatch = dealerFilter === '' || payment.dealer_name.toLowerCase().includes(dealerFilter.toLowerCase());
      
      let dateMatch = true;
      if (fromDateFilter) {
        const paymentDate = new Date(payment.payment_date);
        const fromDate = new Date(fromDateFilter);
        dateMatch = dateMatch && paymentDate >= fromDate;
      }
      if (toDateFilter) {
        const paymentDate = new Date(payment.payment_date);
        const toDate = new Date(toDateFilter);
        toDate.setHours(23, 59, 59, 999);
        dateMatch = dateMatch && paymentDate <= toDate;
      }
      
      return dealerMatch && dateMatch;
    });
  }, [payments, dealerFilter, fromDateFilter, toDateFilter]);

  // Get filtered data by status
  const pendingPayments = useMemo(() => filteredPayments.filter(p => p.status === 'pending_approval'), [filteredPayments]);
  const approvedPayments = useMemo(() => filteredPayments.filter(p => p.status === 'completed'), [filteredPayments]);
  const rejectedPayments = useMemo(() => filteredPayments.filter(p => p.status === 'rejected'), [filteredPayments]);

  // Pagination helpers
  const getPaginatedData = (data: PaymentApproval[], page: number) => {
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  };

  const getTotalPages = (data: PaymentApproval[]) => Math.ceil(data.length / ITEMS_PER_PAGE);

  // Print function
  const handlePrint = (data: PaymentApproval[], title: string, statusLabel: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, 15, { align: 'center' });
    
    // Add filters info
    doc.setFontSize(10);
    let filterText = 'Filters: ';
    if (dealerFilter) filterText += `Dealer: ${dealerFilter}`;
    if (fromDateFilter) filterText += ` | From: ${fromDateFilter}`;
    if (toDateFilter) filterText += ` | To: ${toDateFilter}`;
    doc.text(filterText || 'Filters: None', pageWidth / 2, 22, { align: 'center' });
    
    // Add table
    const tableData = data.map(payment => [
      payment.dealer_name,
      payment.sales_person_name,
      formatCurrency(payment.amount),
      payment.payment_method,
      formatDate(payment.payment_date),
      formatDate(payment.created_at),
      statusLabel
    ]);

    autoTable(doc, {
      head: [['Dealer Name', 'Sales Person', 'Amount', 'Method', 'Payment Date', 'Date', 'Status']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'admin' && userType !== 'accounts') {
        navigate('/dashboard');
      } else {
        fetchPendingPayments();
      }
    }
  }, [user, sessionLoading, userType, navigate, fetchPendingPayments]);

  const handleApprovePayment = async (paymentId: string) => {
    setProcessingId(paymentId);
    try {
      // Get payment details first
      const { data: paymentData, error: fetchError } = await supabase
        .from('payment_received')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!paymentData) {
        throw new Error('Payment not found');
      }

      // Update payment_received status to completed (approved)
      const { error: updateError } = await supabase
        .from('payment_received')
        .update({ status: 'completed' })
        .eq('id', paymentId);

      if (updateError) {
        throw updateError;
      }

      // Call secure admin function to update dealer credit and balance
      // This bypasses RLS restrictions using SECURITY DEFINER
      const { data: functionResult, error: functionError } = await supabase
        .rpc('update_dealer_credit_on_payment_approval', {
          p_dealer_id: paymentData.dealer_id,
          p_amount: paymentData.amount,
          p_operation: 'increase'
        });

      if (functionError) {
        throw functionError;
      }

      if (!functionResult?.success) {
        throw new Error(functionResult?.error || 'Failed to update dealer credit');
      }

      showSuccess(`Payment approved! Dealer's consumed limit will be recalculated (Total Billed - Total Received).`);
      // Refresh data immediately
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchPendingPayments();
    } catch (error: any) {
      console.error('Error approving payment:', error);
      showError(`Failed to approve payment: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPaymentId || !rejectionReason.trim()) {
      showError('Please provide a rejection reason');
      return;
    }

    setProcessingId(selectedPaymentId);
    try {
      // Update payment_received status to rejected
      const { error: updateError } = await supabase
        .from('payment_received')
        .update({ 
          status: 'rejected',
        })
        .eq('id', selectedPaymentId);

      if (updateError) {
        throw updateError;
      }

      showSuccess('Payment rejected successfully!');
      setShowRejectionDialog(false);
      setRejectionReason('');
      setSelectedPaymentId(null);
      // Refresh data immediately
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchPendingPayments();
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      showError(`Failed to reject payment: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectApprovedPayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to reject this approved payment?')) {
      return;
    }

    setProcessingId(paymentId);
    try {
      // Get payment details
      const { data: paymentData, error: fetchError } = await supabase
        .from('payment_received')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError) throw fetchError;
      if (!paymentData) throw new Error('Payment not found');

      // Update payment status to rejected
      const { error: updateError } = await supabase
        .from('payment_received')
        .update({ status: 'rejected' })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Call secure admin function to revert dealer credit and balance
      const { data: functionResult, error: functionError } = await supabase
        .rpc('update_dealer_credit_on_payment_approval', {
          p_dealer_id: paymentData.dealer_id,
          p_amount: paymentData.amount,
          p_operation: 'decrease'
        });

      if (functionError) throw functionError;
      if (!functionResult?.success) throw new Error(functionResult?.error || 'Failed to update dealer credit');

      showSuccess(`Payment rejected! Dealer's consumed limit will be recalculated (Total Billed - Total Received).`);
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchPendingPayments();
    } catch (error: any) {
      console.error('Error rejecting approved payment:', error);
      showError(`Failed to reject payment: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveRejectedPayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to approve this rejected payment?')) {
      return;
    }

    setProcessingId(paymentId);
    try {
      // Get payment details
      const { data: paymentData, error: fetchError } = await supabase
        .from('payment_received')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError) throw fetchError;
      if (!paymentData) throw new Error('Payment not found');

      // Update payment status to completed
      const { error: updateError } = await supabase
        .from('payment_received')
        .update({ status: 'completed' })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Call secure admin function to update dealer credit and balance
      const { data: functionResult, error: functionError } = await supabase
        .rpc('update_dealer_credit_on_payment_approval', {
          p_dealer_id: paymentData.dealer_id,
          p_amount: paymentData.amount,
          p_operation: 'increase'
        });

      if (functionError) throw functionError;
      if (!functionResult?.success) throw new Error(functionResult?.error || 'Failed to update dealer credit');

      showSuccess(`Payment approved! Dealer's consumed limit will be recalculated (Total Billed - Total Received).`);
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchPendingPayments();
    } catch (error: any) {
      console.error('Error approving rejected payment:', error);
      showError(`Failed to approve payment: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'Pending Approval by Account Dept';
      case 'completed':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const getSalesPersonDisplay = (name: string | undefined) => {
    return name && name.trim() ? name : '—';
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
            Payments Approval Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Review and approve pending payments</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate('/admin-dashboard')} 
            variant="outline" 
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            size="icon"
            className="text-black hover:text-black"
          >
            <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-yellow-500 dark:bg-yellow-700 text-white rounded-t-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <CardTitle className="text-xl font-semibold">Pending Payments for Approval</CardTitle>
              <CardDescription className="text-yellow-100 dark:text-yellow-200">
                {pendingPayments.length === 0 
                  ? 'No payments waiting for approval' 
                  : `Total Pending: ${pendingPayments.length} payment${pendingPayments.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Button
              onClick={() => handlePrint(pendingPayments, 'Pending Payments Report', 'Pending Approval')}
              disabled={pendingPayments.length === 0}
              variant="ghost"
              className="text-white hover:bg-yellow-600"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
            <Input
              placeholder="Filter by dealer..."
              value={dealerFilter}
              onChange={(e) => {
                setDealerFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-yellow-50 dark:bg-yellow-900/30 text-black dark:text-white placeholder:text-yellow-700 dark:placeholder:text-yellow-300 border-yellow-200 dark:border-yellow-600"
            />
            <Input
              type="date"
              placeholder="From date"
              value={fromDateFilter}
              onChange={(e) => {
                setFromDateFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-yellow-50 dark:bg-yellow-900/30 text-black dark:text-white border-yellow-200 dark:border-yellow-600"
            />
            <Input
              type="date"
              placeholder="To date"
              value={toDateFilter}
              onChange={(e) => {
                setToDateFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-yellow-50 dark:bg-yellow-900/30 text-black dark:text-white border-yellow-200 dark:border-yellow-600"
            />
            <Button
              onClick={() => {
                setDealerFilter('');
                setFromDateFilter('');
                setToDateFilter('');
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              variant="ghost"
              className="text-white hover:bg-yellow-600"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payments...</p>
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-lg">No pending payments for approval.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                      <TableHead className="text-muted-foreground">Sales Person</TableHead>
                      <TableHead className="text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-muted-foreground">Method</TableHead>
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Submitted On</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Transaction Reference</TableHead>
                      <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPaginatedData(pendingPayments, currentPagePending).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-foreground">
                          {payment.dealer_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getSalesPersonDisplay(payment.sales_person_name)}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {payment.payment_method}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(payment.payment_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(payment.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.transaction_reference ? (
                            <><strong>Ref:</strong> {payment.transaction_reference}</>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprovePayment(payment.id)}
                              disabled={processingId === payment.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {processingId === payment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Dialog open={showRejectionDialog && selectedPaymentId === payment.id} onOpenChange={(open) => {
                              setShowRejectionDialog(open);
                              if (!open) {
                                setSelectedPaymentId(null);
                                setRejectionReason('');
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPaymentId(payment.id);
                                    setShowRejectionDialog(true);
                                  }}
                                  disabled={processingId === payment.id}
                                  variant="destructive"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Payment</DialogTitle>
                                  <DialogDescription>
                                    Provide a reason for rejecting this payment from {payment.dealer_name}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Textarea
                                    placeholder="Enter rejection reason..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="min-h-[100px]"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setShowRejectionDialog(false);
                                        setSelectedPaymentId(null);
                                        setRejectionReason('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={handleRejectPayment}
                                      disabled={processingId !== null}
                                    >
                                      {processingId === payment.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : null}
                                      Confirm Rejection
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination for Pending Payments */}
              <div className="flex justify-between items-center mt-4 gap-2">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPagePending - 1) * ITEMS_PER_PAGE + 1, pendingPayments.length)} to {Math.min(currentPagePending * ITEMS_PER_PAGE, pendingPayments.length)} of {pendingPayments.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPagePending(Math.max(1, currentPagePending - 1))}
                    disabled={currentPagePending === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <div className="text-sm font-medium flex items-center px-3">
                    Page {currentPagePending} of {getTotalPages(pendingPayments) || 1}
                  </div>
                  <Button
                    onClick={() => setCurrentPagePending(Math.min(getTotalPages(pendingPayments), currentPagePending + 1))}
                    disabled={currentPagePending >= getTotalPages(pendingPayments)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Approved Payments Card */}
      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <CardTitle className="text-xl font-semibold">Approved Payments</CardTitle>
              <CardDescription className="text-green-100 dark:text-green-200">
                {approvedPayments.length === 0 
                  ? 'No approved payments' 
                  : `Total Approved: ${approvedPayments.length} payment${approvedPayments.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Button
              onClick={() => handlePrint(approvedPayments, 'Approved Payments Report', 'Approved')}
              disabled={approvedPayments.length === 0}
              variant="ghost"
              className="text-white hover:bg-green-600"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
            <Input
              placeholder="Filter by dealer..."
              value={dealerFilter}
              onChange={(e) => {
                setDealerFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-green-50 dark:bg-green-900/30 text-black dark:text-white placeholder:text-green-700 dark:placeholder:text-green-300 border-green-200 dark:border-green-600"
            />
            <Input
              type="date"
              placeholder="From date"
              value={fromDateFilter}
              onChange={(e) => {
                setFromDateFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-green-50 dark:bg-green-900/30 text-black dark:text-white border-green-200 dark:border-green-600"
            />
            <Input
              type="date"
              placeholder="To date"
              value={toDateFilter}
              onChange={(e) => {
                setToDateFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-green-50 dark:bg-green-900/30 text-black dark:text-white border-green-200 dark:border-green-600"
            />
            <Button
              onClick={() => {
                setDealerFilter('');
                setFromDateFilter('');
                setToDateFilter('');
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              variant="ghost"
              className="text-white hover:bg-green-600"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {approvedPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-lg">No approved payments yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50 dark:bg-green-950 hover:bg-green-50 dark:hover:bg-green-950">
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Dealer Name</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Sales Person</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Amount</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Method</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Payment Date</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Approved On</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold">Status</TableHead>
                      <TableHead className="text-green-700 dark:text-green-300 font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPaginatedData(approvedPayments, currentPageApproved).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                        <TableCell>{getSalesPersonDisplay(payment.sales_person_name)}</TableCell>
                        <TableCell className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="capitalize">{payment.payment_method}</TableCell>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>{formatDate(payment.created_at)}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => handleRejectApprovedPayment(payment.id)}
                            disabled={processingId === payment.id}
                            variant="destructive"
                          >
                            {processingId === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination for Approved Payments */}
              <div className="flex justify-between items-center mt-4 gap-2">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPageApproved - 1) * ITEMS_PER_PAGE + 1, approvedPayments.length)} to {Math.min(currentPageApproved * ITEMS_PER_PAGE, approvedPayments.length)} of {approvedPayments.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPageApproved(Math.max(1, currentPageApproved - 1))}
                    disabled={currentPageApproved === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <div className="text-sm font-medium flex items-center px-3">
                    Page {currentPageApproved} of {getTotalPages(approvedPayments) || 1}
                  </div>
                  <Button
                    onClick={() => setCurrentPageApproved(Math.min(getTotalPages(approvedPayments), currentPageApproved + 1))}
                    disabled={currentPageApproved >= getTotalPages(approvedPayments)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Rejected Payments Card */}
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-red-500 dark:bg-red-700 text-white rounded-t-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <CardTitle className="text-xl font-semibold">Rejected Payments</CardTitle>
              <CardDescription className="text-red-100 dark:text-red-200">
                {rejectedPayments.length === 0 
                  ? 'No rejected payments' 
                  : `Total Rejected: ${rejectedPayments.length} payment${rejectedPayments.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Button
              onClick={() => handlePrint(rejectedPayments, 'Rejected Payments Report', 'Rejected')}
              disabled={rejectedPayments.length === 0}
              variant="ghost"
              className="text-white hover:bg-red-600"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
            <Input
              placeholder="Filter by dealer..."
              value={dealerFilter}
              onChange={(e) => {
                setDealerFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-red-50 dark:bg-red-900/30 text-black dark:text-white placeholder:text-red-700 dark:placeholder:text-red-300 border-red-200 dark:border-red-600"
            />
            <Input
              type="date"
              placeholder="From date"
              value={fromDateFilter}
              onChange={(e) => {
                setFromDateFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-red-50 dark:bg-red-900/30 text-black dark:text-white border-red-200 dark:border-red-600"
            />
            <Input
              type="date"
              placeholder="To date"
              value={toDateFilter}
              onChange={(e) => {
                setToDateFilter(e.target.value);
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              className="bg-red-50 dark:bg-red-900/30 text-black dark:text-white border-red-200 dark:border-red-600"
            />
            <Button
              onClick={() => {
                setDealerFilter('');
                setFromDateFilter('');
                setToDateFilter('');
                setCurrentPagePending(1);
                setCurrentPageApproved(1);
                setCurrentPageRejected(1);
              }}
              variant="ghost"
              className="text-white hover:bg-red-600"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {rejectedPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-lg">No rejected payments.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50 dark:bg-red-950 hover:bg-red-50 dark:hover:bg-red-950">
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Dealer Name</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Sales Person</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Amount</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Method</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Payment Date</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Rejected On</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold">Status</TableHead>
                      <TableHead className="text-red-700 dark:text-red-300 font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPaginatedData(rejectedPayments, currentPageRejected).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                        <TableCell>{getSalesPersonDisplay(payment.sales_person_name)}</TableCell>
                        <TableCell className="font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="capitalize">{payment.payment_method}</TableCell>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>{formatDate(payment.created_at)}</TableCell>
                        <TableCell>
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => handleApproveRejectedPayment(payment.id)}
                            disabled={processingId === payment.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {processingId === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination for Rejected Payments */}
              <div className="flex justify-between items-center mt-4 gap-2">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPageRejected - 1) * ITEMS_PER_PAGE + 1, rejectedPayments.length)} to {Math.min(currentPageRejected * ITEMS_PER_PAGE, rejectedPayments.length)} of {rejectedPayments.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPageRejected(Math.max(1, currentPageRejected - 1))}
                    disabled={currentPageRejected === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <div className="text-sm font-medium flex items-center px-3">
                    Page {currentPageRejected} of {getTotalPages(rejectedPayments) || 1}
                  </div>
                  <Button
                    onClick={() => setCurrentPageRejected(Math.min(getTotalPages(rejectedPayments), currentPageRejected + 1))}
                    disabled={currentPageRejected >= getTotalPages(rejectedPayments)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsDashboard;
