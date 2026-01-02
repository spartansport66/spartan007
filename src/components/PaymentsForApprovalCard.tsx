"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

interface PaymentForApproval {
  id: string; // Payment ID
  order_id: string;
  order_number: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  dealer_name: string;
  dealer_id: string;
}

interface PaymentsForApprovalCardProps {
  onPaymentAction: () => void; // Callback to refresh parent data
}

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const APPROVE_PAYMENT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/approve-payment";

const PaymentsForApprovalCard: React.FC<PaymentsForApprovalCardProps> = ({ onPaymentAction }) => {
  const [payments, setPayments] = useState<PaymentForApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const fetchPaymentsForApproval = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          amount,
          payment_method,
          payment_date,
          orders (
            order_number,
            dealers (id, name)
          )
        `)
        .eq('status', 'pending_approval')
        .order('payment_date', { ascending: true });

      if (error) throw error;

      const formattedPayments: PaymentForApproval[] = (data || []).map((payment: any) => ({
        id: payment.id,
        order_id: payment.order_id,
        order_number: payment.orders?.order_number || 'N/A',
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_date: payment.payment_date,
        dealer_name: payment.orders?.dealers?.name || 'N/A',
        dealer_id: payment.orders?.dealers?.id || '',
      }));

      setPayments(formattedPayments);
    } catch (error: any) {
      console.error('Error fetching payments for approval:', error.message);
      showError('Failed to load payments for approval.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentsForApproval();
  }, [fetchPaymentsForApproval]);

  const handlePaymentAction = async (paymentId: string, orderId: string, dealerId: string, amount: number, action: 'approve' | 'reject') => {
    setIsSubmitting(true);
    try {
      const response = await fetch(APPROVE_PAYMENT_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          orderId,
          dealerId,
          amount,
          action,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} payment`);
      }

      showSuccess(`Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      fetchPaymentsForApproval(); // Refresh the list
      onPaymentAction(); // Notify parent to refresh dashboard data (e.g., payment overview)
    } catch (error: any) {
      console.error(`Error ${action}ing payment:`, error);
      showError(`Failed to ${action} payment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-yellow-500 dark:bg-yellow-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Payments Pending Approval</CardTitle>
        <CardDescription className="text-yellow-100 dark:text-yellow-200">
          Review and approve or reject payments submitted by salespersons.
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
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Method</TableHead>
                    <TableHead className="text-muted-foreground">Date Submitted</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">#{payment.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.payment_method}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleViewOrderDetails(payment.order_id)}
                            title="View Payment Details"
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Approve Payment" disabled={isSubmitting}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to approve the payment of ₹{payment.amount.toFixed(2)} for Order #{payment.order_number} from {payment.dealer_name}? This will mark the order as paid and update the dealer's credit.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handlePaymentAction(payment.id, payment.order_id, payment.dealer_id, payment.amount, 'approve')} 
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Approve'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Reject Payment" disabled={isSubmitting}>
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
                                <AlertDialogAction 
                                  onClick={() => handlePaymentAction(payment.id, payment.order_id, payment.dealer_id, payment.amount, 'reject')} 
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reject'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
    </Card>
  );
};

export default PaymentsForApprovalCard;