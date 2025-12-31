"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, PlusCircle, UserCog, Loader2, Eye, FileText, CreditCard } from 'lucide-react';
import SalesPersonPerformanceTable from '@/components/SalesPersonPerformanceTable';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import OrdersToDispatchCard from '@/components/OrdersToDispatchCard';
import DispatchedOrdersCard from '@/components/DispatchedOrdersCard';
import PaymentCard from '@/components/PaymentCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import OrdersAwaitingDispatchReportDialog from '@/components/reports/OrdersAwaitingDispatchReportDialog';
import DispatchedOrdersReportDialog from '@/components/reports/DispatchedOrdersReportDialog';
import SalesPersonPerformanceReportDialog from '@/components/reports/SalesPersonPerformanceReportDialog';
import DealerReportDialog from '@/components/reports/DealerReportDialog';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  description: string;
}

interface Dealer {
  id: string;
  name: string;
}

interface Sale {
  id: string;
  quantity: number;
  total_price: number;
  sale_date: string;
  products: { name: string } | null;
  orders: {
    dealers: { name: string } | null;
    user_id: string;
    profiles: { first_name: string; last_name: string } | null;
    payment_status: string;
  } | null;
}

interface SalesPersonProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface OrderSummary {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [allSalesPersons, setAllSalesPersons] = useState<SalesPersonProfile[]>([]);
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<string | null>(null);
  const [salesBySalesPersonData, setSalesBySalesPersonData] = useState<{ salesPerson: string; totalSales: number; id: string }[]>([]);
  const [currentMonthTarget, setCurrentMonthTarget] = useState<number | null>(null);
  const [currentMonthAchieved, setCurrentMonthAchieved] = useState<number | null>(null);
  const [currentMonthPending, setCurrentMonthPending] = useState<number | null>(null);
  const today = new Date();
  const [selectedChartMonth, setSelectedChartMonth] = useState<string>((today.getMonth() + 1).toString());
  const [selectedChartYear, setSelectedChartYear] = useState<string>(today.getFullYear().toString());
  const [loadingData, setLoadingData] = useState(true);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [shouldPrintOrderDetails, setShouldPrintOrderDetails] = useState(false);
  const [isOrdersAwaitingDispatchReportOpen, setIsOrdersAwaitingDispatchReportOpen] = useState(false);
  const [isDispatchedOrdersReportOpen, setIsDispatchedOrdersReportOpen] = useState(false);
  const [isSalesPersonPerformanceReportOpen, setIsSalesPersonPerformanceReportOpen] = useState(false);
  const [isDealerReportOpen, setIsDealerReportOpen] = useState(false);

