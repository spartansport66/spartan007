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
import PaymentOverviewCard from '@/components/PaymentOverviewCard';
import DealerLedgerReportDialog from '@/components/reports/DealerLedgerReportDialog';
import OpeningBalanceReportDialog from '@/components/reports/OpeningBalanceReportDialog';
import SalesChart from '@/components/SalesChart';
import DealerOverdueBalanceReportDialog from '@/components/reports/DealerOverdueBalanceReportDialog'; // New import

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType, session } = useSession();
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
  const [isDealerLedgerReportOpen, setIsDealerLedgerReportOpen] = useState(false);
  const [isOpeningBalanceReportOpen, setIsOpeningBalanceReportOpen] = useState(false);
  const [isDealerOverdueBalanceReportOpen, setIsDealerOverdueBalanceReportOpen] = useState(false); // New state for Overdue Balance Report
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [paymentsReportInitialStatus, setPaymentsReportInitialStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [paymentsReportInitialFromDate, setPaymentsReportInitialFromDate] = useState<string>('');
  const [paymentsReportInitialToDate, setPaymentsReportInitialToDate] = useState<string>('');
  const [paymentsReportDialogKey, setPaymentsReportDialogKey] = useState(0);

  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [monthlySalesData, setMonthlySalesData] = useState<{ month: string; sales: number }[]>([]);

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

      // Fetch total sales value
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price');
      if (salesError) {
        console.error('Error fetching total sales value:', salesError.message);
        setTotalSalesValue(0);
      } else {
        const total = (salesData || []).reduce((sum, sale) => sum + sale.total_price, 0);
        setTotalSalesValue(total);
      }

      // Fetch monthly sales data for the chart
      const { data: monthlySalesRaw, error: monthlySalesError } = await supabase
        .from('sales')
        .select('sale_date, total_price')
        .order('sale_date', { ascending: true });

      if (monthlySalesError) {
        console.error('Error fetching monthly sales data:', monthlySalesError.message);
        setMonthlySalesData([]);
      } else {
        const salesByMonth: { [key: string]: number } = {};
        (monthlySalesRaw || []).forEach(sale => {
          const date = new Date(sale.sale_date);
          const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
          salesByMonth[monthYear] = (salesByMonth[monthYear] || 0) + sale.total_price;
        });

        const formattedMonthlySales = Object.keys(salesByMonth).map(month => ({
          month,
          sales: salesByMonth[month],
        }));
        setMonthlySalesData(formattedMonthlySales);
      }

    } catch (error: any) {
      console.error('AdminDashboard: Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'admin') {
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        fetchDashboardData();
        fetchCompanyInfo();
      }
    }
  }, [sessionLoading, user, userType, isAdmin, fetchDashboardData, fetchCompanyInfo, navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Logout API call failed, but proceeding with client-side logout as session might be invalid:', error.message);
        showError(`Logout failed: ${error.message}. You are being redirected.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      navigate('/login');
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting.`);
      navigate('/login');
    }
  };

  const handleDispatchSuccessAndPrint = (dispatchedOrderId: string) => {
    setSelectedOrderIdForDetails(dispatchedOrderId);
    setIsOrderDetailsDialogOpen(true);
    setShouldPrintOrderDetails(true);
    fetchDashboardData();
  };

  const handlePaymentAction = () => {
    setRefreshKey(prev => prev + 1);
    fetchDashboardData();
  };

  const handleViewPaymentsReport = () => {
    setPaymentsReportInitialStatus('all');
    setPaymentsReportInitialFromDate('');
    setPaymentsReportInitialToDate('');
    setPaymentsReportDialogKey(prev => prev + 1);
    setIsPaymentsReportOpen(true);
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300 mb-4">Loading admin dashboard...</p>
        <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Force Logout
        </Button>
      </div>
    );
  }

  if (userType !== 'admin') {
    return null;
  }

  const salesOverview = [
    {
      title: "Total Sales Value",
      value: `₹${totalSalesValue.toFixed(2)}`,
      change: "+20.1% from last month",
      icon: <DollarSign className="h-4 w-4 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Total Orders",
      value: totalOrders.toString(),
      change: "+180.1% from last month",
      icon: <Package className="h-4 w-4 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Active Dealers",
      value: activeDealersCount.toString(),
      change: "+19% from last month",
      icon: <Building className="h-4 w-4 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Total Products",
      value: productsCount.toString(),
      change: "Overall",
      icon: <Boxes className="h-4 w-4 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="text-left">
          {companyName && (
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
              {companyName}
            </h2>
          )}
        </div>
        <h1 className="text-center text-3xl sm:text-4xl font-bold text-primary">Admin Dashboard</h1>
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
              setIsDealerLedgerReportOpen={setIsDealerLedgerReportOpen}
              setIsOpeningBalanceReportOpen={setIsOpeningBalanceReportOpen}
              setIsDealerOverdueBalanceReportOpen={setIsDealerOverdueBalanceReportOpen} // Pass new prop
            />
          </SheetContent>
        </Sheet>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index} className="bg-card text-card-foreground shadow-md h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg">
              <CardTitle className="text-base font-medium text-white">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-3xl font-bold ${item.valueColor}`}>{item.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <OrdersToDispatchCard onDispatchSuccess={handleDispatchSuccessAndPrint} />
        <DispatchedOrdersCard />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ProductionAlertsCard />
        <SalesPersonPerformanceOverviewCard onViewDetails={() => setIsSalesPersonPerformanceReportOpen(true)} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PaymentOverviewCard onViewReport={handleViewPaymentsReport} />
        <AllPendingPaymentsCard onPaymentAction={handlePaymentAction} key={`all-pending-payments-${refreshKey}`} />
      </div>

      <div className="grid grid-cols-1 mb-6">
        <SalesChart data={monthlySalesData} />
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
        key={paymentsReportDialogKey}
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
      <DealerLedgerReportDialog 
        isOpen={isDealerLedgerReportOpen} 
        onOpenChange={setIsDealerLedgerReportOpen} 
      />
      <OpeningBalanceReportDialog
        isOpen={isOpeningBalanceReportOpen}
        onOpenChange={setIsOpeningBalanceReportOpen}
      />
      <DealerOverdueBalanceReportDialog // New dialog component
        isOpen={isDealerOverdueBalanceReportOpen}
        onOpenChange={setIsDealerOverdueBalanceReportOpen}
      />
    </div>
  );
};

export default AdminDashboard;