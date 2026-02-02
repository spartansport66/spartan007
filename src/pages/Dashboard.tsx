"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, Search, Eye, FileText, Lock, Edit, PlusCircle } from 'lucide-react';
import MultiItemOrderForm from '@/components/MultiItemOrderForm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import SalesPersonPerformanceCard from '@/components/SalesPersonPerformanceCard';
import PaymentStatusCard from '@/components/PaymentStatusCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SalesPersonSalesReport from '@/components/reports/SalesPersonSalesReport';
import SalesPersonDealerReport from '@/components/reports/SalesPersonDealerReport';
import SalesPersonPaymentsReport from '@/components/reports/SalesPersonPaymentsReport';
import DailyVisitProgressCard from '@/components/DailyVisitProgressCard';
import SalesPersonFollowupsCard from '@/components/SalesPersonFollowupsCard'; // New Import
import EditOrderDialog from '@/components/EditOrderDialog'; // NEW IMPORT

interface Product {
  id: string;
  name: string;
  dp: number; // Changed from 'price' to 'dp'
  stock: number;
  description: string;
}

interface Dealer {
  id: string;
  name: string;
}

interface OrderItemDisplay {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_dp: number;
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
  dispatched: boolean; // Added dispatched status
}

// Format date as dd/mm/yyyy
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, session } = useSession(); // Added session here
  const [orders, setOrders] = useState<OrderDisplay[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true); // New state for orders loading
  const [salesPersonName, setSalesPersonName] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Go back 29 days to include today, making it 30 days total
    const day = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    const month = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const year = thirtyDaysAgo.getFullYear();
    return `${year}-${month}-${day}`;
  });
  const [filterToDate, setFilterToDate] = useState<string>(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${year}-${month}-${day}`;
  });
  const [allDealers, setAllDealers] = useState<{ id: string; name: string }[]>([]);

  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  
  // NEW EDIT STATE
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

  // New states for salesperson reports
  const [isSalesPersonSalesReportOpen, setIsSalesPersonSalesReportOpen] = useState(false);
  const [isSalesPersonDealerReportOpen, setIsSalesPersonDealerReportOpen] = useState(false);
  const [isSalesPersonPaymentsReportOpen, setIsSalesPersonPaymentsReportOpen] = useState(false);
  
  // State to force explicit refresh of dashboard data
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    // Also trigger order fetch explicitly if needed, although useEffect below handles it
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    // Fetch sales person name
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profileError && profileData) {
      setSalesPersonName(`${profileData.first_name || ''} ${profileData.last_name || ''}`.trim());
    }

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
      setAllDealers(formattedDealers);
    }
    
    setLoadingData(false);
  }, [user]);

  const fetchRecentOrders = useCallback(async () => {
    if (!user) {
      setLoadingOrders(false);
      return;
    }
    setLoadingOrders(true);

    // Fetch orders and their associated sales items
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_date,
        total_amount,
        payment_status,
        dispatched,
        dealers (name),
        sales (
          quantity,
          total_price,
          products (id, name, dp)
        )
      `)
      .eq('user_id', user.id)
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
        dispatched: order.dispatched, // Include dispatched status
        items: (order.sales || []).map((sale: any) => ({
          product_id: sale.products?.id || '',
          product_name: sale.products?.name || 'N/A',
          quantity: sale.quantity,
          unit_dp: sale.products?.dp || 0,
          total_price: sale.total_price,
        })),
      }));

      setOrders(processedOrders);
    }

    setLoadingOrders(false);
  }, [user, filterDealerId, filterFromDate, filterToDate, refreshKey]); // Added refreshKey dependency

  // Effect for initial data load (runs once)
  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (isAdmin) {
        navigate('/admin-dashboard');
      } else {
        fetchInitialData();
      }
    }
  }, [user, sessionLoading, isAdmin, fetchInitialData, navigate]);
  
  // Effect for fetching orders (runs when filters or refreshKey change)
  useEffect(() => {
    if (user && !isAdmin) {
      fetchRecentOrders();
    }
  }, [user, isAdmin, fetchRecentOrders]);

  const handleLogout = async () => {
    try {
      // Attempt to sign out. Even if it fails with 403, the session is likely invalid on server.
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Logout API call failed, but proceeding with client-side logout as session might be invalid:', error.message);
        showError(`Logout failed: ${error.message}. You are being redirected.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      // Regardless of API success/failure, redirect to login.
      // The SessionContext's onAuthStateChange will handle clearing local state.
      navigate('/login');
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting.`);
      navigate('/login');
    }
  };

  const handleApplyOrderFilters = () => {
    // Trigger fetchRecentOrders by updating the refreshKey
    setRefreshKey(prev => prev + 1);
  };

  const handleClearFilters = () => {
    setFilterDealerId('');
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const todayString = `${year}-${month}-${day}`;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoDay = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    const thirtyDaysAgoMonth = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const thirtyDaysAgoYear = thirtyDaysAgo.getFullYear();
    const thirtyDaysAgoString = `${thirtyDaysAgoYear}-${thirtyDaysAgoMonth}-${thirtyDaysAgoDay}`;

    setFilterFromDate(thirtyDaysAgoString); // Reset to 30 days ago
    setFilterToDate(todayString); // Reset to today
    
    // Trigger fetchRecentOrders
    setRefreshKey(prev => prev + 1);
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };
  
  // NEW HANDLER
  const handleEditOrder = (orderId: string) => {
    setSelectedOrderIdForEdit(orderId);
    setIsEditOrderDialogOpen(true);
  };
  
  // NEW HANDLER
  const handleOrderUpdated = () => {
    // Close edit dialog and refresh data
    setIsEditOrderDialogOpen(false);
    handleRefreshData();
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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 w-full">
        <div className="text-left flex-shrink-0">
          <h2 className="text-[4vw] sm:text-[2vw] md:text-xl lg:text-2xl font-bold text-black dark:text-black whitespace-nowrap overflow-hidden text-ellipsis max-w-[40vw] sm:max-w-none">
            Welcome, {salesPersonName || 'Sales Person'}!
          </h2>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> My Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Reports</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsSalesPersonSalesReportOpen(true)}>
                Sales Detail Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonDealerReportOpen(true)}>
                My Dealer Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonPaymentsReportOpen(true)}>
                My Payments Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/add-dealer')}>
                <PlusCircle className="h-4 w-4 mr-2" /> Add New Dealer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/manage-dealers')}>
                <Building className="h-4 w-4 mr-2" /> Manage Dealers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/change-password')}>
                <Lock className="h-4 w-4 mr-2" /> Change Password
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleLogout} variant="ghost" size="icon" className="text-black hover:text-black p-2">
            <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

      {/* Sales Person Performance Card and Daily Visit Progress Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SalesPersonPerformanceCard key={`performance-${refreshKey}`} />
        <DailyVisitProgressCard key={`visits-${refreshKey}`} />
      </div>
      
      {/* Dealer Follow-ups Card - New Row */}
      <div className="grid grid-cols-1 mb-6">
        <SalesPersonFollowupsCard key={`followups-${refreshKey}`} />
      </div>

      {/* Multi-Item Order Form - Full Width */}
      <div className="mb-6">
        <MultiItemOrderForm onOrderPlaced={handleRefreshData} />
      </div>

      {/* Payment Status Card */}
      <div className="mb-6">
        <PaymentStatusCard key={`payment-status-${refreshKey}`} />
      </div>

      {/* Recent Activities (Orders) */}
      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">My Recent Orders</CardTitle>
          <CardDescription className="text-teal-100 dark:text-teal-200">
            A list of your recent orders.
          </CardDescription>
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
            <Button onClick={handleApplyOrderFilters} className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
              Clear Filters
            </Button>
          </div>
          <div className="overflow-x-auto">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders recorded yet or matching your filters.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Order No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer</TableHead>
                      <TableHead className="text-muted-foreground">Order Date</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                      <TableHead className="text-muted-foreground">Payment Status</TableHead>
                      <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">#{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{order.payment_status || 'N/A'}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewOrderDetails(order.id)}
                              title="View Order Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {/* NEW EDIT BUTTON - Only allow editing if not yet dispatched */}
                            {!order.dispatched && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditOrder(order.id)}
                                title="Edit Order"
                              >
                                <Edit className="h-4 w-4 text-orange-600" />
                              </Button>
                            )}
                          </div>
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
      <MadeWithDyad />
      {/* Order Details Dialog */}
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
      {/* NEW EDIT ORDER DIALOG */}
      <EditOrderDialog
        orderId={selectedOrderIdForEdit}
        isOpen={isEditOrderDialogOpen}
        onOpenChange={setIsEditOrderDialogOpen}
        onOrderUpdated={handleOrderUpdated}
      />
      {/* Salesperson Reports Dialogs */}
      <SalesPersonSalesReport
        isOpen={isSalesPersonSalesReportOpen}
        onOpenChange={setIsSalesPersonSalesReportOpen}
      />
      <SalesPersonDealerReport
        isOpen={isSalesPersonDealerReportOpen}
        onOpenChange={setIsSalesPersonDealerReportOpen}
      />
      <SalesPersonPaymentsReport
        isOpen={isSalesPersonPaymentsReportOpen}
        onOpenChange={setIsSalesPersonPaymentsReportOpen}
      />
    </div>
  );
};

export default Dashboard;