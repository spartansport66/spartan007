"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Building, PlusCircle, Loader2, Search, Eye } from 'lucide-react';
import MultiItemOrderForm from '@/components/MultiItemOrderForm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import PaymentStatusCard from '@/components/PaymentStatusCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import OrderDetailsDialog from '@/components/OrderDetailsDialog'; // Import OrderDetailsDialog
import SalesPersonPerformanceCard from '@/components/SalesPersonPerformanceCard'; // Import the new component

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

// New interfaces for order-wise display
interface OrderItemDisplay {
  product_id: string; // Added for client-side filtering
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderDisplay {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  payment_status: string;
  items: OrderItemDisplay[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [orders, setOrders] = useState<OrderDisplay[]>([]); // Changed from sales to orders
  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0); // Renamed to avoid conflict
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);

  // Filter states for recent sales
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [allDealers, setAllDealers] = useState<{ id: string; name: string }[]>([]);

  // Dialog states for order details
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);

    // Fetch all dealers assigned to the current user for the filter dropdown
    const { data: assignedDealersData, error: assignedDealersError } = await supabase
      .from('dealer_sales_persons')
      .select('dealers(id, name)')
      .eq('sales_person_id', user.id);

    if (assignedDealersError) {
      console.error('Error fetching assigned dealers:', assignedDealersError);
      showError(`Failed to load assigned dealers: ${assignedDealersError.message}`);
      setAllDealers([]);
    } else {
      const formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => item.dealers);
      setActiveDealersCount(formattedDealers.length || 0);
      setAllDealers(formattedDealers);
    }

    // Fetch orders and their associated sales items
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_date,
        total_amount,
        payment_status,
        dealers (name),
        sales (
          quantity,
          total_price,
          products (id, name, price)
        )
      `)
      .eq('user_id', user.id) // Filter by current sales person
      .order('order_date', { ascending: false });

    // Apply filters
    if (filterDealerId) {
      ordersQuery = ordersQuery.eq('dealer_id', filterDealerId);
    }
    if (filterFromDate) {
      ordersQuery = ordersQuery.gte('order_date', `${filterFromDate}T00:00:00.000Z`);
    }
    if (filterToDate) {
      ordersQuery = ordersQuery.lte('order_date', `${filterToDate}T23:59:59.999Z`);
    }

    const { data: ordersData, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      showError(`Failed to load orders data: ${ordersError.message}`);
      setOrders([]);
    } else {
      let processedOrders: OrderDisplay[] = (ordersData || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        total_amount: order.total_amount,
        dealer_name: order.dealers?.name || 'N/A',
        payment_status: order.payment_status,
        items: (order.sales || []).map((sale: any) => ({
          product_id: sale.products?.id || '', // Added product_id for client-side filtering
          product_name: sale.products?.name || 'N/A',
          quantity: sale.quantity,
          unit_price: sale.products?.price || 0,
          total_price: sale.total_price,
        })),
      }));

      setOrders(processedOrders);

      const totalValue = processedOrders.reduce((sum, order) => sum + order.total_amount, 0) || 0;
      const totalOrdersCountValue = processedOrders.length || 0;
      setTotalSalesValue(totalValue);
      setTotalOrdersCount(totalOrdersCountValue);
    }

    setLoadingData(false);
  }, [user, filterDealerId, filterFromDate, filterToDate]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (isAdmin) {
        navigate('/admin-dashboard');
      } else {
        fetchDashboardData();
      }
    }
  }, [user, sessionLoading, isAdmin, fetchDashboardData, navigate]);

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

  const handleClearFilters = () => {
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!user || isAdmin) {
    return null;
  }

  const salesOverview = [
    {
      title: "My Total Sales",
      value: `₹${totalSalesValue.toFixed(2)}`,
      change: "+20.1% from last month",
      icon: <DollarSign className="h-3 w-3 text-white" />,
      headerBg: "bg-green-500 dark:bg-green-700",
      valueColor: "text-green-800 dark:text-green-200"
    },
    {
      title: "My Total Orders",
      value: totalOrdersCount.toString(), // Use totalOrdersCount
      change: "+180.1% from last month",
      icon: <Package className="h-3 w-3 text-white" />,
      headerBg: "bg-indigo-500 dark:bg-indigo-700",
      valueColor: "text-indigo-800 dark:text-indigo-200"
    },
    {
      title: "My Active Dealers",
      value: activeDealersCount.toString(),
      change: "+19% from last month",
      icon: <Users className="h-3 w-3 text-white" />,
      headerBg: "bg-purple-500 dark:bg-purple-700",
      valueColor: "text-purple-800 dark:text-purple-200"
    },
    {
      title: "Pending Tasks",
      value: "57",
      change: "-5% from last month",
      icon: <Activity className="h-3 w-3 text-white" />,
      headerBg: "bg-red-500 dark:bg-red-700",
      valueColor: "text-red-800 dark:text-red-200"
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">Sales Dashboard</h1>
      </div>

      {/* Sales Overview Cards */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index} className="bg-card text-card-foreground shadow-md">
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-0 p-2 ${item.headerBg} text-white rounded-t-lg`}>
              <CardTitle className="text-[0.5rem] font-medium text-white">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className={`text-sm font-bold ${item.valueColor}`}>{item.value}</div>
              <p className="text-[0.4rem] text-muted-foreground mt-1">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Person Performance Card */}
      <div className="mb-6">
        <SalesPersonPerformanceCard />
      </div>

      {/* Multi-Item Order Form - Full Width */}
      <div className="mb-6">
        <MultiItemOrderForm />
      </div>

      {/* Payment Status Card */}
      <div className="mb-6">
        <PaymentStatusCard />
      </div>

      {/* Recent Activities (Orders) */}
      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">My Recent Orders</CardTitle> {/* Changed title */}
          <CardDescription className="text-teal-100 dark:text-teal-200">A list of your recent orders.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterDealer">Dealer Name</Label>
              <Select
                value={filterDealerId || "all"}
                onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}
              >
                <SelectTrigger id="filterDealer" className="w-full">
                  <SelectValue placeholder="Filter by dealer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dealers</SelectItem>
                  {allDealers.map(dealer => (
                    <SelectItem key={dealer.id} value={dealer.id}>{dealer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterFromDate">From Date</Label>
              <Input
                id="filterFromDate"
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterToDate">To Date</Label>
              <Input
                id="filterToDate"
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-full"
              />
            </div>
            <Button onClick={fetchDashboardData} className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
              Clear Filters
            </Button>
          </div>

          <div className="overflow-x-auto">
            {orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders recorded yet or matching your filters.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Order No.</TableHead> {/* Changed header */}
                      <TableHead className="text-muted-foreground">Dealer</TableHead>
                      <TableHead className="text-muted-foreground">Order Date</TableHead> {/* Changed header */}
                      <TableHead className="text-muted-foreground">Total Amount</TableHead>
                      <TableHead className="text-muted-foreground">Payment Status</TableHead>
                      <TableHead className="text-muted-foreground text-center">Actions</TableHead> {/* Added Actions header */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">#{order.order_number}</TableCell> {/* Display order_number */}
                        <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground">₹{order.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{order.payment_status || 'N/A'}</TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleViewOrderDetails(order.id)} 
                            title="View Order Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
          <CardDescription className="text-orange-100 dark:text-orange-200">Perform common tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 p-4">
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
              <Button onClick={() => navigate('/add-dealer')} size="icon" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <PlusCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Dealer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleLogout} variant="destructive" size="icon" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
      <MadeWithDyad />

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
    </div>
  );
};

export default Dashboard;