  const getMonthName = (monthNum: string) => {
    const date = new Date(Date.UTC(2000, parseInt(monthNum) - 1, 1));
    return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i.toString());
    }
    return years;
  };

  const fetchAdminDashboardData = useCallback(async () => {
    if (!user || !isAdmin) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    try {
      const chartYearNum = parseInt(selectedChartYear);
      const chartMonthNum = parseInt(selectedChartMonth);
      const startOfMonth = new Date(Date.UTC(chartYearNum, chartMonthNum - 1, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(chartYearNum, chartMonthNum, 0, 23, 59, 59, 999)).toISOString();
      const currentMonthTargetDate = new Date(Date.UTC(chartYearNum, chartMonthNum - 1, 1)).toISOString().split('T')[0];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');

      if (profilesError) {
        console.error('AdminDashboard: Error fetching sales persons:', profilesError);
        showError(`Failed to load sales persons: ${profilesError.message}`);
        setAllSalesPersons([]);
      } else {
        setAllSalesPersons(profilesData || []);
      }

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, stock, description');

      if (productsError) {
        console.error('AdminDashboard: Error fetching products:', productsError);
        showError(`Failed to load products: ${productsError.message}`);
        setProducts([]);
      } else {
        setProducts(productsData || []);
      }

      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name');

      if (dealersError) {
        console.error('AdminDashboard: Error fetching dealers:', dealersError);
        showError(`Failed to load dealers: ${dealersError.message}`);
        setDealers([]);
        setActiveDealersCount(0);
      } else {
        setDealers(dealersData || []);
        setActiveDealersCount(dealersData?.length || 0);
      }

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`id, quantity, total_price, sale_date, products (name), orders (dealers (name), user_id, profiles (first_name, last_name), payment_status)`)
        .order('sale_date', { ascending: false });

      if (salesError) {
        console.error('AdminDashboard: Error fetching sales:', salesError);
        showError(`Failed to load sales data: ${salesError.message}`);
        setSales([]);
      } else {
        const typedSalesData: Sale[] = (salesData || []).map((sale: any) => ({
          id: sale.id,
          quantity: sale.quantity,
          total_price: sale.total_price,
          sale_date: sale.sale_date,
          products: sale.products || null,
          orders: sale.orders ? {
            dealers: sale.orders.dealers || null,
            user_id: sale.orders.user_id,
            profiles: sale.orders.profiles ? {
              first_name: sale.orders.profiles.first_name,
              last_name: sale.orders.profiles.last_name
            } : null,
            payment_status: sale.orders.payment_status,
          } : null,
        }));

        setSales(typedSalesData);
        const totalValue = typedSalesData.reduce((sum, sale) => sum + sale.total_price, 0) || 0;
        setTotalSalesValue(totalValue);
        setTotalOrders(typedSalesData.length || 0);

        const currentMonthSalesForAllPersons = typedSalesData.filter(sale =>
          new Date(sale.sale_date) >= new Date(startOfMonth) &&
          new Date(sale.sale_date) <= new Date(endOfMonth)
        );

        const salesByPersonMap = new Map<string, number>();
        const salesPersonNamesMap = new Map<string, string>();

        (profilesData || []).forEach(p => {
          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          salesPersonNamesMap.set(p.id, fullName || 'Unknown Sales Person');
          salesByPersonMap.set(p.id, 0);
        });

        currentMonthSalesForAllPersons.forEach(sale => {
          const personId = sale.orders?.user_id;
          if (personId) {
            salesByPersonMap.set(personId, (salesByPersonMap.get(personId) || 0) + sale.total_price);
          }
        });

        const formattedSalesByPerson = Array.from(salesByPersonMap.entries()).map(([id, totalSales]) => ({
          salesPerson: salesPersonNamesMap.get(id) || 'Unknown Sales Person',
          totalSales: totalSales,
          id: id,
        }));

        setSalesBySalesPersonData(formattedSalesByPerson);

        if (selectedSalesPersonId) {
          const { data: targetData, error: targetError } = await supabase
            .from('sales_targets')
            .select('target_amount')
            .eq('sales_person_id', selectedSalesPersonId)
            .eq('target_month', currentMonthTargetDate)
            .single();

          if (targetError && targetError.code !== 'PGRST116') {
            console.error('AdminDashboard: Supabase Error fetching target:', targetError);
            setCurrentMonthTarget(null);
          } else {
            setCurrentMonthTarget(targetData?.target_amount || 0);
          }

          const achieved = currentMonthSalesForAllPersons
            .filter(sale => sale.orders?.user_id === selectedSalesPersonId)
            .reduce((sum, sale) => sum + sale.total_price, 0);

          setCurrentMonthAchieved(achieved);
          const pending = (targetData?.target_amount || 0) - achieved;
          setCurrentMonthPending(pending);
        } else {
          setCurrentMonthTarget(null);
          setCurrentMonthAchieved(null);
          setCurrentMonthPending(null);
        }
      }
    } catch (error: any) {
      console.error('AdminDashboard: Error in fetchAdminDashboardData:', error);
      showError(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  }, [user, isAdmin, selectedSalesPersonId, selectedChartMonth, selectedChartYear]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAdmin) {
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        fetchAdminDashboardData();
      }
    }
  }, [sessionLoading, user, isAdmin, fetchAdminDashboardData, navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
      showError(`Failed to log out: ${error.message}`);
    } else {
      showSuccess('Logged out successfully!');
      navigate('/login');
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
    setShouldPrintOrderDetails(false);
  };

  const handleDispatchSuccessAndPrint = (dispatchedOrderId: string) => {
    setSelectedOrderIdForDetails(dispatchedOrderId);
    setIsOrderDetailsDialogOpen(true);
    setShouldPrintOrderDetails(true);
    fetchAdminDashboardData();
  };

  // Show loading state while session or data is loading
  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading admin dashboard...</p>
      </div>
    );
  }

  // If not admin, don't render anything (redirect will happen)
  if (!isAdmin) {
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
      icon: <Users className="h-3 w-3 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
    {
      title: "Total Products",
      value: products.length.toString(),
      change: "Overall",
      icon: <Boxes className="h-3 w-3 text-white" />,
      valueColor: "text-blue-800 dark:text-blue-200"
    },
  ];

  const salesPersonOptions = allSalesPersons.map(sp => ({
    value: sp.id,
    label: `${sp.first_name || ''} ${sp.last_name || ''}`.trim() || 'Unknown Sales Person',
  }));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Admin Dashboard</h1>
        <div className="flex gap-2 sm:gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate('/manage-products')} size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Boxes className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manage Products</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate('/manage-dealers')} size="icon" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Building className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manage Dealers</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate('/manage-users')} size="icon" className="bg-purple-600 text-white hover:bg-purple-700">
                <UserCog className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manage Users</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="bg-blue-600 text-white hover:bg-blue-700">
                    <FileText className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Reports</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Select a Report</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsOrdersAwaitingDispatchReportOpen(true)}>
                Orders Awaiting Dispatch
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsDispatchedOrdersReportOpen(true)}>
                Dispatched Orders
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonPerformanceReportOpen(true)}>
                Sales Person Performance
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsDealerReportOpen(true)}>
                Dealer Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleLogout} variant="destructive" size="icon" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PaymentCard />
        <SalesPersonPerformanceTable
          data={salesBySalesPersonData}
          salesPersonsOptions={salesPersonOptions}
          selectedSalesPersonId={selectedSalesPersonId}
          onSelectSalesPerson={setSelectedSalesPersonId}
          currentMonthTarget={currentMonthTarget}
          currentMonthAchieved={currentMonthAchieved}
          currentMonthPending={currentMonthPending}
          displayMonth={getMonthName(selectedChartMonth)}
          displayYear={selectedChartYear}
          selectedChartMonth={selectedChartMonth}
          setSelectedChartMonth={setSelectedChartMonth}
          selectedChartYear={selectedChartYear}
          setSelectedChartYear={setSelectedChartYear}
          getMonthName={getMonthName}
          generateYears={generateYears}
        />
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
    </div>
  );
};

export default AdminDashboard;