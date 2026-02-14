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
      <CardHeader className="bg-muted/30 p-4 md:p-6">
        <CardTitle className="text-xl md:text-2xl font-bold text-primary">CEO's Daily Briefing</CardTitle>
        <CardDescription>Live summary for {todayDate}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Orders Received Section */}
            <div>
              <h3 className="text-base md:text-lg font-semibold flex items-center gap-2 mb-2">
                <ArrowDown className="h-5 w-5 text-green-500" /> Today's Orders Received
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> From Sales Team:</span>
                  <span className="font-bold">{formatCurrency(data?.ordersFromSalesmen || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> From Online:</span>
                  <span className="font-bold">{formatCurrency(data?.ordersFromOnline || 0)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between font-bold text-base">
                  <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Received:</span>
                  <span>{formatCurrency(data?.totalOrdersReceived || 0)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dispatched Material Section */}
            <div>
              <h3 className="text-base md:text-lg font-semibold flex items-center gap-2 mb-2">
                <ArrowUp className="h-5 w-5 text-blue-500" /> Today's Dispatched Material
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between font-bold text-base">
                  <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Total Dispatched:</span>
                  <span>{formatCurrency(data?.totalDispatchedValue || 0)}</span>
                </div>
              </div>
              
              {data && data.dispatchedOrders.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Dealer</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">Sales Person</TableHead>
                        <TableHead className="text-right text-xs">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.dispatchedOrders.map((order, index) => (
                        <TableRow key={index} className="text-sm">
                          <TableCell>{order.dealerName}</TableCell>
                          <TableCell className="hidden sm:table-cell">{order.salesmanName}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(order.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CEO_Dashboard_Card;