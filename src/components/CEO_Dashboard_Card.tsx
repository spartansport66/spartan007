"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowDown, ArrowUp, DollarSign, Package, Users, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/formatters';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface DispatchedOrder {
  orderNumber: number;
  dealerName: string;
  salesmanName: string;
  amount: number;
}

interface DashboardData {
  ordersFromSalesmen: number;
  ordersFromOnline: number;
  totalOrdersReceived: number;
  dispatchedOrders: DispatchedOrder[];
  totalDispatchedValue: number;
}

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: string, icon: React.ReactNode, isLoading: boolean }) => (
  <div className="flex items-center justify-between rounded-lg border bg-card text-card-foreground p-4">
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {isLoading ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
    <div className="bg-primary text-primary-foreground p-3 rounded-full">
      {icon}
    </div>
  </div>
);

const CEO_Dashboard_Card: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const startOfToday = getStartOfUTCDayISO();
      const endOfToday = getEndOfUTCDayISO();

      // 1. Fetch Orders Received Today
      const { data: ordersToday, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, dealers (name)')
        .gte('order_date', startOfToday)
        .lte('order_date', endOfToday);
      if (ordersError) throw ordersError;

      let fromSalesmen = 0;
      let fromOnline = 0;
      (ordersToday || []).forEach(order => {
        if ((order.dealers as any)?.name === 'Online Order') {
          fromOnline += order.total_amount;
        } else {
          fromSalesmen += order.total_amount;
        }
      });

      // 2. Fetch Dispatched Orders Today
      const { data: dispatchedToday, error: dispatchedError } = await supabase
        .from('orders')
        .select('order_number, total_amount, dealers(name), profiles:user_id(first_name, last_name)')
        .gte('gate_pass_dispatch_time', startOfToday)
        .lte('gate_pass_dispatch_time', endOfToday)
        .order('gate_pass_dispatch_time', { ascending: false });
      if (dispatchedError) throw dispatchedError;

      const dispatchedOrdersList: DispatchedOrder[] = (dispatchedToday || []).map((order: any) => ({
        orderNumber: order.order_number,
        dealerName: order.dealers?.name || 'N/A',
        salesmanName: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'N/A',
        amount: order.total_amount,
      }));

      const totalDispatched = dispatchedOrdersList.reduce((sum, order) => sum + order.amount, 0);

      setData({
        ordersFromSalesmen: fromSalesmen,
        ordersFromOnline: fromOnline,
        totalOrdersReceived: fromSalesmen + fromOnline,
        dispatchedOrders: dispatchedOrdersList,
        totalDispatchedValue: totalDispatched,
      });

    } catch (error: any) {
      showError(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Card className="bg-card text-card-foreground shadow-lg w-full border-2 border-primary/20">
      <CardHeader className="bg-muted/30">
        <CardTitle className="text-2xl font-bold text-primary">CEO's Daily Briefing</CardTitle>
        <CardDescription>Live summary for {todayDate}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Orders Received */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><ArrowDown className="h-5 w-5 text-green-500" /> Today's Orders Received</h3>
            <StatCard title="From Sales Team" value={formatCurrency(data?.ordersFromSalesmen || 0)} icon={<Users className="h-5 w-5" />} isLoading={loading} />
            <StatCard title="From Online" value={formatCurrency(data?.ordersFromOnline || 0)} icon={<ShoppingCart className="h-5 w-5" />} isLoading={loading} />
            <Separator />
            <StatCard title="Total Received" value={formatCurrency(data?.totalOrdersReceived || 0)} icon={<DollarSign className="h-5 w-5" />} isLoading={loading} />
          </div>

          {/* Column 2 & 3: Dispatched Material */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><ArrowUp className="h-5 w-5 text-blue-500" /> Today's Dispatched Material</h3>
            <div className="max-h-64 overflow-y-auto border rounded-md">
              {loading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !data || data.dispatchedOrders.length === 0 ? (
                <p className="text-center text-muted-foreground p-8">No material dispatched today.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Sales Person</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dispatchedOrders.map((order, index) => (
                      <TableRow key={index}>
                        <TableCell>{order.dealerName}</TableCell>
                        <TableCell>{order.salesmanName}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(order.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <Separator />
            <StatCard title="Total Dispatched" value={formatCurrency(data?.totalDispatchedValue || 0)} icon={<Package className="h-5 w-5" />} isLoading={loading} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CEO_Dashboard_Card;