"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, FileText, Info, Gift, Menu, Scale, Mail, ShoppingCart } from 'lucide-react';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import OrdersToDispatchCard from '@/components/OrdersToDispatchCard';
import DispatchedOrdersCard from '@/components/DispatchedOrdersCard';
import AdminTodayFollowupsCard from '@/components/AdminTodayFollowupsCard';
import AdminTodayVisitsCard from '@/components/AdminTodayVisitsCard';
import AdminTotalPendingOrdersCard from '@/components/AdminTotalPendingOrdersCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
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
import DealerOverdueBalanceReportDialog from '@/components/reports/DealerOverdueBalanceReportDialog';
import DealerClosingBalanceReportDialog from '@/components/reports/DealerClosingBalanceReportDialog';
import SalesPersonVisitReportDialog from '@/components/reports/SalesPersonVisitReportDialog';
import SalesPersonTodayFollowupsReportDialog from '@/components/reports/SalesPersonTodayFollowupsReportDialog';
import LoginLogReportDialog from '@/components/reports/LoginLogReportDialog';
import SalesPersonAccountStatementReportDialog from '@/components/reports/SalesPersonAccountStatementReportDialog';
import OrderSummaryReportDialog from '@/components/reports/OrderSummaryReportDialog';
import NotificationEmailManager from '@/components/NotificationEmailManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SalesPersonLedgerReportDialog from '@/components/reports/SalesPersonLedgerReportDialog';
import SalesPersonPerformanceReportDialog from '@/components/reports/SalesPersonPerformanceReportDialog';
import DailyReportDialog from '@/components/reports/DailyReportDialog';
import SalesPersonDailySalesReportDialog from '@/components/reports/SalesPersonDailySalesReportDialog'; // New Import
import SalesPersonOrderWiseReportDialog from '@/components/reports/SalesPersonOrderWiseReportDialog';
import ItemWiseDealerSalesReportDialog from '@/components/reports/ItemWiseDealerSalesReportDialog';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType, session } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
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
  const [isEmailManagerOpen, setIsEmailManagerOpen] = useState(false);
  const [isSalesPersonLedgerReportOpen, setIsSalesPersonLedgerReportOpen] = useState(false);
  const [isSalesPersonPerformanceReportOpen, setIsSalesPersonPerformanceReportOpen] = useState(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isSalesPersonDailySalesReportOpen, setIsSalesPersonDailySalesReportOpen] = useState(false); // New State
  const [isSalesPersonOrderWiseReportOpen, setIsSalesPersonOrderWiseReportOpen] = useState(false);
  const [isItemWiseDealerSalesReportOpen, setIsItemWiseDealerSalesReportOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastActiveTime, setLastActiveTime] = useState<string | null>(null);

  const [paymentsReportInitialStatus, setPaymentsReportInitialStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [paymentsReportInitialFromDate, setPaymentsReportInitialFromDate] = useState<string>('');
  const [paymentsReportInitialToDate, setPaymentsReportInitialToDate] = useState<string>('');
  const [paymentsReportDialogKey, setPaymentsReportDialogKey] = useState(0);

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
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const { count: productsCount, error: productsError } = await supabase.from('products').select('*', { count: 'exact', head: true });
      if (!productsError) setProductsCount(productsCount || 0);

      const { count: dealersCount, error: dealersError } = await supabase.from('dealers').select('*', { count: 'exact', head: true });
      if (!dealersError) setActiveDealersCount(dealersCount || 0);

      const { count: ordersCount, error: ordersError } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      if (!ordersError) setTotalOrders(ordersCount || 0);

      const { data: salesRpcData, error: salesRpcError } = await supabase
        .rpc('get_net_sales_value')
        .single();
        
      if (salesRpcError) {
        console.error('Error fetching total sales via RPC:', salesRpcError);
        setTotalSalesValue(0);
      } else {
        const netSalesValue = (salesRpcData as any)?.net_sales_value || 0;
        setTotalSalesValue(netSalesValue);
      }
      
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
        fetchDashboardData();
        fetchCompanyInfo();
      }
    }
  }, [sessionLoading, user, userType, isAdmin, fetchDashboardData, fetchCompanyInfo, navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };

  const handleDispatchSuccess = (dispatchedOrderId: string) => {
    setSelectedOrderIdForDetails(dispatchedOrderId);
    setIsOrderDetailsDialogOpen(true);
    setRefreshKey(prev => prev + 1);
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
        <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2"><LogOut className="h-4 w-4" />Force Logout</Button>
      </div>
    );
  }

  if (userType !== 'admin') return null;

  const salesOverview = [
    { title: "Total Sales Value", value: `₹${totalSalesValue.toFixed(2)}`, change: "Net revenue (All Time)", icon: <DollarSign className="h-4 w-4 text-white" />, valueColor: "text-blue-800 dark:text-blue-200" },
    { title: "Total Orders", value: totalOrders.toString(), change: "Total orders placed", icon: <Package className="h-4 w-4 text-white" />, valueColor: "text-blue-800 dark:text-blue-200" },
    { title: "Active Dealers", value: activeDealersCount.toString(), change: "Total registered dealers", icon: <Building className="h-4 w-4 text-white" />, valueColor: "text-blue-800 dark:text-blue-200" },
    { title: "Total Products", value: productsCount.toString(), change: "Total unique products", icon: <Boxes className="h-4 w-4 text-white" />, valueColor: "text-blue-800 dark:text-blue-200" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="text-left">{companyName && (<h2 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{companyName}</h2>)}<p className="text-xs text-muted-foreground mt-1">Last Active: {lastActiveTime ? new Date(lastActiveTime).toLocaleString() : 'N/A'}</p></div>
        <h1 className="text-center text-3xl sm:text-4xl font-bold text-primary">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setIsEmailManagerOpen(true)} title="Notification Settings">
            <Mail className="h-5 w-5" />
          </Button>
          {/* Quick access to Online Orders Admin Dashboard for users with proper type */}
          {(userType === 'admin' || userType === 'online_dashboard') && (
            <Button variant="outline" size="icon" onClick={() => navigate('/online-orders-admin')} title="Online Orders Admin">
              <FileText className="h-5 w-5" />
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="text-gray-600 dark:text-gray-400"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px] sm:w-[300px]">
              <SheetHeader><SheetTitle>Admin Navigation</SheetTitle></SheetHeader>
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
                setIsSalesPersonLedgerReportOpen={setIsSalesPersonLedgerReportOpen}
                setIsSalesPersonPerformanceReportOpen={setIsSalesPersonPerformanceReportOpen}
                setIsDailyReportOpen={setIsDailyReportOpen}
                setIsSalesPersonDailySalesReportOpen={setIsSalesPersonDailySalesReportOpen}
                setIsItemWiseDealerSalesReportOpen={setIsItemWiseDealerSalesReportOpen}
                setIsSalesPersonOrderWiseReportOpen={setIsSalesPersonOrderWiseReportOpen}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">{salesOverview.map((item, index) => (<Card key={index} className="bg-card text-card-foreground shadow-md h-full"><CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 p-4 bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg`}><CardTitle className="text-base font-medium text-white">{item.title}</CardTitle>{item.icon}</CardHeader><CardContent className="p-4 pt-0"><div className={`text-3xl font-bold ${item.valueColor}`}>{item.value}</div><p className="text-xs text-muted-foreground mt-1">{item.change}</p></CardContent></Card>))}</div>
      
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 mb-6">
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between cursor-pointer hover:bg-accent" onClick={() => navigate('/receive-payment')}>
          <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Receive Payment</CardTitle>
            <CardDescription className="text-green-100 dark:text-green-200">Log new incoming payments.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <DollarSign className="h-12 w-12 text-green-500" />
          </CardContent>
        </Card>
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between cursor-pointer hover:bg-accent" onClick={() => navigate('/material-returns')}>
          <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Material Return</CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">Log materials returned from dealers.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <Package className="h-12 w-12 text-purple-500" />
          </CardContent>
        </Card>
        {/* Exchange Material card temporarily hidden */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between cursor-pointer hover:bg-accent" onClick={() => navigate('/purchase-dashboard')}>
          <CardHeader className="bg-cyan-500 dark:bg-cyan-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Purchasing</CardTitle>
            <CardDescription className="text-cyan-100 dark:text-cyan-200">Manage suppliers & raw materials.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <ShoppingCart className="h-12 w-12 text-cyan-500" />
          </CardContent>
        </Card>
        <AdminTodayFollowupsCard key={`admin-followups-${refreshKey}`} onViewReport={() => setIsSalesPersonTodayFollowupsReportOpen(true)} />
        <AdminTodayVisitsCard key={`admin-visits-${refreshKey}`} onViewReport={() => setIsSalesPersonVisitReportOpen(true)} />
        <AdminTotalPendingOrdersCard key={`admin-pending-orders-${refreshKey}`} onViewReport={() => setIsOrdersAwaitingDispatchReportOpen(true)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6"><OrdersToDispatchCard key={`orders-to-dispatch-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} /><DispatchedOrdersCard key={`dispatched-orders-${refreshKey}`} /></div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6"><PaymentOverviewCard key={`payment-overview-${refreshKey}`} onViewReport={handleViewPaymentsReport} /><AllPendingPaymentsCard onPaymentAction={handlePaymentAction} key={`all-pending-payments-${refreshKey}`} /></div>
      <MadeWithDyad />
      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isOrderDetailsDialogOpen} onOpenChange={setIsOrderDetailsDialogOpen} />
      <OrdersAwaitingDispatchReportDialog isOpen={isOrdersAwaitingDispatchReportOpen} onOpenChange={setIsOrdersAwaitingDispatchReportOpen} />
      <DispatchedOrdersReportDialog isOpen={isDispatchedOrdersReportOpen} onOpenChange={setIsDispatchedOrdersReportOpen} />
      <DealerReportDialog isOpen={isDealerReportOpen} onOpenChange={setIsDealerReportOpen} />
      <PaymentsReportDialog key={paymentsReportDialogKey} isOpen={isPaymentsReportOpen} onOpenChange={setIsPaymentsReportOpen} initialFilterStatus={paymentsReportInitialStatus} initialFilterFromDate={paymentsReportInitialFromDate} initialFilterToDate={paymentsReportInitialToDate} />
      <SalesReportsDialog isOpen={isSalesReportsDialogOpen} onOpenChange={setIsSalesReportsDialogOpen} />
      <OrderSummaryReportDialog isOpen={isOrderSummaryReportOpen} onOpenChange={setIsOrderSummaryReportOpen} />
      <CompanyInfoDialog isOpen={isCompanyInfoDialogOpen} onOpenChange={setIsCompanyInfoDialogOpen} onCompanyInfoUpdated={fetchCompanyInfo} />
      <DealerLedgerReportDialog isOpen={isDealerLedgerReportOpen} onOpenChange={setIsDealerLedgerReportOpen} />
      <OpeningBalanceReportDialog isOpen={isOpeningBalanceReportOpen} onOpenChange={setIsOpeningBalanceReportOpen} />
      <DealerOverdueBalanceReportDialog isOpen={isDealerOverdueBalanceReportOpen} onOpenChange={setIsDealerOverdueBalanceReportOpen} />
      <DealerClosingBalanceReportDialog isOpen={isDealerClosingBalanceReportOpen} onOpenChange={setIsDealerClosingBalanceReportOpen} />
      <SalesPersonVisitReportDialog isOpen={isSalesPersonVisitReportOpen} onOpenChange={setIsSalesPersonVisitReportOpen} />
      <SalesPersonTodayFollowupsReportDialog isOpen={isSalesPersonTodayFollowupsReportOpen} onOpenChange={setIsSalesPersonTodayFollowupsReportOpen} />
      <LoginLogReportDialog isOpen={isLoginLogReportOpen} onOpenChange={setIsLoginLogReportOpen} />
      <SalesPersonAccountStatementReportDialog isOpen={isSalesPersonAccountStatementReportOpen} onOpenChange={setIsSalesPersonAccountStatementReportOpen} />
      <SalesPersonLedgerReportDialog isOpen={isSalesPersonLedgerReportOpen} onOpenChange={setIsSalesPersonLedgerReportOpen} />
      <SalesPersonPerformanceReportDialog isOpen={isSalesPersonPerformanceReportOpen} onOpenChange={setIsSalesPersonPerformanceReportOpen} />
      <DailyReportDialog isOpen={isDailyReportOpen} onOpenChange={setIsDailyReportOpen} />
      <SalesPersonDailySalesReportDialog isOpen={isSalesPersonDailySalesReportOpen} onOpenChange={setIsSalesPersonDailySalesReportOpen} />
      <SalesPersonOrderWiseReportDialog isOpen={isSalesPersonOrderWiseReportOpen} onOpenChange={setIsSalesPersonOrderWiseReportOpen} />
      <ItemWiseDealerSalesReportDialog isOpen={isItemWiseDealerSalesReportOpen} onOpenChange={setIsItemWiseDealerSalesReportOpen} />
      
      <Dialog open={isEmailManagerOpen} onOpenChange={setIsEmailManagerOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>Configure email addresses for automated order notifications.</DialogDescription>
          </DialogHeader>
          <NotificationEmailManager />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;