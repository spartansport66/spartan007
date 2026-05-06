"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Target, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { getStartOfUTCDayISO } from '@/utils/date';

const DAILY_VISIT_GOAL = 10;

const DailyVisitProgressCard: React.FC = () => {
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [visitsToday, setVisitsToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDailyVisits = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startOfToday = getStartOfUTCDayISO();

      const { count, error } = await supabase
        .from('sales_person_visits')
        .select('id', { count: 'exact', head: true })
        .eq('sales_person_id', user.id)
        .gte('visit_time', startOfToday);

      if (error) throw error;
      
      setVisitsToday(count || 0);
    } catch (error: any) {
      console.error('Error fetching daily visits:', error.message);
      showError('Failed to load daily visit progress.');
      setVisitsToday(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDailyVisits();
    }
  }, [user, fetchDailyVisits]);

  const progressPercentage = Math.min(100, (visitsToday / DAILY_VISIT_GOAL) * 100);
  const isGoalMet = visitsToday >= DAILY_VISIT_GOAL;

  if (sessionLoading || loading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-1.5">
          <CardTitle className="text-xs font-semibold">Daily Goal</CardTitle>
        </CardHeader>
        <CardContent className="p-1 flex items-center justify-center py-2">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-1.5">
        <CardTitle className="text-xs font-semibold flex items-center gap-1">
          <Target className="h-2.5 w-2.5" /> Daily Goal
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-medium">Done: {visitsToday}</span>
          {isGoalMet && <CheckCircle className="h-3 w-3 text-green-600" />}
        </div>
        <Progress value={progressPercentage} className="w-full h-1" indicatorColor={isGoalMet ? "bg-green-600" : "bg-yellow-500"} />
        <p className="text-xs text-muted-foreground">
          {isGoalMet ? "Goal met!" : `${DAILY_VISIT_GOAL - visitsToday} more needed`}
        </p>
        <Button 
          onClick={() => navigate('/daily-visit-report')} 
          className="w-full bg-green-600 hover:bg-green-700 text-white h-5 text-xs px-1"
        >
          Log <ArrowRight className="ml-0.5 h-2 w-2" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default DailyVisitProgressCard;