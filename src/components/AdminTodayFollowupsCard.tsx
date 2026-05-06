"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface AdminTodayFollowupsCardProps {
  onViewReport: () => void;
}

const AdminTodayFollowupsCard: React.FC<AdminTodayFollowupsCardProps> = ({ onViewReport }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFollowupCount = useCallback(async () => {
    setLoading(true);
    try {
      const todayDateString = new Date().toISOString().split('T')[0];
      const startOfToday = `${todayDateString}T00:00:00.000Z`;
      const endOfToday = `${todayDateString}T23:59:59.999Z`;

      const { data: visitsData, error: visitsError } = await supabase
        .from('sales_person_visits')
        .select(`
          dealer_id,
          sales_person_id,
          visit_time
        `)
        .gte('visit_time', startOfToday)
        .lte('visit_time', endOfToday)
        .order('visit_time', { ascending: false });

      if (visitsError) throw visitsError;

      const latestFollowups = new Map<string, any>(); // Key: sales_person_id-dealer_id

      for (const visit of visitsData || []) {
        const dealerId = visit.dealer_id || 'unknown';
        const salesPersonId = visit.sales_person_id || 'unknown';
        const key = `${salesPersonId}-${dealerId}`;
        const currentVisitTime = new Date(visit.visit_time || '').getTime();
        const existing = latestFollowups.get(key);

        if (!existing || currentVisitTime > new Date(existing.visit_time || '').getTime()) {
            latestFollowups.set(key, visit);
        }
      }
      
      setCount(latestFollowups.size);

    } catch (error: any) {
      console.error('Error fetching today\'s follow-up count:', error.message);
      showError('Failed to load today\'s follow-up count.');
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowupCount();
  }, [fetchFollowupCount]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" /> Today's Follow-ups
        </CardTitle>
        <CardDescription className="text-purple-100 dark:text-purple-200">
          Dealers visited today by all sales persons.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-purple-600">{count}</span>
            <span className="text-lg font-medium text-muted-foreground">Visits</span>
          </div>
        )}
        <Button 
          onClick={onViewReport} 
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          View Detailed Report <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminTodayFollowupsCard;