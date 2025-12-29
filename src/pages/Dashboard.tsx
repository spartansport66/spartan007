"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, BarChart, UserPlus } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import OrderForm from '@/components/OrderForm';
import SalesChart from '@/components/SalesChart';
import ProductSalesChart from '@/components/ProductSalesChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    } else {
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

  // Dummy data for the CRM dashboard
  const salesOverview = [
    { 
      title: "Total Sales", 
      value: "$45,231.89", 
      change: "+20.1% from last month", 
      icon: <DollarSign className="h-3 w-3 text-primary" /> 
    },
    { 
      title: "New Orders", 
      value: "2350", 
      change: "+180.1% from last month", 
      icon: <Package className="h-3 w-3 text-accent" /> 
    },
    { 
      title: "Active Dealers", 
      value: "124", 
      change: "+19% from last month", 
      icon: <Users className="h-3 w-3 text-secondary" /> 
    },
    { 
      title: "Pending Tasks", 
      value: "57", 
      change: "-5% from last month", 
      icon: <Activity className="h-3 w-3 text-destructive" /> 
    },
  ];

  const recentActivities = [
    { id: "1", type: "Order", description: "New order from Dealer A", date: "2023-10-26", status: "Pending" },
    { id: "2", type: "Contact", description: "Follow-up with Dealer B", date: "2023-10-25", status: "Completed" },
    { id: "3", type: "Product", description: "Updated pricing for Product X", date: "2023-10-24", status: "Info" },
    { id: "4", type: "Order", description: "Order #1001 shipped to Dealer C", date: "2023-10-23", status: "Shipped" },
  ];

  const dummyProducts = [
    { id: 'prod1', name: 'Product Alpha', description: 'High-quality product for general use.', price: 29.99, stock: 150 },
    { id: 'prod2', name: 'Product Beta', description: 'Premium solution for advanced needs.', price: 49.99, stock: 80 },
    { id: 'prod3', name: 'Product Gamma', description: 'Economical choice for bulk purchases.', price: 15.50, stock: 300 },
  ];

  const dummyDealers = [
    { id: 'dlr1', name: 'Global Distributors Inc.' },
    { id: 'dlr2', name: 'Local Supply Co.' },
    { id: 'dlr3', name: 'Mega Mart Wholesale' },
  ];

  const monthlySalesData = [
    { month: 'Jan', sales: 4000 },
    { month: 'Feb', sales: 3000 },
    { month: 'Mar', sales: 5000 },
    { month: 'Apr', sales: 4500 },
    { month: 'May', sales: 6000 },
    { month: 'Jun', sales: 5500 },
  ];

  const productSalesData = [
    { product: 'Alpha', sales: 12000 },
    { product: 'Beta', sales: 8000 },
    { product: 'Gamma', sales: 15000 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">CRM Dashboard</h1>
        {/* Logout button moved to Quick Actions */}
      </div>
      
      {/* Sales Overview Cards - Reduced by 70% with adjusted fonts */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index} className="bg-card text-card-foreground shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
              <CardTitle className="text-[0.5rem] font-medium text-muted-foreground">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-base font-bold text-foreground">{item.value}</div>
              <p className="text-[0.4rem] text-muted-foreground mt-1">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <SalesChart data={monthlySalesData} />
        <ProductSalesChart data={productSalesData} />
      </div>

      {/* Products and Order Form */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          {dummyProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={(id) => console.log(`Added ${id} to cart`)} />
          ))}
        </div>
        <OrderForm products={dummyProducts} dealers={dummyDealers} />
      </div>

      {/* Recent Activities */}
      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Recent Activities</CardTitle>
          <CardDescription className="text-muted-foreground">A list of recent interactions and updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted/90">
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Description</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivities.map((activity) => (
                <TableRow key={activity.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium text-foreground">{activity.type}</TableCell>
                  <TableCell className="text-muted-foreground">{activity.description}</TableCell>
                  <TableCell className="text-muted-foreground">{activity.date}</TableCell>
                  <TableCell className="text-muted-foreground">{activity.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground">Perform common tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2 sm:gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Boxes className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View Products</TooltipContent>
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
              <Button size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <BarChart className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sales Reports</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate('/add-dealer')} size="icon" variant="outline">
                <UserPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add New Dealer</TooltipContent>
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