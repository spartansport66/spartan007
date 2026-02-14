"use client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, LogOut, ArrowLeft, Truck } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import GatePassOrderSearch from '@/components/GatePassOrderSearch';
import GatePassDispatchedOrdersCard from '@/components/GatePassDispatchedOrdersCard'; // NEW IMPORT

const GatePassDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0); // To force refresh of search component if needed

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
    // Force refresh of both the search component (to clear it) and the dispatched list
    setRefreshKey(prev => prev + 1);
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
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
            <Truck className="h-6 w-6" /> Gate Pass Dashboard
          </h1>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>

        <div className="space-y-6">
          <GatePassOrderSearch key={`search-${refreshKey}`} onDispatchSuccess={handleDispatchSuccess} />
          <GatePassDispatchedOrdersCard key={`dispatched-${refreshKey}`} />
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default GatePassDashboard;