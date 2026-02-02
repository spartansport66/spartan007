"use client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import StockReceiptForm from '@/components/StockReceiptForm';

const StockReceipts = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';
  const [refreshKey, setRefreshKey] = useState(0); // Key to force re-fetch in related components

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAuthorized) {
      showError('Access Denied: Only authorized personnel can manage stock receipts.');
      navigate('/dashboard');
    }
  }, [sessionLoading, user, isAuthorized, navigate]);

  const handleReceiptRecorded = () => {
    setRefreshKey(prev => prev + 1); // Trigger refresh in related components (like LowStockProductsCard)
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading stock receipts page...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/product-management-console' : '/product-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Product Console
        </Button>
        
        <StockReceiptForm key={refreshKey} onReceiptRecorded={handleReceiptRecorded} />
        
        {/* Optionally, add a table of recent receipts here */}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default StockReceipts;