"use client";

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, PlusCircle, Boxes, AlertTriangle, FileUp, Package } from 'lucide-react'; // Added Package icon
import ProductTableManager from '@/components/ProductTableManager';
import LowStockProductsCard from '@/components/LowStockProductsCard';
import { useSession } from '@/contexts/SessionContext';
import { Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

const ProductManagementConsole = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [refreshKey, setRefreshKey] = useState(0); // Key to force re-fetch in child components

  const handleProductAction = useCallback(() => {
    setRefreshKey(prev => prev + 1); // Increment key to trigger re-fetch in children
  }, []);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading product console...</p>
      </div>
    );
  }

  if (!isAdmin) {
    showError('Access Denied: You must be an administrator to view this page.');
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Product Management Console</h1>
        <div className="w-fit"></div> {/* Spacer for alignment */}
      </div>

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
        
        {/* Record Stock Receipt Card (New) */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
          <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Material Return</CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">Log materials returned from dealers.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <Button onClick={() => navigate('/material-returns')} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              <Package className="h-5 w-5 mr-2" /> Record Return
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

export default ProductManagementConsole;