"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Package, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface AdminTotalPendingOrdersCardProps {
  onViewReport: () => void;
}

const AdminTotalPendingOrdersCard: React.FC<AdminTotalPendingOrdersCardProps> = ({ onViewReport }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingOrdersCount = useCallback(async () => {
    setLoading(true);
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('dispatched', false);

      if (error) throw error;
      
      setCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching pending orders count:', error.message);
      showError('Failed to load pending orders count.');
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingOrdersCount();
  }, [fetchPendingOrdersCount]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" /> Orders Awaiting Dispatch
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Total orders that have been placed but not yet dispatched.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-blue-600">{count}</span>
            <span className="text-lg font-medium text-muted-foreground">Orders</span>
          </div>
        )}
        <Button 
          onClick={onViewReport} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          View Dispatch Queue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminTotalPendingOrdersCard;