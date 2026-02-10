"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface PaymentDetails {
  id: string;
  order_id: string | null;
  order_number: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  cheque_dd_date: string | null;
  // Cheque/DD fields
  cheque_dd_no: string | null;
  // Card fields
  card_number: string | null;
  card_holder_name: string | null;
  expiry_date: string | null;
  cvv: string | null;
  // Bank Transfer fields
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  // UPI fields
  upi_id: string | null;
  transaction_id: string | null;
}

interface PaymentDetailsDialogProps {
  paymentId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const PaymentDetailsDialog: React.FC<PaymentDetailsDialogProps> = ({ paymentId, isOpen, onOpenChange }) => {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      if (!isOpen || !paymentId) {
        setPaymentDetails(null);
        return;
      }

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
            status,
            cheque_dd_date,
            cheque_dd_no,
            card_number,
            card_holder_name,
            expiry_date,
            cvv,
            bank_name,
            account_number,
            ifsc_code,
            upi_id,
            transaction_id,
            orders (order_number)
          `)
          .eq('id', paymentId)
          .single();

        if (error) throw error;

        setPaymentDetails({
          id: data.id,
          order_id: data.order_id,
          order_number: (data.orders as any)?.order_number || 0,
          amount: data.amount,
          payment_method: data.payment_method,
          payment_date: data.payment_date,
          status: data.status,
          cheque_dd_date: data.cheque_dd_date,
          cheque_dd_no: data.cheque_dd_no,
          card_number: data.card_number,
          card_holder_name: data.card_holder_name,
          expiry_date: data.expiry_date,
          cvv: data.cvv,
          bank_name: data.bank_name,
          account_number: data.account_number,
          ifsc_code: data.ifsc_code,
          upi_id: data.upi_id,
          transaction_id: data.transaction_id,
        });
      } catch (error: any) {
        console.error('Error fetching payment details:', error.message);
        showError(`Failed to load payment details: ${error.message}`);
        setPaymentDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentDetails();
  }, [isOpen, paymentId]);

  const renderPaymentDetails = () => {
    if (!paymentDetails) return null;

    // Check if payment is post-dated
    const isPostDated = paymentDetails.payment_method === 'Cheque/DD' && paymentDetails.cheque_dd_date;
    const isDue = isPostDated ? (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(paymentDetails.cheque_dd_date!);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate <= today;
    })() : true;

    return (
      <div className="space-y-4">
        {isPostDated && !isDue && (
          <div className="p-3 bg-yellow-100 text-yellow-800 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Post-dated Payment</p>
              <p>This payment is scheduled for {new Date(paymentDetails.cheque_dd_date!).toLocaleDateString()}.</p>
              <p>It can only be approved on or after that date.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold">Payment Information</h3>
            <div className="mt-2 space-y-2">
              <p><span className="font-medium">Reference:</span> {paymentDetails.order_number === 0 ? 'General Balance' : `Order #${paymentDetails.order_number}`}</p>
              <p><span className="font-medium">Payment Method:</span> {paymentDetails.payment_method}</p>
              <p><span className="font-medium">Amount:</span> ₹{paymentDetails.amount.toFixed(2)}</p>
              <p><span className="font-medium">Payment Date:</span> {new Date(paymentDetails.payment_date).toLocaleDateString()}</p>
              <p><span className="font-medium">Status:</span> <span className="capitalize">{paymentDetails.status.replace('_', ' ')}</span></p>
              {isPostDated && (
                <p className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Due Date:</span> {new Date(paymentDetails.cheque_dd_date!).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Transaction Details</h3>
            <div className="mt-2 space-y-2">
              {paymentDetails.transaction_id && (
                <p><span className="font-medium">Transaction ID:</span> {paymentDetails.transaction_id}</p>
              )}
              {paymentDetails.upi_id && (
                <p><span className="font-medium">UPI ID:</span> {paymentDetails.upi_id}</p>
              )}
              {(!paymentDetails.transaction_id && !paymentDetails.upi_id) && (
                <p><span className="font-medium">Transaction ID:</span> N/A</p>
              )}
            </div>
          </div>
        </div>

        {paymentDetails.payment_method === 'Cheque/DD' && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold">Cheque/DD Details</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-medium">Cheque/DD Number:</span> {paymentDetails.cheque_dd_no || 'N/A'}</p>
              <p className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Cheque/DD Date:</span> {paymentDetails.cheque_dd_date ? new Date(paymentDetails.cheque_dd_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {paymentDetails.payment_method === 'Card' && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold">Card Details</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-medium">Card Number:</span> {paymentDetails.card_number ? `**** **** **** ${paymentDetails.card_number.slice(-4)}` : 'N/A'}</p>
              <p><span className="font-medium">Card Holder:</span> {paymentDetails.card_holder_name || 'N/A'}</p>
              <p><span className="font-medium">Expiry Date:</span> {paymentDetails.expiry_date || 'N/A'}</p>
            </div>
          </div>
        )}

        {paymentDetails.payment_method === 'Bank Transfer' && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold">Bank Transfer Details</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-medium">Bank Name:</span> {paymentDetails.bank_name || 'N/A'}</p>
              <p><span className="font-medium">Account Number:</span> {paymentDetails.account_number ? `****${paymentDetails.account_number.slice(-4)}` : 'N/A'}</p>
              <p><span className="font-medium">IFSC Code:</span> {paymentDetails.ifsc_code || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            View the complete payment information.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payment details...</p>
          </div>
        ) : paymentDetails ? (
          <div className="py-4">
            {renderPaymentDetails()}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No payment details found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDetailsDialog;