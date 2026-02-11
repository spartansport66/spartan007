"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, Search, Eye, FileText, Lock, Edit, PlusCircle, Trash2 } from 'lucide-react';
import MultiItemOrderForm from '@/components/MultiItemOrderForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import SalesPersonFollowupsCard from '@/components/SalesPersonFollowupsCard';
import EditOrderDialog from '@/components/EditOrderDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  name: string;
  dp: number;
  closing_stock: number;
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
  dispatched: boolean;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [orders, setOrders] = useState<OrderDisplay[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [salesPersonName, setSalesPersonName] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
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
  
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

  const [isSalesPersonSalesReportOpen, setIsSalesPersonSalesReportOpen] = useState(false);
  const [isSalesPersonDealerReportOpen, setIsSalesPersonDealerReportOpen] = useState(false);
  const [isSalesPersonPaymentsReportOpen, setIsSalesPersonPaymentsReportOpen] = useState(false);
  
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profileError && profileData) {
      setSalesPersonName(`${profileData.first_name || ''} ${profileData.last_name || ''}`.trim());
    }

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
          product_id,
          quantity,
          total_price,
          products (id, name, dp)
        )
      `)
      .eq('user_id', user.id)
      .order('order_date', { ascending: false });

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
        dispatched: order.dispatched,
        items: (order.sales || []).map((sale: any) => ({
          product_id: sale.product_id || '',
          product_name: sale.products?.name || 'N/A',
          quantity: sale.quantity,
          unit_dp: sale.products?.dp || 0,
          total_price: sale.total_price,
        })),
      }));

      setOrders(processedOrders);
    }

    setLoadingOrders(false);
  }, [user, filterDealerId, filterFromDate, filterToDate, refreshKey]);

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
  
  useEffect(() => {
    if (user && !isAdmin) {
      fetchRecentOrders();
    }
  }, [user, isAdmin, fetchRecentOrders]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      navigate('/login');
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
      navigate('/login');
    }
  };

  const handleApplyOrderFilters = () => {
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

    setFilterFromDate(thirtyDaysAgoString);
    setFilterToDate(todayString);
    setRefreshKey(prev => prev + 1);
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };
  
  const handleEditOrder = (orderId: string) => {
    setSelectedOrderIdForEdit(orderId);
    setIsEditOrderDialogOpen(true);
  };
  
  const handleOrderUpdated = () => {
    setIsEditOrderDialogOpen(false);
    handleRefreshData();
  };

  const handleDeleteOrder = async (order: OrderDisplay) => {
    setLoadingOrders(true);
    try {
      // 1. Restore stock levels using RPC to bypass RLS restrictions
      for (const item of order.items) {
        const { error: stockError } = await supabase.rpc('revert_stock_out', {
          product_id_in: item.product_id,
          quantity_in: item.quantity
        });
        
        if (stockError) {
          console.error(`Failed to revert stock for ${item.product_name}:`, stockError.message);
        }

        // Check if stock is now positive to resolve alerts
        const { data: productData } = await supabase
          .from('products')
          .select('closing_stock')
          .eq('id', item.product_id)
          .single();
        
        if (productData && productData.closing_stock >= 0) {
          await supabase.from('production_alerts').update({ resolved: true }).eq('product_id', item.product_id).eq('resolved', false);
        }
      }

      // 2. Remove associated payments
      await supabase.from('payments').delete().eq('order_id', order.id);

      // 3. Remove associated sales items
      await supabase.from('sales').delete().eq('order_id', order.id);

      // 4. Delete the order
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', order.id);
      if (deleteError) throw deleteError;

      showSuccess(`Order #${order.order_number} deleted and stock restored.`);
      fetchRecentOrders();
      handleRefreshData();
    } catch (error: any) {
      console.error('Error deleting order:', error);
      showError(`Failed to delete order: ${error.message}`);
    } finally {
      setLoadingOrders(false);
    }
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!user || isAdmin) return null;

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
              <DropdownMenuItem onClick={() => setIsSalesPersonSalesReportOpen(true)}>Sales Detail Report</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonDealerReportOpen(true)}>My Dealer Report</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonPaymentsReportOpen(true)}>My Payments Report</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/add-dealer')}><PlusCircle className="h-4 w-4 mr-2" /> Add New Dealer</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/manage-dealers')}><Building className="h-4 w-4 mr-2" /> Manage Dealers</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/change-password')}><Lock className="h-4 w-4 mr-2" /> Change Password</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleLogout} variant="ghost" size="icon" className="text-black hover:text-black p-2">
            <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SalesPersonPerformanceCard key={`performance-${refreshKey}`} />
        <DailyVisitProgressCard key={`visits-${refreshKey}`} />
      </div>
      
      <div className="grid grid-cols-1 mb-6">
        <SalesPersonFollowupsCard key={`followups-${refreshKey}`} />
      </div>

      <div className="mb-6">
        <MultiItemOrderForm onOrderPlaced={handleRefreshData} />
      </div>

      <div className="mb-6">
        <PaymentStatusCard key={`payment-status-${refreshKey}`} />
      </div>

      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">My Recent Orders</CardTitle>
          <CardDescription className="text-teal-100 dark:text-teal-200">A list of your recent orders.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterDealer">Dealer Name</Label>
              <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
                <SelectTrigger id="filterDealer"><SelectValue placeholder="Filter by dealer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dealers</SelectItem>
                  {allDealers.map(dealer => (<SelectItem key={dealer.id} value={dealer.id}>{dealer.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterFromDate">From Date</Label>
              <Input id="filterFromDate" type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full" />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterToDate">To Date</Label>
              <Input id="filterToDate" type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full" />
            </div>
            <Button onClick={handleApplyOrderFilters} className="flex items-center gap-2"><Search className="h-4 w-4" /> Apply Filters</Button>
            <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">Clear Filters</Button>
          </div>
          <div className="overflow-x-auto">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading orders...</p></div>
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
                            <Button variant="ghost" size="icon" onClick={() => handleViewOrderDetails(order.id)} title="View Order Details"><Eye className="h-4 w-4" /></Button>
                            {!order.dispatched && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEditOrder(order.id)} title="Edit Order"><Edit className="h-4 w-4 text-orange-600" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete Order"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Order?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete Order #{order.order_number}? This will restore the product stock levels.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOrder(order)}>Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
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
      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isOrderDetailsDialogOpen} onOpenChange={setIsOrderDetailsDialogOpen} />
      <EditOrderDialog orderId={selectedOrderIdForEdit} isOpen={isEditOrderDialogOpen} onOpenChange={setIsEditOrderDialogOpen} onOrderUpdated={handleOrderUpdated} />
      <SalesPersonSalesReport isOpen={isSalesPersonSalesReportOpen} onOpenChange={setIsSalesPersonSalesReportOpen} />
      <SalesPersonDealerReport isOpen={isSalesPersonDealerReportOpen} onOpenChange={setIsSalesPersonDealerReportOpen} />
      <SalesPersonPaymentsReport isOpen={isSalesPersonPaymentsReportOpen} onOpenChange={setIsSalesPersonPaymentsReportOpen} />
    </div>
  );
};

export default Dashboard;