"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, ShoppingCart, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import DashboardCard from './DashboardCard';
import PaymentOverviewCard from './PaymentOverviewCard';
import SalesChart from './SalesChart';
import RecentOrdersTable from './RecentOrdersTable';
import TopDealersList from './TopDealersList';
import { useRouter } from 'next/navigation';

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [totalDealers, setTotalDealers] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalPayments, setTotalPayments] = useState<number>(0);
  const router = useRouter();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Total Dealers
      const { count: dealerCount, error: dealerError } = await supabase
        .from('dealers')
        .select('*', { count: 'exact', head: true });
      
      if (dealerError) throw dealerError;
      setTotalDealers(dealerCount || 0);

      // Fetch Total Orders Count
      const { count: orderCount, error: orderCountError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      if (orderCountError) throw orderCountError;
      setTotalOrders(orderCount || 0);

      // Fetch Total Sales Value (Net Order Value)
      // Updated to calculate SUM(total_amount) - SUM(discount_amount)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, discount_amount'); // Select both fields
      
      if (ordersError) throw ordersError;
      
      // Calculate Net Sales: SUM(total_amount - discount_amount)
      const netTotalSales = (ordersData || []).reduce((sum, order) => sum + (order.total_amount - (order.discount_amount || 0)), 0);
      setTotalSales(netTotalSales);

      // Fetch Total Payments Received (Completed status)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed');
      
      if (paymentsError) throw paymentsError;
      
      const totalPaymentsValue = (paymentsData || []).reduce((sum, payment) => sum + payment.amount, 0);
      setTotalPayments(totalPaymentsValue);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error.message);
      showError('Failed to load dashboard data.');
      setTotalDealers(0);
      setTotalOrders(0);
      setTotalSales(0);
      setTotalPayments(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleViewReport = () => {
    router.push('/admin/payments');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      {/* Top Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Total Sales Value (Net)"
          value={`₹${totalSales.toFixed(2)}`}
          icon={DollarSign}
          description="Total revenue after discounts."
          color="bg-green-500"
        />
        <DashboardCard
          title="Total Dealers"
          value={totalDealers.toString()}
          icon={Users}
          description="Total registered dealers."
          color="bg-blue-500"
        />
        <DashboardCard
          title="Total Orders"
          value={totalOrders.toString()}
          icon={ShoppingCart}
          description="Total orders placed."
          color="bg-yellow-500"
        />
        <DashboardCard
          title="Total Payments Received"
          value={`₹${totalPayments.toFixed(2)}`}
          icon={TrendingUp}
          description="Total completed payments."
          color="bg-purple-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Chart (2/3 width) */}
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        
        {/* Payment Overview Card (1/3 width) */}
        <PaymentOverviewCard onViewReport={handleViewReport} />
      </div>

      {/* Bottom Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentOrdersTable />
        <TopDealersList />
      </div>
    </div>
  );
};

export default AdminDashboard;