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

const DAILY_VISIT_GOAL = 5;

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
        <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Daily Goal</CardTitle>
          <CardDescription className="text-green-100 dark:text-green-200">Goal: {DAILY_VISIT_GOAL}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" /> Daily Goal
        </CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          Goal: {DAILY_VISIT_GOAL}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">Completed: {visitsToday}</span>
          {isGoalMet && <CheckCircle className="h-6 w-6 text-green-600" />}
        </div>
        <Progress value={progressPercentage} className="w-full" indicatorColor={isGoalMet ? "bg-green-600" : "bg-yellow-500"} />
        <p className="text-sm text-muted-foreground">
          {isGoalMet ? "Goal achieved! Keep up the great work." : `You need ${DAILY_VISIT_GOAL - visitsToday} more to complete your daily task.`}
        </p>
        <Button 
          onClick={() => navigate('/daily-visit-report')} 
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          Log New Visit <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default DailyVisitProgressCard;