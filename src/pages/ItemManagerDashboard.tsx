"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { LogOut, Loader2, Boxes, PlusCircle, FileUp, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import ProductTableManager from '@/components/ProductTableManager';
import LowStockProductsCard from '@/components/LowStockProductsCard';

const ItemManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0); // Key to force re-fetch in child components

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'item_manager') {
        showError('Access Denied: You must be an Item Manager to view this page.');
        navigate('/'); // Redirect to index which will handle other roles
      }
    }
  }, [sessionLoading, user, userType, isAdmin, navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Logout API call failed, but proceeding with client-side logout as session might be invalid:', error.message);
        showError(`Logout failed: ${error.message}. You are being redirected.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      navigate('/login');
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting.`);
      navigate('/login');
    }
  };

  const handleProductAction = useCallback(() => {
    setRefreshKey(prev => prev + 1); // Increment key to trigger re-fetch in children
  }, []);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300 mb-4">Loading Item Manager Dashboard...</p>
        <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Force Logout
        </Button>
      </div>
    );
  }

  if (userType !== 'item_manager') {
    return null; // Render nothing if not an item manager, as they are redirected
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6 gap-4 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Item Manager Dashboard</h1>
        <Button onClick={handleLogout} variant="ghost" size="icon" className="text-black hover:text-black p-2">
          <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
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

        {/* Low Stock Products Card */}
        <LowStockProductsCard key={`low-stock-${refreshKey}`} onProductAction={handleProductAction} />
      </div>

      {/* Manage All Products Table */}
      <div className="flex-grow">
        <ProductTableManager key={`table-manager-${refreshKey}`} onProductAction={handleProductAction} />
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default ItemManagerDashboard;