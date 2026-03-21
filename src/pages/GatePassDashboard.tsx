"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, LogOut, ArrowLeft, Truck } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import GatePassOrderSearch from '@/components/GatePassOrderSearch';
import GatePassDispatchedOrdersCard from '@/components/GatePassDispatchedOrdersCard';
import GatePassQueueCard from '@/components/GatePassQueueCard'; // NEW IMPORT
import GatePassOnlineQueueCard from '@/components/GatePassOnlineQueueCard';
import GatePassPromotionalMaterialCard from '@/components/GatePassPromotionalMaterialCard';

const GatePassDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'gate_keeper') {
        showError('Access Denied: You must be a Gate Keeper to view this page.');
        navigate('/');
      }
    }
  }, [sessionLoading, user, userType, navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };
  
  const handleDispatchSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Helper function to get platform prefix
  const getPlatformPrefix = (platform: string): string => {
    const prefixes: Record<string, string> = {
      'Flipkart': 'F',
      'Meesho': 'M',
      'Amazon': 'A',
      'Spartan': 'S',
      'Website': 'W',
    };
    return prefixes[platform] || 'W';
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading gate pass dashboard...</p>
      </div>
    );
  }

  if (userType !== 'gate_keeper') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
            <Truck className="h-6 w-6" /> Gate Pass Dashboard
          </h1>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <GatePassOrderSearch key={`search-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} />
          </div>
            <div className="lg:col-span-2 space-y-6">
            <GatePassQueueCard key={`queue-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} />
            <GatePassOnlineQueueCard key={`online-queue-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} />
            <GatePassPromotionalMaterialCard key={`promo-material-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} />
            <GatePassDispatchedOrdersCard key={`dispatched-${refreshKey}`} />
          </div>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default GatePassDashboard;