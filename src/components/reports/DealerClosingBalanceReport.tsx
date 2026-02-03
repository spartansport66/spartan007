"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Label } from '@/components/ui/label';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface DealerBalance {
  dealer_id: string;
  dealer_name: string;
  opening_balance: number;
  total_order_value: number;
  total_received: number;
  net_balance: number;
}

interface DealerOption {
  value: string;
  label: string;
}

const DealerClosingBalanceReport: React.FC = () => {
  const [balances, setBalances] = useState<DealerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [filterDealerId, setFilterDealerId] = useState<string>('');

  const fetchDealerBalances = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name');

      if (dealersError) throw dealersError;
      setAllDealers(dealersData.map(d => ({ value: d.id, label: d.name })));

      // 2. Fetch all necessary data points
      const { data: dealerBalancesData, error: balancesError } = await supabase
        .from('dealer_balances')
        .select('dealer_id, opening_balance');
      if (balancesError) throw balancesError;

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('dealer_id, total_amount');
      if (ordersError) throw ordersError;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('dealer_id, amount, status')
        .eq('status', 'completed'); // Only count received payments
      if (paymentsError) throw paymentsError;

      // 3. Process and aggregate data
      const balanceMap = new Map<string, DealerBalance>();

      // Initialize with all dealers
      for (const dealer of dealersData) {
        balanceMap.set(dealer.id, {
          dealer_id: dealer.id,
          dealer_name: dealer.name,
          opening_balance: 0,
          total_order_value: 0,
          total_received: 0,
          net_balance: 0,
        });
      }

      // Add opening balances
      for (const balance of dealerBalancesData) {
        if (balanceMap.has(balance.dealer_id)) {
          balanceMap.get(balance.dealer_id)!.opening_balance = balance.opening_balance || 0;
        }
      }

      // Sum up total order values
      for (const order of ordersData) {
        if (balanceMap.has(order.dealer_id)) {
          const current = balanceMap.get(order.dealer_id)!;
          current.total_order_value += order.total_amount || 0;
        }
      }

      // Sum up total received payments
      for (const payment of paymentsData) {
        if (balanceMap.has(payment.dealer_id)) {
          const current = balanceMap.get(payment.dealer_id)!;
          current.total_received += payment.amount || 0;
        }
      }
      
      // Calculate net balance and filter
      let processedBalances = Array.from(balanceMap.values()).map(b => {
        b.net_balance = b.opening_balance + b.total_order_value - b.total_received;
        return b;
      });

      if (filterDealerId) {
        processedBalances = processedBalances.filter(b => b.dealer_id === filterDealerId);
      }

      setBalances(processedBalances);

    } catch (error: any) {
      console.error('Error fetching dealer balances:', error.message);
      showError('Failed to load dealer balance report.');
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerId]);

  useEffect(() => {
    fetchDealerBalances();
  }, [fetchDealerBalances]);

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(balances.map(b => ({
      'Dealer Name': b.dealer_name,
      'Opening Balance': b.opening_balance,
      'Total Order Value': b.total_order_value,
      'Total Received': b.total_received,
      'Net Balance': b.net_balance,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dealer Balances');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'DealerClosingBalanceReport.xlsx');
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-gray-100 dark:bg-gray-800 p-4 rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Dealer Closing Balance Report</CardTitle>
            <CardDescription className="text-muted-foreground">
              Detailed financial summary for each dealer.
            </CardDescription>
          </div>
          <Button onClick={handleExportToExcel} disabled={loading || balances.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
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
          <Button onClick={fetchDealerBalances} className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Apply Filter
          </Button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading report...</p>
            </div>
          ) : balances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No data available for the selected criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Opening Balance</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Order Value</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Received</TableHead>
                    <TableHead className="text-muted-foreground text-right font-bold">Net Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.dealer_id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{balance.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{balance.opening_balance.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{balance.total_order_value.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground text-right text-green-600">₹{balance.total_received.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right font-bold">₹{balance.net_balance.toFixed(2)}</TableCell>
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

export default DealerClosingBalanceReport;