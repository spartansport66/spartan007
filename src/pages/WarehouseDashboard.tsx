"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, LogOut, Boxes } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import WarehouseOrdersAwaitingDispatch from '@/components/WarehouseOrdersAwaitingDispatch';
import WarehousePromotionalOrdersCard from '@/components/WarehousePromotionalOrdersCard';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

const WarehouseDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'warehouse_keeper') {
        showError('Access Denied: You must be a Warehouse Keeper to view this page.');
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
  
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading warehouse dashboard...</p>
      </div>
    );
  }

  if (userType !== 'warehouse_keeper') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
            <Boxes className="h-6 w-6" /> Warehouse Dashboard
          </h1>
          <div className="flex gap-2">
            <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <WarehouseOrdersAwaitingDispatch key={`warehouse-dispatch-${refreshKey}`} />
          <WarehousePromotionalOrdersCard />
        </div>
      </div>
      <MadeWithDyad />
      <OrderDetailsDialog 
        orderId={selectedOrderIdForDetails} 
        isOpen={isOrderDetailsDialogOpen} 
        onOpenChange={setIsOrderDetailsDialogOpen} 
      />
    </div>
  );
};

export default WarehouseDashboard;