"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';
import { Loader2, DollarSign, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

interface ExpenseEntry {
  id: string;
  expense_type: string;
  amount: number;
  remarks: string | null;
  receipt_url: string | null;
  created_at: string;
}

const DailyExpensesCard: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const todayDateString = new Date().toISOString().slice(0, 10);

  const fetchDailyExpenses = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_person_daily_expenses')
        .select('id, expense_type, amount')
        .eq('sales_person_id', user.id)
        .eq('expense_date', todayDateString)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries((data || []) as ExpenseEntry[]);
    } catch (error: any) {
      console.error('Error fetching daily expenses:', error?.message || error);
      showError('Unable to load daily expenses.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user, todayDateString]);

  useEffect(() => {
    if (user && !sessionLoading) {
      fetchDailyExpenses();
    }
  }, [user, sessionLoading, fetchDailyExpenses]);

  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-amber-500 dark:bg-amber-700 text-white rounded-t-lg p-1.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1">
            <DollarSign className="h-2.5 w-2.5" /> Daily Expenses
          </CardTitle>
          <Button
            onClick={() => navigate('/daily-expenses-entry')}
            className="h-6 text-[10px] bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1"
          >
            Let Go <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>{loading ? 'Loading...' : `${entries.length} entries today`}</span>
          <span className="font-semibold">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="rounded border border-border bg-slate-50 dark:bg-slate-900 p-3 text-xs text-muted-foreground">
          {loading ? (
            <div className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading expenses...</div>
          ) : entries.length === 0 ? (
            'No expenses recorded for today.'
          ) : (
            `${entries.length} expenses tracked today.`
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyExpensesCard;
