"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, FileText, Info, Gift, Menu, Scale, Mail, ShoppingCart, Wrench, PlusCircle as PlusCircleIcon, Eye, Truck, Printer } from 'lucide-react';
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

interface PaymentDetail {
  id: string;
  dealer_id: string;
  dealer_name: string;
  amount: number;
  payment_method: string | null;
  payment_date: string | null;
  status: string;
  created_at: string | null;
  transaction_reference: string | null;
}

interface ApprovedBill {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  dealers?: { name?: string };
  companies?: { name?: string };
  source_table?: string;
  order_id?: string;
}

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
import DealerLedgerReportNewDialog from '@/components/reports/DealerLedgerReportNewDialog';
import CreditNoteDialog from '@/components/CreditNoteDialog';
import CreditNotesReportDialog from '@/components/reports/CreditNotesReportDialog';


const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType, session } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [autoPrintGatepass, setAutoPrintGatepass] = useState(false);
  const [gatepassLoadingId, setGatepassLoadingId] = useState<string | null>(null);
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
  const [isDealerLedgerReportNewOpen, setIsDealerLedgerReportNewOpen] = useState(false);
  const [isCreditNoteDialogOpen, setIsCreditNoteDialogOpen] = useState(false);
  const [isCreditNotesReportOpen, setIsCreditNotesReportOpen] = useState(false);

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
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState<boolean>(true);
  const [pendingDealerFilter, setPendingDealerFilter] = useState<string>('');
  const [approvedDealerFilter, setApprovedDealerFilter] = useState<string>('');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [approvedBills, setApprovedBills] = useState<ApprovedBill[]>([]);
  const [searchApprovedBill, setSearchApprovedBill] = useState<string>('');
  const [approvedBillsLoading, setApprovedBillsLoading] = useState<boolean>(true);
  
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

  const fetchPaymentDetails = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_received')
        .select(`
          id,
          dealer_id,
          amount,
          payment_method,
          payment_date,
          status,
          created_at,
          transaction_reference,
          dealers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        dealer_id: item.dealer_id,
        dealer_name: item.dealers?.name || 'Unknown Dealer',
        amount: Number(item.amount) || 0,
        payment_method: item.payment_method || 'N/A',
        payment_date: item.payment_date || null,
        status: item.status || 'unknown',
        created_at: item.created_at || null,
        transaction_reference: item.transaction_reference || null,
      }));

      setPayments(formatted);
    } catch (error: any) {
      console.error('Error fetching payment details:', error.message || error);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const fetchApprovedBills = useCallback(async () => {
    setApprovedBillsLoading(true);
    try {
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          order_id,
          bill_number,
          bill_date,
          grand_total,
          dealers(name),
          companies(name)
        `)
        .eq('status', 'approve')
        .order('bill_date', { ascending: false });

      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          order_id,
          bill_number,
          bill_date,
          grand_total,
          dealers(name),
          companies(name)
        `)
        .eq('status', 'approve')
        .order('bill_date', { ascending: false });

      if (spartanError && fightorError) {
        throw spartanError || fightorError;
      }

      const spartanWithSource = (spartanData || []).map((inv: any) => ({ ...inv, source_table: 'spartan' }));
      const fightorWithSource = (fightorData || []).map((inv: any) => ({ ...inv, source_table: 'fightor' }));
      const combined = [...spartanWithSource, ...fightorWithSource];
      combined.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
      setApprovedBills(combined);
    } catch (error: any) {
      console.error('Error fetching approved bills:', error.message || error);
      setApprovedBills([]);
    } finally {
      setApprovedBillsLoading(false);
    }
  }, []);

  const handleViewApprovedBill = (invoice: ApprovedBill) => {
    const orderIdToView = invoice.order_id || invoice.id;
    if (!orderIdToView) {
      showError('Unable to load full order details: missing linked order ID.');
      return;
    }
    setSelectedOrderIdForDetails(orderIdToView);
    setAutoPrintGatepass(false);
    setIsOrderDetailsDialogOpen(true);
  };

  const handlePrintGatepassApprovedBill = (invoice: ApprovedBill) => {
    const orderIdToView = invoice.order_id || invoice.id;
    if (!orderIdToView) {
      showError('Unable to print gatepass: missing linked order ID.');
      return;
    }
    setSelectedOrderIdForDetails(orderIdToView);
    setAutoPrintGatepass(true);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleGatepassApprovedBill = async (invoice: ApprovedBill) => {
    if (!invoice.order_id) {
      showError('Cannot update gatepass: missing linked order ID.');
      return;
    }

    setGatepassLoadingId(invoice.id);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ dispatched: true, dispatch_date: new Date().toISOString() })
        .eq('id', invoice.order_id);

      if (error) {
        throw error;
      }

      showSuccess('Gatepass dispatched and order updated successfully.');
    } catch (error: any) {
      console.error('Error updating gatepass for approved bill:', error.message || error);
      showError(error.message || 'Failed to update gatepass dispatch.');
    } finally {
      setGatepassLoadingId(null);
    }
  };

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
      
      await fetchPaymentDetails();
      await fetchApprovedBills();
      fetchLastActiveTime(user.id);
    } catch (error: any) {
      console.error('AdminDashboard: Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user, fetchLastActiveTime, fetchPaymentDetails, fetchApprovedBills]);

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

  const pendingPayments = payments.filter(
    (payment) =>
      payment.status === 'pending_approval' &&
      payment.dealer_name.toLowerCase().includes(pendingDealerFilter.trim().toLowerCase())
  );
  const approvedPayments = payments.filter(
    (payment) =>
      payment.status === 'completed' &&
      payment.dealer_name.toLowerCase().includes(approvedDealerFilter.trim().toLowerCase())
  );

  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPaymentIds((prev) =>
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId]
    );
  };

  const handleSelectAllVisible = (visiblePayments: PaymentDetail[]) => {
    const visibleIds = visiblePayments.map((payment) => payment.id);
    const allSelected = visibleIds.every((id) => selectedPaymentIds.includes(id));
    setSelectedPaymentIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      const next = [...prev];
      visibleIds.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  };

  const handlePrintSelectedPayments = () => {
    const selectedPayments = payments.filter((payment) => selectedPaymentIds.includes(payment.id));
    if (selectedPayments.length === 0) {
      showError('Select at least one payment to print.');
      return;
    }

    const rowsHtml = selectedPayments
      .map(
        (payment) => `
          <tr>
            <td style="padding:8px;border:1px solid #ccc">${payment.dealer_name}</td>
            <td style="padding:8px;border:1px solid #ccc">₹${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding:8px;border:1px solid #ccc">${payment.payment_method || 'N/A'}</td>
            <td style="padding:8px;border:1px solid #ccc">${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : 'N/A'}</td>
            <td style="padding:8px;border:1px solid #ccc">${payment.status === 'completed' ? 'Approved' : 'Pending Approval'}</td>
            <td style="padding:8px;border:1px solid #ccc">${payment.transaction_reference || '—'}</td>
          </tr>
        `
      )
      .join('');

    const newWindow = window.open('', '_blank');
    if (!newWindow) {
      showError('Unable to open print window.');
      return;
    }

    newWindow.document.write(`
      <html>
        <head>
          <title>Selected Payments</title>
          <style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background:#f4f4f4;}</style>
        </head>
        <body>
          <h1>Selected Payments</h1>
          <table>
            <thead>
              <tr>
                <th>Dealer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    newWindow.document.close();
    newWindow.focus();
    newWindow.print();
  };

  const selectedPaymentsCount = selectedPaymentIds.length;
  const pendingAllSelected = pendingPayments.length > 0 && pendingPayments.every((payment) => selectedPaymentIds.includes(payment.id));
  const approvedAllSelected = approvedPayments.length > 0 && approvedPayments.every((payment) => selectedPaymentIds.includes(payment.id));

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
          <Button 
            variant="default" 
            size="sm"
            onClick={() => navigate('/multi-order-form')} 
            title="Create New Order"
            className="bg-green-600 hover:bg-green-700"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Place Order
          </Button>
          <Button 
            variant="secondary"
            size="sm"
            onClick={() => setIsCreditNoteDialogOpen(true)}
            title="Create Credit Note"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <PlusCircleIcon className="h-4 w-4 mr-2" />
            Credit Note
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsEmailManagerOpen(true)} title="Notification Settings">
            <Mail className="h-5 w-5" />
          </Button>
          {/* Quick access to Online Orders Admin Dashboard for users with proper type */}
          {(userType === 'admin' || userType === 'online_dashboard') && (
            <Button variant="outline" size="icon" onClick={() => navigate('/online-orders-admin')} title="Online Orders Admin">
              <FileText className="h-5 w-5" />
            </Button>
          )}
          {/* Combo Offers Admin */}
          <Button variant="outline" size="icon" onClick={() => navigate('/combo-offers-admin')} title="Combo Offers">
            <Gift className="h-5 w-5" />
          </Button>

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
                setIsCreditNoteDialogOpen={setIsCreditNoteDialogOpen}
                setIsCreditNotesReportOpen={setIsCreditNotesReportOpen}
                setIsSalesPersonAccountStatementReportOpen={setIsSalesPersonAccountStatementReportOpen}
                setIsOrderSummaryReportOpen={setIsOrderSummaryReportOpen}
                setIsSalesPersonLedgerReportOpen={setIsSalesPersonLedgerReportOpen}
                setIsSalesPersonPerformanceReportOpen={setIsSalesPersonPerformanceReportOpen}
                setIsDailyReportOpen={setIsDailyReportOpen}
                setIsSalesPersonDailySalesReportOpen={setIsSalesPersonDailySalesReportOpen}
                setIsItemWiseDealerSalesReportOpen={setIsItemWiseDealerSalesReportOpen}
                setIsSalesPersonOrderWiseReportOpen={setIsSalesPersonOrderWiseReportOpen}
                setIsDealerLedgerReportNewOpen={setIsDealerLedgerReportNewOpen}

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
        <AdminTotalPendingOrdersCard key={`admin-pending-orders-${refreshKey}`} onViewReport={() => navigate('/orders-awaiting-dispatch')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6"><OrdersToDispatchCard key={`orders-to-dispatch-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} /><DispatchedOrdersCard key={`dispatched-orders-${refreshKey}`} /></div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="bg-card text-card-foreground shadow-lg overflow-hidden">
          <CardHeader className="bg-yellow-500 dark:bg-yellow-700 text-white rounded-t-lg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Pending Payments Details</CardTitle>
                <CardDescription className="text-yellow-100">Dealer, amount, method, date and approval status</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="pending-dealer-filter"
                  value={pendingDealerFilter}
                  onChange={(event) => setPendingDealerFilter(event.target.value)}
                  placeholder="Filter dealer"
                  className="min-w-[180px] sm:min-w-[220px] text-black"
                />
                <Button onClick={handlePrintSelectedPayments} disabled={selectedPaymentsCount === 0}>
                  Print Selected ({selectedPaymentsCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-full max-h-[440px] overflow-y-auto">
                <div className="grid grid-cols-12 gap-2 bg-yellow-50 p-3 text-xs font-semibold text-gray-700 border-b sticky top-0 z-10">
                  <div className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      checked={pendingAllSelected}
                      onChange={() => handleSelectAllVisible(pendingPayments)}
                      aria-label="Select all pending payments"
                    />
                  </div>
                  <div className="col-span-3">Dealer</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Method</div>
                  <div className="col-span-2">Payment Date</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Ref</div>
                </div>
                {paymentsLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading payment details...</div>
                ) : pendingPayments.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No pending payment entries</div>
                ) : (
                  pendingPayments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-12 gap-2 p-3 items-center text-sm border-b last:border-b-0 hover:bg-yellow-50 transition-colors">
                      <div className="col-span-1 flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                          checked={selectedPaymentIds.includes(payment.id)}
                          onChange={() => togglePaymentSelection(payment.id)}
                          aria-label={`Select payment for ${payment.dealer_name}`}
                        />
                      </div>
                      <div className="col-span-3 font-medium text-yellow-700">{payment.dealer_name}</div>
                      <div className="col-span-2 text-green-700">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="col-span-2 capitalize">{payment.payment_method || 'N/A'}</div>
                      <div className="col-span-2 text-gray-600">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : 'N/A'}</div>
                      <div className="col-span-1"><span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">Pending Approval</span></div>
                      <div className="col-span-1 text-xs text-gray-500 truncate" title={payment.transaction_reference || ''}>{payment.transaction_reference || '—'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg overflow-hidden">
          <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Approved Payments Details</CardTitle>
                <CardDescription className="text-green-100">Dealer, amount, method, date and approval status</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="approved-dealer-filter"
                  value={approvedDealerFilter}
                  onChange={(event) => setApprovedDealerFilter(event.target.value)}
                  placeholder="Filter dealer"
                  className="min-w-[180px] sm:min-w-[220px] text-black"
                />
                <Button onClick={handlePrintSelectedPayments} disabled={selectedPaymentsCount === 0}>
                  Print Selected ({selectedPaymentsCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-full max-h-[440px] overflow-y-auto">
                <div className="grid grid-cols-12 gap-2 bg-green-50 p-3 text-xs font-semibold text-gray-700 border-b sticky top-0 z-10">
                  <div className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={approvedAllSelected}
                      onChange={() => handleSelectAllVisible(approvedPayments)}
                      aria-label="Select all approved payments"
                    />
                  </div>
                  <div className="col-span-3">Dealer</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Method</div>
                  <div className="col-span-2">Payment Date</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Ref</div>
                </div>
                {paymentsLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading payment details...</div>
                ) : approvedPayments.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No approved payment entries</div>
                ) : (
                  approvedPayments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-12 gap-2 p-3 items-center text-sm border-b last:border-b-0 hover:bg-green-50 transition-colors">
                      <div className="col-span-1 flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          checked={selectedPaymentIds.includes(payment.id)}
                          onChange={() => togglePaymentSelection(payment.id)}
                          aria-label={`Select payment for ${payment.dealer_name}`}
                        />
                      </div>
                      <div className="col-span-3 font-medium text-green-700">{payment.dealer_name}</div>
                      <div className="col-span-2 text-green-700">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="col-span-2 capitalize">{payment.payment_method || 'N/A'}</div>
                      <div className="col-span-2 text-gray-600">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : 'N/A'}</div>
                      <div className="col-span-1"><span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Approved</span></div>
                      <div className="col-span-1 text-xs text-gray-500 truncate" title={payment.transaction_reference || ''}>{payment.transaction_reference || '—'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6">
        <Card className="bg-card text-card-foreground shadow-lg overflow-hidden">
          <CardHeader className="bg-emerald-600 dark:bg-emerald-700 text-white rounded-t-lg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Approved Bills</CardTitle>
                <CardDescription className="text-emerald-100">Approved billing dashboard invoices</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="search-approved-bill"
                  value={searchApprovedBill}
                  onChange={(event) => setSearchApprovedBill(event.target.value)}
                  placeholder="Search Bill #, Dealer or Company"
                  className="min-w-[200px] sm:min-w-[280px] text-black"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-full max-h-[520px] overflow-y-auto">
                <div className="grid grid-cols-12 gap-2 bg-emerald-50 p-3 text-xs font-semibold text-gray-700 border-b sticky top-0 z-10">
                  <div className="col-span-2">Bill #</div>
                  <div className="col-span-2">Company</div>
                  <div className="col-span-3">Dealer</div>
                  <div className="col-span-2 text-center">Date</div>
                  <div className="col-span-1 text-right">Amount</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {approvedBillsLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading approved bills...</div>
                ) : approvedBills.filter((invoice) => {
                  if (!searchApprovedBill.trim()) return true;
                  const search = searchApprovedBill.toLowerCase();
                  return (
                    invoice.bill_number?.toLowerCase().includes(search) ||
                    invoice.dealers?.name?.toLowerCase().includes(search) ||
                    invoice.companies?.name?.toLowerCase().includes(search)
                  );
                }).length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No approved bills found</div>
                ) : (
                  approvedBills
                    .filter((invoice) => {
                      if (!searchApprovedBill.trim()) return true;
                      const search = searchApprovedBill.toLowerCase();
                      return (
                        invoice.bill_number?.toLowerCase().includes(search) ||
                        invoice.dealers?.name?.toLowerCase().includes(search) ||
                        invoice.companies?.name?.toLowerCase().includes(search)
                      );
                    })
                    .map((invoice) => (
                      <div key={`${invoice.source_table}-${invoice.id}`} className="grid grid-cols-12 gap-2 p-3 items-center text-sm border-b last:border-b-0 hover:bg-emerald-50 transition-colors">
                        <div className="col-span-2 font-mono text-emerald-700 truncate">{invoice.bill_number || '—'}</div>
                        <div className="col-span-2 truncate text-gray-700">{invoice.companies?.name || 'N/A'}</div>
                        <div className="col-span-3 truncate text-gray-600">{invoice.dealers?.name || 'N/A'}</div>
                        <div className="col-span-2 text-center text-gray-600">{invoice.bill_date ? new Date(invoice.bill_date).toLocaleDateString('en-IN') : 'N/A'}</div>
                        <div className="col-span-1 text-right font-semibold text-emerald-700">₹{(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="col-span-2 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="View Bill"
                            aria-label="View full order details"
                            onClick={(event) => {
                              event.preventDefault();
                              handleViewApprovedBill(invoice);
                            }}
                          >
                            <Eye className="h-4 w-4 text-emerald-700" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Gatepass"
                            aria-label="Mark order dispatched with gate pass"
                            onClick={(event) => {
                              event.preventDefault();
                              handleGatepassApprovedBill(invoice);
                            }}
                            disabled={!invoice.order_id || gatepassLoadingId === invoice.id}
                          >
                            <Truck className="h-4 w-4 text-emerald-700" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Print Gatepass"
                            aria-label="Print gatepass for this order"
                            onClick={(event) => {
                              event.preventDefault();
                              handlePrintGatepassApprovedBill(invoice);
                            }}
                            disabled={gatepassLoadingId === invoice.id}
                          >
                            <Printer className="h-4 w-4 text-emerald-700" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={(open) => {
          setIsOrderDetailsDialogOpen(open);
          if (!open) setAutoPrintGatepass(false);
        }}
        showGatePassButton={false}
        autoPrintGatepass={autoPrintGatepass}
      />
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
      <CreditNoteDialog isOpen={isCreditNoteDialogOpen} onOpenChange={setIsCreditNoteDialogOpen} onSuccess={() => {
        setIsCreditNoteDialogOpen(false);
        showSuccess('Credit note created successfully');
      }} />
      <CreditNotesReportDialog isOpen={isCreditNotesReportOpen} onOpenChange={setIsCreditNotesReportOpen} />
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
      <DealerLedgerReportNewDialog isOpen={isDealerLedgerReportNewOpen} onOpenChange={setIsDealerLedgerReportNewOpen} />
      
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