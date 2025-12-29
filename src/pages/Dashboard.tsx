"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, BarChart, PlusCircle, UserCog } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import SalesChart from '@/components/SalesChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';

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
  product_id: string;
  dealer_id: string;
  quantity: number;
  total_price: number;
  sale_date: string;
  products: { name: string } | null;
  dealers: { name: string } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [monthlySalesData, setMonthlySalesData] = useState<{ month: string; sales: number }[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    // Fetch products (all for everyone, RLS handles what they can manage)
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, stock, description');

    if (productsError) {
      console.error('Error fetching products:', productsError);
      showError(`Failed to load products: ${productsError.message}`);
    } else {
      setProducts(productsData || []);
    }

    // Fetch dealers (RLS handles what they can see)
    const { data: dealersData, error: dealersError } = await supabase
      .from('dealers')
      .select('id, name');

    if (dealersError) {
      console.error('Error fetching dealers:', dealersError);
      showError(`Failed to load dealers: ${dealersError.message}`);
    } else {
      setDealers(dealersData || []);
      setActiveDealersCount(dealersData?.length || 0);
    }

    // Fetch sales (RLS handles what they can see)
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        product_id,
        dealer_id,
        quantity,
        total_price,
        sale_date,
        products (name),
        dealers (name)
      `)
      .order('sale_date', { ascending: false });

    if (salesError) {
      console.error('Error fetching sales:', salesError);
      showError(`Failed to load sales data: ${salesError.message}`);
      setSales([]);
    } else {
      // Explicitly map to ensure type compatibility for nested objects
      const typedSalesData: Sale[] = (salesData || []).map(sale => ({
        ...sale,
        // Safely access the first element if products/dealers are returned as arrays, otherwise null
        products: (sale.products && Array.isArray(sale.products) && sale.products.length > 0)
          ? (sale.products[0] as { name: string })
          : null,
        dealers: (sale.dealers && Array.isArray(sale.dealers) && sale.dealers.length > 0)
          ? (sale.dealers[0] as { name: string })
          : null,
      }));
      setSales(typedSalesData);

      // Calculate total sales value and total orders
      const totalValue = typedSalesData.reduce((sum, sale) => sum + sale.total_price, 0) || 0;
      const totalOrdersCount = typedSalesData.length || 0;
      setTotalSalesValue(totalValue);
      setTotalOrders(totalOrdersCount);

      // Calculate monthly sales data
      const monthlySalesMap = new Map<string, number>();
      typedSalesData.forEach(sale => {
        const date = new Date(sale.sale_date);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const monthYear = `${month} ${year}`;
        monthlySalesMap.set(monthYear, (monthlySalesMap.get(monthYear) || 0) + sale.total_price);
      });

      const sortedMonths = Array.from(monthlySalesMap.keys()).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA.getTime() - dateB.getTime();
      });

      setMonthlySalesData(sortedMonths.map(month => ({ month: month.split(' ')[0], sales: monthlySalesMap.get(month) || 0 })));
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      fetchDashboardData();
    }
  }, [user, loading, fetchDashboardData]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  const salesOverview = [
    {
      title: "Total Sales",
      value: `$${totalSalesValue.toFixed(2)}`,
      change: "+20.1% from last month", // Placeholder, actual calculation would be more complex
      icon: <DollarSign className="h-3 w-3 text-primary" />
    },
    {
      title: "Total Orders",
      value: totalOrders.toString(),
      change: "+180.1% from last month", // Placeholder
      icon: <Package className="h-3 w-3 text-accent" />
    },
    {
      title: "Active Dealers",
      value: activeDealersCount.toString(),
      change: "+19% from last month", // Placeholder
      icon: <Users className="h-3 w-3 text-secondary" />
    },
    {
      title: "Pending Tasks",
      value: "57", // Placeholder
      change: "-5% from last month", // Placeholder
      icon: <Activity className="h-3 w-3 text-destructive" />
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">CRM Dashboard</h1>
      </div>

      {/* Sales Overview Cards */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index} className="bg-card text-card-foreground shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-2">
              <CardTitle className="text-[0.5rem] font-medium text-muted-foreground">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="text-sm font-bold text-foreground">{item.value}</div>
              <p className="text-[0.4rem] text-muted-foreground mt-1">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <SalesChart data={monthlySalesData} />
      </div>

      {/* Products and Order Form */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2">
          <Card className="bg-card text-card-foreground shadow-lg h-full">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-primary">Available Products</CardTitle>
              <CardDescription className="text-muted-foreground">Products you can sell.</CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No products available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted/90">
                        <TableHead className="text-muted-foreground">Name</TableHead>
                        <TableHead className="text-muted-foreground">Price</TableHead>
                        <TableHead className="text-muted-foreground">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id} className="hover:bg-accent/50">
                          <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                          <TableCell className="text-muted-foreground">₹{product.price.toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground">{product.stock}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <OrderForm products={products} dealers={dealers} onOrderPlaced={fetchDashboardData} />
      </div>

      {/* Recent Activities (Sales) */}
      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Recent Sales</CardTitle>
          <CardDescription className="text-muted-foreground">A list of recent sales transactions.</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <TableHead className="text-muted-foreground">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{sale.products?.name || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.dealers?.name || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">₹{sale.total_price.toFixed(2)}</TableCell>
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
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground">Perform common tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
          {isAdmin && (
            <>
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
                  <Button onClick={() => navigate('/add-product')} size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Product</TooltipContent>
              </Tooltip>
            </>
          )}
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
              <Button size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <BarChart className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sales Reports</TooltipContent>
          </Tooltip>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => navigate('/admin-panel')} size="icon" className="bg-purple-600 text-white hover:bg-purple-700">
                  <UserCog className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Admin Panel</TooltipContent>
            </Tooltip>
          )}
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