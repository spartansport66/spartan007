"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Eye, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import PaymentDetailsDialog from '@/components/PaymentDetailsDialog';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  order_number: number | null;
  dealer_name: string;
}

interface DealerPaymentsReceivedDialogProps {
  dealerId: string | null;
  dealerName: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealerPaymentsReceivedDialog: React.FC<DealerPaymentsReceivedDialogProps> = ({ dealerId, dealerName, isOpen, onOpenChange }) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedPaymentIdForDetails, setSelectedPaymentIdForDetails] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!dealerId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch all completed payments associated with this dealer (via dealer_id column)
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id, amount, payment_date, payment_method, status,
          orders (order_number),
          dealers (name)
        `)
        .eq('dealer_id', dealerId)
        .eq('status', 'completed')
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const formattedPayments: PaymentRecord[] = (data || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        status: p.status,
        order_number: (p.orders as any)?.order_number || 0, // 0 for general payments
        dealer_name: (p.dealers as any)?.name || dealerName || 'N/A',
      }));

      setPayments(formattedPayments);
    } catch (error: any) {
      console.error('Error fetching dealer payments:', error.message);
      showError(`Failed to load payments: ${error.message}`);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [dealerId, dealerName]);

  useEffect(() => {
    if (isOpen) {
      fetchPayments();
    }
  }, [isOpen, fetchPayments]);

  const handleViewDetails = (paymentId: string) => {
    setSelectedPaymentIdForDetails(paymentId);
    setIsPaymentDetailsDialogOpen(true);
  };

  const handlePrint = () => {
    if (payments.length === 0) {
      showError('No payments to print.');
      return;
    }
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Payments Received - ${dealerName || 'Dealer'}`, 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);

      const tableColumn = ["Date", "Order No.", "Method", "Amount (₹)"];
      const tableRows = payments.map(p => [
        new Date(p.payment_date).toLocaleDateString(),
        p.order_number === 0 ? 'General' : `#${p.order_number}`,
        p.payment_method,
        p.amount.toFixed(2),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
        margin: { top: 25 },
      });

      doc.save(`payments_received_${dealerName?.replace(/\s/g, '_')}.pdf`);
      showSuccess('Payments report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Payments Received for {dealerName}</DialogTitle>
            <DialogDescription>
              List of all completed payments recorded for this dealer.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-lg text-foreground">Loading payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No completed payments found for this dealer.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground font-bold">Date</TableHead>
                      <TableHead className="text-muted-foreground font-bold">Order No.</TableHead>
                      <TableHead className="text-muted-foreground font-bold">Method</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-right">Amount (₹)</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-center">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-foreground">{payment.order_number === 0 ? 'General Balance' : `#${payment.order_number}`}</TableCell>
                        <TableCell className="text-foreground">{payment.payment_method}</TableCell>
                        <TableCell className="text-foreground text-right font-medium">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleViewDetails(payment.id)}
                            title="View Payment Details"
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
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
      </Dialog>
      
      {selectedPaymentIdForDetails && (
        <PaymentDetailsDialog
          paymentId={selectedPaymentIdForDetails}
          isOpen={isPaymentDetailsDialogOpen}
          onOpenChange={setIsPaymentDetailsDialogOpen}
        />
      )}
    </>
  );
};