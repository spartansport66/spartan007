"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, CheckCircle, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ApprovedPayment {
  id: string;
  dealer_id: string;
  dealer_name?: string;
  amount: number;
  payment_date: string;
  approval_date?: string;
  payment_method: string;
  transaction_reference?: string;
  approved_by_name?: string;
}

const ApprovedPaymentsReport = () => {
  const [payments, setPayments] = useState<ApprovedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<ApprovedPayment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchApprovedPayments = async () => {
    setLoading(true);
    try {
      // Simple query: status = 'approved' AND payment_date between startDate and endDate
      const { data, error } = await supabase
        .from('payments')
        .select(
          `
          id,
          dealer_id,
          amount,
          payment_date,
          approval_date,
          payment_method,
          transaction_reference,
          approved_by,
          dealers(name)
        `
        )
        .eq('status', 'approved')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((payment: any) => ({
        id: payment.id,
        dealer_id: payment.dealer_id,
        dealer_name: payment.dealers?.name || 'Unknown Dealer',
        amount: payment.amount,
        payment_date: payment.payment_date,
        approval_date: payment.approval_date || payment.payment_date,
        payment_method: payment.payment_method,
        transaction_reference: payment.transaction_reference,
        approved_by_name: payment.approved_by ? 'Approved' : 'System',
      }));

      setPayments(formattedData);
    } catch (error: any) {
      showError(`Failed to load approved payments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedPayments();
  }, [startDate, endDate]);

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text('Approved Payments Report', 14, 15);

    // Date range
    doc.setFontSize(10);
    doc.text(
      `From: ${new Date(startDate).toLocaleDateString()} To: ${new Date(endDate).toLocaleDateString()}`,
      14,
      25
    );

    // Summary
    doc.text(`Total Approved Payments: ${formatCurrency(totalAmount)}`, 14, 35);
    doc.text(`Number of Payments: ${payments.length}`, 14, 42);

    // Table
    const tableData = payments.map((payment) => [
      payment.dealer_name,
      formatCurrency(payment.amount),
      new Date(payment.payment_date).toLocaleDateString(),
      payment.payment_method,
      payment.transaction_reference || '-',
      payment.approved_by_name || '-',
    ]);

    autoTable(doc, {
      head: [['Dealer', 'Amount', 'Payment Date', 'Method', 'Reference', 'Approved By']],
      body: tableData,
      startY: 50,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
      },
    });

    doc.save(`Approved_Payments_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approved Payments Report
              </CardTitle>
              <CardDescription>View approved dealer payments (Today by default)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
              {payments.length > 0 && (
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Date Range Filter */}
        {showFilters && (
          <CardContent className="border-t pt-4 pb-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={fetchApprovedPayments}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent className={showFilters ? 'border-t pt-4' : ''}>
          {/* Summary Cards */}
          {payments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <p className="text-sm text-green-700 dark:text-green-400">Total Approved Amount</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">
                    {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <p className="text-sm text-blue-700 dark:text-blue-400">Total Payments</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">
                    {payments.length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Payments Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-gray-600 dark:text-gray-400">Loading approved payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No approved payments found for the selected date range
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96 border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <TableRow>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Entry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 5).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.dealer_name}</TableCell>
                      <TableCell className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-sm">{new Date(payment.approval_date || payment.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-semibold">
                          Approved
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{payment.approved_by_name}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setIsDetailsDialogOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {payments.length > 5 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
              Showing 5 of {payments.length} approved payments. Scroll to see more.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Dealer</p>
                  <p className="font-semibold text-lg">{selectedPayment.dealer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-lg text-green-600">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Payment Date</p>
                  <p className="font-semibold">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Payment Method</p>
                  <p className="font-semibold capitalize">{selectedPayment.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Approval Date</p>
                  <p className="font-semibold">
                    {selectedPayment.approval_date
                      ? new Date(selectedPayment.approval_date).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Approved By</p>
                  <p className="font-semibold">{selectedPayment.approved_by_name}</p>
                </div>
              </div>
              {selectedPayment.transaction_reference && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transaction Reference</p>
                  <p className="font-semibold">{selectedPayment.transaction_reference}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApprovedPaymentsReport;
