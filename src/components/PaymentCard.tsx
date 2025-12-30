"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  order_number: number; // From orders table
  dealer_name: string; // From dealers table via orders
}

interface DealerOption {
  value: string;
  label: string;
}

const PaymentCard: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);

  // Filter states
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const paymentMethods = ['Cash', 'Card', 'Bank Transfer', 'UPI']; // Example methods
  const paymentStatuses = ['completed', 'pending', 'failed']; // Example statuses

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
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_method,
          status,
          orders (
            id,
            order_number,
            dealers (name)
          )
        `)
        .order('payment_date', { ascending: false });

      // Apply filters
      if (filterOrderNumber) {
        query = query.eq('orders.order_number', parseInt(filterOrderNumber));
      }
      if (filterDealerId) {
        query = query.eq('orders.dealer_id', filterDealerId);
      }
      if (filterPaymentMethod) {
        query = query.eq('payment_method', filterPaymentMethod);
      }
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('payment_date', startOfDay);
      }
      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('payment_date', endOfDay);
      }

      const { data: paymentsData, error: paymentsError } = await query;

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError.message);
        showError('Failed to load payments.');
        setPayments([]);
      } else {
        const formattedPayments: Payment[] = (paymentsData || []).map((payment: any) => ({
          id: payment.id,
          order_id: payment.orders?.id || 'N/A',
          amount: payment.amount,
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          status: payment.status,
          order_number: payment.orders?.order_number || 'N/A',
          dealer_name: payment.orders?.dealers?.name || 'N/A',
        }));
        setPayments(formattedPayments);
      }
    } catch (error: any) {
      console.error('Error in fetchPaymentsAndDealers:', error.message);
      showError('An unexpected error occurred while fetching payments.');
    } finally {
      setLoading(false);
    }
  }, [filterOrderNumber, filterDealerId, filterPaymentMethod, filterStatus, filterFromDate, filterToDate]);

  useEffect(() => {
    fetchPaymentsAndDealers();
  }, [fetchPaymentsAndDealers]);

  const handleClearFilters = () => {
    setFilterOrderNumber('');
    setFilterDealerId('');
    setFilterPaymentMethod('');
    setFilterStatus('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Payment Transactions</CardTitle>
        <CardDescription className="text-muted-foreground">
          View and filter all payment records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <div>
            <Label htmlFor="filterOrderNumber">Order Number</Label>
            <Input
              id="filterOrderNumber"
              type="number"
              placeholder="Filter by order no."
              value={filterOrderNumber}
              onChange={(e) => setFilterOrderNumber(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="filterDealer">Dealer Name</Label>
            <Select 
              value={filterDealerId || "all"}
              onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}
            >
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
          <div>
            <Label htmlFor="filterPaymentMethod">Payment Method</Label>
            <Select 
              value={filterPaymentMethod || "all"}
              onValueChange={(value) => setFilterPaymentMethod(value === "all" ? "" : value)}
            >
              <SelectTrigger id="filterPaymentMethod" className="w-full">
                <SelectValue placeholder="Filter by method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filterStatus">Status</Label>
            <Select 
              value={filterStatus || "all"}
              onValueChange={(value) => setFilterStatus(value === "all" ? "" : value)}
            >
              <SelectTrigger id="filterStatus" className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {paymentStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filterFromDate">From Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="filterToDate">To Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-end gap-2 col-span-full lg:col-span-1 xl:col-span-2">
            <Button onClick={fetchPaymentsAndDealers} className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
              Clear Filters
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Method</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Payment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{payment.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.payment_method}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.status}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentCard;