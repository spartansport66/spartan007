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
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [refreshKey, setRefreshKey] = useState(0); // Key to force re-fetch in related components

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAdmin) {
      showError('Access Denied: Only administrators can manage stock receipts.');
      navigate('/dashboard');
    }
  }, [sessionLoading, user, isAdmin, navigate]);

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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg">
        <Button 
          variant="outline" 
          onClick={() => navigate('/product-management-console')} 
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