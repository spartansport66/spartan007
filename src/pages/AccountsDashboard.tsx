"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, LogOut, ArrowLeft, Printer, FileText, AlertCircle } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { format } from 'date-fns';
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
import PrintBillDialog from '@/components/PrintBillDialog';

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

interface SalesItem {
  id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  total_price: number;
  products: {
    name: string;
    code: string;
    hsn: string | null;
  };
}

interface BillForApproval {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  order_id?: string;
  companies?: { id: string; name: string };
  dealers?: { id: string; name: string };
  payment_status: string;
  status: 'approve' | 'reject' | null;
  gst_number?: string;
  total_amount: number;
  discount_amount: number;
  freight_charges: number;
  taxable_value: number;
  total_gst: number;
  round_off: number;
  notes?: string;
  rejection_reason?: string;
  sales?: SalesItem[];
  delivery_location?: string;
  transport_name?: string;
  booking_destination?: string;
  date_of_dispatch?: string;
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
  
  // Bill approval states
  const [pendingBills, setPendingBills] = useState<BillForApproval[]>([]);
  const [verifiedBills, setVerifiedBills] = useState<BillForApproval[]>([]);
  const [rejectedBills, setRejectedBills] = useState<BillForApproval[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillForApproval | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<string | null>(null);
  const [isApproveBillDialogOpen, setIsApproveBillDialogOpen] = useState(false);
  const [isRejectBillDialogOpen, setIsRejectBillDialogOpen] = useState(false);
  const [billRejectionReason, setBillRejectionReason] = useState<string>('');
  const [billProcessingId, setBillProcessingId] = useState<string | null>(null);
  
  // Filter states
  const [dealerFilter, setDealerFilter] = useState<string>('');
  const [fromDateFilter, setFromDateFilter] = useState<string>('');
  const [toDateFilter, setToDateFilter] = useState<string>('');
  
  // Pagination states
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const [currentPageApproved, setCurrentPageApproved] = useState(1);
  const [currentPageRejected, setCurrentPageRejected] = useState(1);
  
  // Real-time sync indicator
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
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

  // Fetch pending bills for approval
  const fetchPendingBills = useCallback(async () => {
    try {
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          bill_number,
          bill_date,
          grand_total,
          order_id,
          payment_status,
          status,
          rejection_reason,
          gst_number,
          total_amount,
          discount_amount,
          freight_charges,
          taxable_value,
          total_gst,
          round_off,
          notes,
          companies (id, name),
          dealers (id, name)
        `)
        .order('bill_date', { ascending: false });

      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          bill_number,
          bill_date,
          grand_total,
          order_id,
          payment_status,
          status,
          rejection_reason,
          gst_number,
          total_amount,
          discount_amount,
          freight_charges,
          taxable_value,
          total_gst,
          round_off,
          notes,
          companies (id, name),
          dealers (id, name)
        `)
        .order('bill_date', { ascending: false });

      if (spartanError && fightorError) throw spartanError;

      const data = [...(spartanData || []), ...(fightorData || [])];
      data.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
      data.splice(1000); // Keep only latest 1000

      if (data) {
        // Filter bills by status: null = pending, 'approve' = approved, 'reject' = rejected
        const pending = (data as BillForApproval[]).filter(
          (bill) => bill.status === null || bill.status === undefined
        );
        
        setPendingBills(pending);

        // Get approved bills
        const approved = (data as BillForApproval[]).filter(
          (bill) => bill.status === 'approve'
        );
        setVerifiedBills(approved);

        // Get rejected bills
        const rejected = (data as BillForApproval[]).filter(
          (bill) => bill.status === 'reject'
        );
        setRejectedBills(rejected);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
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
        fetchPendingBills();
      }
    }
  }, [user, sessionLoading, userType, navigate, fetchPendingPayments, fetchPendingBills]);

