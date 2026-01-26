"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { getStartOfUTCDayISO } from '@/utils/date';
import { useNavigate } from 'react-router-dom';

interface Followup {
  dealer_id: string;
  dealer_name: string;
  next_visit_date: string; // YYYY-MM-DD
  last_visit_time: string; // ISO string
  isOverdue: boolean;
}

const SalesPersonFollowupsCard: React.FC = () => {
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startOfTodayISO = getStartOfUTCDayISO();

      // 1. Fetch all visits for the user's assigned dealers
      const { data: visitsData, error: visitsError } = await supabase
        .from('sales_person_visits')
        .select(`
          dealer_id,
          dealers (name),
          visit_time,
          next_visit_date
        `)
        .eq('sales_person_id', user.id)
        .order('visit_time', { ascending: false }); // Get newest first

      if (visitsError) throw visitsError;

      const dealerFollowupsMap = new Map<string, Followup>();
      const today = new Date(startOfTodayISO);

      for (const visit of visitsData || []) {
        const dealerId = visit.dealer_id;
        const dealerName = visit.dealers?.name || 'N/A';
        const nextVisitDate = visit.next_visit_date;
        const lastVisitTime = visit.visit_time;

        if (!dealerId || !nextVisitDate) continue;

        const followupDate = new Date(nextVisitDate);
        followupDate.setUTCHours(0, 0, 0, 0); // Normalize date for comparison

        const isOverdue = followupDate < today;

        // Only track the latest *uncompleted* follow-up date for each dealer.
        // If a dealer already has an entry in the map, we only update it if the new entry is older (more overdue)
        // or if the map is empty.
        if (!dealerFollowupsMap.has(dealerId)) {
          dealerFollowupsMap.set(dealerId, {
            dealer_id: dealerId,
            dealer_name: dealerName,
            next_visit_date: nextVisitDate,
            last_visit_time: lastVisitTime,
            isOverdue: isOverdue,
          });
        }
        // Note: Since we order by visit_time descending, the first entry found for a dealer
        // is the one associated with their *most recent* visit. We assume the `next_visit_date`
        // recorded on that most recent visit is the one we should track.
      }

      // Convert map values to array and sort: Overdue first, then by date ascending
      const sortedFollowups = Array.from(dealerFollowupsMap.values()).sort((a, b) => {
        const dateA = new Date(a.next_visit_date).getTime();
        const dateB = new Date(b.next_visit_date).getTime();

        // 1. Overdue status (Overdue first)
        if (a.isOverdue !== b.isOverdue) {
          return a.isOverdue ? -1 : 1;
        }
        // 2. Date ascending (Oldest overdue first, then newest upcoming first)
        return dateA - dateB;
      });

      setFollowups(sortedFollowups);
    } catch (error: any) {
      console.error('Error fetching follow-ups:', error.message);
      showError('Failed to load dealer follow-ups.');
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFollowups();
    }
  }, [user, fetchFollowups]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (sessionLoading || loading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full lg:col-span-2">
        <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Dealer Follow-ups</CardTitle>
          <CardDescription className="text-blue-100 dark:text-blue-200">Upcoming and overdue dealer visits.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading follow-ups...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full lg:col-span-2">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" /> Dealer Follow-ups
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Upcoming and overdue dealer visits based on your last visit reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {followups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending follow-ups found for your assigned dealers.</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground">Last Visit</TableHead>
                    <TableHead className="text-muted-foreground">Follow-up Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Status</TableHead>
                    <TableHead className="text-muted-foreground text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followups.map((followup) => (
                    <TableRow 
                      key={followup.dealer_id} 
                      className={followup.isOverdue ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}
                    >
                      <TableCell className="font-medium text-foreground">{followup.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(followup.last_visit_time).toLocaleDateString()}</TableCell>
                      <TableCell className={followup.isOverdue ? "text-destructive font-semibold" : "text-blue-600 font-medium"}>
                        {formatDate(followup.next_visit_date)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full text-xs font-semibold w-fit mx-auto ${followup.isOverdue ? 'text-red-800 bg-red-100' : 'text-blue-800 bg-blue-100'}`}>
                          {followup.isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {followup.isOverdue ? 'OVERDUE' : 'UPCOMING'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/daily-visit-report')}
                          title="Log New Visit"
                        >
                          Log Visit <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesPersonFollowupsCard;