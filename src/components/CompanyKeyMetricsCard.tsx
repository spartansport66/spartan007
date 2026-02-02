"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, CheckCircle, Clock, Package, Building, Boxes, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { formatCurrency } from '@/utils/formatters';

interface Metric {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

const CompanyKeyMetricsCard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Total Sales Value (All time revenue)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price');
      const totalSalesValue = salesData?.reduce((sum, sale) => sum + sale.total_price, 0) || 0;

      // 2. Total Received Payments (All time cleared payments)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'paid');
      const totalReceivedPayments = paymentsData?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

      // 3. Pending Approval Payments
      const { data: pendingPaymentsData, error: pendingPaymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'pending_approval');
      const pendingApprovalPayments = pendingPaymentsData?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

      // 4. Orders Awaiting Dispatch
      const { count: awaitingDispatchCount, error: dispatchError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'awaiting_dispatch');

      // 5. Active Dealers
      const { count: activeDealersCount, error: dealersError } = await supabase
        .from('dealers')
        .select('*', { count: 'exact', head: true });

      // 6. Total Products in Inventory
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (salesError || paymentsError || pendingPaymentsError || dispatchError || dealersError || productsError) {
        throw new Error('Failed to fetch one or more metrics.');
      }

      const newMetrics: Metric[] = [
        {
          title: "Total Sales Value",
          value: formatCurrency(totalSalesValue),
          description: "All time revenue",
          icon: <DollarSign className="h-4 w-4 text-white" />,
          colorClass: "bg-blue-500 dark:bg-blue-700",
        },
        {
          title: "Total Received Payments",
          value: formatCurrency(totalReceivedPayments),
          description: "All time cleared payments",
          icon: <CheckCircle className="h-4 w-4 text-white" />,
          colorClass: "bg-green-500 dark:bg-green-700",
        },
        {
          title: "Pending Approval Payments",
          value: formatCurrency(pendingApprovalPayments),
          description: "Awaiting admin clearance",
          icon: <Clock className="h-4 w-4 text-white" />,
          colorClass: "bg-yellow-500 dark:bg-yellow-700",
        },
        {
          title: "Orders Awaiting Dispatch",
          value: (awaitingDispatchCount || 0).toString(),
          description: "Ready for warehouse dispatch",
          icon: <Package className="h-4 w-4 text-white" />,
          colorClass: "bg-red-500 dark:bg-red-700",
        },
        {
          title: "Active Dealers",
          value: (activeDealersCount || 0).toString(),
          description: "Total registered dealers",
          icon: <Building className="h-4 w-4 text-white" />,
          colorClass: "bg-purple-500 dark:bg-purple-700",
        },
        {
          title: "Total Products in Inventory",
          value: (productsCount || 0).toString(),
          description: "Total unique products",
          icon: <Boxes className="h-4 w-4 text-white" />,
          colorClass: "bg-indigo-500 dark:bg-indigo-700",
        },
      ];

      setMetrics(newMetrics);
    } catch (error: any) {
      console.error('Error fetching key metrics:', error);
      showError(error.message || 'Failed to fetch key metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Array(6).fill(0).map((_, index) => (
          <Card key={index} className="h-full flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {metrics.map((item, index) => (
        <Card key={index} className="bg-card text-card-foreground shadow-md h-full">
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 p-3 ${item.colorClass} text-white rounded-t-lg`}>
            <CardTitle className="text-sm font-medium text-white">{item.title}</CardTitle>
            {item.icon}
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {/* Changed font-bold to font-normal for the value */}
            <div className="text-xl font-normal text-foreground">{item.value}</div>
            {/* Changed font-medium to font-normal for the description */}
            <p className="text-xs font-normal text-muted-foreground mt-1">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CompanyKeyMetricsCard;