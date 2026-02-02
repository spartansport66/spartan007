"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { getStartOfUTCDayISO } from '@/utils/date';

interface AdminTodayVisitsCardProps {
  onViewReport: () => void;
}

const AdminTodayVisitsCard: React.FC<AdminTodayVisitsCardProps> = ({ onViewReport }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTodayVisitsCount = useCallback(async () => {
    setLoading(true);
    try {
      const startOfToday = getStartOfUTCDayISO();

      const { count, error } = await supabase
        .from('sales_person_visits')
        .select('id', { count: 'exact', head: true })
        .gte('visit_time', startOfToday);

      if (error) throw error;
      
      setCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching today\'s visits count:', error.message);
      showError('Failed to load today\'s visits count.');
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayVisitsCount();
  }, [fetchTodayVisitsCount]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Total Visits Today
        </CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          Total dealer visits logged by all sales persons today.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-green-600">{count}</span>
            <span className="text-lg font-medium text-muted-foreground">Visits</span>
          </div>
        )}
        <Button 
          onClick={onViewReport} 
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          View Detailed Report <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminTodayVisitsCard;