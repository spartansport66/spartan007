"use client";
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import StockReceiptForm from '@/components/StockReceiptForm';
import StockReceiptHistory from '@/components/StockReceiptHistory';

const RecordStockReceipt = () => {
  const navigate = useNavigate();
  const { userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/admin-dashboard' : '/product-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="grid grid-cols-1 gap-6">
          <StockReceiptForm onReceiptRecorded={handleRefresh} />
          <StockReceiptHistory key={refreshKey} />
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default RecordStockReceipt;