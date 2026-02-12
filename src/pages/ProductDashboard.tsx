"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { LogOut, Boxes, Package, FileUp, PlusCircle, Loader2, Menu, Lock, ShoppingCart } from 'lucide-react';
import LowStockProductsCard from '@/components/LowStockProductsCard';
import ProductTableManager from '@/components/ProductTableManager';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import AdminTotalPendingOrdersCard from '@/components/AdminTotalPendingOrdersCard';
import OrdersAwaitingDispatchReportDialog from '@/components/reports/OrdersAwaitingDispatchReportDialog';

const ProductDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOrdersAwaitingDispatchReportOpen, setIsOrdersAwaitingDispatchReportOpen] = useState(false);

  const handleProductAction = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error && error.message !== 'Auth session missing!') {
        console.warn('Logout API call failed:', error.message);
        showError(`Logout failed: ${error.message}. You are being redirected.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      // Always navigate to login to clear client-side state
      navigate('/login');
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting.`);
      navigate('/login');
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'inventory_manager' && userType !== 'warehouse_keeper') {
        showError('Access Denied: You do not have permission to view this page.');
        navigate('/dashboard');
      }
    }
  }, [sessionLoading, user, userType, navigate]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading product dashboard...</p>
      </div>
    );
  }

  if (userType !== 'inventory_manager' && userType !== 'warehouse_keeper') {
    showError('Access Denied: You do not have permission to view this page.');
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
          <Boxes className="h-6 w-6" /> Inventory Dashboard
        </h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="text-gray-600 dark:text-gray-400">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[250px] sm:w-[300px]">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col space-y-2 p-4">
              <Button
                onClick={() => navigate('/purchase-dashboard')}
                className="w-full justify-start gap-2 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ShoppingCart className="h-4 w-4" /> Manage Purchases
              </Button>
              <Button
                onClick={() => navigate('/add-product')}
                className="w-full justify-start gap-2 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <PlusCircle className="h-4 w-4" /> Add New Product
              </Button>
              <Button
                onClick={() => navigate('/bulk-add-products')}
                className="w-full justify-start gap-2 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <FileUp className="h-4 w-4" /> Bulk Upload
              </Button>
              <Button
                onClick={() => navigate('/stock-receipts')}
                className="w-full justify-start gap-2 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Package className="h-4 w-4" /> Record Stock Receipt
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="w-full justify-start gap-2 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Lock className="h-4 w-4" /> Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/change-password')}>
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Quick Actions / Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Add New Product Card */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
          <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Add New Product</CardTitle>
            <CardDescription className="text-green-100 dark:text-green-200">Quickly add a new product to your inventory.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <Button onClick={() => navigate('/add-product')} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <PlusCircle className="h-5 w-5 mr-2" /> Add Product
            </Button>
          </CardContent>
        </Card>

        {/* Bulk Add Products Card */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
          <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Bulk Add Products</CardTitle>
            <CardDescription className="text-indigo-100 dark:text-indigo-200">Upload an Excel sheet for multiple products.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <Button onClick={() => navigate('/bulk-add-products')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              <FileUp className="h-5 w-5 mr-2" /> Bulk Upload
            </Button>
          </CardContent>
        </Card>
        
        {/* Record Stock Receipt Card */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
          <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Record Stock Receipt</CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">Log new inventory received.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <Button onClick={() => navigate('/stock-receipts')} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              <Package className="h-5 w-5 mr-2" /> Record Receipt
            </Button>
          </CardContent>
        </Card>

        {userType === 'warehouse_keeper' && (
          <AdminTotalPendingOrdersCard key={`pending-orders-${refreshKey}`} onViewReport={() => setIsOrdersAwaitingDispatchReportOpen(true)} />
        )}

        {/* Low Stock Products Card */}
        <LowStockProductsCard key={`low-stock-${refreshKey}`} onProductAction={handleProductAction} />
      </div>

      {/* Manage All Products Table */}
      <div className="flex-grow">
        <ProductTableManager key={`table-manager-${refreshKey}`} onProductAction={handleProductAction} />
      </div>

      <MadeWithDyad />

      <OrdersAwaitingDispatchReportDialog 
        isOpen={isOrdersAwaitingDispatchReportOpen} 
        onOpenChange={setIsOrdersAwaitingDispatchReportOpen} 
      />
    </div>
  );
};

export default ProductDashboard;