  // Real-time subscriptions for auto-update of bills
  useEffect(() => {
    if (sessionLoading) return;

    const subscriptions: any[] = [];

    // Subscribe to invoices table changes
    const invoicesSubscription = supabase
      .channel('accounts-invoices-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
      }, () => {
        console.log('Invoice changed detected in Accounts Dashboard, updating bills...');
        setLastSyncTime(new Date());
        fetchPendingBills();
      })
      .subscribe();
    subscriptions.push(invoicesSubscription);

    // Subscribe to payment_received table changes
    const paymentsSubscription = supabase
      .channel('accounts-payments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_received',
      }, () => {
        console.log('Payment received changed in Accounts Dashboard, updating payments...');
        setLastSyncTime(new Date());
        fetchPendingPayments();
      })
      .subscribe();
    subscriptions.push(paymentsSubscription);

    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [sessionLoading, fetchPendingPayments, fetchPendingBills]);

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

  // Bill Approval Functions
  const handleApproveBill = (bill: BillForApproval) => {
    setSelectedBill(bill);
    setIsApproveBillDialogOpen(true);
  };

  const confirmApproveBill = async () => {
    if (!selectedBill) return;

    try {
      setBillProcessingId(selectedBill.id);
      console.log('Attempting to approve bill:', selectedBill.id, selectedBill.bill_number);

      // Mark the linked order as bill approved first
      const orderUpdatePayload = { bill_approved: true };
      if (selectedBill.order_id) {
        const { data: orderUpdateData, error: orderUpdateError } = await supabase
          .from('orders')
          .update(orderUpdatePayload)
          .eq('id', selectedBill.order_id)
          .select();

        if (orderUpdateError) {
          throw orderUpdateError;
        }

        if (!orderUpdateData || orderUpdateData.length === 0) {
          console.warn('No orders row updated for selectedBill.order_id', selectedBill.order_id, selectedBill);
        } else {
          console.log('Order bill_approved updated for order:', selectedBill.order_id, orderUpdateData);
        }
      } else if (selectedBill.bill_number) {
        const { data: orderUpdateData, error: orderUpdateError } = await supabase
          .from('orders')
          .update(orderUpdatePayload)
          .eq('bill_no', selectedBill.bill_number)
          .select();

        if (orderUpdateError) {
          throw orderUpdateError;
        }

        if (!orderUpdateData || orderUpdateData.length === 0) {
          console.warn('No orders row updated for selectedBill.bill_number', selectedBill.bill_number, selectedBill);
        } else {
          console.log('Order bill_approved updated for order by bill number:', selectedBill.bill_number, orderUpdateData);
        }
      } else {
        console.warn('Skipping order bill_approved update because selectedBill.order_id and bill_number are both missing', selectedBill);
      }

      // Update bill status to 'approve'
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .update({ status: 'approve' })
        .eq('id', selectedBill.id)
        .select();

      console.log('Spartan update result:', { spartanData, spartanError });

      // If error or no data returned, try fightor
      if (spartanError || !spartanData || spartanData.length === 0) {
        console.log('Bill not found in spartan, trying fightor...');
        const { data: fightorData, error: fightorError } = await supabase
          .from('fightor')
          .update({ status: 'approve' })
          .eq('id', selectedBill.id)
          .select();

        console.log('Fightor update result:', { fightorData, fightorError });

        if (fightorError) {
          console.error('Supabase update error (fightor):', fightorError);
          throw fightorError;
        }

        if (!fightorData || fightorData.length === 0) {
          throw new Error('Bill not found in either spartan or fightor table');
        }
      }

      if (spartanError && !spartanData) {
        console.error('Supabase update error (spartan):', spartanError);
        throw spartanError;
      }

      console.log('Bill approved successfully');

      // Move bill from pending to verified
      setPendingBills(pendingBills.filter((b) => b.id !== selectedBill.id));
      setVerifiedBills([...verifiedBills, { ...selectedBill, status: 'approve' }]);

      showSuccess(`Bill ${selectedBill.bill_number} has been approved`);
      setIsApproveBillDialogOpen(false);
      setSelectedBill(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve bill';
      showError(`Failed to approve bill: ${errorMessage}`);
      console.error('Error approving bill:', error);
    } finally {
      setBillProcessingId(null);
    }
  };

  const handleRejectBill = (bill: BillForApproval) => {
    setSelectedBill(bill);
    setBillRejectionReason('');
    setIsRejectBillDialogOpen(true);
  };

  const confirmRejectBill = async () => {
    if (!selectedBill) return;

    if (!billRejectionReason.trim()) {
      showError('Please provide a reason for rejection');
      return;
    }

    try {
      setBillProcessingId(selectedBill.id);
      console.log('Attempting to reject bill:', selectedBill.id, selectedBill.bill_number);

      // Update bill status to 'reject' with reason
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .update({ 
          status: 'reject',
          rejection_reason: billRejectionReason 
        })
        .eq('id', selectedBill.id)
        .select();

      console.log('Spartan update result:', { spartanData, spartanError });

      // If error or no data returned, try fightor
      if (spartanError || !spartanData || spartanData.length === 0) {
        console.log('Bill not found in spartan, trying fightor...');
        const { data: fightorData, error: fightorError } = await supabase
          .from('fightor')
          .update({ 
            status: 'reject',
            rejection_reason: billRejectionReason 
          })
          .eq('id', selectedBill.id)
          .select();

        console.log('Fightor update result:', { fightorData, fightorError });

        if (fightorError) {
          console.error('Supabase update error (fightor):', fightorError);
          throw fightorError;
        }

        if (!fightorData || fightorData.length === 0) {
          throw new Error('Bill not found in either spartan or fightor table');
        }
      }

      if (spartanError && !spartanData) {
        console.error('Supabase update error (spartan):', spartanError);
        throw spartanError;
      }

      console.log('Bill rejected successfully');

      // Move bill from pending to rejected
      setPendingBills(pendingBills.filter((b) => b.id !== selectedBill.id));
      setRejectedBills([...rejectedBills, { ...selectedBill, status: 'reject' }]);

      showSuccess(`Bill ${selectedBill.bill_number} has been rejected`);
      setIsRejectBillDialogOpen(false);
      setSelectedBill(null);
      setBillRejectionReason('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject bill';
      showError(`Failed to reject bill: ${errorMessage}`);
      console.error('Error rejecting bill:', error);
    } finally {
      setBillProcessingId(null);
    }
  };

  const handleReleaseBill = async (bill: BillForApproval) => {
    try {
      setBillProcessingId(bill.id);
      console.log('Attempting to release rejected bill:', bill.id, bill.bill_number);

      // Update bill status back to null (pending) and clear rejection reason
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .update({ 
          status: null,
          rejection_reason: null
        })
        .eq('id', bill.id)
        .select();

      console.log('Spartan update result:', { spartanData, spartanError });

      // If error or no data returned, try fightor
      if (spartanError || !spartanData || spartanData.length === 0) {
        console.log('Bill not found in spartan, trying fightor...');
        const { data: fightorData, error: fightorError } = await supabase
          .from('fightor')
          .update({ 
            status: null,
            rejection_reason: null
          })
          .eq('id', bill.id)
          .select();

        console.log('Fightor update result:', { fightorData, fightorError });

        if (fightorError) {
          console.error('Supabase update error (fightor):', fightorError);
          throw fightorError;
        }

        if (!fightorData || fightorData.length === 0) {
          throw new Error('Bill not found in either spartan or fightor table');
        }
      }

      if (spartanError && !spartanData) {
        console.error('Supabase update error (spartan):', spartanError);
        throw spartanError;
      }

      console.log('Bill released successfully');

      // Move bill from rejected back to pending
      setRejectedBills(rejectedBills.filter((b) => b.id !== bill.id));
      setPendingBills([...pendingBills, { ...bill, status: null, rejection_reason: undefined }]);

      showSuccess(`Bill ${bill.bill_number} has been released back to pending`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to release bill';
      showError(`Failed to release bill: ${errorMessage}`);
      console.error('Error releasing bill:', error);
    } finally {
      setBillProcessingId(null);
    }
  };

  const handleReleasePayment = async (payment: PaymentApproval) => {
    try {
      setProcessingId(payment.id);
      console.log('Attempting to release rejected payment:', payment.id);

      // Update payment status back to pending_approval
      const { data, error } = await supabase
        .from('payment_received')
        .update({ 
          status: 'pending_approval'
        })
        .eq('id', payment.id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      console.log('Payment released successfully:', data);

      // Refresh payments from database
      await fetchPendingPayments();

      showSuccess('Payment has been released back to pending');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to release payment';
      showError(`Failed to release payment: ${errorMessage}`);
      console.error('Error releasing payment:', error);
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-200 rounded-lg transition"
                title="Go Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Accounts Dashboard</h1>
                <p className="text-gray-600 text-sm mt-1">Review and approve pending payments & bills</p>
              </div>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="icon"
              className="text-black hover:text-black"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">Pending Payments</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-green-600">{approvedPayments.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">Approved Payments</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-red-600">{rejectedPayments.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">Rejected Payments</p>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingBills.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">Pending Bills</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-green-600">{verifiedBills.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">Approved Bills</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-red-600">{rejectedBills.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">Rejected Bills</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pending Section - 50/50 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pending Payments */}
          <div className="flex flex-col">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-600" />
              Pending Payments ({pendingPayments.length})
            </h3>
            <div className="flex flex-col border border-gray-200 rounded-lg bg-white">
              {/* Header Row */}
              <div className="bg-yellow-50 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-0">
                <div className="col-span-2">Dealer</div>
                <div className="col-span-2">Name</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">Method</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2 text-center">Actions</div>
              </div>

              {/* Pending Payments List */}
              <div className="space-y-0 overflow-y-auto max-h-52 divide-y">
                {pendingPayments.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No pending payments</div>
                ) : (
                  pendingPayments.map((payment) => (
                    <div key={payment.id} className="p-3 hover:bg-yellow-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-2">
                        <p className="font-bold text-yellow-600">{payment.dealer_name}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-700 truncate">{payment.sales_person_name}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-bold text-green-600">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600 capitalize">{payment.payment_method}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500">{formatDate(payment.payment_date)}</p>
                      </div>
                      <div className="col-span-2 flex gap-1 justify-center">
                        <Button
                          size="sm"
                          onClick={() => handleApprovePayment(payment.id)}
                          className="px-2 py-1 h-6 text-xs bg-green-600 hover:bg-green-700"
                          disabled={processingId === payment.id}
                        >
                          {processingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPaymentId(payment.id);
                            setShowRejectionDialog(true);
                          }}
                          className="px-2 py-1 h-6 text-xs bg-red-600 hover:bg-red-700"
                          disabled={processingId === payment.id}
                        >
                          {processingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pending Bills */}
          <div className="flex flex-col">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Pending Bills ({pendingBills.length})
            </h3>
            <div className="flex flex-col border border-gray-200 rounded-lg bg-white">
              {/* Header Row */}
              <div className="bg-yellow-50 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-0">
                <div className="col-span-2">Bill #</div>
                <div className="col-span-2">Company</div>
                <div className="col-span-2.5">Dealer</div>
                <div className="col-span-1.5">Date</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-2 text-center">Actions</div>
              </div>

              {/* Pending Bills List */}
              <div className="space-y-0 overflow-y-auto max-h-52 divide-y">
                {pendingBills.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No pending bills to verify</div>
                ) : (
                  pendingBills.map((bill) => (
                    <div key={bill.id} className="p-3 hover:bg-yellow-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-2">
                        <p className="font-mono font-bold text-yellow-600">#{bill.bill_number}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-700 truncate">{bill.companies?.name || 'N/A'}</p>
                      </div>
                      <div className="col-span-2.5">
                        <p className="text-gray-700 truncate">{bill.dealers?.name || 'N/A'}</p>
                      </div>
                      <div className="col-span-1.5">
                        <p className="text-gray-500 text-xs">{format(new Date(bill.bill_date), 'MMM dd')}</p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-bold text-green-600">₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="col-span-2 flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedOrderForPrint(bill.order_id || bill.id);
                              setIsPrintDialogOpen(true);
                            }}
                            className="px-1.5 py-1 h-6"
                            title="Print/Download Bill PDF"
                          >
                            <Printer className="h-3 w-3 text-green-600" />
                          </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveBill(bill)}
                          className="px-2 py-1 h-6 text-xs bg-green-600 hover:bg-green-700"
                          disabled={billProcessingId === bill.id}
                          title="Approve Bill"
                        >
                          {billProcessingId === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRejectBill(bill)}
                          className="px-2 py-1 h-6 text-xs bg-red-600 hover:bg-red-700"
                          disabled={billProcessingId === bill.id}
                          title="Reject Bill"
                        >
                          {billProcessingId === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Approved Section - 50/50 Split */}
        {(approvedPayments.length > 0 || verifiedBills.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Approved Payments */}
            <div className="flex flex-col">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Approved Payments ({approvedPayments.length})
              </h3>
              <div className="flex flex-col border border-gray-200 rounded-lg bg-white">
                {/* Header Row */}
                <div className="bg-green-50 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-0">
                  <div className="col-span-2">Dealer</div>
                  <div className="col-span-2">Name</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Method</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2 text-center">Status</div>
                </div>

                {/* Approved Payments List */}
                <div className="space-y-0 overflow-y-auto max-h-52 divide-y">
                  {approvedPayments.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No approved payments</div>
                  ) : (
                    approvedPayments.map((payment) => (
                      <div key={payment.id} className="p-3 hover:bg-green-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-2">
                          <p className="font-bold text-green-600">{payment.dealer_name}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-700 truncate">{payment.sales_person_name}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="font-bold text-green-600">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-600 capitalize">{payment.payment_method}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">{formatDate(payment.payment_date)}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-semibold inline-block">✓ Approved</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Approved Bills */}
            <div className="flex flex-col">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Approved Bills ({verifiedBills.length})
              </h3>
              <div className="flex flex-col border border-gray-200 rounded-lg bg-white">
                {/* Header Row */}
                <div className="bg-green-50 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-0">
                  <div className="col-span-2">Bill #</div>
                  <div className="col-span-2">Company</div>
                  <div className="col-span-2">Dealer</div>
                  <div className="col-span-1.5">Date</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1.5 text-center">Status</div>
                  <div className="col-span-1 text-center">Actions</div>
                </div>

                {/* Approved Bills List */}
                <div className="space-y-0 overflow-y-auto max-h-52 divide-y">
                  {verifiedBills.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No approved bills</div>
                  ) : (
                    verifiedBills.map((bill) => (
                      <div key={bill.id} className="p-3 hover:bg-green-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-2">
                          <p className="font-mono font-bold text-green-600">#{bill.bill_number}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-700 truncate">{bill.companies?.name || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-700 truncate">{bill.dealers?.name || 'N/A'}</p>
                        </div>
                        <div className="col-span-1.5">
                          <p className="text-gray-500 text-xs">{format(new Date(bill.bill_date), 'MMM dd')}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="font-bold text-green-600">₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="col-span-1.5 text-center">
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-semibold inline-block">✓ Verified</span>
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            onClick={() => {
                              setSelectedOrderForPrint(bill.order_id || '');
                              setIsPrintDialogOpen(true);
                            }}
                            className="p-1.5 hover:bg-green-200 rounded transition-colors"
                            title="Print Bill"
                          >
                            <Printer className="h-4 w-4 text-green-600" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rejected Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rejected Payments */}
            <div className="flex flex-col">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <X className="h-5 w-5 text-red-600" />
                Rejected Payments ({rejectedPayments.length})
              </h3>
              <div className="flex flex-col border border-gray-200 rounded-lg bg-white overflow-x-auto max-h-80">
                {/* Header Row */}
                <div className="bg-red-50 p-3 flex gap-4 font-semibold text-xs text-gray-700 border-b sticky top-0 whitespace-nowrap">
                  <div className="w-32">Dealer</div>
                  <div className="w-24">Name</div>
                  <div className="w-28">Amount</div>
                  <div className="w-24">Method</div>
                  <div className="w-28">Date</div>
                  <div className="w-24 text-center">Status</div>
                  <div className="w-24 text-center">Actions</div>
                </div>

                {/* Rejected Payments List */}
                <div className="space-y-0 divide-y overflow-y-auto">
                  {rejectedPayments.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No rejected payments</div>
                  ) : (
                    rejectedPayments.map((payment) => (
                      <div key={payment.id} className="p-3 hover:bg-red-50 transition-colors flex gap-4 items-center text-xs whitespace-nowrap">
                        <div className="w-32">
                          <p className="font-bold text-red-600 truncate">{payment.dealer_name}</p>
                        </div>
                        <div className="w-24">
                          <p className="text-gray-700 truncate">{payment.sales_person_name}</p>
                        </div>
                        <div className="w-28">
                          <p className="font-bold text-red-600">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="w-24">
                          <p className="text-gray-600 capitalize">{payment.payment_method}</p>
                        </div>
                        <div className="w-28">
                          <p className="text-gray-500">{formatDate(payment.payment_date)}</p>
                        </div>
                        <div className="w-24 text-center">
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-semibold inline-block">✗ Rejected</span>
                        </div>
                        <div className="w-24 text-center flex-shrink-0">
                          <Button
                            onClick={() => handleReleasePayment(payment)}
                            disabled={processingId === payment.id}
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-7 px-2 whitespace-nowrap"
                            title="Release this payment back to pending status"
                          >
                            {processingId === payment.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <ArrowLeft className="h-3 w-3 mr-1" />
                                Release
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Rejected Bills */}
            <div className="flex flex-col">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <X className="h-5 w-5 text-red-600" />
                Rejected Bills ({rejectedBills.length})
              </h3>
              <div className="flex flex-col border border-gray-200 rounded-lg bg-white overflow-x-auto max-h-80">
                {/* Header Row */}
                <div className="bg-red-50 p-3 flex gap-4 font-semibold text-xs text-gray-700 border-b sticky top-0 whitespace-nowrap">
                  <div className="w-24">Bill #</div>
                  <div className="w-32">Company</div>
                  <div className="w-28">Dealer</div>
                  <div className="w-20">Date</div>
                  <div className="w-28 text-right">Amount</div>
                  <div className="w-40">Reason</div>
                  <div className="w-24 text-center">Status</div>
                </div>

                {/* Rejected Bills List */}
                <div className="space-y-0 divide-y overflow-y-auto">
                  {rejectedBills.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No rejected bills</div>
                  ) : (
                    rejectedBills.map((bill) => (
                      <div key={bill.id} className="p-3 hover:bg-red-50 transition-colors flex gap-4 items-center text-xs whitespace-nowrap">
                        <div className="w-24">
                          <p className="font-mono font-bold text-red-600">#{bill.bill_number}</p>
                        </div>
                        <div className="w-32">
                          <p className="text-gray-700 truncate">{bill.companies?.name || 'N/A'}</p>
                        </div>
                        <div className="w-28">
                          <p className="text-gray-700 truncate">{bill.dealers?.name || 'N/A'}</p>
                        </div>
                        <div className="w-20">
                          <p className="text-gray-500 text-xs">{format(new Date(bill.bill_date), 'MMM dd')}</p>
                        </div>
                        <div className="w-28 text-right">
                          <p className="font-bold text-red-600">₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="w-40">
                          <p className="text-gray-600 text-xs break-words">
                            {bill.rejection_reason 
                              ? (() => {
                                  // Remove company IDs, company names, and status from reason
                                  let reason = bill.rejection_reason;
                                  reason = reason.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, ''); // Remove UUIDs
                                  reason = reason.replace(/Metro Sports Industries|Fightor|Spartan/gi, ''); // Remove company names
                                  reason = reason.replace(/company_id:|Company:|status:|Status:/gi, ''); // Remove company and status labels
                                  reason = reason.replace(/reject|rejected|approve|approved|pending|null/gi, ''); // Remove status values
                                  reason = reason.replace(/^\s*[-–:,;]\s*/, '').trim(); // Remove leading separators
                                  reason = reason.replace(/\s+/g, ' ').trim(); // Clean up multiple spaces
                                  return reason || bill.rejection_reason;
                                })()
                              : 'N/A'
                            }
                          </p>
                        </div>
                        <div className="w-24 text-center">
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-semibold inline-block">✗ Rejected</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>



      {/* Approve Bill Confirmation Dialog */}
      <Dialog open={isApproveBillDialogOpen} onOpenChange={setIsApproveBillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Bill</DialogTitle>
            <DialogDescription>Confirm approval of Bill #{selectedBill?.bill_number}</DialogDescription>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-900/30 rounded">
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Bill Number</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBill.bill_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Amount</Label>
                  <p className="font-bold text-green-600 dark:text-green-400 text-sm mt-1">₹{selectedBill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200">✓ This bill will be marked as approved.</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsApproveBillDialogOpen(false);
                setSelectedBill(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApproveBill}
              disabled={billProcessingId !== null}
              className="bg-green-600 hover:bg-green-700 text-white flex-1"
            >
              {billProcessingId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Approve Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Bill Dialog */}
      <Dialog open={isRejectBillDialogOpen} onOpenChange={setIsRejectBillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Bill</DialogTitle>
            <DialogDescription>Provide a reason for rejecting Bill #{selectedBill?.bill_number}</DialogDescription>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">⚠ This bill will be marked as rejected.</p>
              </div>

              <Textarea
                placeholder="Enter rejection reason..."
                value={billRejectionReason}
                onChange={(e) => setBillRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectBillDialogOpen(false);
                setSelectedBill(null);
                setBillRejectionReason('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRejectBill}
              disabled={!billRejectionReason.trim() || billProcessingId !== null}
              variant="destructive"
              className="flex-1"
            >
              {billProcessingId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this payment</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejection-reason" className="text-sm font-medium">
                Reason for Rejection
              </Label>
              <textarea
                id="rejection-reason"
                placeholder="Enter reason for rejecting this payment..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full mt-2 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectionDialog(false);
                setRejectionReason('');
                setSelectedPaymentId(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectPayment}
              disabled={!rejectionReason.trim() || processingId !== null}
              variant="destructive"
              className="flex-1"
            >
              {processingId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Bill Dialog - Using PrintBillDialog Component */}
      {selectedOrderForPrint && (
        <PrintBillDialog
          isOpen={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          orderId={selectedOrderForPrint}
        />
      )}

      <MadeWithDyad />
    </div>
  );
};

export default AccountsDashboard;
