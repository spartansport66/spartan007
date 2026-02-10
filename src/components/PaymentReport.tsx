"use client";
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer } from 'lucide-react';
import { Payment } from '@/types';

interface PaymentReportProps {
  payments: Payment[];
  title: string;
  reportDate: string;
}

const PaymentReport: React.FC<PaymentReportProps> = ({ payments, title, reportDate }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `${title} - ${reportDate}`,
  });

  const renderTransactionDetails = (payment: Payment) => {
    switch (payment.payment_method) {
      case 'Cheque':
        return `Cheque No: ${payment.cheque_number || 'N/A'}`;
      case 'UPI':
        return `UPI ID: ${payment.upi_transaction_id || 'N/A'}`;
      case 'Bank Transfer':
        return `Bank Txn ID: ${payment.bank_transaction_id || 'N/A'}`;
      case 'Cash':
        return 'Paid in Cash';
      default:
        return 'N/A';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">Report for: {reportDate}</p>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={componentRef} className="p-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Payment Report</h1>
            <p className="text-muted-foreground">{reportDate}</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Transaction Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.student_name}</TableCell>
                    <TableCell>${payment.amount.toFixed(2)}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{payment.payment_method}</TableCell>
                    <TableCell>{renderTransactionDetails(payment)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No payments found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentReport;