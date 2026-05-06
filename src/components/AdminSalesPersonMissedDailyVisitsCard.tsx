"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface AdminSalesPersonMissedDailyVisitsCardProps {
  onViewReport: () => void;
}

const AdminSalesPersonMissedDailyVisitsCard: React.FC<AdminSalesPersonMissedDailyVisitsCardProps> = ({ onViewReport }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMissedDailyVisitsCount = useCallback(async () => {
    setLoading(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayDateString = `${year}-${month}-${day}`;
      const startOfYesterday = `${yesterdayDateString}T00:00:00.000Z`;
      const endOfYesterday = `${yesterdayDateString}T23:59:59.999Z`;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', 'sales_person');

      if (profilesError) throw profilesError;

      const { data: visitsData, error: visitsError } = await supabase
        .from('sales_person_visits')
        .select('sales_person_id')
        .gte('visit_time', startOfYesterday)
        .lte('visit_time', endOfYesterday);

      if (visitsError) throw visitsError;

      const visitedIds = new Set((visitsData || []).map((visit: any) => visit.sales_person_id).filter(Boolean));
      const missedCount = (profilesData || []).reduce((acc: number, profile: any) => {
        return visitedIds.has(profile.id) ? acc : acc + 1;
      }, 0);

      setCount(missedCount);
    } catch (error: any) {
      console.error('Error fetching missed daily visits count:', error.message);
      showError('Failed to load missed daily visit count.');
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissedDailyVisitsCount();
  }, [fetchMissedDailyVisitsCount]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-orange-600 dark:bg-orange-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Missing Daily Visits
        </CardTitle>
        <CardDescription className="text-orange-100 dark:text-orange-200">
          Sales persons who did not log yesterday's visit.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-orange-600">{count}</span>
            <span className="text-lg font-medium text-muted-foreground">Sales Persons</span>
          </div>
        )}
        <Button onClick={onViewReport} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
          View Detailed Report <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminSalesPersonMissedDailyVisitsCard;
