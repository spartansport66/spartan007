"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface AdminTodayVisitsCardProps {
  onViewReport: () => void;
}

const AdminTodayVisitsCard: React.FC<AdminTodayVisitsCardProps> = ({ onViewReport }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDueFollowupsCount = useCallback(async () => {
    setLoading(true);
    try {
      const todayDateString = new Date().toISOString().split('T')[0];

      const { data: visitsData, error } = await supabase
        .from('sales_person_visits')
        .select(`
          dealer_id,
          sales_person_id,
          next_visit_date,
          visit_time
        `)
        .lte('next_visit_date', todayDateString);

      if (error) throw error;

      const dueFollowups = new Map<string, any>();
      for (const visit of visitsData || []) {
        const dealerId = visit.dealer_id || 'unknown';
        const salesPersonId = visit.sales_person_id || 'unknown';
        const key = `${salesPersonId}-${dealerId}`;
        const currentVisitTime = new Date(visit.visit_time || '').getTime();
        const existing = dueFollowups.get(key);
        if (!existing || currentVisitTime > new Date(existing.visit_time || '').getTime()) {
          dueFollowups.set(key, visit);
        }
      }

      setCount(dueFollowups.size);
    } catch (error: any) {
      console.error('Error fetching today\'s visits count:', error.message);
      showError('Failed to load today\'s visits count.');
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDueFollowupsCount();
  }, [fetchDueFollowupsCount]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Due Followups
        </CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          Total dealer follow-ups due today or earlier.
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
            <span className="text-lg font-medium text-muted-foreground">Due</span>
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