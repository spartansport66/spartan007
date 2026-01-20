"use client";

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ProductTableManager from '@/components/ProductTableManager';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';

const ManageProducts = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProductAction = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading product management...</p>
      </div>
    );
  }

  const hasAccess = isAdmin || userType === 'item_manager';

  if (!hasAccess) {
    showError('Access Denied: You must be an administrator or item manager to view this page.');
    navigate('/dashboard');
    return null;
  }

  const backRoute = isAdmin ? '/admin-dashboard' : '/item-manager-dashboard';

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => navigate(backRoute)} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Product Inventory Management</h1>
        <div className="w-fit"></div>
      </div>

      <div className="flex-grow">
        <ProductTableManager key={`table-manager-${refreshKey}`} onProductAction={handleProductAction} />
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default ManageProducts;