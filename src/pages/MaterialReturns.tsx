"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import MaterialReturnForm from '@/components/MaterialReturnForm';
import MaterialReturnHistory from '@/components/MaterialReturnHistory';

const MaterialReturns = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAuthorized) {
      showError('Access Denied: Only authorized personnel can manage material returns.');
      navigate('/dashboard');
    }
  }, [sessionLoading, user, isAuthorized, navigate]);

  const handleReturnRecorded = () => {
    setRefreshKey(prev => prev + 1); // Trigger refresh in the history table
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading material returns page...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/admin-dashboard' : '/product-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>
        
        <div className="grid grid-cols-1 gap-6">
          <MaterialReturnForm onReturnRecorded={handleReturnRecorded} />
          <MaterialReturnHistory key={refreshKey} />
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default MaterialReturns;