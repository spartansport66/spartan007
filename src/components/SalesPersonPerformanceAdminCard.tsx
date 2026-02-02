"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Target, TrendingUp, Activity, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/formatters';

interface SalesPersonOption {
  id: string;
  name: string;
}

const SalesPersonPerformanceAdminCard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<SalesPersonOption[]>([]);
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<string>('');
  
  const [targetAmount, setTargetAmount] = useState<number | null>(null);
  const [achievedSales, setAchievedSales] = useState<number | null>(null);
  const [pendingSales, setPendingSales] = useState<number | null>(null);
  const [totalCurrentDealerBalance, setTotalCurrentDealerBalance] = useState<number | null>(null);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  const getMonthName = (monthIndex: number) => {
    const date = new Date(Date.UTC(2000, monthIndex, 1));
    return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  };

  const currentMonthName = getMonthName(currentMonth);

  const fetchSalesPersonOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('user_type', 'sales_person')
      .order('first_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching sales persons:', error.message);
      setAllSalesPersons([]);
    } else {
      const persons = (data || []).map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name || ''}`.trim(),
      }));
      setAllSalesPersons(persons);
      
      // Set the default selection to the first sales person if none is selected
      if (!selectedSalesPersonId && persons.length > 0) {
        setSelectedSalesPersonId(persons[0].id);
      }
    }
  }, [selectedSalesPersonId]);

  const fetchPerformanceData = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      // Format target_month to YYYY-MM-DD for the first day of the current month
      const targetMonthFilterDate = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];
      
      // Fetch sales target for the current month
      const { data: targetData, error: targetError } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('sales_person_id', userId)
        .eq('target_month', targetMonthFilterDate)
        .single();

      if (targetError && targetError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch sales target: ${targetError.message}`);
      }
      const currentTarget = targetData?.target_amount || 0;
      setTargetAmount(currentTarget);

      // Fetch achieved sales for the current month
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString();

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price, orders(user_id)')
        .eq('orders.user_id', userId)
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth);

      if (salesError) {
        throw new Error(`Failed to fetch achieved sales: ${salesError.message}`);
      }
      const currentAchievedSales = (salesData || []).reduce((sum, sale) => sum + sale.total_price, 0);
      setAchievedSales(currentAchievedSales);

      setPendingSales(currentTarget - currentAchievedSales);

      // --- Fetch Total Current Dealer Balance ---
      let calculatedTotalCurrentDealerBalance = 0;
      const todayNormalized = new Date();
      todayNormalized.setHours(0, 0, 0, 0);

      // 1. Fetch all dealers assigned to the selected sales person
      const { data: assignedDealers, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealer_id')
        .eq('sales_person_id', userId);

      if (assignedDealersError) {
        throw new Error(`Failed to fetch assigned dealers: ${assignedDealersError.message}`);
      }

      const dealerIds = (assignedDealers || []).map(d => d.dealer_id);

      if (dealerIds.length > 0) {
        // 2. Fetch opening balances for these dealers
        const { data: dealerBalances, error: balancesError } = await supabase
          .from('dealer_balances')
          .select('dealer_id, opening_balance')
          .in('dealer_id', dealerIds);

        if (balancesError) {
          throw new Error(`Failed to fetch dealer balances: ${balancesError.message}`);
        }
        const openingBalancesMap = new Map((dealerBalances || []).map(b => [b.dealer_id, b.opening_balance || 0]));

        // Initialize balances with opening balances
        dealerIds.forEach(dealerId => {
          calculatedTotalCurrentDealerBalance += openingBalancesMap.get(dealerId) || 0;
        });

        // 3. Fetch ALL orders and ALL completed payments for these dealers
        const { data: dealerTransactions, error: transactionsError } = await supabase
          .from('orders')
          .select(`
            total_amount,
            dealer_id,
            payments(amount, status)
          `)
          .in('dealer_id', dealerIds);

        if (transactionsError) {
          throw new Error(`Failed to fetch dealer transactions: ${transactionsError.message}`);
        }

        // 4. Process transactions to calculate Total Current Dealer Balance
        (dealerTransactions || []).forEach(order => {
          // Add order amount to Total Current Dealer Balance (Debit)
          calculatedTotalCurrentDealerBalance += order.total_amount;

          // Subtract completed payments (Credit)
          (order.payments || []).forEach(payment => {
            if (payment.status === 'completed') {
              calculatedTotalCurrentDealerBalance -= payment.amount;
            }
          });
        });
      }
      
      setTotalCurrentDealerBalance(calculatedTotalCurrentDealerBalance);

    } catch (error: any) {
      console.error('Error fetching sales person performance:', error.message);
      showError(`Failed to load performance data: ${error.message}`);
      setTargetAmount(null);
      setAchievedSales(null);
      setPendingSales(null);
      setTotalCurrentDealerBalance(null);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchSalesPersonOptions();
  }, [fetchSalesPersonOptions]);

  useEffect(() => {
    if (selectedSalesPersonId) {
      fetchPerformanceData(selectedSalesPersonId);
    } else {
      setLoading(false);
    }
  }, [selectedSalesPersonId, fetchPerformanceData]);

  const selectedSalesPersonName = allSalesPersons.find(sp => sp.id === selectedSalesPersonId)?.name || 'Select Sales Person';

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-[350px]">
      <CardHeader className="bg-pink-500 dark:bg-pink-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Sales Person Performance</CardTitle>
        <CardDescription className="text-pink-100 dark:text-pink-200">
          Overview for {currentMonthName} {currentYear}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="salesPersonSelect">Select Sales Person</Label>
          <Select 
            value={selectedSalesPersonId} 
            onValueChange={setSelectedSalesPersonId}
            disabled={allSalesPersons.length === 0 || loading}
          >
            <SelectTrigger id="salesPersonSelect" className="w-full">
              <SelectValue placeholder="Select Sales Person" />
            </SelectTrigger>
            <SelectContent>
              {allSalesPersons.map(sp => (
                <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading performance...</p>
          </div>
        ) : selectedSalesPersonId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span className="text-muted-foreground">Monthly Target:</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(targetAmount !== null ? targetAmount : 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Achieved Sales:</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(achievedSales !== null ? achievedSales : 0)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-600" />
                <span className="text-muted-foreground">Pending Target:</span>
              </div>
              <span className={`text-lg font-bold ${pendingSales !== null && pendingSales > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(pendingSales !== null ? pendingSales : 0)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                <span className="text-muted-foreground">Total Dealer Balance:</span>
              </div>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(totalCurrentDealerBalance !== null ? totalCurrentDealerBalance : 0)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Please select a sales person to view performance.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesPersonPerformanceAdminCard;