"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Building, PlusCircle, Loader2 } from 'lucide-react';
import MultiItemOrderForm from '@/components/MultiItemOrderForm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import PaymentStatusCard from '@/components/PaymentStatusCard'; // Updated import

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
  orders: { // New nested structure
    dealers: { name: string } | null;
    user_id: string; // Sales person ID who created the order
    profiles: { first_name: string; last_name: string } | null; // Sales person name
    payment_status: string; // Added
  } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }
    setLoadingData(true);

    // Fetch dealers assigned to the current user via the join table
    const { data: assignedDealersData, error: assignedDealersError } = await supabase
      .from('dealer_sales_persons')
      .select('dealers(id, name)')
      .eq('sales_person_id', user.id);
    
    if (assignedDealersError) {
      console.error('Error fetching assigned dealers:', assignedDealersError);
      showError(`Failed to load assigned dealers: ${assignedDealersError.message}`);
    } else {
      const formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => item.dealers);
      setActiveDealersCount(formattedDealers.length || 0);
    }

    // Fetch sales (RLS handles what they can see)
    // Now joining through 'orders' to get dealer and sales person info
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        id, quantity, total_price, sale_date,
        products (name),
        orders (dealers (name), user_id, profiles (first_name, last_name), payment_status)
      `)
      .order('sale_date', { ascending: false });
    
    if (salesError) {
      console.error('Error fetching sales:', salesError);
      showError(`Failed to load sales data: ${salesError.message}`);
      setSales([]);
    } else {
      // Explicitly map to ensure type compatibility for nested objects
      const typedSalesData: Sale[] = (salesData || []).map((sale: any) => ({
        id: sale.id,
        quantity: sale.quantity,
        total_price: sale.total_price,
        sale_date: sale.sale_date,
        products: sale.products ? { name: sale.products.name } : null,
        orders: sale.orders ? {
          dealers: sale.orders.dealers ? { name: sale.orders.dealers.name } : null,
          user_id: sale.orders.user_id,
          profiles: sale.orders.profiles ? { first_name: sale.orders.profiles.first_name, last_name: sale.orders.profiles.last_name } : null,
          payment_status: sale.orders.payment_status, // Added
        } : null,
      }));
      setSales(typedSalesData);

      // Calculate total sales value and total orders
      const totalValue = typedSalesData.reduce((sum, sale) => sum + sale.total_price, 0) || 0;
      const totalOrdersCount = typedSalesData.length || 0;
      setTotalSalesValue(totalValue);
      setTotalOrders(totalOrdersCount);
    }
    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (isAdmin) {
        // Redirect admins to the new Admin Dashboard
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

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!user || isAdmin) {
    return null; // Should be redirected by useEffect
  }

  const salesOverview = [
    {
      title: "My Total Sales",
      value: `₹${totalSalesValue.toFixed(2)}`,
      change: "+20.1% from last month", // Placeholder, actual calculation would be more complex
      icon: <DollarSign className="h-3 w-3 text-white" />,
      headerBg: "bg-green-500 dark:bg-green-700",
      valueColor: "text-green-800 dark:text-green-200"
    },
    {
      title: "My Total Orders",
      value: totalOrders.toString(),
      change: "+180.1% from last month", // Placeholder
      icon: <Package className="h-3 w-3 text-white" />,
      headerBg: "bg-indigo-500 dark:bg-indigo-700",
      valueColor: "text-indigo-800 dark:text-indigo-200"
    },
    {
      title: "My Active Dealers",
      value: activeDealersCount.toString(),
      change: "+19% from last month", // Placeholder
      icon: <Users className="h-3 w-3 text-white" />,
      headerBg: "bg-purple-500 dark:bg-purple-700",
      valueColor: "text-purple-800 dark:text-purple-200"
    },
    {
      title: "Pending Tasks",
      value: "57", // Placeholder
      change: "-5% from last month", // Placeholder
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

      {/* Multi-Item Order Form - Full Width */}
      <div className="mb-6">
        <MultiItemOrderForm />
      </div>

      {/* Payment Status Card */}
      <PaymentStatusCard />

      {/* Recent Activities (Sales) */}
      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">My Recent Sales</CardTitle>
          <CardDescription className="text-teal-100 dark:text-teal-200">A list of your recent sales transactions.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            {sales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No sales recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Product</TableHead>
                    <TableHead className="text-muted-foreground">Dealer</TableHead>
                    <TableHead className="text-muted-foreground">Quantity</TableHead>
                    <TableHead className="text-muted-foreground">Total Price</TableHead>
                    <TableHead className="text-muted-foreground">Payment Status</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{sale.products?.name || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.orders?.dealers?.name || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">₹{sale.total_price.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.orders?.payment_status || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    </div>
  );
};

export default Dashboard;