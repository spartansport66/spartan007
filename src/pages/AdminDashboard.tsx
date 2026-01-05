"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, FileText, Info, Gift, Menu } from 'lucide-react';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import OrdersToDispatchCard from '@/components/OrdersToDispatchCard';
import DispatchedOrdersCard from '@/components/DispatchedOrdersCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import OrdersAwaitingDispatchReportDialog from '@/components/reports/OrdersAwaitingDispatchReportDialog';
import DispatchedOrdersReportDialog from '@/components/reports/DispatchedOrdersReportDialog';
import SalesPersonPerformanceReportDialog from '@/components/reports/SalesPersonPerformanceReportDialog';
import DealerReportDialog from '@/components/reports/DealerReportDialog';
import SalesPersonPerformanceOverviewCard from '@/components/SalesPersonPerformanceOverviewCard';
import PaymentsReportDialog from '@/components/reports/PaymentsReportDialog';
import CompanyInfoDialog from '@/components/CompanyInfoDialog';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AdminSidebar from '@/components/AdminSidebar';
import SalesReportsDialog from '@/components/reports/SalesReportsDialog';
import ProductionAlertsCard from '@/components/ProductionAlertsCard';
import AllPendingPaymentsCard from '@/components/AllPendingPaymentsCard';
import PaymentOverviewCard from '@/components/PaymentOverviewCard'; // NEW IMPORT

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [shouldPrintOrderDetails, setShouldPrintOrderDetails] = useState(false);
  const [isOrdersAwaitingDispatchReportOpen, setIsOrdersAwaitingDispatchReportOpen] = useState(false);
  const [isDispatchedOrdersReportOpen, setIsDispatchedOrdersReportOpen] = useState(false);
  const [isSalesPersonPerformanceReportOpen, setIsSalesPersonPerformanceReportOpen] = useState(false);
  const [isDealerReportOpen, setIsDealerReportOpen] = useState(false);
  const [isPaymentsReportOpen, setIsPaymentsReportOpen] = useState(false);
  const [isSalesReportsDialogOpen, setIsSalesReportsDialogOpen] = useState(false);
  const [isCompanyInfoDialogOpen, setIsCompanyInfoDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Key to force re-fetch in child components

  // State for PaymentsReportDialog filters
  const [paymentsReportInitialStatus, setPaymentsReportInitialStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [paymentsReportInitialFromDate, setPaymentsReportInitialFromDate] = useState<string>('');
  const [paymentsReportInitialToDate, setPaymentsReportInitialToDate] = useState<string>('');

  // Simplified dashboard data
  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch products count
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (!productsError) {
        setProductsCount(productsCount || 0);
      }

      // Fetch dealers count
      const { count: dealersCount, error: dealersError } = await supabase
        .from('dealers')
        .select('*', { count: 'exact', head: true });

      if (!dealersError) {
        setActiveDealersCount(dealersCount || 0);
      }

      // Fetch orders count
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      if (!ordersError) {
        setTotalOrders(ordersCount || 0);
      }

      // Set a dummy sales value for now
      setTotalSalesValue(125000);

    } catch (error: any) {
      console.error('AdminDashboard: Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('AdminDashboard session check: sessionLoading=', sessionLoading, 'user=', user, 'userType=', userType, 'isAdmin=', isAdmin);
    if (!sessionLoading) {
      if (!user) {
        console.log('AdminDashboard: No user, navigating to /login');
        navigate('/login');
      } else if (userType !== 'admin') {
        console.log('AdminDashboard: User is not admin (userType:', userType, '), navigating to /dashboard');
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        console.log('AdminDashboard: User is admin, fetching data.');
        fetchDashboardData();
        fetchCompanyInfo();
      }
    }
  }, [sessionLoading, user, userType, isAdmin, fetchDashboardData, fetchCompanyInfo, navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error logging out:', error.message);
        showError(`Failed to log out: ${error.message}`);
      } else {
        showSuccess('Logged out successfully!');
        navigate('/login');
      }
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`Unexpected error during logout: ${error.message}`);
    }
  };

  const handleDispatchSuccessAndPrint = (dispatchedOrderId: string) => {
    setSelectedOrderIdForDetails(dispatchedOrderId);
    setIsOrderDetailsDialogOpen(true);
    setShouldPrintOrderDetails(true);
    fetchDashboardData(); // Refresh dashboard data
  };

  const handlePaymentAction = () => {
    setRefreshKey(prev => prev + 1); // Increment key to trigger re-fetch in child components
    fetchDashboardData(); // Also refresh main dashboard data
  };

  const handleViewPaymentsReport = (status: 'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval', fromDate?: string, toDate?: string) => {
    console.log('AdminDashboard: handleViewPaymentsReport called. Setting dialog open.');
    setPaymentsReportInitialStatus(status);
    setPaymentsReportInitialFromDate(fromDate || '');
    setPaymentsReportInitialToDate(toDate || '');
    setIsPaymentsReportOpen(true);
  };

  // Show loading state with logout option
  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300 mb-4">Loading admin dashboard...</p>
        <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" /> Force Logout
        </Button>
      </div>
    );
  }

  // If not admin, don't render anything (redirect will happen)
  if (userType !== 'admin') {
    return null;
  }

  const salesOverview = [
    {
      title: "Total Sales Value",
      value: `₹${totalSalesValue.toFixed(2)}`,
      change: "+20.1% from last month",
      icon: <DollarSign className="h-3 w-3 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Total Orders",
      value: totalOrders.toString(),
      change: "+180.1% from last month",
      icon: <Package className="h-3 w-3 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Active Dealers",
      value: activeDealersCount.toString(),
      change: "+19% from last month",
      icon: <Building className="h-3 w-3 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Total Products",
      value: productsCount.toString(),
      change: "Overall",
      icon: <Boxes className="h-3 w-3 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        {/* Left: Company Name */}
        <div className="text-left">
          {companyName && (
            <h2 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {companyName}
            </h2>
          )}
        </div>
        {/* Center: Admin Dashboard Title */}
        <h1 className="text-center text-2xl sm:text-3xl font-bold text-primary">Admin Dashboard</h1>
        {/* Right: Sidebar Trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="text-gray-600 dark:text-gray-400">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[250px] sm:w-[300px]">
            <SheetHeader>
              <SheetTitle>Admin Navigation</SheetTitle>
            </SheetHeader>
            <AdminSidebar
              handleLogout={handleLogout}
              setIsOrdersAwaitingDispatchReportOpen={setIsOrdersAwaitingDispatchReportOpen}
              setIsDispatchedOrdersReportOpen={setIsDispatchedOrdersReportOpen}
              setIsSalesPersonPerformanceReportOpen={setIsSalesPersonPerformanceReportOpen}
              setIsDealerReportOpen={setIsDealerReportOpen}
              setIsPaymentsReportOpen={setIsPaymentsReportOpen}
              setIsSalesReportsDialogOpen={setIsSalesReportsDialogOpen}
              setIsCompanyInfoDialogOpen={setIsCompanyInfoDialogOpen}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index} className="bg-card text-card-foreground shadow-md h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-2 bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg">
              <CardTitle className="text-[0.5rem] font-medium text-white">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className={`text-2xl font-bold ${item.valueColor}`}>{item.value}</div>
              <p className="text-[0.4rem] text-muted-foreground mt-1">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <OrdersToDispatchCard onDispatchSuccess={handleDispatchSuccessAndPrint} />
        <DispatchedOrdersCard />
      </div>
      
      {/* New row for Production Alerts and Sales Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ProductionAlertsCard />
        <SalesPersonPerformanceOverviewCard onViewDetails={() => setIsSalesPersonPerformanceReportOpen(true)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Payment Overview Card */}
        <PaymentOverviewCard onViewReport={handleViewPaymentsReport} />
        {/* All Pending Payments Card */}
        <AllPendingPaymentsCard onPaymentAction={handlePaymentAction} key={`all-pending-payments-${refreshKey}`} />
      </div>

      <MadeWithDyad />

      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
        shouldPrintOnLoad={shouldPrintOrderDetails}
      />
      <OrdersAwaitingDispatchReportDialog
        isOpen={isOrdersAwaitingDispatchReportOpen}
        onOpenChange={setIsOrdersAwaitingDispatchReportOpen}
      />
      <DispatchedOrdersReportDialog
        isOpen={isDispatchedOrdersReportOpen}
        onOpenChange={setIsDispatchedOrdersReportOpen}
      />
      <SalesPersonPerformanceReportDialog
        isOpen={isSalesPersonPerformanceReportOpen}
        onOpenChange={setIsSalesPersonPerformanceReportOpen}
      />
      <DealerReportDialog
        isOpen={isDealerReportOpen}
        onOpenChange={setIsDealerReportOpen}
      />
      <PaymentsReportDialog
        isOpen={isPaymentsReportOpen}
        onOpenChange={setIsPaymentsReportOpen}
        initialFilterStatus={paymentsReportInitialStatus}
        initialFilterFromDate={paymentsReportInitialFromDate}
        initialFilterToDate={paymentsReportInitialToDate}
      />
      <SalesReportsDialog
        isOpen={isSalesReportsDialogOpen}
        onOpenChange={setIsSalesReportsDialogOpen}
      />
      <CompanyInfoDialog
        isOpen={isCompanyInfoDialogOpen}
        onOpenChange={setIsCompanyInfoDialogOpen}
        onCompanyInfoUpdated={fetchCompanyInfo}
      />
    </div>
  );
};

export default AdminDashboard;