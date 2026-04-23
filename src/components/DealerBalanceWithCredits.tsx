"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Loader2, TrendingDown, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DealerBalanceWithCredits } from '@/types/creditNote';

interface DealerBalanceWithCreditsProps {
  dealerId: string;
  companyId?: string;
}

export default function DealerBalanceWithCredits({
  dealerId,
  companyId,
}: DealerBalanceWithCreditsProps) {
  const [balance, setBalance] = useState<DealerBalanceWithCredits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalance();
  }, [dealerId, companyId]);

  const loadBalance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_dealer_balance_with_credits', {
        p_dealer_id: dealerId,
        p_company_id: companyId || null,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setBalance(data[0]);
      }
    } catch (err) {
      console.error('Error loading dealer balance:', err);
      showError('Failed to load dealer balance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  const isOverdue = balance.net_balance > 0;

  return (
    <div className="space-y-4">
      {/* Main Balance Card */}
      <Card className={isOverdue ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className={`h-5 w-5 ${isOverdue ? 'text-red-600' : 'text-green-600'}`} />
            Dealer Balance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Invoiced</p>
              <p className="text-xl font-bold">₹{balance.total_invoiced.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-xl font-bold text-green-600">
                ₹{balance.total_paid.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Amount</p>
              <p className={`text-xl font-bold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                ₹{(balance.total_invoiced - balance.total_paid).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Balance</p>
              <p className={`text-xl font-bold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                ₹{balance.net_balance.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credit Notes Status</CardTitle>
          <CardDescription>Credit notes available and applied</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-muted-foreground mb-1">Credits Issued</p>
              <p className="text-lg font-bold text-blue-600">
                ₹{balance.credit_notes_issued.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-muted-foreground mb-1">Credits Used</p>
              <p className="text-lg font-bold text-yellow-600">
                ₹{balance.credit_notes_used.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-lg font-bold text-green-600">
                ₹{balance.credit_notes_balance.toFixed(2)}
              </p>
            </div>
          </div>

          {balance.credit_notes_balance > 0 && (
            <Alert className="mt-4 bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Credit Available</AlertTitle>
              <AlertDescription className="text-green-700">
                Dealer has ₹{balance.credit_notes_balance.toFixed(2)} in available credit notes
                that can be applied against future invoices or payments.
              </AlertDescription>
            </Alert>
          )}

          {balance.credit_notes_balance === 0 && balance.credit_notes_issued > 0 && (
            <Alert className="mt-4 bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">All Credits Used</AlertTitle>
              <AlertDescription className="text-blue-700">
                All issued credit notes have been fully applied.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Balance Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Balance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Invoice Due Amount</span>
              <span className="font-semibold">
                ₹{(balance.total_invoiced - balance.total_paid).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Less: Credit Notes Balance</span>
              <span className="font-semibold text-green-600">
                -₹{balance.credit_notes_balance.toFixed(2)}
              </span>
            </div>
            <div className={`flex justify-between items-center py-2 font-bold ${
              isOverdue ? 'text-red-600' : 'text-green-600'
            }`}>
              <span>Net Balance Due</span>
              <span>₹{balance.net_balance.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
