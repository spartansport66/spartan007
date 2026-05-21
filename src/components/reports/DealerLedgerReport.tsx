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
import { Loader2, Download, TrendingDown, TrendingUp, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Dealer {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
}

interface DealerBalance {
  dealer_id: string;
  dealer_name: string;
  opening_balance: number;
  total_orders: number;
  total_payments: number;
  closing_balance: number;
}

interface DealerLedgerEntry {
  date: string;
  type: 'order' | 'payment';
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
}

const DealerLedgerReport = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [ledgerData, setLedgerData] = useState<DealerLedgerEntry[]>([]);
  const [dealerBalance, setDealerBalance] = useState<DealerBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);


  // Fetch dealers
  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const { data, error } = await supabase
          .from('dealers')
          .select('id, name, contact_person, phone')
          .order('name', { ascending: true });

        if (error) throw error;
        setDealers(data || []);
        if (data && data.length > 0) {
          setSelectedDealerId(data[0].id);
        }
      } catch (error: any) {
        showError(`Failed to load dealers: ${error.message}`);
      }
    };

    fetchDealers();
  }, []);

  // Fetch ledger data
  const fetchLedgerData = async () => {
    if (!selectedDealerId) return;

    setLoading(true);
    try {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch orders for the dealer
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, order_date, total_amount, bill_no')
        .eq('dealer_id', selectedDealerId)
        .gte('order_date', startOfDay.toISOString())
        .lte('order_date', endOfDay.toISOString())
        .order('order_date', { ascending: false });

      // Fetch payments for the dealer
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, payment_date, amount, transaction_reference')
        .eq('dealer_id', selectedDealerId)
        .eq('approval_status', 'approved')
        .gte('payment_date', startOfDay.toISOString())
        .lte('payment_date', endOfDay.toISOString())
        .order('payment_date', { ascending: false });

      if (ordersError || paymentsError) throw new Error('Failed to fetch ledger data');

      // Combine and sort by date
      const entries: DealerLedgerEntry[] = [];
      let runningBalance = 0;

      // Add orders
      (ordersData || []).forEach((order: any) => {
        entries.push({
          date: order.order_date,
          type: 'order',
          description: `Order #${order.order_number} - ${order.bill_no || 'Pending Bill'}`,
          debit: order.total_amount,
          credit: 0,
          balance: 0,
          reference: order.id,
        });
      });

      // Add payments
      (paymentsData || []).forEach((payment: any) => {
        entries.push({
          date: payment.payment_date,
          type: 'payment',
          description: `Payment Received - ${payment.transaction_reference || 'No Reference'}`,
          debit: 0,
          credit: payment.amount,
          balance: 0,
          reference: payment.id,
        });
      });

      // Sort by date and calculate running balance
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      entries.forEach((entry) => {
        runningBalance += entry.debit - entry.credit;
        entry.balance = runningBalance;
      });

      setLedgerData(entries);

      // Calculate dealer balance summary
      const totalOrders = (ordersData || []).reduce((sum: number, o: any) => sum + o.total_amount, 0);
      const totalPayments = (paymentsData || []).reduce((sum: number, p: any) => sum + p.amount, 0);

      const dealerName = dealers.find((d) => d.id === selectedDealerId)?.name || 'Unknown';

      setDealerBalance({
        dealer_id: selectedDealerId,
        dealer_name: dealerName,
        opening_balance: 0,
        total_orders: totalOrders,
        total_payments: totalPayments,
        closing_balance: totalOrders - totalPayments,
      });
    } catch (error: any) {
      showError(`Failed to load ledger data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!dealerBalance) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text('Dealer Ledger Report', 14, 15);

    // Dealer details
    doc.setFontSize(11);
    doc.text(`Dealer: ${dealerBalance.dealer_name}`, 14, 25);

    doc.setFontSize(10);
    doc.text(
      `From: ${new Date(startDate).toLocaleDateString()} To: ${new Date(endDate).toLocaleDateString()}`,
      14,
      32
    );

    // Summary
    doc.setFontSize(10);
    doc.text(`Total Orders (Debit): ${formatCurrency(dealerBalance.total_orders)}`, 14, 42);
    doc.text(`Total Payments (Credit): ${formatCurrency(dealerBalance.total_payments)}`, 14, 49);
    doc.text(`Closing Balance: ${formatCurrency(dealerBalance.closing_balance)}`, 14, 56);

    // Table
    const tableData = ledgerData.map((entry) => [
      new Date(entry.date).toLocaleDateString(),
      entry.type === 'order' ? 'Order' : 'Payment',
      entry.description,
      formatCurrency(entry.debit),
      formatCurrency(entry.credit),
      formatCurrency(entry.balance),
    ]);

    autoTable(doc, {
      head: [['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      startY: 65,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
      },
    });

    doc.save(`Dealer_Ledger_${dealerBalance.dealer_name}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Dealer Ledger Report</CardTitle>
            <CardDescription>View complete transaction history for dealers</CardDescription>
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
            {ledgerData.length > 0 && (
              <Button onClick={handleExportPDF} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        {showFilters && (
          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-end">
              <Button onClick={fetchLedgerData} className="w-full bg-primary hover:bg-primary/90">
                Load Ledger
              </Button>
            </div>
          </div>
        )}

        {/* Load Ledger button */}
        {!showFilters && (
          <div className="flex items-end">
            <Button onClick={fetchLedgerData} className="bg-primary hover:bg-primary/90">
              Load Ledger
            </Button>
          </div>
        )}

        {/* Summary Cards */}
        {dealerBalance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Total Orders (Debit)
                    </p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-200 mt-2">
                      {formatCurrency(dealerBalance.total_orders)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" /> Total Payments (Credit)
                    </p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">
                      {formatCurrency(dealerBalance.total_payments)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={dealerBalance.closing_balance > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm flex items-center gap-2 ${dealerBalance.closing_balance > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-blue-700 dark:text-blue-400'}`}>
                      Closing Balance
                    </p>
                    <p className={`text-2xl font-bold mt-2 ${dealerBalance.closing_balance > 0 ? 'text-orange-900 dark:text-orange-200' : 'text-blue-900 dark:text-blue-200'}`}>
                      {formatCurrency(dealerBalance.closing_balance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ledger Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-gray-600 dark:text-gray-400">Loading ledger...</p>
          </div>
        ) : ledgerData.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No transactions found for the selected period
          </div>
        ) : (
          <div className="overflow-y-auto max-h-96 border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerData.slice(0, 5).map((entry, index) => (
                  <TableRow key={index} className={entry.type === 'order' ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10'}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium capitalize">{entry.type}</TableCell>
                    <TableCell className="text-sm">{entry.description}</TableCell>
                    <TableCell className="font-semibold text-red-600 dark:text-red-400">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600 dark:text-green-400">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(entry.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {ledgerData.length > 5 && (
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Showing 5 of {ledgerData.length} ledger entries. Scroll to see more.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DealerLedgerReport;
