"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';
import SupplierManager from '@/components/purchases/SupplierManager';
import RecordPurchaseForm from '@/components/purchases/RecordPurchaseForm';
import PurchaseHistory from '@/components/purchases/PurchaseHistory';

const PurchaseDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAuthorized) {
        showError('Access Denied: You do not have permission to view this page.');
        navigate('/dashboard');
      }
    }
  }, [sessionLoading, user, isAuthorized, navigate]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading purchase dashboard...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/admin-dashboard' : '/product-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <SupplierManager key={`suppliers-${refreshKey}`} onSupplierAdded={handleRefresh} />
          </div>
          <div className="lg:col-span-2">
            <RecordPurchaseForm key={`form-${refreshKey}`} onPurchaseRecorded={handleRefresh} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="lg:col-span-3">
            <PurchaseHistory key={`history-${refreshKey}`} />
          </div>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default PurchaseDashboard;