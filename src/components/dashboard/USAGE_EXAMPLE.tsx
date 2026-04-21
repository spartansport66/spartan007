/**
 * USAGE EXAMPLE: Billing Dashboard Components
 * 
 * This file demonstrates how to use the dashboard components together
 * to create a comprehensive billing dashboard similar to the reference design.
 * 
 * Copy this structure into your BillingDashboard.tsx or create a new page.
 */

import React, { useState, useEffect } from 'react';
import {
  BillingProgressCard,
  RevenueSummaryCard,
  PendingPaymentsCard,
  CustomerMetricsCard,
  MonthlyRevenueChart,
  InvoiceStatusChart,
  PaymentAgeingCard,
} from './index';

export const BillingDashboardExample: React.FC = () => {
  // Example: Fetch dashboard data from your API
  const [dashboardData, setDashboardData] = useState({
    invoiceProgress: 76,
    totalRevenue: 52000000, // ₹52L
    targetRevenue: 65000000, // ₹65L
    pendingPayments: [
      {
        id: '1',
        dealerName: 'Dealer ABC',
        amount: 500000,
        invoiceNumber: '001',
        daysOverdue: 5,
      },
      {
        id: '2',
        dealerName: 'Dealer XYZ',
        amount: 750000,
        invoiceNumber: '002',
        daysOverdue: 15,
      },
    ],
    topCustomers: [
      { id: '1', name: 'Premium Corp', revenue: 5000000, percentage: 100, orders: 24 },
      { id: '2', name: 'Elite Traders', revenue: 4200000, percentage: 84, orders: 18 },
      { id: '3', name: 'Standard Sales', revenue: 3100000, percentage: 62, orders: 14 },
    ],
    monthlyRevenue: [
      { month: 'Jan', revenue: 4500000, target: 5000000 },
      { month: 'Feb', revenue: 5200000, target: 5000000 },
      { month: 'Mar', revenue: 6100000, target: 6500000 },
      { month: 'Apr', revenue: 5800000, target: 6000000 },
      { month: 'May', revenue: 6200000, target: 6500000 },
      { month: 'Jun', revenue: 7100000, target: 7000000 },
    ],
    invoiceStatuses: [
      { status: 'Paid', count: 245, percentage: 60, color: '#10B981' },
      { status: 'Pending', count: 85, percentage: 21, color: '#F59E0B' },
      { status: 'Overdue', count: 50, percentage: 12, color: '#EF4444' },
      { status: 'Cancelled', count: 20, percentage: 5, color: '#6B7280' },
    ],
    paymentAgeing: [
      { period: '0-30 Days', amount: 2500000, percentage: 45, invoices: 25, color: '#10B981' },
      { period: '30-60 Days', amount: 1200000, percentage: 21, invoices: 12, color: '#F59E0B' },
      { period: '60-90 Days', amount: 950000, percentage: 17, invoices: 10, color: '#FF6B6B' },
      { period: '90+ Days', amount: 800000, percentage: 14, invoices: 8, color: '#DC2626' },
    ],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Billing Dashboard</h1>
          <p className="text-gray-600">Complete overview of revenue, invoices, and payments</p>
        </div>

        {/* Row 1: Progress, Revenue, Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Progress Card - Takes 1 column */}
          <div className="lg:col-span-1">
            <BillingProgressCard
              percentage={dashboardData.invoiceProgress}
              label="Invoice Generation"
              color="#F59E0B"
            />
          </div>

          {/* Revenue Summary - Takes 1 column */}
          <div className="lg:col-span-1">
            <RevenueSummaryCard
              totalRevenue={dashboardData.totalRevenue}
              targetRevenue={dashboardData.targetRevenue}
              percentage={(dashboardData.totalRevenue / dashboardData.targetRevenue) * 100}
              currency="₹"
            />
          </div>

          {/* Pending Payments - Takes 2 columns */}
          <div className="lg:col-span-2">
            <PendingPaymentsCard
              payments={dashboardData.pendingPayments}
              total={dashboardData.pendingPayments.reduce((sum, p) => sum + p.amount, 0)}
            />
          </div>
        </div>

        {/* Row 2: Customers and Payment Ageing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <CustomerMetricsCard
            customers={dashboardData.topCustomers}
            totalCustomers={dashboardData.topCustomers.length}
          />
          <PaymentAgeingCard
            data={dashboardData.paymentAgeing}
            totalAmount={dashboardData.paymentAgeing.reduce((sum, d) => sum + d.amount, 0)}
          />
        </div>

        {/* Row 3: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonthlyRevenueChart
            data={dashboardData.monthlyRevenue}
            maxValue={Math.max(...dashboardData.monthlyRevenue.map((d) => Math.max(d.revenue, d.target))) * 1.1}
          />
          <InvoiceStatusChart
            statuses={dashboardData.invoiceStatuses}
            total={dashboardData.invoiceStatuses.reduce((sum, s) => sum + s.count, 0)}
          />
        </div>
      </div>
    </div>
  );
};

export default BillingDashboardExample;

/**
 * INTEGRATION TIPS:
 * 
 * 1. Replace mock data with real API calls:
 *    - Fetch data from your Supabase backend
 *    - Use useEffect to load dashboard data
 *    - Add loading and error states
 * 
 * 2. Type Safety:
 *    - Import and use the TypeScript interfaces from each component
 *    - Define a DashboardData interface that matches your API response
 * 
 * 3. Real-time Updates:
 *    - Use Supabase real-time subscriptions for live updates
 *    - Set up intervals for periodic data refresh
 * 
 * 4. Styling:
 *    - Wrap in a layout container with your preferred theme
 *    - Adjust grid columns based on your screen size needs
 *    - Use the gap prop to control spacing between cards
 * 
 * 5. Performance:
 *    - Memoize components that don't need frequent re-renders
 *    - Use useCallback for event handlers
 *    - Consider pagination for large datasets in tables
 * 
 * Example API call structure:
 * 
 *   useEffect(() => {
 *     const fetchDashboardData = async () => {
 *       try {
 *         const { data } = await supabase
 *           .from('dashboard_metrics')
 *           .select('*')
 *           .single();
 *         setDashboardData(data);
 *       } catch (error) {
 *         console.error('Failed to fetch dashboard data:', error);
 *       }
 *     };
 *     fetchDashboardData();
 *   }, []);
 */
