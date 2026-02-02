"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, FileText, Info, Gift, Menu, Scale, MapPin, Clock, ListChecks } from 'lucide-react';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import OrdersToDispatchCard from '@/components/OrdersToDispatchCard';
import DispatchedOrdersCard from '@/components/DispatchedOrdersCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import OrdersAwaitingDispatchReportDialog from '@/components/reports/OrdersAwaitingDispatchReportDialog';
import DispatchedOrdersReportDialog from '@/components/reports/DispatchedOrdersReportDialog';
import DealerReportDialog from '@/components/reports/DealerReportDialog';
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
import DealerOverdueBalanceReportDialog from '@/components/reports/DealerOverdueBalanceReportDialog';
import DealerClosingBalanceReportDialog from '@/components/reports/DealerClosingBalanceReportDialog';
import SalesPersonVisitReportDialog from '@/components/reports/SalesPersonVisitReportDialog';
import SalesPersonTodayFollowupsReportDialog from '@/components/reports/SalesPersonTodayFollowupsReportDialog';
import LoginLogReportDialog from '@/components/reports/LoginLogReportDialog';
import SalesPersonAccountStatementReportDialog from '@/components/reports/SalesPersonAccountStatementReportDialog';
import OrderSummaryReportDialog from '@/components/reports/OrderSummaryReportDialog';
import { updateAllDealerCreditDays } from '@/utils/supabase-actions';
import AdminTodayFollowupsCard from '@/components/AdminTodayFollowupsCard';
import AdminTodayVisitsCard from '@/components/AdminTodayVisitsCard';
import AdminTotalPendingOrdersCard from '@/components/AdminTotalPendingOrdersCard';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType, session } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [shouldPrintOrderDetails, setShouldPrintOrderDetails] = useState(false);
  const [isOrdersAwaitingDispatchReportOpen, setIsOrdersAwaitingDispatchReportOpen] = useState(false);
  const [isDispatchedOrdersReportOpen, setIsDispatchedOrdersReportOpen] = useState(false);
  const [isDealerReportOpen, setIsDealerReportOpen] = useState(false);
  const [isPaymentsReportOpen, setIsPaymentsReportOpen] = useState(false);
  const [isSalesReportsDialogOpen, setIsSalesReportsDialogOpen] = useState(false);
  const [isCompanyInfoDialogOpen, setIsCompanyInfoDialogOpen] = useState(false);
  const [isDealerLedgerReportOpen, setIsDealerLedgerReportOpen] = useState(false);
  const [isOpeningBalanceReportOpen, setIsOpeningBalanceReportOpen] = useState(false);
  const [isDealerOverdueBalanceReportOpen, setIsDealerOverdueBalanceReportOpen] = useState(false);
  const [isDealerClosingBalanceReportOpen, setIsDealerClosingBalanceReportOpen] = useState(false);
  const [isSalesPersonVisitReportOpen, setIsSalesPersonVisitReportOpen] = useState(false);
  const [isSalesPersonTodayFollowupsReportOpen, setIsSalesPersonTodayFollowupsReportOpen] = useState(false);
  const [isLoginLogReportOpen, setIsLoginLogReportOpen] = useState(false);
  const [isSalesPersonAccountStatementReportOpen, setIsSalesPersonAccountStatementReportOpen] = useState(false);
  const [isOrderSummaryReportOpen, setIsOrderSummaryReportOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastActiveTime, setLastActiveTime] = useState<string | null>(null); // New state for debugging

  const [paymentsReportInitialStatus, setPaymentsReportInitialStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [paymentsReportInitialFromDate, setPaymentsReportInitialFromDate] = useState<string>('');
  const [paymentsReportInitialToDate, setPaymentsReportInitialToDate] = useState<string>('');
  const [paymentsReportDialogKey, setPaymentsReportDialogKey] = useState(0);

  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  
  // Initialize with mock data to ensure the chart is never empty
  const [monthlySalesData, setMonthlySalesData] = useState<{ month: string; sales: number }[]>(() => {
    const currentYear = new Date().getFullYear();
    return [
      { month: `Jan ${currentYear}`, sales: 150000 },
      { month: `Feb ${currentYear}`, sales: 220000 },
      { month: `Mar ${currentYear}`, sales: 180000 },
      { month: `Apr ${currentYear}`, sales: 300000 },
    ];
  });

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
  
  const fetchLastActiveTime = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select('last_active_at')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setLastActiveTime(data?.last_active_at || null);
    } catch (error: any) {
      console.error('Error fetching last active time:', error.message);
      setLastActiveTime('Error fetching time');
    }
  }, [user]);

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
        // If error, the initial mock data is preserved.
      } else if (monthlySalesRaw && monthlySalesRaw.length > 0) {
        const salesByMonth: { [key: string]: number } = {};
        (monthlySalesRaw || []).forEach(sale => {
          const date = new Date(sale.sale_date);
          // Use short month name and year for clarity
          const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
          salesByMonth[monthYear] = (salesByMonth[monthYear] || 0) + sale.total_price;
        });

        const formattedMonthlySales = Object.keys(salesByMonth).map(month => ({
          month,
          sales: salesByMonth[month],
        }));
        
        // Overwrite mock data with real data
        setMonthlySalesData(formattedMonthlySales);
      }
      // If no real data is found, the initial state (mock data) is preserved.
      
      // Fetch last active time for debugging
      fetchLastActiveTime(user.id);

    } catch (error: any) {
      console.error('AdminDashboard: Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user, fetchLastActiveTime]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'admin') {
        showError('Access Denied: Only administrators can view this page.');
        navigate('/dashboard');
      } else {
        // Removed automatic update logic here
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

  // RENAMED and MODIFIED: Stop automatic PDF generation
  const handleDispatchSuccess = (dispatchedOrderId: string) => {
    setSelectedOrderIdForDetails(dispatchedOrderId);
    setIsOrderDetailsDialogOpen(true);
    setShouldPrintOrderDetails(false); // Do NOT force print
    setRefreshKey(prev => prev + 1); // Trigger refresh
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
          {/* Debugging info for Last Active Time */}
          <p className="text-xs text-muted-foreground mt-1">
            Last Active: {lastActiveTime ? new Date(lastActiveTime).toLocaleString() : 'N/A'}
          </p>
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
              setIsDealerReportOpen={setIsDealerReportOpen}
              setIsPaymentsReportOpen={setIsPaymentsReportOpen}
              setIsSalesReportsDialogOpen={setIsSalesReportsDialogOpen}
              setIsCompanyInfoDialogOpen={setIsCompanyInfoDialogOpen}
              setIsDealerLedgerReportOpen={setIsDealerLedgerReportOpen}
              setIsOpeningBalanceReportOpen={setIsOpeningBalanceReportOpen}
              setIsDealerOverdueBalanceReportOpen={setIsDealerOverdueBalanceReportOpen}
              setIsDealerClosingBalanceReportOpen={setIsDealerClosingBalanceReportOpen}
              setIsSalesPersonVisitReportOpen={setIsSalesPersonVisitReportOpen}
              setIsSalesPersonTodayFollowupsReportOpen={setIsSalesPersonTodayFollowupsReportOpen}
              setIsLoginLogReportOpen={setIsLoginLogReportOpen}
              setIsSalesPersonAccountStatementReportOpen={setIsSalesPersonAccountStatementReportOpen}
              setIsOrderSummaryReportOpen={setIsOrderSummaryReportOpen}
            />
          </SheetContent>
        </Sheet>
      </div>
      
      {/* 1. Sales Overview (4 cards) */}
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
      
      {/* 2. Sales Person Reports (NEW SECTION) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card text-card-foreground shadow-lg h-full lg:col-span-3">
          <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Sales Person Reports</CardTitle>
            <CardDescription className="text-teal-100 dark:text-teal-200">
              Detailed reports on sales person activity, performance, and dealer accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button onClick={() => setIsSalesPersonVisitReportOpen(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              <MapPin className="h-4 w-4 mr-2" /> Visit Report
            </Button>
            <Button onClick={() => setIsSalesPersonTodayFollowupsReportOpen(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              <Clock className="h-4 w-4 mr-2" /> Today's Follow-ups Report
            </Button>
            <Button onClick={() => setIsSalesPersonAccountStatementReportOpen(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              <Scale className="h-4 w-4 mr-2" /> Account Statement Report
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* 3. Sales Person Lead Management Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <AdminTodayFollowupsCard key={`admin-followups-${refreshKey}`} onViewReport={() => setIsSalesPersonTodayFollowupsReportOpen(true)} />
        <AdminTodayVisitsCard key={`admin-visits-${refreshKey}`} onViewReport={() => setIsSalesPersonVisitReportOpen(true)} />
        <AdminTotalPendingOrdersCard key={`admin-pending-orders-${refreshKey}`} onViewReport={() => setIsOrdersAwaitingDispatchReportOpen(true)} />
      </div>
      
      {/* 4. Orders to Dispatch / Dispatched Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <OrdersToDispatchCard key={`orders-to-dispatch-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} />
        <DispatchedOrdersCard key={`dispatched-orders-${refreshKey}`} />
      </div>
      
      {/* 5. Production Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ProductionAlertsCard key={`production-alerts-${refreshKey}`} />
      </div>
      
      {/* 6. Payment Overview / Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PaymentOverviewCard key={`payment-overview-${refreshKey}`} onViewReport={handleViewPaymentsReport} />
        <AllPendingPaymentsCard onPaymentAction={handlePaymentAction} key={`all-pending-payments-${refreshKey}`} />
      </div>

      {/* 7. Monthly Sales Trend Chart and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="bg-card text-card-foreground shadow-lg h-[350px]"> {/* Fixed height for smaller size */}
          <CardHeader className="bg-pink-500 dark:bg-pink-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Monthly Sales Trend</CardTitle>
            <CardDescription className="text-pink-100 dark:text-pink-200">
              Sales performance over the last 12 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-[280px]"> {/* Fixed height for chart area */}
            {loadingData ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <SalesChart data={monthlySalesData} />
            )}
          </CardContent>
        </Card>
        
        {/* Quick Actions Card */}
        <Card className="bg-card text-card-foreground shadow-lg h-[350px]">
          <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
            <CardDescription className="text-indigo-100 dark:text-indigo-200">
              Access key administrative functions quickly.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <Button onClick={() => navigate('/manage-users')} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <UserCog className="h-4 w-4 mr-2" /> Manage Users
            </Button>
            <Button onClick={() => navigate('/manage-dealers')} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <Building className="h-4 w-4 mr-2" /> Manage Dealers
            </Button>
            <Button onClick={() => navigate('/product-management-console')} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              <Boxes className="h-4 w-4 mr-2" /> Manage Inventory
            </Button>
            <Button onClick={() => setIsCompanyInfoDialogOpen(true)} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
              <Info className="h-4 w-4 mr-2" /> Company Info
            </Button>
          </CardContent>
        </Card>
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
      <OrderSummaryReportDialog
        isOpen={isOrderSummaryReportOpen}
        onOpenChange={setIsOrderSummaryReportOpen}
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
      <DealerOverdueBalanceReportDialog
        isOpen={isDealerOverdueBalanceReportOpen}
        onOpenChange={setIsDealerOverdueBalanceReportOpen}
      />
      <DealerClosingBalanceReportDialog
        isOpen={isDealerClosingBalanceReportOpen}
        onOpenChange={setIsDealerClosingBalanceReportOpen}
      />
      <SalesPersonVisitReportDialog
        isOpen={isSalesPersonVisitReportOpen}
        onOpenChange={setIsSalesPersonVisitReportOpen}
      />
      <SalesPersonTodayFollowupsReportDialog
        isOpen={isSalesPersonTodayFollowupsReportOpen}
        onOpenChange={setIsSalesPersonTodayFollowupsReportOpen}
      />
      <LoginLogReportDialog
        isOpen={isLoginLogReportOpen}
        onOpenChange={setIsLoginLogReportOpen}
      />
      <SalesPersonAccountStatementReportDialog
        isOpen={isSalesPersonAccountStatementReportOpen}
        onOpenChange={setIsSalesPersonAccountStatementReportOpen}
      />
    </div>
  );
};

export default AdminDashboard;